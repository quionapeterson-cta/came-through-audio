import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { emailLayout, escapeHtml } from "./email-layout";
import { OUTREACH_DAILY_LIMIT, OUTREACH_FROM } from "./outreach-emails";

/** Company outreach emails (Phase 4 item 5): sent from partnerships@ by super admins only, logged for follow-ups. */
async function superAdminDb(context: { supabase: { rpc: (fn: "has_role", args: { _user_id: string; _role: "super_admin" }) => PromiseLike<{ data: unknown }> }; userId: string }) {
  const { data: isSuper } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "super_admin" });
  if (!isSuper) throw new Error("Only super admins can send outreach emails.");
  return (await import("@/integrations/supabase/client.server")).supabaseAdmin;
}

export type OutreachLogRow = { kind: string; toEmail: string; toName: string; company: string; subject: string; sentAt: string };

export const listOutreach = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<OutreachLogRow[]> => {
    const db = await superAdminDb(context);
    const { data, error } = await db.from("outreach_emails" as never).select("kind, to_email, to_name, company, subject, sent_at").order("sent_at", { ascending: false }).limit(300);
    if (error) throw new Error("Couldn't load sent outreach. Run migration 20261025190000 first.");
    return ((data ?? []) as { kind: string; to_email: string; to_name: string; company: string; subject: string; sent_at: string }[])
      .map((r) => ({ kind: r.kind, toEmail: r.to_email, toName: r.to_name, company: r.company, subject: r.subject, sentAt: r.sent_at }));
  });

export const sendOutreach = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    kind: z.enum(["cold", "followup", "demo"]), to: z.string().trim().email(), name: z.string().trim().max(200).default(""),
    company: z.string().trim().max(200).default(""), subject: z.string().trim().min(3).max(300), body: z.string().trim().min(20).max(8000),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const db = await superAdminDb(context);
    const key = process.env["RESEND_API_KEY"] || process.env["CameThroughAudio"];
    if (!key) throw new Error("Email sending is not configured yet.");
    const since = new Date(Date.now() - 86400000).toISOString();
    const { count } = await db.from("outreach_emails" as never).select("id", { count: "exact", head: true }).gte("sent_at", since);
    if ((count ?? 0) >= OUTREACH_DAILY_LIMIT) throw new Error(`That's ${OUTREACH_DAILY_LIMIT} outreach emails in 24 hours, the daily limit. Send the rest tomorrow.`);
    const html = data.body.split(/\n{2,}/).map((p) => `<p style="font-size:15px;line-height:1.6;margin:0 0 14px">${escapeHtml(p).replace(/\n/g, "<br>")}</p>`).join("");
    // Business outreach is commercial email: an honest subject, our address and a one-click way to opt out.
    const unsubscribe = `mailto:partnerships@camethroughaudio.com?subject=${encodeURIComponent("Unsubscribe")}`;
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: OUTREACH_FROM, to: [data.to], reply_to: "partnerships@camethroughaudio.com", subject: data.subject,
        html: emailLayout(html, { kind: "marketing", unsubscribeUrl: unsubscribe, reason: `You're receiving this because Came Through Audio reached out to ${data.company || "your company"} about a possible partnership.` }) }),
    });
    if (!res.ok) { console.error(`Outreach email failed [${res.status}]: ${await res.text()}`); throw new Error(`The email couldn't be sent (${res.status}).`); }
    await db.from("outreach_emails" as never).insert({ kind: data.kind, to_email: data.to, to_name: data.name, company: data.company, subject: data.subject, sent_by: context.userId } as never);
    return { ok: true };
  });
