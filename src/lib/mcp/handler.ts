import { getDb } from "@/db";
import { authenticateApiKeyValue, authenticateApiRequest } from "@/lib/api/key-auth";
import type { ApiAuthResult } from "@/lib/api/key-auth-types";
import type { JsonRpcRequest, JsonRpcResponse, McpContext } from "./mcp-types";
import {
	isJsonRpcRequest,
	isNotification,
	JSON_RPC_ERRORS,
	keyFromMcpPath,
	negotiateProtocolVersion,
	rpcError,
	rpcResult,
	toolError,
	toolsForScopes,
	toToolListing,
} from "./mcp-utils";
import { MCP_TOOLS } from "./tools";

const SERVER_INFO = { name: "mailflare", title: "Mailflare", version: "1.0.0" };
const INSTRUCTIONS =
	"Mailflare mail tools. Call list_mailboxes first to find the sending mailbox. For outreach, create drafts with create_draft and only call send_draft or send_email after the user approves the exact message.";
const MAX_BODY_BYTES = 1024 * 1024;

const CORS_HEADERS = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Methods": "POST, OPTIONS",
	"Access-Control-Allow-Headers": "Authorization, Content-Type, Mcp-Protocol-Version, Mcp-Session-Id",
};
const JSON_HEADERS = { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...CORS_HEADERS };

function json(body: unknown, status = 200, extra: Record<string, string> = {}) {
	return new Response(JSON.stringify(body), { status, headers: { ...JSON_HEADERS, ...extra } });
}

async function authenticate(env: CloudflareEnv, request: Request): Promise<ApiAuthResult | null> {
	const header = await authenticateApiRequest(env, request);
	if (header) return header;
	const pathKey = keyFromMcpPath(new URL(request.url).pathname);
	return pathKey ? authenticateApiKeyValue(env, pathKey) : null;
}

async function handleMessage(ctx: McpContext, message: JsonRpcRequest): Promise<JsonRpcResponse | null> {
	const id = message.id ?? null;
	const params = message.params ?? {};
	const notification = isNotification(message);

	switch (message.method) {
		case "initialize":
			return rpcResult(id, {
				protocolVersion: negotiateProtocolVersion(params.protocolVersion),
				capabilities: { tools: { listChanged: false } },
				serverInfo: SERVER_INFO,
				instructions: INSTRUCTIONS,
			});
		case "ping":
			return notification ? null : rpcResult(id, {});
		case "tools/list":
			return rpcResult(id, { tools: toolsForScopes(MCP_TOOLS, ctx.auth.scopes).map(toToolListing) });
		case "tools/call": {
			const name = typeof params.name === "string" ? params.name : "";
			const tool = toolsForScopes(MCP_TOOLS, ctx.auth.scopes).find((entry) => entry.name === name);
			if (!tool) return rpcError(id, JSON_RPC_ERRORS.invalidParams, `Unknown tool: ${name}`);
			const args = params.arguments && typeof params.arguments === "object" ? (params.arguments as Record<string, unknown>) : {};
			try {
				return rpcResult(id, await tool.run(ctx, args));
			} catch (error) {
				return rpcResult(id, toolError(error instanceof Error ? error.message : "Tool failed"));
			}
		}
		default:
			if (notification) return null;
			return rpcError(id, JSON_RPC_ERRORS.methodNotFound, `Method not found: ${message.method}`);
	}
}

/**
 * Stateless MCP server over Streamable HTTP (JSON responses only, no SSE stream).
 * Authenticated by an API key — `Authorization: Bearer <key>`, Basic auth, or the
 * key as the last path segment for clients that cannot set headers. Tools are
 * filtered by the key's `read` and `send` scopes.
 */
export async function handleMcpRequest(request: Request, env: CloudflareEnv): Promise<Response> {
	if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS_HEADERS });
	if (request.method !== "POST") {
		return json({ error: "Method not allowed; this MCP server accepts POST only" }, 405, { Allow: "POST, OPTIONS" });
	}

	const auth = await authenticate(env, request);
	if (!auth) return json({ error: "Unauthorized" }, 401, { "WWW-Authenticate": 'Bearer realm="Mailflare MCP"' });
	if (toolsForScopes(MCP_TOOLS, auth.scopes).length === 0) {
		return json({ error: "This API key needs the read or send scope" }, 403);
	}

	const length = Number(request.headers.get("content-length") ?? 0);
	if (length > MAX_BODY_BYTES) return json(rpcError(null, JSON_RPC_ERRORS.invalidRequest, "Request too large"), 413);
	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return json(rpcError(null, JSON_RPC_ERRORS.parse, "Parse error"), 400);
	}

	const ctx: McpContext = { env, db: getDb(env), auth };
	const batch = Array.isArray(body);
	const entries = batch ? (body as unknown[]) : [body];
	if (entries.length === 0) return json(rpcError(null, JSON_RPC_ERRORS.invalidRequest, "Empty batch"), 400);

	const responses: JsonRpcResponse[] = [];
	for (const entry of entries) {
		if (!isJsonRpcRequest(entry)) {
			responses.push(rpcError(null, JSON_RPC_ERRORS.invalidRequest, "Invalid request"));
			continue;
		}
		const response = await handleMessage(ctx, entry);
		if (response && !isNotification(entry)) responses.push(response);
	}

	if (responses.length === 0) return new Response(null, { status: 202, headers: CORS_HEADERS });
	return json(batch ? responses : responses[0]);
}
