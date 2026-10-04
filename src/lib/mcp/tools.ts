import { and, desc, eq, inArray } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { messages } from "@/db/schema";
import { newId } from "@/lib/ids";
import { buildSnippet } from "@/lib/email/parse";
import { htmlToReadableText } from "@/lib/email/reply-content-utils";
import { sendEmail } from "@/lib/email/send";
import { getAuthorizedSenderAddress } from "@/lib/email/sender";
import { listMessageAttachments, loadMessageAttachmentContents } from "@/lib/email/attachments";
import { deleteMessageWithObjects } from "@/lib/email/message-cleanup";
import { getMailboxAccessLevel, hasMailboxPermission, listAccessibleMailboxes } from "@/lib/mailboxes/access";
import { buildSearchConditions } from "@/lib/search/conditions";
import type { McpContext, McpToolDefinition } from "./mcp-types";
import { clampLimit, readRecipients, readString, toolError, toolOk, truncate } from "./mcp-utils";

const MESSAGE_STATUSES = ["received", "sent", "draft", "spam", "trash", "archived"] as const;
const MAX_BODY_CHARS = 20_000;

type MessageRow = typeof messages.$inferSelect;

function summarize(row: MessageRow) {
	return {
		id: row.id,
		mailboxId: row.mailboxId,
		direction: row.direction,
		status: row.status,
		from: row.fromAddr,
		to: row.toAddr,
		cc: row.ccAddr,
		subject: row.subject,
		snippet: row.snippet,
		date: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
		read: row.read,
		starred: row.starred,
		threadId: row.threadId,
	};
}

async function listMailboxesWithAddresses(ctx: McpContext) {
	const rows = await listAccessibleMailboxes(ctx.db, ctx.auth.user);
	return rows.map((row) => ({
		id: row.id,
		address: `${row.localPart}@${row.hostname}`,
		displayName: row.displayName,
		type: row.type,
		permission: row.permission,
		canSend: hasMailboxPermission(row.permission, "send_on_behalf"),
		isPrimary: row.isPrimary,
	}));
}

/**
 * Pick the sending mailbox from `mailboxId`, else from the `from` address, else the
 * only sendable mailbox, then let the normal sender check authorize and format it.
 */
async function resolveSender(ctx: McpContext, args: Record<string, unknown>) {
	const mailboxes = (await listMailboxesWithAddresses(ctx)).filter((mailbox) => mailbox.canSend);
	const mailboxId = readString(args, "mailboxId");
	const from = readString(args, "from");
	let mailbox = mailboxId ? mailboxes.find((entry) => entry.id === mailboxId) : undefined;
	if (!mailbox && !mailboxId && from) {
		const address = from.replace(/^.*<([^>]+)>.*$/, "$1").trim().toLowerCase();
		mailbox = mailboxes.find((entry) => entry.address.toLowerCase() === address);
	}
	if (!mailbox && !mailboxId && !from && mailboxes.length === 1) mailbox = mailboxes[0];
	if (!mailbox) {
		const options = mailboxes.map((entry) => `${entry.address} (${entry.id})`).join(", ") || "none";
		throw new Error(`Choose a sending mailbox with mailboxId or from. Mailboxes this key can send from: ${options}`);
	}
	return getAuthorizedSenderAddress(ctx.env, {
		userId: ctx.auth.userId,
		from: from ?? mailbox.address,
		mailboxId: mailbox.id,
	});
}

function readBody(args: Record<string, unknown>) {
	const text = readString(args, "text");
	const html = readString(args, "html");
	if (!text && !html) throw new Error("Provide a body in text or html");
	return { text: text ?? null, html: html ?? null };
}

/** Threading fields for a reply to a stored message the key can read. */
async function replyHeaders(ctx: McpContext, messageId: string | undefined) {
	if (!messageId) return { inReplyTo: null, references: null, threadId: null };
	const parent = await loadReadableMessage(ctx, messageId);
	if (!parent) throw new Error("replyToMessageId not found");
	const parentId = parent.providerMessageId;
	const chain = [parent.references, parentId].filter(Boolean).join(" ").trim();
	return { inReplyTo: parentId ?? null, references: chain || null, threadId: parent.threadId ?? null };
}

async function loadReadableMessage(ctx: McpContext, id: string): Promise<MessageRow | null> {
	const [row] = await ctx.db.select().from(messages).where(eq(messages.id, id)).limit(1);
	if (!row) return null;
	if (row.mailboxId) {
		const access = await getMailboxAccessLevel(ctx.db, ctx.auth.user, row.mailboxId);
		return access?.canRead ? row : null;
	}
	return row.userId === ctx.auth.userId ? row : null;
}

async function loadOwnDraft(ctx: McpContext, id: string): Promise<MessageRow | null> {
	const [row] = await ctx.db.select().from(messages).where(eq(messages.id, id)).limit(1);
	return row && row.userId === ctx.auth.userId && row.status === "draft" ? row : null;
}

const recipientSchema = {
	oneOf: [{ type: "string" }, { type: "array", items: { type: "string" } }],
	description: "Comma-separated header string or array; entries may include a display name.",
};

const composeProperties = {
	mailboxId: { type: "string", description: "Sending mailbox id from list_mailboxes. Optional when `from` or a single mailbox identifies it." },
	from: { type: "string", description: "Sender address; defaults to the mailbox address." },
	to: recipientSchema,
	cc: recipientSchema,
	bcc: recipientSchema,
	subject: { type: "string" },
	text: { type: "string", description: "Plain-text body." },
	html: { type: "string", description: "Optional HTML body." },
	replyToMessageId: { type: "string", description: "Mailflare message id this replies to; sets threading headers." },
};

export const MCP_TOOLS: McpToolDefinition[] = [
	{
		name: "list_mailboxes",
		description: "List the mailboxes this API key can read or send from, with their ids and addresses.",
		scope: "read",
		inputSchema: { type: "object", properties: {}, additionalProperties: false },
		annotations: { title: "List mailboxes", readOnlyHint: true, openWorldHint: false },
		async run(ctx) {
			return toolOk({ mailboxes: await listMailboxesWithAddresses(ctx) });
		},
	},
	{
		name: "search_messages",
		description:
			"Search or list messages, newest first. `query` uses the Gmail-style search grammar (from:, to:, subject:, plain words). Returns summaries without bodies; use get_message for the full text.",
		scope: "read",
		inputSchema: {
			type: "object",
			properties: {
				query: { type: "string" },
				mailboxId: { type: "string" },
				status: { type: "string", enum: [...MESSAGE_STATUSES], description: "received = inbox." },
				direction: { type: "string", enum: ["inbound", "outbound"] },
				limit: { type: "integer", minimum: 1, maximum: 50, default: 20 },
			},
			additionalProperties: false,
		},
		annotations: { title: "Search messages", readOnlyHint: true, openWorldHint: false },
		async run(ctx, args) {
			const conditions: SQL[] = [];
			const mailboxId = readString(args, "mailboxId");
			if (mailboxId) {
				const access = await getMailboxAccessLevel(ctx.db, ctx.auth.user, mailboxId);
				if (!access?.canRead) return toolError("Mailbox not found");
				conditions.push(eq(messages.mailboxId, mailboxId));
			} else {
				const ids = (await listAccessibleMailboxes(ctx.db, ctx.auth.user)).map((row) => row.id);
				conditions.push(ids.length > 0 ? inArray(messages.mailboxId, ids) : eq(messages.userId, ctx.auth.userId));
			}
			const status = readString(args, "status");
			if (status) {
				if (!(MESSAGE_STATUSES as readonly string[]).includes(status)) return toolError(`Unknown status: ${status}`);
				conditions.push(eq(messages.status, status));
			}
			const direction = readString(args, "direction");
			if (direction === "inbound" || direction === "outbound") conditions.push(eq(messages.direction, direction));
			const query = readString(args, "query");
			if (query) conditions.push(...buildSearchConditions(query));

			const rows = await ctx.db
				.select()
				.from(messages)
				.where(and(...conditions))
				.orderBy(desc(messages.createdAt))
				.limit(clampLimit(args.limit, 20, 50));
			return toolOk({ count: rows.length, messages: rows.map(summarize) });
		},
	},
	{
		name: "get_message",
		description: "Read one message in full: headers, plain-text body and attachment names.",
		scope: "read",
		inputSchema: { type: "object", properties: { id: { type: "string" } }, required: ["id"], additionalProperties: false },
		annotations: { title: "Read message", readOnlyHint: true, openWorldHint: false },
		async run(ctx, args) {
			const id = readString(args, "id");
			if (!id) return toolError("id is required");
			const row = await loadReadableMessage(ctx, id);
			if (!row) return toolError("Message not found");
			const body = truncate(row.textBody?.trim() || htmlToReadableText(row.htmlBody), MAX_BODY_CHARS);
			const attachments = await listMessageAttachments(ctx.env, row.id);
			return toolOk({
				...summarize(row),
				bcc: row.bccAddr,
				messageIdHeader: row.providerMessageId,
				inReplyTo: row.inReplyTo,
				references: row.references,
				body: body.text,
				bodyTruncated: body.truncated,
				attachments: attachments.map((entry) => ({ filename: entry.filename, type: entry.type, size: entry.size })),
			});
		},
	},
	{
		name: "list_drafts",
		description: "List your drafts, newest first.",
		scope: "read",
		inputSchema: {
			type: "object",
			properties: { mailboxId: { type: "string" }, limit: { type: "integer", minimum: 1, maximum: 100, default: 50 } },
			additionalProperties: false,
		},
		annotations: { title: "List drafts", readOnlyHint: true, openWorldHint: false },
		async run(ctx, args) {
			const conditions = [eq(messages.userId, ctx.auth.userId), eq(messages.direction, "outbound" as const), eq(messages.status, "draft")];
			const mailboxId = readString(args, "mailboxId");
			if (mailboxId) conditions.push(eq(messages.mailboxId, mailboxId));
			const rows = await ctx.db
				.select()
				.from(messages)
				.where(and(...conditions))
				.orderBy(desc(messages.createdAt))
				.limit(clampLimit(args.limit, 50, 100));
			return toolOk({ count: rows.length, drafts: rows.map(summarize) });
		},
	},
	{
		name: "create_draft",
		description:
			"Save an email as a draft in Mailflare without sending it. The draft appears in the Drafts folder for review; send it with send_draft or from the Mailflare UI. Prefer this over send_email for outreach.",
		scope: "send",
		inputSchema: { type: "object", properties: composeProperties, required: ["to", "subject"], additionalProperties: false },
		annotations: { title: "Create draft", readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
		async run(ctx, args) {
			const to = readRecipients(args, "to");
			const subject = readString(args, "subject");
			if (!to || !subject) return toolError("to and subject are required");
			const { text, html } = readBody(args);
			const sender = await resolveSender(ctx, args);
			const threading = await replyHeaders(ctx, readString(args, "replyToMessageId"));
			const id = newId("msg");
			await ctx.db.insert(messages).values({
				id,
				userId: ctx.auth.userId,
				mailboxId: sender.mailboxId,
				direction: "outbound",
				fromAddr: sender.fromAddr,
				toAddr: to,
				ccAddr: readRecipients(args, "cc") ?? null,
				bccAddr: readRecipients(args, "bcc") ?? null,
				subject,
				snippet: buildSnippet(text, html),
				textBody: text,
				htmlBody: html,
				status: "draft",
				read: true,
				...threading,
			});
			return toolOk({ draftId: id, from: sender.fromAddr, to, subject, status: "draft" });
		},
	},
	{
		name: "delete_draft",
		description: "Permanently delete one of your drafts.",
		scope: "send",
		inputSchema: { type: "object", properties: { id: { type: "string" } }, required: ["id"], additionalProperties: false },
		annotations: { title: "Delete draft", readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
		async run(ctx, args) {
			const id = readString(args, "id");
			const draft = id ? await loadOwnDraft(ctx, id) : null;
			if (!draft) return toolError("Draft not found");
			await deleteMessageWithObjects(ctx.env, ctx.db, draft.id, draft.rawR2Key);
			return toolOk({ deleted: draft.id });
		},
	},
	{
		name: "send_draft",
		description:
			"Send an existing draft exactly as stored, including its attachments, then remove it from Drafts. This delivers real email to external recipients.",
		scope: "send",
		inputSchema: { type: "object", properties: { id: { type: "string" } }, required: ["id"], additionalProperties: false },
		annotations: { title: "Send draft", readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
		async run(ctx, args) {
			const id = readString(args, "id");
			const draft = id ? await loadOwnDraft(ctx, id) : null;
			if (!draft) return toolError("Draft not found");
			if (!draft.mailboxId) return toolError("Draft has no sending mailbox");
			if (!draft.toAddr.trim()) return toolError("Draft has no recipients");
			if (!draft.subject?.trim()) return toolError("Draft has no subject");
			const attachments = await loadMessageAttachmentContents(ctx.env, draft.id);
			const result = await sendEmail(ctx.env, {
				userId: ctx.auth.userId,
				mailboxId: draft.mailboxId,
				from: draft.fromAddr,
				to: draft.toAddr,
				cc: draft.ccAddr ?? undefined,
				bcc: draft.bccAddr ?? undefined,
				subject: draft.subject,
				text: draft.textBody ?? undefined,
				html: draft.htmlBody ?? undefined,
				inReplyTo: draft.inReplyTo,
				references: draft.references,
				threadId: draft.threadId,
				attachments,
			});
			// Same as the composer: the sent copy is a new message, so the draft goes.
			await deleteMessageWithObjects(ctx.env, ctx.db, draft.id, draft.rawR2Key);
			return toolOk({ sent: true, messageId: result.messageId, scheduled: !!result.scheduled, to: draft.toAddr, subject: draft.subject });
		},
	},
	{
		name: "send_email",
		description:
			"Compose and send an email immediately, without a draft. This delivers real email to external recipients; for anything a person should review first, use create_draft instead.",
		scope: "send",
		inputSchema: { type: "object", properties: composeProperties, required: ["to", "subject"], additionalProperties: false },
		annotations: { title: "Send email", readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
		async run(ctx, args) {
			const to = readRecipients(args, "to");
			const subject = readString(args, "subject");
			if (!to || !subject) return toolError("to and subject are required");
			const { text, html } = readBody(args);
			const sender = await resolveSender(ctx, args);
			const threading = await replyHeaders(ctx, readString(args, "replyToMessageId"));
			const result = await sendEmail(ctx.env, {
				userId: ctx.auth.userId,
				mailboxId: sender.mailboxId,
				from: sender.fromAddr,
				to,
				cc: readRecipients(args, "cc"),
				bcc: readRecipients(args, "bcc"),
				subject,
				text: text ?? undefined,
				html: html ?? undefined,
				...threading,
			});
			return toolOk({ sent: true, messageId: result.messageId, scheduled: !!result.scheduled, to, subject });
		},
	},
];
