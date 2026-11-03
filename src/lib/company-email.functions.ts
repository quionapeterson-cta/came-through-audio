import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { emailLayout } from "./email-layout";
import {
  COMPANY_MAILBOXES,
  COMPANY_MAIL_DAILY_LIMIT,
  companyFrom,
  companyReplyTo,
  mailBodyHtml,
  type CompanyMailbox,
} from "./company-email";

/**
 * Admin → Company Contracts → Email: one-off correspondence from a company mailbox, super admins only.
 *
 * The mailbox is a key into COMPANY_MAILBOXES, never a raw address, so a caller cannot make us send as anything that
 * isn't ours. Mail is logged in outreach_emails with kind "company" for the daily cap and so nobody answers a thread
 * twice; a failed log never undoes a letter that already went out, it just says so in the server log.
 */
const MAILBOX_KEYS = Object.keys(COMPANY_MAILBOXES) as [CompanyMailbox, ...CompanyMailbox[]];

async function superAdminDb(context: {
  supabase: {
    rpc: (
      fn: "has_role",
      args: { _user_id: string; _role: "super_admin" },
    ) => PromiseLike<{ data: unknown }>;
  };
  userId: string;
}) {
  const { data: isSuper } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "super_admin",
  });
  if (!isSuper) throw new Error("Only super admins can send company email.");
  return (await import("@/integrations/supabase/client.server")).supabaseAdmin;
}

export const sendCompanyEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        mailbox: z.enum(MAILBOX_KEYS),
        to: z.string().trim().email().max(320),
        cc: z.union([z.literal(""), z.string().trim().email().max(320)]).optional(),
        subject: z.string().trim().min(3).max(300),
        body: z.string().trim().min(20).max(8000),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const db = await superAdminDb(context);
    const key = process.env["RESEND_API_KEY"] || process.env["CameThroughAudio"];
    if (!key) throw new Error("Email sending is not configured yet.");
    const from = companyFrom(data.mailbox);
    if (!from) throw new Error("That isn't one of the company mailboxes.");

    const since = new Date(Date.now() - 86400000).toISOString();
    const { count } = await db
      .from("outreach_emails" as never)
      .select("id", { count: "exact", head: true })
      .eq("kind", "company")
      .gte("sent_at", since);
    if ((count ?? 0) >= COMPANY_MAIL_DAILY_LIMIT)
      throw new Error(
        `That's ${COMPANY_MAIL_DAILY_LIMIT} company emails in 24 hours, the daily limit. Send the rest tomorrow.`,
      );

    const cc = data.cc?.trim();
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: [data.to],
        ...(cc ? { cc: [cc] } : {}),
        reply_to: companyReplyTo(data.mailbox),
        subject: data.subject,
        html: emailLayout(mailBodyHtml(data.body), {
          reason: "You're receiving this because Came Through Audio wrote to you directly.",
        }),
      }),
    });
    if (!res.ok) {
      console.error(`Company email failed [${res.status}]: ${await res.text()}`);
      throw new Error(
        res.status === 403
          ? "The email couldn't be sent: the camethroughaudio.com sending domain isn't verified in Resend yet."
          : `The email couldn't be sent (${res.status}).`,
      );
    }

    const { error } = await db.from("outreach_emails" as never).insert({
      kind: "company",
      to_email: data.to,
      to_name: "",
      company: "",
      subject: data.subject,
      from_email: from,
      sent_by: context.userId,
    } as never);
    // The letter has already left; losing the log row is worth a note, not a failure the sender has to retry.
    if (error) console.error(`Company email sent but not logged: ${error.message}`);
    return { ok: true };
  });
