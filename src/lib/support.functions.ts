import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { BILLING_EMAIL, emailLayout, escapeHtml, INFO_EMAIL, SUPPORT_EMAIL } from "./email-layout";
import { sendMemberReplyNotice, sendTicketReceivedEmail, sendTicketReplyEmail } from "./support-emails";
import { BILLING_AREA, TICKET_CATEGORIES } from "./support-topics";
import {
  TICKET_STATUSES,
  afterSendStatus,
  canSendReply,
  type ThreadMessage,
  type TicketRecord,
} from "./support-replies";

/** Categories come from the two-step picker (src/lib/support-topics.ts): "Area · Issue". */
export { TICKET_CATEGORIES } from "./support-topics";
/** `waiting` joined the three original statuses (founder, 2026-11-08). Labels live in support-replies.ts. */
export { TICKET_STATUSES };

const ticketSchema = z.object({
  kind: z.enum(["contact", "support"]),
  name: z.string().trim().min(1, "Enter your name").max(100),
  email: z.string().trim().email("Enter a valid email").max(255),
  category: z.enum(TICKET_CATEGORIES),
  subject: z.string().trim().min(1, "Add a subject").max(150),
  message: z.string().trim().min(10, "Tell us a bit more (10+ characters)").max(3000),
  website: z.string().max(0).optional(), // honeypot: must stay empty
});
export type TicketInput = z.infer<typeof ticketSchema>;
export { ticketSchema };

/** Public: Contact Us messages. Support tickets need an account (submitSupportTicket). */
export const submitTicket = createServerFn({ method: "POST" })
  .inputValidator((d) => ticketSchema.parse(d))
  .handler(async ({ data }) => {
    if (data.kind !== "contact") throw new Error("Log in to open a support ticket.");
    return storeTicket(data);
  });

/**
 * Support tickets come from signed-in users only (founder, 2026-10-27), so tickets are real and tied to an account.
 * The reply address is the account's own email, never one typed into the form.
 */
export const submitSupportTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => ticketSchema.omit({ email: true }).parse(d))
  .handler(async ({ data, context }) => {
    const email = (context.claims as { email?: string }).email;
    if (!email) throw new Error("Your account has no email address. Contact us instead.");
    return storeTicket({ ...data, kind: "support", email, userId: context.userId });
  });

async function storeTicket(data: TicketInput & { userId?: string }) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count } = await supabaseAdmin.from("support_tickets").select("id", { count: "exact", head: true })
    .eq("email", data.email).gte("created_at", since);
  if ((count ?? 0) >= 5) throw new Error("Too many messages — please try again in an hour.");
  const { data: row, error } = await supabaseAdmin.from("support_tickets").insert({
    kind: data.kind, name: data.name, email: data.email, category: data.category, subject: data.subject, message: data.message,
    // The account that opened it: what the member's own Support tab and the thread policies key on.
    user_id: data.userId ?? null,
  }).select("id").single();
  if (error || !row) throw new Error("We couldn't send your message. Please try again.");

  const key = process.env["RESEND_API_KEY"] || process.env["CameThroughAudio"];
  if (key) {
    const label = data.kind === "support" ? "Support Ticket" : "Contact Message";
    const html = emailLayout(`<p style="font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#004AAD;margin:0">New ${label}</p>
<h1 style="font-size:22px;margin:8px 0 16px">${escapeHtml(data.subject)}</h1>
<p style="font-size:14px;margin:0"><b>From:</b> ${escapeHtml(data.name)} (${escapeHtml(data.email)})<br/><b>Category:</b> ${escapeHtml(data.category)}</p>
<p style="font-size:15px;line-height:1.6;white-space:pre-wrap">${escapeHtml(data.message)}</p>`,
      { hideAddress: true, reason: "You're receiving this staff notice because a new message was submitted on the Came Through Audio website." });
    // Billing questions go to billing@, support tickets to support@, Contact Us messages to info@.
    const inbox = data.category.startsWith(BILLING_AREA) ? BILLING_EMAIL : data.kind === "support" ? SUPPORT_EMAIL : INFO_EMAIL;
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "Idempotency-Key": `ticket-${row.id}` },
      body: JSON.stringify({ from: "Came Through Audio <collaborate@camethroughaudio.com>", to: [inbox], reply_to: data.email, subject: `[${label}] ${data.subject}`, html }),
    }).catch((e) => console.error("Ticket notify failed", e));
  }
  // The member's own copy of "we have it": a ticket used to sit silent until a staff reply arrived. Never fails the
  // submit — the row is already saved, and the queue still shows it.
  await sendTicketReceivedEmail({ id: row.id, kind: data.kind, name: data.name, email: data.email, category: data.category, subject: data.subject })
    .catch((e) => console.error("Ticket receipt failed", e));
  return { ok: true };
}

type ScopeContext = {
  supabase: {
    rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown }>;
    from: (table: string) => any;
  };
  userId: string;
  claims?: unknown;
};

/**
 * Support sees every ticket; Billing sees its own (founder, 2026-11-05). The filter is the same "Account & billing"
 * prefix the inbox routing and the database policy use, so a ticket can never be in two queues by accident.
 */
async function staffScope(context: ScopeContext): Promise<"all" | "billing" | null> {
  const [support, billing] = await Promise.all([
    context.supabase.rpc("in_department", { _user_id: context.userId, _dept: "support" }),
    context.supabase.rpc("in_department", { _user_id: context.userId, _dept: "billing" }),
  ]);
  if (support.data) return "all";
  if (billing.data) return "billing";
  return null;
}

async function ticketScope(context: ScopeContext): Promise<"all" | "billing"> {
  const scope = await staffScope(context);
  if (!scope) throw new Error("Tickets are for the Support and Billing teams.");
  return scope;
}

/** Support department, and Billing for billing tickets: list tickets. */
export const listTickets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const scope = await ticketScope(context as unknown as ScopeContext);
    const base = context.supabase.from("support_tickets").select("*");
    const scoped = scope === "billing" ? base.like("category", `${BILLING_AREA}%`) : base;
    const { data, error } = await scoped.order("created_at", { ascending: false }).limit(200);
    if (error) throw new Error("Couldn't load tickets.");
    return data ?? [];
  });

/** Support, or Billing on a billing ticket: change ticket status. */
export const updateTicketStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid(), status: z.enum(TICKET_STATUSES) }).parse(d))
  .handler(async ({ data, context }) => {
    const scope = await ticketScope(context as unknown as ScopeContext);
    const base = context.supabase.from("support_tickets").update({ status: data.status }).eq("id", data.id);
    // Billing can only touch a billing ticket, even if a database policy ever let a wider read through.
    const scoped = scope === "billing" ? base.like("category", `${BILLING_AREA}%`) : base;
    const { error } = await scoped;
    if (error) throw new Error("Couldn't update ticket.");
    return { ok: true };
  });

/**
 * One thread, for staff and for the member who opened it (founder, 2026-11-08). The database decides the rows; this
 * only adds the second lock: a member's copy never carries an internal note, and a ticket they don't own is not found.
 */
export const listTicketThread = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ ticketId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: ticket, error } = await context.supabase
      .from("support_tickets").select("*").eq("id", data.ticketId).maybeSingle();
    if (error) throw new Error("Couldn't load that ticket.");
    if (!ticket) throw new Error("That ticket isn't available to you.");
    const scope = await staffScope(context as unknown as ScopeContext);
    const owns = (ticket as TicketRecord).user_id === context.userId;
    if (!scope && !owns) throw new Error("That ticket isn't available to you.");
    const { data: messages, error: threadError } = await context.supabase
      .from("support_ticket_messages").select("*").eq("ticket_id", data.ticketId).order("created_at");
    if (threadError) throw new Error("Couldn't load the conversation.");
    const rows = ((messages ?? []) as ThreadMessage[]).filter((m) => scope || !m.internal);
    return { ticket: ticket as TicketRecord, messages: rows, staff: !!scope };
  });

const replyInput = z.object({
  ticketId: z.string().uuid(),
  body: z.string().trim().min(1).max(8000),
  internal: z.boolean().default(false),
  after: z.enum(["stay", "waiting", "resolved"]).default("stay"),
  /** One id per draft: a retry or a double click can't store or send the same reply twice. */
  requestId: z.string().uuid().optional(),
});

/**
 * The native reply (founder, 2026-11-08): store it, set the ticket's next state in the same click, and send the member
 * the words with a link straight back to their message box. An internal note is stored and never emailed.
 */
export const replyToTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => replyInput.parse(d))
  .handler(async ({ data, context }) => {
    const scope = await ticketScope(context as unknown as ScopeContext);
    const { data: ticketRow, error: loadError } = await context.supabase
      .from("support_tickets").select("*").eq("id", data.ticketId).maybeSingle();
    if (loadError || !ticketRow) throw new Error("That ticket isn't in your queue.");
    const ticket = ticketRow as TicketRecord;
    if (scope === "billing" && !ticket.category.startsWith(BILLING_AREA)) {
      throw new Error("Billing answers Account & billing tickets only.");
    }
    const check = canSendReply(data.body, data.internal);
    if (!check.ok) throw new Error(check.error);

    const claims = (context.claims ?? {}) as { name?: string; email?: string };
    const authorName = (claims.name || claims.email || "Support").slice(0, 100);
    const { data: inserted, error: insertError } = await context.supabase
      .from("support_ticket_messages").insert({
        ticket_id: ticket.id,
        author_kind: "staff",
        author_id: context.userId,
        author_name: authorName,
        body: data.body.trim(),
        internal: data.internal,
        request_id: data.requestId ?? null,
      }).select("id").single();
    if (insertError || !inserted) {
      // Same request id twice: the first send already happened, so this is a no-op rather than a second reply.
      if (insertError?.code === "23505") return { ok: true as const, emailed: false, duplicate: true };
      throw new Error("Couldn't save the reply. Nothing was sent.");
    }
    const messageId = (inserted as { id: string }).id;

    const patch: { first_reply_at?: string; status?: string } = {};
    if (!data.internal) {
      if (!ticket.first_reply_at) patch.first_reply_at = new Date().toISOString();
      patch.status = afterSendStatus(data.after);
    }
    if (Object.keys(patch).length) await context.supabase.from("support_tickets").update(patch).eq("id", ticket.id);

    let emailed = false;
    if (!data.internal) {
      const result = await sendTicketReplyEmail(ticket, data.body.trim(), messageId);
      emailed = result.emailed;
      if (emailed) {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        await supabaseAdmin.from("support_ticket_messages")
          .update({ emailed_at: new Date().toISOString() }).eq("id", messageId);
      }
    }
    return { ok: true as const, emailed, duplicate: false };
  });

/** A member's own tickets, with whether Support has replied since they last looked. */
export const listMyTickets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: tickets, error } = await context.supabase
      .from("support_tickets").select("*").eq("user_id", context.userId)
      .order("created_at", { ascending: false }).limit(50);
    if (error) throw new Error("Couldn't load your tickets.");
    const rows = (tickets ?? []) as TicketRecord[];
    if (!rows.length) return [] as (TicketRecord & { last_staff_at: string | null })[];
    const { data: replies } = await context.supabase
      .from("support_ticket_messages")
      .select("ticket_id,created_at,author_kind,internal")
      .in("ticket_id", rows.map((t) => t.id))
      .eq("author_kind", "staff").eq("internal", false)
      .order("created_at", { ascending: false }).limit(200);
    const latest = new Map<string, string>();
    for (const r of (replies ?? []) as { ticket_id: string; created_at: string }[]) {
      if (!latest.has(r.ticket_id)) latest.set(r.ticket_id, r.created_at);
    }
    return rows.map((t) => ({ ...t, last_staff_at: latest.get(t.id) ?? null }));
  });

/** The member answers on their own ticket. A resolved ticket is closed: they open a new one instead. */
export const replyAsMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ ticketId: z.string().uuid(), body: z.string().trim().min(1).max(8000) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: ticketRow } = await supabaseAdmin
      .from("support_tickets").select("*").eq("id", data.ticketId).eq("user_id", context.userId).maybeSingle();
    if (!ticketRow) throw new Error("That ticket isn't yours.");
    const ticket = ticketRow as TicketRecord;
    if (ticket.status === "resolved") throw new Error("This ticket is resolved and closed. Open a new ticket and we'll pick it up.");
    const check = canSendReply(data.body, false);
    if (!check.ok) throw new Error(check.error);
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count } = await supabaseAdmin.from("support_ticket_messages")
      .select("id", { count: "exact", head: true })
      .eq("ticket_id", ticket.id).eq("author_kind", "member").gte("created_at", since);
    if ((count ?? 0) >= 10) throw new Error("That's a lot of messages in a row — give us a moment to reply.");
    const { data: saved, error } = await supabaseAdmin.from("support_ticket_messages").insert({
      ticket_id: ticket.id,
      author_kind: "member",
      author_id: context.userId,
      author_name: ticket.name,
      body: data.body.trim(),
    }).select("id").single();
    if (error || !saved) throw new Error("Couldn't send your message. Please try again.");
    await supabaseAdmin.from("support_tickets").update({ status: "open" }).eq("id", ticket.id);
    await sendMemberReplyNotice(ticket, data.body.trim(), (saved as { id: string }).id);
    return { ok: true as const };
  });

/** The member opened the thread: their unread dot clears, and the queue still keeps its own record. */
export const markTicketRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ ticketId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("support_tickets")
      .update({ member_read_at: new Date().toISOString() })
      .eq("id", data.ticketId).eq("user_id", context.userId);
    return { ok: true };
  });
