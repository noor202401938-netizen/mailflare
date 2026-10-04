import type { JsonRpcId, JsonRpcRequest, JsonRpcResponse, McpToolDefinition, McpToolListing, McpToolResult } from "./mcp-types";

/** Newest first. The server answers with the client's version when it is listed, else the newest. */
export const MCP_PROTOCOL_VERSIONS = ["2025-06-18", "2025-03-26", "2024-11-05"] as const;

export const JSON_RPC_ERRORS = {
	parse: -32700,
	invalidRequest: -32600,
	methodNotFound: -32601,
	invalidParams: -32602,
	internal: -32603,
} as const;

export function negotiateProtocolVersion(requested: unknown): string {
	return typeof requested === "string" && (MCP_PROTOCOL_VERSIONS as readonly string[]).includes(requested)
		? requested
		: MCP_PROTOCOL_VERSIONS[0];
}

export function isJsonRpcRequest(value: unknown): value is JsonRpcRequest {
	if (!value || typeof value !== "object") return false;
	const message = value as Record<string, unknown>;
	return message.jsonrpc === "2.0" && typeof message.method === "string";
}

/** A request without an `id` is a notification and must not be answered. */
export function isNotification(message: JsonRpcRequest): boolean {
	return !("id" in message) || message.id === undefined;
}

export function rpcResult(id: JsonRpcId, result: unknown): JsonRpcResponse {
	return { jsonrpc: "2.0", id, result };
}

export function rpcError(id: JsonRpcId, code: number, message: string, data?: unknown): JsonRpcResponse {
	return { jsonrpc: "2.0", id, error: data === undefined ? { code, message } : { code, message, data } };
}

export function toolOk(data: Record<string, unknown>): McpToolResult {
	return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }], structuredContent: data };
}

/** Tool failures are results with `isError`, so the model sees the reason and can recover. */
export function toolError(message: string): McpToolResult {
	return { content: [{ type: "text", text: message }], isError: true };
}

export function toolsForScopes(tools: McpToolDefinition[], scopes: string[]): McpToolDefinition[] {
	const all = scopes.includes("*");
	return tools.filter((tool) => all || scopes.includes(tool.scope));
}

export function toToolListing(tool: McpToolDefinition): McpToolListing {
	return {
		name: tool.name,
		title: tool.annotations.title,
		description: tool.description,
		inputSchema: tool.inputSchema,
		annotations: tool.annotations,
	};
}

export function readString(args: Record<string, unknown>, key: string): string | undefined {
	const value = args[key];
	if (typeof value !== "string") return undefined;
	const trimmed = value.trim();
	return trimmed ? trimmed : undefined;
}

/** Accepts a comma-separated header string or an array of addresses. */
export function readRecipients(args: Record<string, unknown>, key: string): string | undefined {
	const value = args[key];
	if (Array.isArray(value)) {
		const list = value.filter((entry): entry is string => typeof entry === "string" && entry.trim() !== "").map((entry) => entry.trim());
		return list.length > 0 ? list.join(", ") : undefined;
	}
	return readString(args, key);
}

export function clampLimit(value: unknown, fallback: number, max: number): number {
	const parsed = typeof value === "number" ? value : Number(value);
	if (!Number.isFinite(parsed) || parsed < 1) return fallback;
	return Math.min(Math.floor(parsed), max);
}

export function truncate(text: string, max: number): { text: string; truncated: boolean } {
	return text.length > max ? { text: `${text.slice(0, max)}\n…[truncated]`, truncated: true } : { text, truncated: false };
}

/**
 * Pull the API key out of `/api/mcp/<key>`. Some MCP clients (claude.ai custom
 * connectors) cannot send an Authorization header, so the key may ride in the path.
 */
export function keyFromMcpPath(pathname: string): string | null {
	const match = /^\/api\/mcp\/([^/]+)\/?$/.exec(pathname);
	if (!match) return null;
	try {
		const key = decodeURIComponent(match[1]).trim();
		return key || null;
	} catch {
		return null;
	}
}
