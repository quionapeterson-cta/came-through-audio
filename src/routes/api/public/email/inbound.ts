import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

/**
 * The Admin Inbox receiver (founder, 2026-11-17): a Cloudflare Email Worker on the admin@ and contracts@ routes posts
 * one message here, and it is stored as a thread we can read and answer in Admin. Every other @camethroughaudio.com
 * address keeps Cloudflare's Email Routing, so no existing mailbox changes.
 *
 * The body is the worker's own shape, not a Resend event: the shared secret in x-worker-secret is the only thing that
 * lets a call in. A delivery the worker retries is one row, and a reply joins the thread it names.
 */

let _sb: ReturnType<typeof createClient> | null;
function db() {
  if (!_sb)
    _sb = createClient(process.env["SUPABASE_URL"]!, process.env["SUPABASE_SERVICE_ROLE_KEY"]!);
  return _sb;
}

const INBOX_MAILBOXES = ["admin", "contracts"] as const;
type InboxMailbox = (typeof INBOX_MAILBOXES)[number];

const payloadSchema = z.object({
  /** Optional: when it is left out the mailbox is read from the recipient address. */
  mailbox: z.enum(["admin", "contracts"]).optional(),
  from: z.string().trim().min(3).max(320),
  fromName: z.string().trim().max(200).optional(),
  to: z.union([z.string(), z.array(z.string())]).optional(),
  cc: z.union([z.string(), z.array(z.string())]).optional(),
  subject: z.string().max(1000).default(""),
  text: z.string().max(200_000).optional(),
  html: z.string().max(400_000).optional(),
  messageId: z.string().trim().max(500).optional(),
  inReplyTo: z.string().trim().max(500).optional(),
  references: z.union([z.string().max(4000), z.array(z.string().max(500)).max(50)]).optional(),
  /** ISO time the message arrived, as the worker saw it; a missing or unreadable value means now. */
  receivedAt: z.string().trim().max(40).optional(),
});

/** Compares the worker's header with the secret without leaking where the first difference is. */
function sameSecret(given: string | null, expected: string): boolean {
  const a = new TextEncoder().encode(given ?? "");
  const b = new TextEncoder().encode(expected);
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i += 1) difference |= a[i]! ^ b[i]!;
  return difference === 0;
}

/** `"Qui-Ona Peterson" <admin@camethroughaudio.com>` → the address and the name it was sent with. */
function parseAddress(value: string): { email: string; name: string | null } {
  const angle = /<([^>]+)>/.exec(value);
  const email = (angle ? angle[1]! : value).trim().toLowerCase();
  const name = angle
    ? value
        .slice(0, angle.index)
        .trim()
        .replace(/^["']|["']$/g, "")
    : "";
  return { email, name: name || null };
}

function addressList(value: string | string[] | undefined): string[] {
  const list = value === undefined ? [] : Array.isArray(value) ? value : [value];
  return list
    .map((entry) => parseAddress(entry).email)
    .filter((entry) => entry.includes("@"))
    .slice(0, 50);
}

function mailboxFor(given: InboxMailbox | undefined, recipients: string[]): InboxMailbox {
  if (given) return given;
  for (const address of recipients) {
    const local = address.split("@")[0] ?? "";
    if (local === "contracts") return "contracts";
    if (local === "admin") return "admin";
  }
  return "admin";
}

/** The mail's own id without its angle brackets: what a later reply names in In-Reply-To / References. */
function cleanId(value: string | undefined): string | null {
  const trimmed = (value ?? "").trim().replace(/^</, "").replace(/>$/, "").trim();
  return trimmed ? trimmed.slice(0, 500) : null;
}

/**
 * The subject a thread is matched on: Re:/Fwd: stripped (however many are stacked), spaces collapsed, case folded.
 * A reply keeps the subject, so this is what joins it to its conversation when References are missing.
 */
function threadSubjectKey(subject: string): string {
  return subject
    .replace(/^\s*((re|fw|fwd)\s*:\s*)+/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .slice(0, 200);
}

function isoOrNow(value: string | undefined): string {
  if (value) {
    const at = Date.parse(value);
    if (!Number.isNaN(at)) return new Date(at).toISOString();
  }
  return new Date().toISOString();
}

export const Route = createFileRoute("/api/public/email/inbound")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["INBOUND_EMAIL_SECRET"];
        if (!secret) {
          // Nothing can be verified, so nothing is stored: better a visible 503 than an open inbox endpoint.
          console.error(
            "Admin inbox: INBOUND_EMAIL_SECRET is not set, so mail cannot be received.",
          );
          return new Response("Inbound email not configured", { status: 503 });
        }
        if (!sameSecret(request.headers.get("x-worker-secret"), secret)) {
          return new Response("Unauthorized", { status: 401 });
        }
        if (!process.env["SUPABASE_URL"] || !process.env["SUPABASE_SERVICE_ROLE_KEY"]) {
          console.error("Admin inbox: Supabase is not configured, so mail cannot be stored.");
          return new Response("Inbound email not configured", { status: 503 });
        }

        let raw: unknown;
        try {
          raw = await request.json();
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }
        const parsed = payloadSchema.safeParse(raw);
        if (!parsed.success) return new Response("Invalid payload", { status: 400 });
        const input = parsed.data;

        const from = parseAddress(input.from);
        if (!from.email.includes("@")) return new Response("Invalid sender", { status: 400 });

        const recipients = addressList(input.to);
        const mailbox = mailboxFor(input.mailbox, recipients);
        const subject = input.subject.trim();
        const subjectKey = threadSubjectKey(subject);
        const receivedAt = isoOrNow(input.receivedAt);
        const messageId = cleanId(input.messageId);
        const inReplyTo = cleanId(input.inReplyTo);
        const references = Array.isArray(input.references)
          ? input.references
          : (input.references ?? "").split(/\s+/);
        const referenceIds = references
          .map((entry) => cleanId(entry))
          .filter((entry): entry is string => !!entry)
          .slice(0, 20);
        const fromName = input.fromName?.trim() || from.name;
        const supabase = db();

        // The same mail twice (a worker retry) is one row, and answers with the thread it already opened.
        if (messageId) {
          const { data: stored } = await supabase
            .from("admin_inbox_messages")
            .select("id, thread_id")
            .eq("mailbox", mailbox)
            .eq("message_id", messageId)
            .maybeSingle();
          const prior = stored as { id: string; thread_id: string } | null;
          if (prior) {
            return Response.json({ ok: true, duplicate: true, threadId: prior.thread_id });
          }
        }

        // 1. A reply names its thread: In-Reply-To and References are the mail's own record of what it answers.
        let threadId: string | null = null;
        if (referenceIds.length) {
          const { data: named } = await supabase
            .from("admin_inbox_messages")
            .select("thread_id")
            .eq("mailbox", mailbox)
            .in("message_id", referenceIds)
            .limit(1)
            .maybeSingle();
          threadId = (named as { thread_id: string } | null)?.thread_id ?? null;
        }

        // 2. Otherwise the same correspondent and subject is the same conversation.
        if (!threadId) {
          const { data: match } = await supabase
            .from("admin_inbox_threads")
            .select("id")
            .eq("mailbox", mailbox)
            .eq("counterpart_email", from.email)
            .eq("subject_key", subjectKey)
            .maybeSingle();
          threadId = (match as { id: string } | null)?.id ?? null;
        }

        // 3. Nothing to join: a new conversation, and the unique thread index makes a simultaneous delivery safe.
        if (!threadId) {
          const { data: created, error } = await supabase
            .from("admin_inbox_threads")
            .insert({
              mailbox,
              subject,
              subject_key: subjectKey,
              counterpart_email: from.email,
              counterpart_name: fromName,
              last_message_at: receivedAt,
            } as never)
            .select("id")
            .single();
          if (error) {
            if (error.code !== "23505") {
              console.error("Admin inbox: couldn't open the thread:", error.message);
              return new Response("Could not store the message", { status: 500 });
            }
            const { data: twin } = await supabase
              .from("admin_inbox_threads")
              .select("id")
              .eq("mailbox", mailbox)
              .eq("counterpart_email", from.email)
              .eq("subject_key", subjectKey)
              .maybeSingle();
            const row = twin as { id: string } | null;
            if (!row) {
              console.error("Admin inbox: the thread exists but could not be read back.");
              return new Response("Could not store the message", { status: 500 });
            }
            threadId = row.id;
          } else {
            threadId = (created as { id: string }).id;
          }
        }

        const { data: stored, error: insertError } = await supabase
          .from("admin_inbox_messages")
          .insert({
            thread_id: threadId,
            mailbox,
            direction: "inbound",
            message_id: messageId,
            in_reply_to: inReplyTo,
            from_email: from.email,
            from_name: fromName,
            to_emails: recipients,
            subject,
            body_text: input.text ?? null,
            body_html: input.html ?? null,
            received_at: receivedAt,
          } as never)
          .select("id")
          .single();
        if (insertError) {
          // A retry that raced the first delivery is not an error: the mail is already in its thread.
          if (insertError.code === "23505") {
            return Response.json({ ok: true, duplicate: true, threadId });
          }
          // A non-2xx makes the worker retry, so a database blip never loses a message.
          console.error("Admin inbox: couldn't store the message:", insertError.message);
          return new Response("Could not store the message", { status: 500 });
        }

        // Only the recency moves: unread is counted from the message rows (read_at is null), so a lost or doubled
        // update here can never make the badge read low.
        await supabase
          .from("admin_inbox_threads")
          .update({ last_message_at: receivedAt } as never)
          .eq("id", threadId);

        return Response.json({
          ok: true,
          duplicate: false,
          threadId,
          messageId: (stored as { id: string }).id,
        });
      },
    },
  },
});
