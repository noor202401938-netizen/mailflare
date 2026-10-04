import { getEnv } from "@/lib/cloudflare";
import { handleMcpRequest } from "@/lib/mcp/handler";

/** MCP endpoint authenticated with `Authorization: Bearer <api key>`. */
async function handle(request: Request) {
	return handleMcpRequest(request, getEnv());
}

export const GET = handle;
export const POST = handle;
export const OPTIONS = handle;
export const DELETE = handle;
export const dynamic = "force-dynamic";
