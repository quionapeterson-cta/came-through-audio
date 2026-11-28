import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { BILLING_DEPARTMENTS } from "@/lib/departments";
import { getPaymentsEnvironment } from "@/lib/payments-env";
import { requireStaffAccess, type StaffContext } from "@/lib/staff-access.server";
import { getStripeErrorMessage } from "@/lib/stripe.server";

/**
 * The free month Support offers someone who is trying to cancel (founder, 2026-11-28). "Need more time" in the app is
 * the $1.99 pause now, so this staff-only action is the one way the offer gets granted. It runs the same code path the
 * old button did — `extend` in retention.server — so the once-every-12-months record and the "your plan is extended"
 * email still apply, and the grant is written to `billing_actions` with `action = 'free_month'`, so the log names who
 * gave it, to whom and until when.
 *
 * Never advertised: the site, the help centre and the chat desk never mention the free month. A person offers it from
 * Admin → Billing, to someone who is trying to cancel.
 */

async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

const REFUSED = "Only the Billing and Finance teams and super admins can give the free month.";

/** The same people who run the rest of Admin → Billing, through the one staff gate. */
async function requireBillingStaff(context: StaffContext) {
  const access = await requireStaffAccess(context, REFUSED);
  const isSuper = access.role === "super_admin";
  const inBilling = BILLING_DEPARTMENTS.some((d) => access.departments.includes(d));
  if (!isSuper && !inBilling) throw new Error(REFUSED);
  return access;
}

/** The log line. The free time has already been given, so a missing line is reported, never raised. */
async function log(entry: {
  actorId: string;
  actorEmail: string;
  targetUserId: string;
  targetEmail: string;
  target: string;
  reason: string;
  status: "done" | "failed";
  error: string | null;
  environment: string;
}) {
  const d = await db();
  const { error } = await d.from("billing_actions" as never).insert({
    actor_id: entry.actorId,
    actor_email: entry.actorEmail,
    target_user_id: entry.targetUserId,
    target_email: entry.targetEmail,
    action: "free_month",
    target: entry.target,
    stripe_object: entry.target,
    amount_cents: null,
    currency: null,
    reason: entry.reason,
    status: entry.status,
    error: entry.error,
    environment: entry.environment,
  } as never);
  if (error) console.error("Billing log line failed:", error.message);
}

export const grantFreeMonth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ subscriptionId: z.string().min(3), requestId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }): Promise<{ until: string }> => {
    await requireBillingStaff(context);
    const env = getPaymentsEnvironment();
    const d = await db();
    const { data: row } = await d
      .from("subscriptions")
      .select("user_id, cancel_at_period_end")
      .eq("stripe_subscription_id", data.subscriptionId)
      .eq("environment", env)
      .maybeSingle();
    const sub = row as { user_id: string; cancel_at_period_end: boolean | null } | null;
    if (!sub) throw new Error("That plan isn't on this account any more.");
    const { data: who } = await d.auth.admin.getUserById(sub.user_id);
    const entry = {
      actorId: context.userId,
      actorEmail: context.claims?.email ?? "",
      targetUserId: sub.user_id,
      targetEmail: who.user?.email ?? "",
      target: data.subscriptionId,
      environment: env,
    };
    const reason = "The Support offer for someone trying to cancel";
    try {
      // A plan already set to stop is kept on first: the offer's own words are that the plan renews at its normal
      // price when the free month ends, which cannot happen while the cancellation still stands.
      const { admin, extend, setCancelling } = await import("@/lib/retention.server");
      if (sub.cancel_at_period_end) await setCancelling(await admin(), sub.user_id, env, false);
      const granted = await extend(await admin(), sub.user_id, env);
      await log({
        ...entry,
        reason: `${reason} — renews ${granted.until.slice(0, 10)}`,
        status: "done",
        error: null,
      });
      return granted;
    } catch (e) {
      // A rule refusal ("once every 12 months") is written for a person; Stripe's own words are cleaned up.
      const why = e instanceof Error && !("raw" in e) ? e.message : getStripeErrorMessage(e);
      await log({ ...entry, reason, status: "failed", error: why });
      throw new Error(why);
    }
  });
