import PostalMime from "postal-mime";

/**
 * The Admin Inbox receiver's other half (founder, 2026-11-17). Cloudflare Email Routing sends admin@ and contracts@
 * here instead of straight to a forwarding address, and this posts each message to the app's
 * /api/public/email/inbound with the shared secret. No MX record changes and every other @camethroughaudio.com
 * address keeps its own rule.
 *
 * A message the app does not accept is thrown, never swallowed: Cloudflare then answers the sending server with a
 * temporary failure and it retries, so a bad deploy or a restart delays a message instead of losing it. A retried
 * delivery ends up as one row, because the receiver dedupes on Message-ID.
 *
 * The files stay with the message (founder, 2026-11-17). Each attachment the sender actually attached is posted to the
 * app's /api/public/email/attachment first, which writes it into the private admin-inbox bucket and answers with the key;
 * the message then names that key beside the file. A mail's attachments share Cloudflare's 25 MiB limit, so a file over
 * the founder's 10 MB cap is recorded by name with the reason rather than quietly dropped.
 */

interface Env {
  /** Full https URL of the app's receiver, e.g. https://<deployed origin>/api/public/email/inbound. */
  INBOX_URL: string;
  /** The same value the app holds as INBOUND_EMAIL_SECRET. Set with `wrangler secret put`, never in a file. */
  INBOUND_EMAIL_SECRET: string;
  /**
   * Optional: an address that still gets a copy, so admin@ keeps reaching Gmail while the inbox fills up. Routing an
   * address here replaces its forward, so leaving this unset would silently end the copies someone reads today.
   */
  FORWARD_TO?: string;
}

/** The receiver's own limits, so an oversized mail is trimmed rather than refused as a 400 and retried forever. */
const MAX_TEXT = 200_000;
const MAX_HTML = 400_000;

/** The founder's per-file cap (2026-11-17), the same number the app enforces. */
const MAX_KEPT_BYTES = 10 * 1024 * 1024;

/** How many files one message may hand over. A 25 MiB mail cannot carry many, so this only bounds a broken one. */
const MAX_UPLOADS = 12;

type ParsedEmail = Awaited<ReturnType<typeof PostalMime.parse>>;

type KeptFile = {
  filename: string;
  mimeType?: string;
  size?: number;
  /** Where the app stored it. Absent when the file could not be kept, and `reason` says why. */
  storagePath?: string;
  kept: boolean;
  reason?: string;
};

/** Which mailbox the route delivered to. Anything else means the Cloudflare route is wrong. */
function mailboxOf(recipient: string): "admin" | "contracts" {
  const local = (recipient.split("@")[0] ?? "").trim().toLowerCase();
  if (local === "admin" || local === "contracts") return local;
  // Thrown rather than filed under admin, where it would be answered from the wrong address and nobody would notice.
  throw new Error(`Routed to ${recipient}, which is not an Admin Inbox mailbox`);
}

function header(headers: Headers, name: string): string | undefined {
  const value = headers.get(name)?.trim();
  return value ? value : undefined;
}

function clipped(value: string | undefined, limit: number): string | undefined {
  if (!value) return undefined;
  return value.length > limit ? value.slice(0, limit) : value;
}

/** The Date the mail was written, so a retry keeps its place in the thread; unreadable means now. */
function receivedAt(headers: Headers): string {
  const when = Date.parse(headers.get("date") ?? "");
  return Number.isNaN(when) ? new Date().toISOString() : new Date(when).toISOString();
}

function addressesOf(list: ParsedEmail["to"] | undefined): string[] {
  if (!list) return [];
  return list
    .map((entry) => entry.address?.trim().toLowerCase() ?? "")
    .filter((entry) => entry.includes("@"));
}

/** postal-mime hands attachment content back as text or bytes, depending on how the mail encoded it. */
function bytesOf(content: unknown): Uint8Array | undefined {
  if (typeof content === "string") return new TextEncoder().encode(content);
  if (content instanceof Uint8Array) return content;
  if (content instanceof ArrayBuffer) return new Uint8Array(content);
  return undefined;
}

/**
 * Where the app keeps a mail's files: the receiver's URL with its last step changed. Kept in step with the app's own
 * route, so a deployment needs no second setting, and a URL that doesn't look like the receiver keeps only the names.
 */
function attachmentUrl(inboxUrl: string): string | null {
  return /\/inbound\/?$/i.test(inboxUrl) ? inboxUrl.replace(/\/inbound\/?$/i, "/attachment") : null;
}

/** A stable folder for this mail: its Message-ID, or the seam that identifies it when the header is missing. */
function messageKeyOf(message: ForwardableEmailMessage, subject: string, at: string): string {
  return header(message.headers, "message-id") ?? `${message.from}-${at}-${subject}`;
}

/**
 * What arrived attached, with each file kept where it can be. A picture a signature draws inline is part of the message,
 * not something the sender attached, so those are left out and the list means what staff would see in their own client.
 */
async function attachmentsOf(
  list: ParsedEmail["attachments"] | undefined,
  keep: (file: {
    index: number;
    filename: string;
    mimeType?: string;
    bytes: Uint8Array;
  }) => Promise<KeptFile>,
): Promise<KeptFile[]> {
  if (!list) return [];
  const files = list.filter((one) => one.disposition !== "inline").slice(0, 50);
  const out: KeptFile[] = [];
  for (const [index, one] of files.entries()) {
    const filename = (one.filename ?? "").trim() || "Attachment";
    const mimeType = one.mimeType || undefined;
    const bytes = bytesOf(one.content);
    const size = bytes?.byteLength;
    if (!bytes || !size) {
      out.push({ filename, mimeType, kept: false, reason: "the file didn't come through intact" });
      continue;
    }
    if (size > MAX_KEPT_BYTES) {
      out.push({ filename, mimeType, size, kept: false, reason: "over 10 MB" });
      continue;
    }
    out.push(await keep({ index, filename, mimeType, bytes }));
  }
  return out;
}

export default {
  async email(message: ForwardableEmailMessage, env: Env): Promise<void> {
    if (!env.INBOUND_EMAIL_SECRET) {
      console.error("Admin inbox: INBOUND_EMAIL_SECRET is not set, so nothing can be stored.");
      throw new Error("INBOUND_EMAIL_SECRET is not set");
    }
    const url = env.INBOX_URL?.trim() ?? "";
    if (!/^https:\/\//i.test(url)) {
      console.error("Admin inbox: INBOX_URL must be the deployed https receiver URL.");
      throw new Error("INBOX_URL is not configured");
    }

    const mailbox = mailboxOf(message.to);

    // A message too broken to parse is still worth seeing, so it goes on with its headers and no body.
    let parsed: ParsedEmail | null = null;
    try {
      parsed = await PostalMime.parse(message.raw);
    } catch (error) {
      console.error("Admin inbox: the mail could not be parsed, storing its headers only.", error);
    }

    const recipients = [
      ...new Set([message.to, ...addressesOf(parsed?.to)].map((one) => one.trim().toLowerCase())),
    ].filter((one) => one.includes("@"));

    const subject = parsed?.subject?.trim() || header(message.headers, "subject") || "";
    const at = receivedAt(message.headers);
    const messageKey = messageKeyOf(message, subject, at);
    const filesUrl = attachmentUrl(url);
    if (!filesUrl && parsed?.attachments?.length) {
      console.error(
        "Admin inbox: INBOX_URL does not end in /inbound, so files can only be listed.",
      );
    }

    let attempted = 0;
    const attachments = await attachmentsOf(parsed?.attachments, async (file) => {
      const base = {
        filename: file.filename,
        ...(file.mimeType ? { mimeType: file.mimeType } : {}),
      };
      if (!filesUrl) {
        return {
          ...base,
          size: file.bytes.byteLength,
          kept: false,
          reason: "file storage is not configured",
        };
      }
      if (attempted >= MAX_UPLOADS) {
        return {
          ...base,
          size: file.bytes.byteLength,
          kept: false,
          reason: "too many files in one message",
        };
      }
      attempted += 1;
      try {
        const response = await fetch(filesUrl, {
          method: "POST",
          headers: {
            "content-type": file.mimeType ?? "application/octet-stream",
            "x-worker-secret": env.INBOUND_EMAIL_SECRET,
            "x-mailbox": mailbox,
            "x-message-key": encodeURIComponent(messageKey),
            "x-index": String(file.index),
            "x-filename": encodeURIComponent(file.filename),
          },
          body: file.bytes,
        });
        if (!response.ok) {
          const detail = await response.text().catch(() => "");
          console.error(
            `Admin inbox: ${file.filename} was not kept (${response.status}): ${detail.slice(0, 300)}`,
          );
          return {
            ...base,
            size: file.bytes.byteLength,
            kept: false,
            reason: "it could not be stored",
          };
        }
        const answer = (await response.json().catch(() => null)) as { path?: unknown } | null;
        if (typeof answer?.path !== "string" || !answer.path) {
          return {
            ...base,
            size: file.bytes.byteLength,
            kept: false,
            reason: "it could not be stored",
          };
        }
        return {
          ...base,
          size: file.bytes.byteLength,
          kept: true,
          storagePath: answer.path,
        };
      } catch (error) {
        // The message itself must still arrive: a file that failed is named with the reason, not lost silently.
        console.error(`Admin inbox: ${file.filename} could not be uploaded.`, error);
        return {
          ...base,
          size: file.bytes.byteLength,
          kept: false,
          reason: "it could not be stored",
        };
      }
    });

    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", "x-worker-secret": env.INBOUND_EMAIL_SECRET },
      body: JSON.stringify({
        mailbox,
        from: message.from,
        fromName: parsed?.from?.name?.trim() || undefined,
        to: recipients,
        subject,
        text: clipped(parsed?.text, MAX_TEXT),
        html: clipped(parsed?.html ?? undefined, MAX_HTML),
        attachments,
        // A reply is matched to its thread on these three, so they travel exactly as the mail carries them.
        messageId: header(message.headers, "message-id"),
        inReplyTo: header(message.headers, "in-reply-to"),
        references: header(message.headers, "references"),
        receivedAt: at,
      }),
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.error(
        `Admin inbox: the receiver answered ${response.status}: ${detail.slice(0, 500) || "(no body)"}`,
      );
      throw new Error(`Inbound email was not stored (${response.status})`);
    }

    // Storing came first and is what must succeed; a mailbox having a bad day must not undo it.
    if (env.FORWARD_TO) {
      try {
        await message.forward(env.FORWARD_TO);
      } catch (error) {
        console.error(`Admin inbox: stored, but the copy to ${env.FORWARD_TO} failed.`, error);
      }
    }
  },
};
