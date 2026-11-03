import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveAccess } from "./departments";
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
 * Admin → Email: one-off correspondence from a company mailbox, open to every member of staff and nobody else.
 *
 * The mailbox is a key into COMPANY_MAILBOXES, never a raw address, so a caller cannot make us send as anything that
 * isn't ours. Mail is logged in outreach_emails with kind "company" for the daily cap and so two people don't answer the
 * same thread; a failed log never undoes a letter that already went out, it just says so in the server log.
 */
const MAILBOX_KEYS = Object.keys(COMPANY_MAILBOXES) as [CompanyMailbox, ...CompanyMailbox[]];

/** Any staff role (user_roles through resolveAccess), the same test the rest of the dashboard uses. */
async function staffDb(context: { supabase: SupabaseClient<Database>; userId: string }) {
  const { data: roles } = await context.supabase
    .from("user_roles")
    .select("role, departments")
    .eq("user_id", context.userId);
  if (!resolveAccess(roles ?? [])) throw new Error("Staff access only.");
  return (await import("@/integrations/supabase/client.server")).supabaseAdmin;
}

export type CompanyEmailRow = {
  toEmail: string;
  subject: string;
  fromEmail: string;
  sentAt: string;
};

/** The letters staff have sent, newest first, for the "did someone already answer this?" check. */
export const listCompanyEmail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CompanyEmailRow[]> => {
    const db = await staffDb(context);
    const { data, error } = await db
      .from("outreach_emails" as never)
      .select("to_email, subject, from_email, sent_at")
      .eq("kind", "company")
      .order("sent_at", { ascending: false })
      .limit(100);
    if (error) throw new Error("Couldn't load company email. Run migration 20261103130000 first.");
    return (
      (data ?? []) as {
        to_email: string;
        subject: string;
        from_email: string | null;
        sent_at: string;
      }[]
    ).map((r) => ({
      toEmail: r.to_email,
      subject: r.subject,
      fromEmail: r.from_email ?? "",
      sentAt: r.sent_at,
    }));
  });

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
    const db = await staffDb(context);
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
