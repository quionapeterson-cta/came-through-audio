import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { BILLING_EMAIL, emailLayout, escapeHtml, INFO_EMAIL, SUPPORT_EMAIL } from "./email-layout";

export const TICKET_CATEGORIES = ["General Inquiry", "Royalty Help", "Split Sheets", "AI Protection", "Billing", "Technical Issue"] as const;
export const TICKET_STATUSES = ["open", "in_progress", "resolved"] as const;

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
    return storeTicket({ ...data, kind: "support", email });
  });

async function storeTicket(data: TicketInput) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count } = await supabaseAdmin.from("support_tickets").select("id", { count: "exact", head: true })
    .eq("email", data.email).gte("created_at", since);
  if ((count ?? 0) >= 5) throw new Error("Too many messages — please try again in an hour.");
  const { data: row, error } = await supabaseAdmin.from("support_tickets").insert({
    kind: data.kind, name: data.name, email: data.email, category: data.category, subject: data.subject, message: data.message,
  }).select("id").single();
  if (error || !row) throw new Error("We couldn't send your message. Please try again.");

  const key = process.env["RESEND_API_KEY"] || process.env["CameThroughAudio"];
  if (key) {
    const label = data.kind === "support" ? "Support Ticket" : "Contact Message";
    const html = emailLayout(`<p style="font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#004AAD;margin:0">New ${label}</p>
<h1 style="font-size:22px;margin:8px 0 16px">${escapeHtml(data.subject)}</h1>
<p style="font-size:14px;margin:0"><b>From:</b> ${escapeHtml(data.name)} (${escapeHtml(data.email)})<br/><b>Category:</b> ${escapeHtml(data.category)}</p>
<p style="font-size:15px;line-height:1.6;white-space:pre-wrap">${escapeHtml(data.message)}</p>`,
      { reason: "You're receiving this staff notice because a new message was submitted on the Came Through Audio website." });
    // Billing questions go to billing@, support tickets to support@, Contact Us messages to info@.
    const inbox = data.category === "Billing" ? BILLING_EMAIL : data.kind === "support" ? SUPPORT_EMAIL : INFO_EMAIL;
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "Idempotency-Key": `ticket-${row.id}` },
      body: JSON.stringify({ from: "Came Through Audio <collaborate@camethroughaudio.com>", to: [inbox], reply_to: data.email, subject: `[${label}] ${data.subject}`, html }),
    }).catch((e) => console.error("Ticket notify failed", e));
  }
  return { ok: true };
}

/** Support department only: list tickets. */
export const listTickets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: allowed } = await context.supabase.rpc("in_department", { _user_id: context.userId, _dept: "support" });
    if (!allowed) throw new Error("Forbidden");
    const { data, error } = await context.supabase.from("support_tickets").select("*").order("created_at", { ascending: false }).limit(200);
    if (error) throw new Error("Couldn't load tickets.");
    return data ?? [];
  });

/** Support department only: change ticket status. */
export const updateTicketStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid(), status: z.enum(TICKET_STATUSES) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: allowed } = await context.supabase.rpc("in_department", { _user_id: context.userId, _dept: "support" });
    if (!allowed) throw new Error("Forbidden");
    const { error } = await context.supabase.from("support_tickets").update({ status: data.status }).eq("id", data.id);
    if (error) throw new Error("Couldn't update ticket.");
    return { ok: true };
  });
