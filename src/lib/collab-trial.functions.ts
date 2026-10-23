import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { SITE_URL } from "@/lib/email-layout";
import { trustedOrigin } from "@/lib/invite-limits";

export const COLLAB_TRIAL_DAYS = 30;

/**
 * Grants a one-time 30-day Catalog & Collaborate trial to someone invited to sign a split sheet or contract.
 * The invite is verified as the caller (email must match), then the fraud guard runs (see trialBlockReason).
 * Reasons are logged server-side only, so the response never teaches anyone how to get around the checks.
 */
export const grantCollaboratorTrial = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    rowId: z.string().uuid().optional(),
    partyId: z.string().uuid().optional(),
    ipiRequestId: z.string().uuid().optional(),
    environment: z.enum(["sandbox", "live"]),
  }).refine((v) => [v.rowId, v.partyId, v.ipiRequestId].filter(Boolean).length === 1, "Send one invite id").parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { trialBlockReason, inviterOf, hashIp } = await import("./collab-trial.server");

    // Throws unless the invite was sent to the caller's email.
    const source = data.rowId ? "split_sheet" as const : data.ipiRequestId ? "ipi_request" as const : "contract" as const;
    const { data: invite, error } = data.rowId
      ? await context.supabase.rpc("get_split_invite", { _row_id: data.rowId })
      : data.ipiRequestId
        ? await context.supabase.rpc("get_ipi_request" as never, { _id: data.ipiRequestId } as never)
        : await context.supabase.rpc("get_contract_invite" as never, { _party_id: data.partyId } as never);
    if (error || !invite) return { granted: false };
    if (source === "contract" && !(invite as { can_sign?: boolean }).can_sign) return { granted: false };
    // Company agreements (testimonial releases and the like) never start a trial; gifts come from Admin at launch.
    if (source === "contract") {
      const { data: k } = await supabaseAdmin.from("contracts" as never).select("is_company").eq("id", (invite as { contract_id: string }).contract_id).maybeSingle();
      if ((k as { is_company?: boolean } | null)?.is_company) return { granted: false };
    }

    const subId = `collab_trial_${context.userId}`;
    const { data: existing } = await supabaseAdmin.from("subscriptions").select("id").eq("paddle_subscription_id", subId).maybeSingle();
    if (existing) return { granted: false };

    const inviterId = await inviterOf(supabaseAdmin, source, (data.rowId ?? data.partyId ?? data.ipiRequestId)!);
    const { getRequestHeader, getRequestIP } = await import("@tanstack/react-start/server");
    const ip = getRequestHeader("cf-connecting-ip") ?? getRequestIP({ xForwardedFor: true }) ?? "";
    const ipHash = ip ? hashIp(ip) : null;
    const reason = await trialBlockReason(supabaseAdmin, { userId: context.userId, inviterId, source, ipHash, environment: data.environment });
    if (reason) { console.warn(`Collaborator trial withheld for ${context.userId}: ${reason}`); return { granted: false }; }

    const now = new Date();
    const end = new Date(now.getTime() + COLLAB_TRIAL_DAYS * 86400000);
    const { error: insErr } = await supabaseAdmin.from("subscriptions").insert({
      user_id: context.userId,
      paddle_subscription_id: subId,
      paddle_customer_id: "collab_trial",
      product_id: "collab_trial",
      // Co-writers asked for their IPI get Catalog Plus (their own catalog); split and contract signers get Collaborate.
      price_id: source === "ipi_request" ? "catalog_plus_yearly" : "catalog_collaborate_yearly",
      status: "trialing",
      current_period_start: now.toISOString(),
      current_period_end: end.toISOString(),
      environment: data.environment,
    });
    if (insErr) { console.error("Trial insert failed", insErr); return { granted: false }; }
    const email = String((context.claims as { email?: string }).email ?? "");
    await supabaseAdmin.from("trial_grants" as never).insert({ user_id: context.userId, inviter_id: inviterId, source, ip_hash: ipHash, email_domain: email.split("@")[1]?.toLowerCase() ?? null } as never);
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
      .select("id, paddle_customer_id, current_period_end, price_id")
      .eq("paddle_subscription_id", `collab_trial_${context.userId}`)
      .eq("environment", data.environment).maybeSingle();
    if (!sub || sub.paddle_customer_id === "collab_trial_reminded" || !sub.current_period_end) return { sent: false };
    const email = (context.claims as { email?: string }).email;
    if (!email) return { sent: false };
    const plans = `${trustedOrigin(data.origin, SITE_URL)}/plans`;
    const sent = await sendReminderForTrial(supabaseAdmin, sub, email, plans);
    return { sent, daysLeft: daysLeftInWindow(sub.current_period_end) ?? undefined };
  });
