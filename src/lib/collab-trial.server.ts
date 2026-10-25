import { createHash } from "node:crypto";
import { hasTier, isActiveSub, tierFromPrice } from "@/lib/plans";
import { emailLayout } from "./email-layout";

const REMINDED = "collab_trial_reminded";
const REMINDER_WINDOW_DAYS = 5;

/** Trials are Catalog & Collaborate (split sheets, contracts) or Catalog Plus (co-writer IPI requests), by price. */
export const trialPlan = (priceId?: string | null) => (priceId?.startsWith("catalog_plus") ? "Catalog Plus" : "Catalog & Collaborate");

function reminderHtml(daysLeft: number, when: string, plansUrl: string, plan: string): string {
  const html = plan.replace("&", "&amp;");
  const loses = plan === "Catalog Plus"
    ? "On Free you can still run Royalty Health Checks and sign split sheets you're invited to, but you won't be able to embed metadata or add songs to your catalog. Your saved catalog stays safe."
    : "On Free you can still sign split sheets you're invited to, but you won't be able to create split sheets or use Collaborate features. Your saved catalog stays safe.";
  return emailLayout(`<p style="font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#004AAD;margin:0">Your ${html} Trial</p>
<h1 style="font-size:24px;margin:8px 0 16px">Your free trial ends in ${daysLeft} day${daysLeft === 1 ? "" : "s"}</h1>
<p style="font-size:15px;line-height:1.6">Your 30-day ${html} access ends on <b>${when}</b>. After that your account moves to the Free plan automatically. You won't be charged.</p>
<p style="font-size:15px;line-height:1.6">${loses}</p>
<a href="${plansUrl}" style="display:inline-block;background:#004AAD;color:#ffffff;text-decoration:none;font-weight:700;padding:14px 28px;border-radius:8px">Keep ${plan === "Catalog Plus" ? "Catalog Plus" : "Collaborate"} Access</a>`,
    { reason: `You're receiving this account notice because your free ${plan} Trial on Came Through Audio is ending soon.` });
}

async function sendReminderEmail(key: string, idempotencyKey: string, email: string, daysLeft: number, when: string, plansUrl: string, plan: string): Promise<boolean> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
    body: JSON.stringify({
      from: "Came Through Audio <collaborate@camethroughaudio.com>",
      to: [email],
      subject: `Your ${plan} Trial ends in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`,
      html: reminderHtml(daysLeft, when, plansUrl, plan),
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
  sub: { id: string; current_period_end: string | null; price_id?: string | null },
  email: string,
  plansUrl: string,
): Promise<boolean> {
  if (!sub.current_period_end) return false;
  const key = resendKey();
  const daysLeft = daysLeftInWindow(sub.current_period_end);
  if (!key || daysLeft === null) return false;
  const ok = await sendReminderEmail(key, `trial-reminder-${sub.id}`, email, daysLeft, formatEndDate(sub.current_period_end), plansUrl, trialPlan(sub.price_id));
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
    .select("id, user_id, current_period_end, price_id")
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

// ---------- Collaborator trial fraud guard ----------
type Admin = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];

/** Limits for free collaborator trials. Tuned so real collaborators never notice them. */
export const TRIAL_LIMITS = { perInviterPer30Days: 10, perNetworkPer30Days: 2 };

/** Throwaway inbox providers people use to farm free accounts. */
const DISPOSABLE = ["mailinator.com", "guerrillamail.com", "10minutemail.com", "tempmail.com", "temp-mail.org", "yopmail.com", "trashmail.com", "sharklasers.com", "getnada.com", "dispostable.com", "maildrop.cc", "throwawaymail.com", "fakeinbox.com", "mintemail.com", "moakt.com", "emailondeck.com"];

/** Salted SHA-256 of the IP, so the guard can compare networks without storing anyone's address. */
export function hashIp(ip: string) {
  return createHash("sha256").update(`${process.env["SESSION_SECRET"] ?? "cta"}|${ip}`).digest("hex");
}

/**
 * The same inbox however it's typed: lowercase, without a "+tag", and for Gmail without dots (Gmail ignores both),
 * so one person can't collect a trial per spelling.
 */
export function normalizeEmail(email: string) {
  const [local = "", domain = ""] = email.trim().toLowerCase().split("@");
  const gmail = domain === "gmail.com" || domain === "googlemail.com";
  const base = local.split("+")[0]!;
  return `${gmail ? base.replace(/\./g, "") : base}@${gmail ? "gmail.com" : domain}`;
}
/** A salted fingerprint of the normalized email: enough to spot a repeat, never readable back into the address. */
export function hashEmail(email: string) {
  return createHash("sha256").update(`${process.env["SESSION_SECRET"] ?? "cta"}|email|${normalizeEmail(email)}`).digest("hex");
}

/** Who sent the invite: the catalog owner for a split sheet row, the contract owner for a contract party. */
export async function inviterOf(admin: Admin, source: "split_sheet" | "contract" | "ipi_request", id: string): Promise<string | null> {
  if (source === "ipi_request") {
    const { data: r } = await admin.from("ipi_requests" as never).select("owner_id").eq("id", id).maybeSingle();
    return (r as { owner_id?: string } | null)?.owner_id ?? null;
  }
  if (source === "split_sheet") {
    const { data: row } = await admin.from("split_sheets").select("catalog_id").eq("id", id).maybeSingle();
    if (!row?.catalog_id) return null;
    const { data: cat } = await admin.from("catalogs").select("user_id").eq("id", row.catalog_id).maybeSingle();
    return cat?.user_id ?? null;
  }
  const { data: party } = await admin.from("contract_parties" as never).select("contract_id").eq("id", id).maybeSingle();
  const contractId = (party as { contract_id?: string } | null)?.contract_id;
  if (!contractId) return null;
  const { data: k } = await admin.from("contracts" as never).select("user_id").eq("id", contractId).maybeSingle();
  return (k as { user_id?: string } | null)?.user_id ?? null;
}

/**
 * Why a trial should be withheld, or null to grant it:
 * the caller invited themselves, hasn't confirmed their email, uses a throwaway inbox, the inviter isn't a paying
 * member (trial accounts can't hand out more trials), or the inviter or network already used this month's allowance.
 */
export async function trialBlockReason(admin: Admin, o: { userId: string; inviterId: string | null; source: "split_sheet" | "contract" | "ipi_request"; ipHash: string | null; environment: "sandbox" | "live" }): Promise<string | null> {
  if (!o.inviterId) return "no inviter";
  if (o.inviterId === o.userId) return "self invite";
  const { data: u } = await admin.auth.admin.getUserById(o.userId);
  if (!u?.user?.email_confirmed_at) return "email not confirmed";
  const domain = u.user.email?.split("@")[1]?.toLowerCase() ?? "";
  if (DISPOSABLE.includes(domain)) return "disposable email";

  const { data: subs } = await admin.from("subscriptions").select("price_id, status, current_period_end, paddle_subscription_id, environment").eq("user_id", o.inviterId).eq("environment", o.environment);
  // Co-writer IPI requests can come from any paid plan; the inviter just has to be paying (not on a trial).
  const needed = o.source === "contract" ? "management" : o.source === "ipi_request" ? "plus" : "collaborate";
  const paying = (subs ?? []).some((s) => !s.paddle_subscription_id?.startsWith("collab_trial_") && isActiveSub(s) && hasTier(tierFromPrice(s.price_id), needed));
  const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", o.inviterId);
  if (!paying && !(roles ?? []).some((r) => r.role === "super_admin")) return "inviter is not a paying member";

  // One trial per email per rolling year, even if the account was deleted and made again (grants outlive accounts).
  if (u.user.email) {
    const yearAgo = new Date(Date.now() - 365 * 86400000).toISOString();
    const { count: byEmail } = await admin.from("trial_grants" as never).select("id", { count: "exact", head: true }).eq("email_hash", hashEmail(u.user.email)).gte("created_at", yearAgo);
    if ((byEmail ?? 0) > 0) return "email already had a trial this year";
  }
  const since = new Date(Date.now() - 30 * 86400000).toISOString();
  const { count: byInviter } = await admin.from("trial_grants" as never).select("id", { count: "exact", head: true }).eq("inviter_id", o.inviterId).gte("created_at", since);
  if ((byInviter ?? 0) >= TRIAL_LIMITS.perInviterPer30Days) return "inviter trial limit";
  if (o.ipHash) {
    const { count: byIp } = await admin.from("trial_grants" as never).select("id", { count: "exact", head: true }).eq("ip_hash", o.ipHash).gte("created_at", since);
    if ((byIp ?? 0) >= TRIAL_LIMITS.perNetworkPer30Days) return "network trial limit";
  }
  return null;
}
