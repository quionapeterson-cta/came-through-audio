import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveAccess } from "./departments";
import { emailLayout, escapeHtml } from "./email-layout";
import { PDF_EMAIL_MAX_BYTES, PDF_MAILBOXES } from "./pdf-tools";

const emailList = z.array(z.string().trim().email()).min(1).max(5);

/** Emails a PDF from Admin → PDF Tools as an attachment. Staff only; the PDF is sent straight through and never stored. */
export const sendPdfEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      to: emailList,
      from: z.enum(PDF_MAILBOXES),
      subject: z.string().trim().min(1).max(200),
      message: z.string().max(5000),
      fileName: z.string().trim().min(1).max(200),
      pdf: z.string().min(1).max(Math.ceil(PDF_EMAIL_MAX_BYTES / 3) * 4),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: roles } = await context.supabase.from("user_roles").select("role, departments").eq("user_id", context.userId);
    if (!resolveAccess(roles ?? [])) throw new Error("Staff access only.");
    const key = process.env["RESEND_API_KEY"] || process.env["CameThroughAudio"];
    if (!key) throw new Error("Email sending is not configured yet.");

    const address = `${data.from}@camethroughaudio.com`;
    const fileName = data.fileName.toLowerCase().endsWith(".pdf") ? data.fileName : `${data.fileName}.pdf`;
    const message = data.message.trim()
      ? `<p style="font-size:15px;line-height:1.6">${escapeHtml(data.message.trim()).replace(/\n/g, "<br>")}</p>`
      : "";
    const html = emailLayout(`<p style="font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#004AAD;margin:0">Document</p>
<h1 style="font-size:22px;margin:8px 0 16px">${escapeHtml(data.subject)}</h1>
${message}
<p style="font-size:13px;line-height:1.6;color:#555;margin-top:24px">The document is attached: <b>${escapeHtml(fileName)}</b>. Reply to this email with any questions.</p>
`, { reason: "You're receiving this because a member of the Came Through Audio team sent you a document." });

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: `Came Through Audio <${address}>`,
        reply_to: address,
        to: data.to,
        subject: data.subject,
        html,
        attachments: [{ filename: fileName, content: data.pdf }],
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      console.error(`Resend failed [${res.status}]: ${body}`);
      throw new Error(`Email could not be sent (${res.status}).`);
    }
    return { ok: true };
  });
