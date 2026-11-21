import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveAccess } from "./departments";
import { emailLayout } from "./email-layout";
import { mailKey, sendMail } from "./mailer";
import {
  COMPANY_MAILBOXES,
  COMPANY_MAIL_DAILY_LIMIT,
  COMPANY_MAIL_SENDER_DAILY_LIMIT,
  companyFrom,
  companyMailboxesFor,
  companyMailReadScope,
  companyReplyTo,
  mailBodyHtml,
  type CompanyMailbox,
} from "./company-email";

/**
 * Admin → Email: one-off correspondence from a company mailbox, for a super admin or the lead of the department that owns
 * the box, and nobody else (founder, 2026-11-19). General staff send nothing from a company address; they answer inside
 * the tool they are already working in, such as a member's own support ticket.
 *
 * The mailbox is a key into COMPANY_MAILBOXES, never a raw address, so a caller cannot make us send as anything that
 * isn't ours, and COMPANY_MAILBOX_OWNERS decides whose box it is. Mail is logged in outreach_emails with kind "company",
 * the mailbox and the sender, for the daily caps and the department-scoped history; a failed log never undoes a letter
 * that already went out, it just says so in the server log.
 */
const MAILBOX_KEYS = Object.keys(COMPANY_MAILBOXES) as [CompanyMailbox, ...CompanyMailbox[]];

/** Any staff role (user_roles through resolveAccess), the same test the rest of the dashboard uses. */
async function staffDb(context: { supabase: SupabaseClient<Database>; userId: string }) {
  const { data: roles } = await context.supabase
    .from("user_roles")
    .select("role, departments")
    .eq("user_id", context.userId);
  const access = resolveAccess(roles ?? []);
  if (!access) throw new Error("Staff access only.");
  return { db: (await import("@/integrations/supabase/client.server")).supabaseAdmin, access };
}

export type CompanyEmailRow = {
  toEmail: string;
  subject: string;
  fromEmail: string;
  mailbox: string;
  sentAt: string;
};

/**
 * The letters already sent, newest first (founder, 2026-11-19): a super admin sees every mailbox company-wide, a
 * department lead only their department's boxes, and everyone else only what they sent themselves. No one reads another
 * department's correspondence.
 */
export const listCompanyEmail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CompanyEmailRow[]> => {
    const { db, access } = await staffDb(context);
    const scope = companyMailReadScope(access);
    if (Array.isArray(scope) && !scope.length) return [];
    const base = db
      .from("outreach_emails" as never)
      .select("to_email, subject, from_email, mailbox, sent_at")
      .eq("kind", "company")
      .order("sent_at", { ascending: false })
      .limit(100);
    const scoped =
      scope === "all"
        ? base
        : scope === "own"
          ? base.eq("sent_by", context.userId)
          : base.in("mailbox", scope);
    const { data, error } = await scoped;
    if (error) throw new Error("Couldn't load company email. Run migration 20261119200000 first.");
    return (
      (data ?? []) as {
        to_email: string;
        subject: string;
        from_email: string | null;
        mailbox: string | null;
        sent_at: string;
      }[]
    ).map((r) => ({
      toEmail: r.to_email,
      subject: r.subject,
      fromEmail: r.from_email ?? "",
      mailbox: r.mailbox ?? "",
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
    const { db, access } = await staffDb(context);
    // The picker is already narrowed, and this is the rule: a super admin writes as any box, a department lead as the
    // boxes their department owns, and nobody else sends at all. Posting another key cannot reach admin@ or legal@.
    const allowed = companyMailboxesFor(access);
    if (!allowed.length)
      throw new Error(
        "Company mail is sent by a super admin or the lead of the mailbox's department. Reply to the member inside the tool you're working in instead.",
      );
    if (!allowed.includes(data.mailbox))
      throw new Error("That mailbox belongs to another department. Send from one of yours.");
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
    // One account's share of the same cap, so the allowance can never be spent by a single sender.
    const { count: mine } = await db
      .from("outreach_emails" as never)
      .select("id", { count: "exact", head: true })
      .eq("kind", "company")
      .eq("sent_by", context.userId)
      .gte("sent_at", since);
    if ((mine ?? 0) >= COMPANY_MAIL_SENDER_DAILY_LIMIT)
      throw new Error(
        `That's ${COMPANY_MAIL_SENDER_DAILY_LIMIT} company emails from your account in 24 hours. Send the rest tomorrow.`,
      );

    const cc = data.cc?.trim();
    const res = await sendMail({
      from: data.mailbox,
      to: [data.to],
      ...(cc ? { cc: [cc] } : {}),
      replyTo: companyReplyTo(data.mailbox),
      subject: data.subject,
      html: emailLayout(mailBodyHtml(data.body), {
        reason: "You're receiving this because Came Through Audio wrote to you directly.",
      }),
      key: mailKey(
        "company-letter",
        data.mailbox,
        data.to,
        data.subject,
        Math.floor(Date.now() / 60_000),
      ),
    });
    if (!res.ok) {
      console.error(`Company email failed [${res.status ?? res.detail}]: ${res.detail ?? ""}`);
      throw new Error(
        res.detail === "no-key"
          ? "Email sending is not configured yet."
          : res.status === 403
            ? "The email couldn't be sent: the camethroughaudio.com sending domain isn't verified in Resend yet."
            : `The email couldn't be sent (${res.status ?? "network"}).`,
      );
    }

    const { error } = await db.from("outreach_emails" as never).insert({
      kind: "company",
      to_email: data.to,
      to_name: "",
      company: "",
      subject: data.subject,
      from_email: from,
      mailbox: data.mailbox,
      sent_by: context.userId,
    } as never);
    // The letter has already left; losing the log row is worth a note, not a failure the sender has to retry.
    if (error) console.error(`Company email sent but not logged: ${error.message}`);
    return { ok: true };
  });
