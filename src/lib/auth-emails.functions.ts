import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { emailLayout, SITE_URL } from "./email-layout";
import { mailKey, sendMail } from "./mailer";

/**
 * Branded account emails (founder, 2026-11-05). A reset mail used to come straight from the auth provider: default
 * template, no brand, and a link that dropped people on a page with no instructions. We now mint the link ourselves and
 * send our own email, so the shell, the sender and the destination are the same as every other email we write.
 */

async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/** Emails a password-reset link. Answers the same way whether or not the address exists. */
export const sendPasswordResetEmail = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ email: z.string().trim().toLowerCase().min(3, "Enter your email").max(320) }).parse(d))
  .handler(async ({ data }): Promise<{ ok: true; emailed: boolean }> => {
    const admin = await db();
    const link = await admin.auth.admin.generateLink({
      type: "recovery",
      email: data.email,
      options: { redirectTo: `${SITE_URL}/reset-password` },
    });
    const url = link.data?.properties?.action_link;
    if (link.error || !url) {
      // Never let this page say whether an account exists.
      console.warn("Password reset link not generated:", link.error?.message ?? "no link");
      return { ok: true, emailed: false };
    }
    const html = emailLayout(`<p style="font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#004AAD;margin:0">Password reset</p>
<h1 style="font-size:24px;margin:8px 0 16px">Choose a new password</h1>
<p style="font-size:15px;line-height:1.6">Use the button below to set a new password for your Came Through Audio account. The link works once and expires in one hour.</p>
<p style="font-size:15px;line-height:1.6">Open <b>Profile → Manage billing</b> afterwards if you also need to update the card on file. We never ask for a password by email.</p>
<p style="margin:24px 0"><a href="${url}" style="background:#004AAD;color:#ffffff;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:8px;display:inline-block">Choose a new password</a></p>
<p style="font-size:13px;line-height:1.6;color:#666">If the button doesn't work, paste this address into your browser:<br/><span style="word-break:break-all">${url}</span></p>`,
      { reason: "You're receiving this because someone asked to reset the password for this Came Through Audio account." });
    // One link per hour per address: a double click sends one email, and a genuine retry later still arrives.
    const res = await sendMail({
      from: "admin",
      to: [data.email],
      subject: "Choose a new Came Through Audio password",
      html,
      key: mailKey("password-reset", data.email, Math.floor(Date.now() / 3_600_000)),
    });
    if (!res.ok) console.error(`Password reset email failed [${res.status ?? res.detail ?? "network"}]`);
    return { ok: true, emailed: res.ok };
  });
