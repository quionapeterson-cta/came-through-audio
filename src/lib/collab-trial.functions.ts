import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const COLLAB_TRIAL_DAYS = 30;

/**
 * Grants a one-time 30-day Catalog and Collaborate trial to a collaborator who was
 * invited to sign a split sheet. The invite is verified as the caller (email must match).
 */
export const grantCollaboratorTrial = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ rowId: z.string().uuid(), environment: z.enum(["sandbox", "live"]) }).parse(d))
  .handler(async ({ data, context }) => {
    // Throws unless the invite was sent to the caller's email.
    const { data: invite, error } = await context.supabase.rpc("get_split_invite", { _row_id: data.rowId });
    if (error || !invite) return { granted: false };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const subId = `collab_trial_${context.userId}`;
    const { data: existing } = await supabaseAdmin.from("subscriptions").select("id").eq("paddle_subscription_id", subId).maybeSingle();
    if (existing) return { granted: false };

    const now = new Date();
    const end = new Date(now.getTime() + COLLAB_TRIAL_DAYS * 86400000);
    const { error: insErr } = await supabaseAdmin.from("subscriptions").insert({
      user_id: context.userId,
      paddle_subscription_id: subId,
      paddle_customer_id: "collab_trial",
      product_id: "collab_trial",
      price_id: "catalog_collaborate_yearly",
      status: "trialing",
      current_period_start: now.toISOString(),
      current_period_end: end.toISOString(),
      environment: data.environment,
    });
    if (insErr) { console.error("Trial insert failed", insErr); return { granted: false }; }
    return { granted: true, endsAt: end.toISOString() };
  });

const REMINDED = "collab_trial_reminded";

/** Sends a one-time "trial ending soon" email when 5 or fewer days remain. Marked on the trial row so it never repeats. */
export const sendTrialEndingReminder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ environment: z.enum(["sandbox", "live"]), origin: z.string().url() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: sub } = await supabaseAdmin.from("subscriptions")
      .select("id, paddle_customer_id, current_period_end")
      .eq("paddle_subscription_id", `collab_trial_${context.userId}`)
      .eq("environment", data.environment).maybeSingle();
    if (!sub || sub.paddle_customer_id === REMINDED || !sub.current_period_end) return { sent: false };
    const end = new Date(sub.current_period_end);
    const daysLeft = Math.ceil((end.getTime() - Date.now()) / 86400000);
    if (daysLeft > 5 || daysLeft < 0) return { sent: false };
    const email = (context.claims as { email?: string }).email;
    const key = process.env["RESEND_API_KEY"] || process.env["CameThroughAudio"];
    if (!email || !key) return { sent: false };

    const plans = `${new URL(data.origin).origin}/plans`;
    const when = end.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
    const html = `<!doctype html><html><body style="margin:0;background:#ffffff;font-family:Poppins,Arial,sans-serif;color:#0b0b0b">
<div style="max-width:560px;margin:0 auto;padding:32px 24px">
<p style="font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#004AAD;margin:0">Your Collaborate Trial</p>
<h1 style="font-size:24px;margin:8px 0 16px">Your free trial ends in ${daysLeft} day${daysLeft === 1 ? "" : "s"}</h1>
<p style="font-size:15px;line-height:1.6">Your 30-day Catalog &amp; Collaborate access ends on <b>${when}</b>. After that your account moves to the Free plan automatically. You won't be charged.</p>
<p style="font-size:15px;line-height:1.6">On Free you can still sign split sheets you're invited to, but you won't be able to create split sheets or use Collaborate features. Your saved catalog stays safe.</p>
<a href="${plans}" style="display:inline-block;background:#004AAD;color:#ffffff;text-decoration:none;font-weight:700;padding:14px 28px;border-radius:8px">Keep Collaborate Access</a>
</div></body></html>`;
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "Idempotency-Key": `trial-reminder-${sub.id}` },
      body: JSON.stringify({ from: "Came Through Audio <collaborate@camethroughaudio.com>", to: [email], subject: `Your Came Through Audio trial ends in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`, html }),
    });
    if (!res.ok) { console.error(`Trial reminder failed [${res.status}]: ${await res.text()}`); return { sent: false }; }
    await supabaseAdmin.from("subscriptions").update({ paddle_customer_id: REMINDED }).eq("id", sub.id);
    return { sent: true, daysLeft };
  });
