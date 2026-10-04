import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test, { after } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

import { build } from "esbuild";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

/** The MCP helpers are pure, so they are bundled alone; nothing here needs a Workers binding. */
const outDir = mkdtempSync(join(tmpdir(), "mailflare-mcp-test-"));
after(() => rmSync(outDir, { recursive: true, force: true }));

await build({
	entryPoints: [join(root, "src/lib/mcp/mcp-utils.ts")],
	outfile: join(outDir, "entry.mjs"),
	bundle: true,
	platform: "node",
	format: "esm",
	target: "node22",
	tsconfig: join(root, "tsconfig.json"),
	logLevel: "silent",
});

const utils = await import(pathToFileURL(join(outDir, "entry.mjs")).href);

test("protocol version echoes a supported request and falls back to the newest", () => {
	assert.equal(utils.negotiateProtocolVersion("2025-03-26"), "2025-03-26");
	assert.equal(utils.negotiateProtocolVersion("1999-01-01"), utils.MCP_PROTOCOL_VERSIONS[0]);
	assert.equal(utils.negotiateProtocolVersion(undefined), utils.MCP_PROTOCOL_VERSIONS[0]);
});

test("requests without an id are notifications", () => {
	assert.equal(utils.isNotification({ jsonrpc: "2.0", method: "notifications/initialized" }), true);
	assert.equal(utils.isNotification({ jsonrpc: "2.0", id: 0, method: "ping" }), false);
	assert.equal(utils.isJsonRpcRequest({ jsonrpc: "2.0", method: "ping" }), true);
	assert.equal(utils.isJsonRpcRequest({ method: "ping" }), false);
});

test("tools are filtered by API key scope", () => {
	const tools = [
		{ name: "a", scope: "read" },
		{ name: "b", scope: "send" },
	];
	assert.deepEqual(utils.toolsForScopes(tools, ["read"]).map((t) => t.name), ["a"]);
	assert.deepEqual(utils.toolsForScopes(tools, ["send", "read"]).map((t) => t.name), ["a", "b"]);
	assert.deepEqual(utils.toolsForScopes(tools, ["*"]).map((t) => t.name), ["a", "b"]);
	assert.deepEqual(utils.toolsForScopes(tools, ["jmap"]), []);
});

test("the API key is read from the last path segment only", () => {
	assert.equal(utils.keyFromMcpPath("/api/mcp/mf_abc123"), "mf_abc123");
	assert.equal(utils.keyFromMcpPath("/api/mcp/mf_abc123/"), "mf_abc123");
	assert.equal(utils.keyFromMcpPath("/api/mcp"), null);
	assert.equal(utils.keyFromMcpPath("/api/mcp/a/b"), null);
	assert.equal(utils.keyFromMcpPath("/api/mcp/%E0%A4%A"), null);
});

test("recipients accept arrays or header strings", () => {
	assert.equal(utils.readRecipients({ to: ["a@x.com", " ", "b@y.com"] }, "to"), "a@x.com, b@y.com");
	assert.equal(utils.readRecipients({ to: " a@x.com " }, "to"), "a@x.com");
	assert.equal(utils.readRecipients({ to: [] }, "to"), undefined);
});

test("limits are clamped and tool errors are flagged", () => {
	assert.equal(utils.clampLimit(500, 20, 50), 50);
	assert.equal(utils.clampLimit("abc", 20, 50), 20);
	assert.equal(utils.clampLimit(0, 20, 50), 20);
	assert.equal(utils.toolError("nope").isError, true);
	assert.deepEqual(utils.toolOk({ a: 1 }).structuredContent, { a: 1 });
	assert.equal(utils.truncate("abcdef", 3).truncated, true);
});
