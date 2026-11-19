import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveAccess } from "./departments";
import { emailLayout, escapeHtml } from "./email-layout";
import { mailKey, mailboxAddress, sendMail } from "./mailer";
import { companyMailboxesFor } from "./company-email";
import { PDF_EMAIL_MAX_BYTES, PDF_MAILBOXES } from "./pdf-tools";

const emailList = z.array(z.string().trim().email()).min(1).max(5);

/**
 * Emails a PDF from Admin → PDF Tools as an attachment. The PDF is sent straight through and never stored.
 *
 * A document leaving a company address is outbound correspondence, so it follows the same rule as Admin → Email
 * (founder, 2026-11-19): a super admin may send from any mailbox, a department lead from the ones their department owns,
 * and general staff from none — they download or save the file and hand it over another way.
 */
export const sendPdfEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        to: emailList,
        from: z.enum(PDF_MAILBOXES),
        subject: z.string().trim().min(1).max(200),
        message: z.string().max(5000),
        fileName: z.string().trim().min(1).max(200),
        pdf: z
          .string()
          .min(1)
          .max(Math.ceil(PDF_EMAIL_MAX_BYTES / 3) * 4),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: roles } = await context.supabase
      .from("user_roles")
      .select("role, departments")
      .eq("user_id", context.userId);
    const access = resolveAccess((roles ?? []) as { role: string; departments?: string[] | null }[]);
    if (!access) throw new Error("Staff access only.");
    if (!companyMailboxesFor(access).includes(data.from))
      throw new Error(
        "Only a super admin, or the lead of the mailbox's department, can send a document from that mailbox.",
      );
    const address = mailboxAddress(data.from);
    const fileName = data.fileName.toLowerCase().endsWith(".pdf")
      ? data.fileName
      : `${data.fileName}.pdf`;
    const message = data.message.trim()
      ? `<p style="font-size:15px;line-height:1.6">${escapeHtml(data.message.trim()).replace(/\n/g, "<br>")}</p>`
      : "";
    const html = emailLayout(
      `<p style="font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#004AAD;margin:0">Document</p>
<h1 style="font-size:22px;margin:8px 0 16px">${escapeHtml(data.subject)}</h1>
${message}
<p style="font-size:13px;line-height:1.6;color:#555;margin-top:24px">The document is attached: <b>${escapeHtml(fileName)}</b>. Reply to this email with any questions.</p>
`,
      {
        reason:
          "You're receiving this because a member of the Came Through Audio team sent you a document.",
      },
    );

    const res = await sendMail({
      from: data.from,
      replyTo: address,
      to: data.to,
      subject: data.subject,
      html,
      attachments: [{ filename: fileName, content: data.pdf }],
      // Each deliberate Send is its own email: a member re-sending the same packet a minute later still gets it sent
      // (the button is disabled while a send is in flight, so a double click can't duplicate it).
      key: mailKey("pdf", data.from, data.to.join("-"), fileName, crypto.randomUUID()),
    });
    if (!res.ok) {
      console.error(`Resend failed [${res.status ?? res.detail}]: ${res.detail ?? ""}`);
      if (res.detail === "no-key") {
        throw new Error(
          "Email sending isn't switched on yet. Ask a super admin to enable it, then try again.",
        );
      }
      const hint =
        res.status === 401 || res.status === 403
          ? " The sending key was refused, or the camethroughaudio.com domain isn't verified."
          : res.status === 429
            ? " The email service's rate limit was hit; wait a minute and try again."
            : res.status === 422
              ? " The email service refused the message — check the addresses and the attachment size."
              : "";
      throw new Error(`Email could not be sent (${res.status ?? "network"}).${hint}`);
    }
    // Resend accepted it; the delivery result arrives on the webhook. The log is a courtesy — a failed insert must
    // never turn a sent document into an error the sender sees.
    const { error: logError } = await context.supabase.from("pdf_email_sends" as never).insert({
      resend_id: res.id ?? null,
      sent_by: context.userId,
      mailbox: data.from,
      recipients: data.to,
      subject: data.subject,
      file_name: fileName,
    } as never);
    if (logError) console.warn("Couldn't record the PDF email:", logError.message);
    return { ok: true };
  });
