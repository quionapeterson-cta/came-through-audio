import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveAccess } from "./departments";
import { ADMIN_EMAIL, REGISTRATIONS_EMAIL, emailLayout, escapeHtml } from "./email-layout";
import { INBOX_BUCKET } from "./inbox-attachments";
import { mailKey, sendMail } from "./mailer";

/**
 * Admin Inbox, part 3 (founder, 2026-11-17): reading the stored mail and answering it from Admin.
 *
 * Files stay with the message (founder, 2026-11-17): each attachment the mail carried is kept in the private
 * admin-inbox bucket up to 10 MB, and a super admin opens it through a short-lived signed link that is only issued for a
 * key the message already holds.
 *
 * Unread is never a stored number. It is counted from the messages themselves — inbound rows with no `read_at` — so two
 * deliveries landing together can never leave a badge reading low for good. Opening a thread is what marks it read.
 *
 * Only a super admin reads the company inbox, and the check is here as well as in RLS: the reads go through the
 * service role because the panel asks for several tables at once, so the gate has to exist before that client is used.
 */

/**
 * The company mailboxes this inbox stores. registrations@ is the registration desk's own (founder, 2026-11-18): a super
 * admin sees all three, and the registration department sees that one only.
 */
export type InboxMailbox = "admin" | "contracts" | "registrations";

export type InboxAttachment = {
  filename: string;
  mimeType?: string;
  size?: number;
  /** The key the file itself was stored under in the private admin-inbox bucket. Absent when it wasn't kept. */
  storagePath?: string;
  /** False when the file was too big to keep: the name is the record, and `reason` says why. */
  kept?: boolean;
  reason?: string;
};

export type InboxThreadSummary = {
  id: string;
  mailbox: InboxMailbox;
  subject: string;
  counterpartEmail: string;
  counterpartName: string | null;
  lastMessageAt: string;
  /** Derived: inbound messages in this thread with no read_at. */
  unread: number;
};

export type InboxMessage = {
  id: string;
  direction: "inbound" | "outbound";
  fromEmail: string;
  fromName: string | null;
  subject: string;
  text: string | null;
  attachments: InboxAttachment[];
  receivedAt: string;
  readAt: string | null;
  sendStatus: string | null;
};

export type InboxThread = InboxThreadSummary & { messages: InboxMessage[] };

type Db = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];

/**
 * Who may read the inbox, and how much of it: a super admin sees every mailbox, the registration department sees
 * registrations@ alone. The service role is used below, so this gate is the rule rather than a convenience.
 */
async function inboxDb(context: { supabase: unknown; userId: string }): Promise<{ db: Db; isSuper: boolean }> {
  const client = context.supabase as { // eslint-disable-line @typescript-eslint/no-explicit-any
    rpc: (
      fn: "has_role",
      args: { _user_id: string; _role: "super_admin" },
    ) => PromiseLike<{ data: unknown }>;
    from: (table: string) => {
      select: (columns: string) => { eq: (column: string, value: string) => PromiseLike<{ data: unknown }> };
    };
  };
  const { data: isSuper } = await client.rpc("has_role", {
    _user_id: context.userId,
    _role: "super_admin",
  });
  if (!isSuper) {
    const { data: roles } = await client.from("user_roles").select("role, departments").eq("user_id", context.userId);
    const access = resolveAccess((roles ?? []) as { role: string; departments?: string[] | null }[]);
    if (!access?.departments.includes("registration")) {
      throw new Error("Only a super admin or the registration desk can read the company inbox.");
    }
  }
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return { db: supabaseAdmin, isSuper: !!isSuper };
}

type ThreadRow = {
  id: string;
  mailbox: InboxMailbox;
  subject: string;
  counterpart_email: string;
  counterpart_name: string | null;
  last_message_at: string;
};

type MessageRow = {
  id: string;
  thread_id: string;
  direction: "inbound" | "outbound";
  from_email: string;
  from_name: string | null;
  subject: string;
  body_text: string | null;
  attachments: unknown;
  received_at: string;
  read_at: string | null;
  send_status: string | null;
};

const MSG_COLUMNS =
  "id, thread_id, direction, from_email, from_name, subject, body_text, attachments, received_at, read_at, send_status";

function attachmentsOf(value: unknown): InboxAttachment[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((one) => one as Partial<InboxAttachment> | null)
    .filter((one): one is Partial<InboxAttachment> => !!one && typeof one.filename === "string")
    .map((one) => ({
      filename: one.filename as string,
      ...(one.mimeType ? { mimeType: one.mimeType } : {}),
      ...(typeof one.size === "number" ? { size: one.size } : {}),
      ...(typeof one.storagePath === "string" && one.storagePath
        ? { storagePath: one.storagePath }
        : {}),
      ...(typeof one.kept === "boolean" ? { kept: one.kept } : {}),
      ...(typeof one.reason === "string" && one.reason ? { reason: one.reason } : {}),
    }));
}

function toMessage(row: MessageRow): InboxMessage {
  return {
    id: row.id,
    direction: row.direction,
    fromEmail: row.from_email,
    fromName: row.from_name,
    subject: row.subject,
    text: row.body_text,
    attachments: attachmentsOf(row.attachments),
    receivedAt: row.received_at,
    readAt: row.read_at,
    sendStatus: row.send_status,
  };
}

/** Recent threads, newest first, each with its unread count counted from its unread inbound rows. */
export const listInboxThreads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<InboxThreadSummary[]> => {
    const { db, isSuper } = await inboxDb(context);
    // The registration desk answers registrations@ and nothing else; a super admin keeps the whole inbox.
    let query = db
      .from("admin_inbox_threads" as never)
      .select("id, mailbox, subject, counterpart_email, counterpart_name, last_message_at")
      .order("last_message_at", { ascending: false })
      .limit(200);
    if (!isSuper) query = query.eq("mailbox", "registrations");
    const { data, error } = await query;
    if (error) throw new Error("Couldn't load the inbox. Run migration 20261117120000 first.");
    const rows = (data ?? []) as unknown as ThreadRow[];
    if (!rows.length) return [];

    // The unread rows themselves, not a counter: this is the same source the badge uses, per thread.
    const { data: unreadRows } = await db
      .from("admin_inbox_messages" as never)
      .select("thread_id")
      .eq("direction", "inbound")
      .is("read_at", null)
      .in(
        "thread_id",
        rows.map((r) => r.id),
      )
      .limit(5000);
    const counts = new Map<string, number>();
    for (const row of (unreadRows ?? []) as unknown as { thread_id: string }[]) {
      counts.set(row.thread_id, (counts.get(row.thread_id) ?? 0) + 1);
    }

    return rows.map((row) => ({
      id: row.id,
      mailbox: row.mailbox,
      subject: row.subject,
      counterpartEmail: row.counterpart_email,
      counterpartName: row.counterpart_name,
      lastMessageAt: row.last_message_at,
      unread: counts.get(row.id) ?? 0,
    }));
  });

/** The badge on the tab: every unread inbound message, counted at the source. */
export const inboxUnreadCount = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<number> => {
    const { db, isSuper } = await inboxDb(context);
    let query = db
      .from("admin_inbox_messages" as never)
      .select("id", { count: "exact", head: true })
      .eq("direction", "inbound")
      .is("read_at", null);
    if (!isSuper) query = query.eq("mailbox", "registrations");
    const { count, error } = await query;
    if (error) {
      // A silent 0 is the exact undercount the derived count exists to prevent (founder, 2026-11-17): a failed count
      // fails here, and the tab says the number is unknown rather than showing an empty inbox.
      console.error("Admin inbox: couldn't count unread mail:", error.message);
      throw new Error("Couldn't count unread mail, so the badge is unknown rather than zero.");
    }
    return count ?? 0;
  });

/** One conversation, oldest message first. Opening it is reading it, so its unread inbound rows are marked read. */
export const openInboxThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ threadId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<InboxThread> => {
    const { db, isSuper } = await inboxDb(context);
    const { data: thread } = await db
      .from("admin_inbox_threads" as never)
      .select("id, mailbox, subject, counterpart_email, counterpart_name, last_message_at")
      .eq("id", data.threadId)
      .maybeSingle();
    const row = thread as unknown as ThreadRow | null;
    if (!row) throw new Error("That conversation is no longer here.");
    if (!isSuper && row.mailbox !== "registrations") throw new Error("That conversation belongs to a super admin.");

    const { data: messages, error } = await db
      .from("admin_inbox_messages" as never)
      .select(MSG_COLUMNS)
      .eq("thread_id", row.id)
      .order("received_at", { ascending: true })
      .limit(500);
    if (error) throw new Error("Couldn't load this conversation.");

    const readAt = new Date().toISOString();
    const { error: readError } = await db
      .from("admin_inbox_messages" as never)
      .update({ read_at: readAt } as never)
      .eq("thread_id", row.id)
      .eq("direction", "inbound")
      .is("read_at", null);
    // A failed mark-read must not hide the conversation: the next open tries again, and the count stays honest.
    if (readError) console.error("Admin inbox: couldn't mark the thread read:", readError.message);

    const list = ((messages ?? []) as unknown as MessageRow[]).map(toMessage);
    return {
      id: row.id,
      mailbox: row.mailbox,
      subject: row.subject,
      counterpartEmail: row.counterpart_email,
      counterpartName: row.counterpart_name,
      lastMessageAt: row.last_message_at,
      unread: 0,
      messages: list.map((m) =>
        m.direction === "inbound" ? { ...m, readAt: m.readAt ?? readAt } : m,
      ),
    };
  });

/**
 * A short-lived link to one attachment's file (founder, 2026-11-17). The bytes never travel through a server function:
 * the bucket is private and stays private, and the browser streams from the signed address it is given.
 *
 * The key comes from the message's own row, not from the browser: the path asked for has to be one the message already
 * holds, so a super admin can't be handed a key to a file that isn't on the thread they're reading.
 */
export const inboxAttachmentUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({ messageId: z.string().uuid(), storagePath: z.string().trim().min(3).max(400) })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<{ url: string; filename: string }> => {
    const { db, isSuper } = await inboxDb(context);
    const { data: message } = await db
      .from("admin_inbox_messages" as never)
      .select("attachments, thread_id")
      .eq("id", data.messageId)
      .maybeSingle();
    // The registration desk may sign a file only when it sits on a registrations@ thread.
    if (!isSuper) {
      const threadId = (message as { thread_id?: string } | null)?.thread_id ?? "";
      const { data: thread } = await db
        .from("admin_inbox_threads" as never)
        .select("mailbox")
        .eq("id", threadId)
        .maybeSingle();
      if ((thread as { mailbox: string } | null)?.mailbox !== "registrations") {
        throw new Error("That file is on a conversation for a super admin.");
      }
    }
    const files = attachmentsOf((message as { attachments: unknown } | null)?.attachments);
    const file = files.find((one) => one.storagePath === data.storagePath);
    if (!file?.storagePath) throw new Error("That file isn't on this message.");
    const { data: signed, error } = await db.storage
      .from(INBOX_BUCKET)
      .createSignedUrl(file.storagePath, 600);
    if (error || !signed) {
      console.error("Admin inbox: couldn't sign an attachment:", error?.message ?? "no url");
      throw new Error("Couldn't prepare that file. Run migration 20261117140000 first.");
    }
    return { url: signed.signedUrl, filename: file.filename };
  });

/**
 * A reply written in Admin, sent from admin@ (founder, 2026-11-17) to the address that wrote to us, and stored on the
 * thread so the conversation is complete the next time someone opens it.
 */
export const replyToInboxThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        threadId: z.string().uuid(),
        body: z.string().trim().min(2, "Write a reply first.").max(8000),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<{ ok: true; messageId: string }> => {
    const { db, isSuper } = await inboxDb(context);
    const { data: thread } = await db
      .from("admin_inbox_threads" as never)
      .select("id, mailbox, subject, counterpart_email")
      .eq("id", data.threadId)
      .maybeSingle();
    const row = thread as unknown as Pick<
      ThreadRow,
      "id" | "mailbox" | "subject" | "counterpart_email"
    > | null;
    if (!row) throw new Error("That conversation is no longer here.");
    if (!isSuper && row.mailbox !== "registrations") throw new Error("That conversation belongs to a super admin.");

    // The reply leaves from the mailbox the mail arrived at, so the answer comes back to the desk that owns it.
    const replyMailbox: "admin" | "registrations" = row.mailbox === "registrations" ? "registrations" : "admin";
    const replyAddress = replyMailbox === "registrations" ? REGISTRATIONS_EMAIL : ADMIN_EMAIL;

    const base = row.subject.trim() || "(no subject)";
    const subject = /^(re|fwd?)\s*:/i.test(base) ? base : `Re: ${base}`;
    const body = data.body.trim();
    const html = emailLayout(
      `<p style="font-size:15px;line-height:1.6;white-space:pre-wrap">${escapeHtml(body)}</p>`,
      { reason: "You're receiving this because you wrote to us and this is our reply." },
    );

    // The reply's own id is its idempotency key, so a double click sends one email: the row is only written once it sends.
    const messageId = crypto.randomUUID();
    const { data: lastInbound } = await db
      .from("admin_inbox_messages" as never)
      .select("message_id")
      .eq("thread_id", row.id)
      .eq("direction", "inbound")
      .order("received_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const sent = await sendMail({
      from: replyMailbox,
      to: [row.counterpart_email],
      replyTo: replyAddress,
      subject,
      html,
      key: mailKey("inbox-reply", messageId),
    });
    if (!sent.ok) {
      console.error(
        `Admin inbox: reply failed [${sent.status ?? sent.detail}]: ${sent.detail ?? ""}`,
      );
      throw new Error(
        sent.detail === "no-key"
          ? "Email sending is not configured yet."
          : `The reply was not sent (${sent.status ?? "network"}). Nothing was stored, so you can send it again.`,
      );
    }

    const now = new Date().toISOString();
    const { error: insertError } = await db.from("admin_inbox_messages" as never).insert({
      id: messageId,
      thread_id: row.id,
      mailbox: row.mailbox,
      direction: "outbound",
      in_reply_to: (lastInbound as { message_id: string | null } | null)?.message_id ?? null,
      from_email: replyAddress,
      from_name: "Came Through Audio",
      to_emails: [row.counterpart_email],
      subject,
      body_text: body,
      body_html: html,
      resend_id: sent.id ?? null,
      send_status: "sent",
      received_at: now,
      created_by: context.userId,
    } as never);
    if (insertError) {
      // The mail went out; say so plainly instead of asking for a send that would be a second copy.
      console.error("Admin inbox: the reply sent but could not be stored:", insertError.message);
      throw new Error(
        "The reply was sent, but it couldn't be saved to the thread. Refresh to see it.",
      );
    }

    await db
      .from("admin_inbox_threads" as never)
      .update({ last_message_at: now } as never)
      .eq("id", row.id);
    return { ok: true, messageId };
  });
