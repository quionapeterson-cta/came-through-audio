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
 * The body is JSON rather than the raw mail so the receiver's schema validates what it stores. Attachment bytes stay
 * here — the inbox is a record of the conversation, not a file store — but each attachment's name, type and size
 * travel with the message, so a thread never reads like a plain email when something arrived with it.
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

type ParsedEmail = Awaited<ReturnType<typeof PostalMime.parse>>;

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
function sizeOf(content: unknown): number | undefined {
  if (typeof content === "string") return new TextEncoder().encode(content).byteLength;
  if (content instanceof Uint8Array || content instanceof ArrayBuffer) return content.byteLength;
  return undefined;
}

/**
 * What arrived attached, by name only. A picture a signature draws inline is part of the message, not something the
 * sender attached, so those are left out and the list means what staff would see in their own mail client.
 */
function attachmentsOf(list: ParsedEmail["attachments"] | undefined) {
  if (!list) return [];
  return list
    .filter((one) => one.disposition !== "inline")
    .slice(0, 50)
    .map((one) => ({
      filename: (one.filename ?? "").trim() || "Attachment",
      mimeType: one.mimeType || undefined,
      size: sizeOf(one.content),
    }));
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

    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", "x-worker-secret": env.INBOUND_EMAIL_SECRET },
      body: JSON.stringify({
        mailbox,
        from: message.from,
        fromName: parsed?.from?.name?.trim() || undefined,
        to: recipients,
        subject: parsed?.subject?.trim() || header(message.headers, "subject") || "",
        text: clipped(parsed?.text, MAX_TEXT),
        html: clipped(parsed?.html ?? undefined, MAX_HTML),
        attachments: attachmentsOf(parsed?.attachments),
        // A reply is matched to its thread on these three, so they travel exactly as the mail carries them.
        messageId: header(message.headers, "message-id"),
        inReplyTo: header(message.headers, "in-reply-to"),
        references: header(message.headers, "references"),
        receivedAt: receivedAt(message.headers),
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
