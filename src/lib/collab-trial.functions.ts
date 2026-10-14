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
