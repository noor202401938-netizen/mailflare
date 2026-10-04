import type { AppDatabase } from "@/db";
import type { ApiAuthResult } from "@/lib/api/key-auth-types";
import type { ApiKeyScope } from "@/lib/api/scopes";

export type JsonRpcId = string | number | null;

export type JsonRpcRequest = {
	jsonrpc: "2.0";
	id?: JsonRpcId;
	method: string;
	params?: Record<string, unknown>;
};

export type JsonRpcResponse =
	| { jsonrpc: "2.0"; id: JsonRpcId; result: unknown }
	| { jsonrpc: "2.0"; id: JsonRpcId; error: { code: number; message: string; data?: unknown } };

export type McpContent = { type: "text"; text: string };

export type McpToolResult = {
	content: McpContent[];
	structuredContent?: Record<string, unknown>;
	isError?: boolean;
};

export type McpContext = {
	env: CloudflareEnv;
	db: AppDatabase;
	auth: ApiAuthResult;
};

export type McpToolAnnotations = {
	title?: string;
	readOnlyHint?: boolean;
	destructiveHint?: boolean;
	idempotentHint?: boolean;
	openWorldHint?: boolean;
};

export type McpToolDefinition = {
	name: string;
	description: string;
	/** API key scope the tool needs; tools the key lacks are hidden from tools/list. */
	scope: ApiKeyScope;
	inputSchema: Record<string, unknown>;
	annotations: McpToolAnnotations;
	run: (ctx: McpContext, args: Record<string, unknown>) => Promise<McpToolResult>;
};

/** The listing shape MCP clients receive: a tool definition minus server-side fields. */
export type McpToolListing = Pick<McpToolDefinition, "name" | "description" | "inputSchema" | "annotations"> & {
	title?: string;
};
