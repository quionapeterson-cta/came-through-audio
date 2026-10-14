import { emailLayout } from "./email-layout";

const REMINDED = "collab_trial_reminded";
const REMINDER_WINDOW_DAYS = 5;

function reminderHtml(daysLeft: number, when: string, plansUrl: string): string {
  return emailLayout(`<p style="font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#004AAD;margin:0">Your Collaborate Trial</p>
<h1 style="font-size:24px;margin:8px 0 16px">Your free trial ends in ${daysLeft} day${daysLeft === 1 ? "" : "s"}</h1>
<p style="font-size:15px;line-height:1.6">Your 30-day Catalog &amp; Collaborate access ends on <b>${when}</b>. After that your account moves to the Free plan automatically. You won't be charged.</p>
<p style="font-size:15px;line-height:1.6">On Free you can still sign split sheets you're invited to, but you won't be able to create split sheets or use Collaborate features. Your saved catalog stays safe.</p>
<a href="${plansUrl}" style="display:inline-block;background:#004AAD;color:#ffffff;text-decoration:none;font-weight:700;padding:14px 28px;border-radius:8px">Keep Collaborate Access</a>`,
    { reason: "You're receiving this account notice because your free Collaborate trial on Came Through Audio is ending soon." });
}

async function sendReminderEmail(key: string, idempotencyKey: string, email: string, daysLeft: number, when: string, plansUrl: string): Promise<boolean> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
    body: JSON.stringify({
      from: "Came Through Audio <collaborate@camethroughaudio.com>",
      to: [email],
      subject: `Your Came Through Audio trial ends in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`,
      html: reminderHtml(daysLeft, when, plansUrl),
    }),
  });
  if (!res.ok) { console.error(`Trial reminder failed [${res.status}]: ${await res.text()}`); return false; }
  return true;
}

export function resendKey(): string | undefined {
  return process.env["RESEND_API_KEY"] || process.env["CameThroughAudio"];
}

/** Days left on a trial end date, or null if outside the 0–5 day reminder window. */
export function daysLeftInWindow(periodEnd: string): number | null {
  const end = new Date(periodEnd);
  const daysLeft = Math.ceil((end.getTime() - Date.now()) / 86400000);
  if (daysLeft > REMINDER_WINDOW_DAYS || daysLeft < 0) return null;
  return daysLeft;
}

export function formatEndDate(periodEnd: string): string {
  return new Date(periodEnd).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

/** Sends the reminder for one trial row owned by the given email. Returns true if sent and marked. */
export async function sendReminderForTrial(
  supabaseAdmin: any,
  sub: { id: string; current_period_end: string | null },
  email: string,
  plansUrl: string,
): Promise<boolean> {
  if (!sub.current_period_end) return false;
  const key = resendKey();
  const daysLeft = daysLeftInWindow(sub.current_period_end);
  if (!key || daysLeft === null) return false;
  const ok = await sendReminderEmail(key, `trial-reminder-${sub.id}`, email, daysLeft, formatEndDate(sub.current_period_end), plansUrl);
  if (!ok) return false;
  await supabaseAdmin.from("subscriptions").update({ paddle_customer_id: REMINDED }).eq("id", sub.id);
  return true;
}

/**
 * Cron path: finds every un-reminded collaborator trial ending within the window
 * and emails its owner, regardless of whether they sign in. Returns counts only.
 */
export async function sendAllDueTrialReminders(plansUrl: string): Promise<{ scanned: number; sent: number }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const now = new Date();
  const windowEnd = new Date(now.getTime() + REMINDER_WINDOW_DAYS * 86400000);
  const { data: subs, error } = await supabaseAdmin.from("subscriptions")
    .select("id, user_id, current_period_end")
    .like("paddle_subscription_id", "collab_trial_%")
    .neq("paddle_customer_id", REMINDED)
    .eq("status", "trialing")
    .gte("current_period_end", now.toISOString())
    .lte("current_period_end", windowEnd.toISOString());
  if (error || !subs) { console.error("Trial reminder scan failed", error); return { scanned: 0, sent: 0 }; }

  let sent = 0;
  for (const sub of subs) {
    const { data: userData, error: userErr } = await supabaseAdmin.auth.admin.getUserById(sub.user_id);
    const email = userData?.user?.email;
    if (userErr || !email) continue;
    if (await sendReminderForTrial(supabaseAdmin, sub, email, plansUrl)) sent += 1;
  }
  return { scanned: subs.length, sent };
}
