import { getEnv } from "@/lib/cloudflare";
import { handleMcpRequest } from "@/lib/mcp/handler";

/**
 * MCP endpoint with the API key as the last path segment, for clients such as
 * claude.ai custom connectors that cannot send an Authorization header.
 * The handler reads the key from the URL itself.
 */
async function handle(request: Request) {
	return handleMcpRequest(request, getEnv());
}

export const GET = handle;
export const POST = handle;
export const OPTIONS = handle;
export const DELETE = handle;
export const dynamic = "force-dynamic";
