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

/** Sends a one-time "trial ending soon" email when 5 or fewer days remain. Marked on the trial row so it never repeats. */
export const sendTrialEndingReminder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ environment: z.enum(["sandbox", "live"]), origin: z.string().url() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { sendReminderForTrial, daysLeftInWindow } = await import("./collab-trial.server");
    const { data: sub } = await supabaseAdmin.from("subscriptions")
      .select("id, paddle_customer_id, current_period_end")
      .eq("paddle_subscription_id", `collab_trial_${context.userId}`)
      .eq("environment", data.environment).maybeSingle();
    if (!sub || sub.paddle_customer_id === "collab_trial_reminded" || !sub.current_period_end) return { sent: false };
    const email = (context.claims as { email?: string }).email;
    if (!email) return { sent: false };
    const plans = `${new URL(data.origin).origin}/plans`;
    const sent = await sendReminderForTrial(supabaseAdmin, sub, email, plans);
    return { sent, daysLeft: daysLeftInWindow(sub.current_period_end) ?? undefined };
  });
