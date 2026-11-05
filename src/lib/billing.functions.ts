import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { BILLING_DEPARTMENTS, resolveAccess } from "@/lib/departments";
import { getPaymentsEnvironment } from "@/lib/payments-env";
import { createBillingStripeClient, getStripeErrorMessage } from "@/lib/stripe.server";
import { PRICE_TIER, TIER_LABEL, refundDaysLeft } from "@/lib/plans";
import { formatUsd, proratedRefundCents, purchaseKindLabel, refundVerdict, type RefundReason } from "@/lib/billing-console";
import {
  DUPLICATE_CHECK_IDS, duplicateRefundBlock, groupPossibleDuplicates, paymentState, readCharge,
  type ChargeFacts, type ChargeReading, type DuplicateGroup,
} from "@/lib/duplicate-charges";

/**
 * The billing console's server side (founder, 2026-11-05). Finance and super admins refund a payment or cancel a plan
 * from Admin → Billing, so routine billing never needs a Stripe dashboard login. The browser only names the target; the
 * server decides whether the person may act, what was actually paid, and whether the refund is allowed.
 */

async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

type Ctx = {
  supabase: {
    from: (table: "user_roles") => {
      select: (columns: string) => {
        eq: (column: string, value: unknown) => PromiseLike<{ data: unknown }>;
      };
    };
  };
  userId: string;
  claims?: { email?: string };
};

type PurchaseRow = {
  id: string;
  user_id: string;
  kind: string;
  environment: string;
  details: Record<string, string> | null;
  stripe_session_id: string | null;
  created_at: string | null;
};

type SubRow = {
  price_id: string;
  status: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean | null;
  stripe_subscription_id: string;
  stripe_customer_id: string | null;
  created_at: string | null;
};

export type BillingSubscription = {
  id: string;
  tier: string;
  status: string;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  customerId: string | null;
};

export type BillingPurchase = {
  id: string;
  kind: string;
  label: string;
  createdAt: string;
  refundedAt: string | null;
  windowDaysLeft: number;
  refundable: boolean;
};

export type BillingMember = {
  userId: string;
  email: string;
  name: string;
  confirmed: boolean;
  subscriptions: BillingSubscription[];
  purchases: BillingPurchase[];
};

export type PaymentInfo = { paidCents: number; refundedCents: number; currency: string; windowDaysLeft: number; paymentIntent: string | null };
export type PlanChargeInfo = { chargeId: string; paidCents: number; refundedCents: number; currency: string; windowDaysLeft: number; proratedCents: number };

export type BillingAction = {
  createdAt: string;
  actorEmail: string;
  action: string;
  targetEmail: string;
  amountCents: number | null;
  currency: string | null;
  reason: string;
  status: string;
  error: string | null;
};

/** Finance and super admins only. The department check mirrors `public.can_see_billing`. */
async function requireBilling(context: Ctx): Promise<{ isSuper: boolean; actorEmail: string }> {
  const { data } = await context.supabase.from("user_roles").select("role, departments").eq("user_id", context.userId);
  const access = resolveAccess((data ?? []) as { role: string; departments?: string[] | null }[]);
  if (!access) throw new Error("Billing is for the Billing and Finance teams and super admins.");
  const isSuper = access.role === "super_admin";
  const inBilling = BILLING_DEPARTMENTS.some((d) => access.departments.includes(d));
  if (!isSuper && !inBilling) throw new Error("Billing is for the Billing and Finance teams and super admins.");
  return { isSuper, actorEmail: context.claims?.email ?? "" };
}

/** Everything a refund already took, so a second one can't overdraw the payment. */
async function refundedOn(stripe: ReturnType<typeof createBillingStripeClient>, paymentIntent: string): Promise<number> {
  const list = await stripe.refunds.list({ payment_intent: paymentIntent, limit: 100 });
  return list.data.filter((r) => r.status !== "failed" && r.status !== "canceled").reduce((sum, r) => sum + r.amount, 0);
}

async function record(entry: {
  actorId: string;
  actorEmail: string;
  targetUserId: string | null;
  targetEmail: string;
  action: "refund" | "cancel_plan" | "resume_plan";
  target: string;
  stripeObject: string | null;
  amountCents: number | null;
  currency: string | null;
  reason: string;
  status: "done" | "failed";
  error: string | null;
  environment: string;
  requestId: string | null;
}) {
  const d = await db();
  const { error } = await d.from("billing_actions" as never).insert({
    actor_id: entry.actorId,
    actor_email: entry.actorEmail,
    target_user_id: entry.targetUserId,
    target_email: entry.targetEmail,
    action: entry.action,
    target: entry.target,
    stripe_object: entry.stripeObject,
    amount_cents: entry.amountCents,
    currency: entry.currency,
    reason: entry.reason,
    status: entry.status,
    error: entry.error,
    environment: entry.environment,
    request_id: entry.requestId,
  } as never);
  // Money has already moved (or not); a missing log line must never turn a real refund into an error on screen.
  if (error) console.error("Billing log line failed:", error.message);
}

const emailInput = z.object({ email: z.string().trim().min(3).max(320) });

/** One member, their plans and their one-time purchases, by email. */
export const lookupBillingMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => emailInput.parse(d))
  .handler(async ({ data, context }): Promise<BillingMember> => {
    await requireBilling(context as unknown as Ctx);
    const env = getPaymentsEnvironment();
    const d = await db();
    const { data: found } = await d.rpc("billing_find_user" as never, { _email: data.email } as never);
    const userId = typeof found === "string" ? found : null;
    if (!userId) throw new Error("No account with that email. Check the spelling, or search the address they paid with.");
    const [{ data: profile }, { data: subs }, { data: purchases }, account] = await Promise.all([
      d.from("profiles").select("stage_name, legal_name").eq("id", userId).maybeSingle(),
      d.from("subscriptions").select("price_id, status, current_period_end, cancel_at_period_end, stripe_subscription_id, stripe_customer_id, created_at")
        .eq("user_id", userId).eq("environment", env).not("stripe_subscription_id", "is", null).order("created_at", { ascending: false }),
      d.from("purchases").select("id, kind, details, environment, stripe_session_id, created_at")
        .eq("user_id", userId).eq("environment", env).order("created_at", { ascending: false }).limit(30),
      d.auth.admin.getUserById(userId),
    ]);
    const prof = profile as { stage_name: string | null; legal_name: string | null } | null;
    // The admin lookup's response type varies by SDK build; read the two fields we need without depending on it.
    const authUser = (account as unknown as { data?: { user?: { email?: string | null; email_confirmed_at?: string | null } | null } | null }).data?.user ?? null;
    const subRows = (subs ?? []) as SubRow[];
    const buyRows = (purchases ?? []) as PurchaseRow[];
    return {
      userId,
      email: authUser?.email ?? data.email,
      name: prof?.stage_name || prof?.legal_name || "No name on the profile yet",
      confirmed: !!authUser?.email_confirmed_at,
      subscriptions: subRows.map((s) => ({
        id: s.stripe_subscription_id,
        tier: PRICE_TIER[s.price_id] ? TIER_LABEL[PRICE_TIER[s.price_id]!] : s.price_id,
        status: s.status,
        currentPeriodEnd: s.current_period_end,
        cancelAtPeriodEnd: !!s.cancel_at_period_end,
        customerId: s.stripe_customer_id,
      })),
      purchases: buyRows.map((p) => {
        const refundedAt = p.details?.["refunded_at"] ?? null;
        const left = refundDaysLeft(p.created_at);
        return {
          id: p.id,
          kind: p.kind,
          label: purchaseKindLabel(p.kind),
          createdAt: p.created_at ?? "",
          refundedAt,
          windowDaysLeft: left,
          refundable: !refundedAt,
        };
      }),
    };
  });

/** What was paid, what came back, and how much window is left, for one purchase. */
export const purchasePaymentInfo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ purchaseId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<PaymentInfo> => {
    await requireBilling(context as unknown as Ctx);
    const d = await db();
    const { data: row } = await d.from("purchases").select("id, user_id, kind, environment, details, stripe_session_id, created_at").eq("id", data.purchaseId).maybeSingle();
    const p = row as PurchaseRow | null;
    if (!p) throw new Error("That purchase no longer exists.");
    const env = getPaymentsEnvironment();
    if (p.environment !== env) throw new Error("That purchase belongs to the other Stripe mode, so it can't be refunded from here.");
    if (!p.stripe_session_id) throw new Error("This purchase has no Stripe payment behind it to refund.");
    try {
      const stripe = createBillingStripeClient(env);
      const session = await stripe.checkout.sessions.retrieve(p.stripe_session_id);
      const pi = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id ?? null;
      return {
        paidCents: session.amount_total ?? 0,
        refundedCents: pi ? await refundedOn(stripe, pi) : 0,
        currency: (session.currency ?? "usd").toUpperCase(),
        windowDaysLeft: refundDaysLeft(p.created_at),
        paymentIntent: pi,
      };
    } catch (e) {
      throw new Error(`Stripe couldn't read that payment: ${getStripeErrorMessage(e)}`);
    }
  });

const refundFields = {
  amountCents: z.number().int().positive().max(10_000_000),
  reason: z.enum(["requested_by_customer", "duplicate", "fraudulent"]),
  note: z.string().max(300).optional(),
  requestId: z.string().uuid(),
  /** Only for reason "duplicate": the four checks the person ticked. The server re-checks Stripe regardless. */
  duplicateChecks: z.array(z.enum(DUPLICATE_CHECK_IDS)).max(DUPLICATE_CHECK_IDS.length).optional(),
};

/** Refund a one-time purchase (Expert Registration, AI Protection, branding, renewals, contracts, seats). */
export const refundPurchase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ purchaseId: z.string().uuid(), ...refundFields }).parse(d))
  .handler(async ({ data, context }): Promise<{ refundId: string; amountCents: number; status: string | null }> => {
    const ctx = context as unknown as Ctx;
    const { actorEmail } = await requireBilling(ctx);
    const env = getPaymentsEnvironment();
    const d = await db();
    const { data: row } = await d.from("purchases").select("id, user_id, kind, environment, details, stripe_session_id, created_at").eq("id", data.purchaseId).maybeSingle();
    const p = row as PurchaseRow | null;
    if (!p) throw new Error("That purchase no longer exists.");
    if (p.environment !== env) throw new Error("That purchase belongs to the other Stripe mode, so it can't be refunded from here.");
    if (!p.stripe_session_id) throw new Error("This purchase has no Stripe payment behind it to refund.");

    const stripe = createBillingStripeClient(env);
    let pi: string | null = null;
    let paidCents = 0;
    let refundedCents = 0;
    try {
      const session = await stripe.checkout.sessions.retrieve(p.stripe_session_id);
      pi = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id ?? null;
      paidCents = session.amount_total ?? 0;
      refundedCents = pi ? await refundedOn(stripe, pi) : 0;
    } catch (e) {
      throw new Error(`Stripe couldn't read that payment: ${getStripeErrorMessage(e)}`);
    }
    if (!pi) throw new Error("This payment has no Stripe payment intent, so it can't be refunded automatically.");

    // A "duplicate" refund is a claim about the payment itself (founder, 2026-11-05), so Stripe has to agree the money
    // actually moved before any of it goes back. Otherwise a hold gets "refunded" and the member is paid for a charge
    // that never happened.
    if (data.reason === "duplicate") {
      let state: ReturnType<typeof paymentState> = "failed";
      try {
        state = paymentState((await stripe.paymentIntents.retrieve(pi)).status);
      } catch (e) {
        throw new Error(`Stripe couldn't confirm whether that payment settled: ${getStripeErrorMessage(e)}`);
      }
      const block = duplicateRefundBlock({
        checks: data.duplicateChecks ?? [],
        settled: state === "succeeded",
        held: state === "requires_capture" || state === "processing",
        refunded: refundedCents >= paidCents,
      });
      if (block) {
        await record({ actorId: ctx.userId, actorEmail, targetUserId: p.user_id, targetEmail: "", action: "refund", target: p.id, stripeObject: pi, amountCents: data.amountCents, currency: null, reason: data.reason, status: "failed", error: block, environment: env, requestId: data.requestId });
        throw new Error(block);
      }
    }

    const verdict = refundVerdict({ paidCents, refundedCents, amountCents: data.amountCents, paidAt: p.created_at ?? new Date().toISOString() });
    const why = `${data.reason}${data.note?.trim() ? `: ${data.note.trim()}` : ""}`;
    if (verdict.ok && verdict.discretionary && !data.note?.trim()) {
      throw new Error("Past the 30-day window a refund needs a note saying why. It's allowed — a dispute costs more — but the reason has to be on the record.");
    }
    if (!verdict.ok) {
      await record({ actorId: ctx.userId, actorEmail, targetUserId: p.user_id, targetEmail: "", action: "refund", target: p.id, stripeObject: pi, amountCents: data.amountCents, currency: null, reason: why, status: "failed", error: verdict.reason, environment: env, requestId: data.requestId });
      throw new Error(verdict.reason);
    }

    try {
      const refund = await stripe.refunds.create(
        { payment_intent: pi, amount: data.amountCents, reason: data.reason as RefundReason, metadata: { app: "cta_billing_console", purchase_id: p.id, actor_id: ctx.userId } },
        { idempotencyKey: `cta-refund-${data.requestId}` },
      );
      await record({ actorId: ctx.userId, actorEmail, targetUserId: p.user_id, targetEmail: "", action: "refund", target: p.id, stripeObject: pi, amountCents: refund.amount, currency: refund.currency.toUpperCase(), reason: why, status: "done", error: null, environment: env, requestId: data.requestId });
      return { refundId: refund.id, amountCents: refund.amount, status: refund.status };
    } catch (e) {
      const reason = getStripeErrorMessage(e);
      await record({ actorId: ctx.userId, actorEmail, targetUserId: p.user_id, targetEmail: "", action: "refund", target: p.id, stripeObject: pi, amountCents: data.amountCents, currency: null, reason: why, status: "failed", error: reason, environment: env, requestId: data.requestId });
      throw new Error(`Stripe refused the refund: ${reason}`);
    }
  });

/** The newest paid charge on a plan, which is what a plan refund actually refunds. */
async function latestChargeFor(customerId: string, env: "sandbox" | "live") {
  const stripe = createBillingStripeClient(env);
  const charges = await stripe.charges.list({ customer: customerId, limit: 10 });
  return { stripe, charge: charges.data.find((c) => c.paid && !c.refunded && c.amount - c.amount_refunded > 0) ?? null };
}

export const latestPlanCharge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ subscriptionId: z.string().min(3) }).parse(d))
  .handler(async ({ data, context }): Promise<PlanChargeInfo> => {
    await requireBilling(context as unknown as Ctx);
    const env = getPaymentsEnvironment();
    const d = await db();
    const { data: row } = await d.from("subscriptions").select("stripe_customer_id").eq("stripe_subscription_id", data.subscriptionId).eq("environment", env).maybeSingle();
    const sub = row as { stripe_customer_id: string | null } | null;
    if (!sub?.stripe_customer_id) throw new Error("That plan has no Stripe customer, so there's no card charge to refund.");
    const { charge } = await latestChargeFor(sub.stripe_customer_id, env);
    if (!charge) throw new Error("No refundable charge on that plan.");
    const paidAt = new Date(charge.created * 1000).toISOString();
    return {
      chargeId: charge.id,
      paidCents: charge.amount,
      refundedCents: charge.amount_refunded,
      currency: charge.currency.toUpperCase(),
      windowDaysLeft: refundDaysLeft(paidAt),
      proratedCents: proratedRefundCents({ paidCents: charge.amount - charge.amount_refunded, paidAt }),
    };
  });

/** Refund the newest paid charge of a plan (a yearly renewal went wrong, or they asked inside 30 days). */
export const refundLatestPlanCharge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ subscriptionId: z.string().min(3), ...refundFields }).parse(d))
  .handler(async ({ data, context }): Promise<{ refundId: string; amountCents: number; status: string | null }> => {
    const ctx = context as unknown as Ctx;
    const { actorEmail } = await requireBilling(ctx);
    const env = getPaymentsEnvironment();
    const d = await db();
    const { data: row } = await d.from("subscriptions").select("stripe_customer_id").eq("stripe_subscription_id", data.subscriptionId).eq("environment", env).maybeSingle();
    const sub = row as { stripe_customer_id: string | null } | null;
    if (!sub?.stripe_customer_id) throw new Error("That plan has no Stripe customer, so there's no card charge to refund.");
    const { stripe, charge } = await latestChargeFor(sub.stripe_customer_id, env);
    if (!charge) throw new Error("No refundable charge on that plan.");
    const why = `${data.reason}${data.note?.trim() ? `: ${data.note.trim()}` : ""}`;
    // Same gate as a purchase: "duplicate" means two settled payments, not one charge and the bank's hold.
    if (data.reason === "duplicate") {
      const state = paymentState(charge.status, charge.captured);
      const block = duplicateRefundBlock({
        checks: data.duplicateChecks ?? [],
        settled: state === "succeeded",
        held: state === "requires_capture" || state === "processing",
        refunded: charge.amount_refunded >= charge.amount,
      });
      if (block) {
        await record({ actorId: ctx.userId, actorEmail, targetUserId: null, targetEmail: "", action: "refund", target: data.subscriptionId, stripeObject: charge.id, amountCents: data.amountCents, currency: charge.currency.toUpperCase(), reason: why, status: "failed", error: block, environment: env, requestId: data.requestId });
        throw new Error(block);
      }
    }
    const verdict = refundVerdict({
      paidCents: charge.amount,
      refundedCents: charge.amount_refunded,
      amountCents: data.amountCents,
      paidAt: new Date(charge.created * 1000).toISOString(),
    });
    if (verdict.ok && verdict.discretionary && !data.note?.trim()) {
      throw new Error("Past the 30-day window a refund needs a note saying why. It's allowed — a dispute costs more — but the reason has to be on the record.");
    }
    // Past the window a plan refund covers the unused time only (founder, 2026-11-05), so nobody can refund a year
    // they have already used.
    if (verdict.ok && verdict.discretionary) {
      const unused = proratedRefundCents({ paidCents: charge.amount - charge.amount_refunded, paidAt: new Date(charge.created * 1000).toISOString() });
      if (data.amountCents > unused) {
        throw new Error(`Past 30 days a plan refund covers the unused time only: ${formatUsd(unused)} of ${formatUsd(charge.amount)}.`);
      }
    }
    if (!verdict.ok) {
      await record({ actorId: ctx.userId, actorEmail, targetUserId: null, targetEmail: "", action: "refund", target: data.subscriptionId, stripeObject: charge.id, amountCents: data.amountCents, currency: charge.currency.toUpperCase(), reason: why, status: "failed", error: verdict.reason, environment: env, requestId: data.requestId });
      throw new Error(verdict.reason);
    }
    try {
      const refund = await stripe.refunds.create(
        { charge: charge.id, amount: data.amountCents, reason: data.reason as RefundReason, metadata: { app: "cta_billing_console", subscription_id: data.subscriptionId, actor_id: ctx.userId } },
        { idempotencyKey: `cta-refund-${data.requestId}` },
      );
      await record({ actorId: ctx.userId, actorEmail, targetUserId: null, targetEmail: "", action: "refund", target: data.subscriptionId, stripeObject: charge.id, amountCents: refund.amount, currency: refund.currency.toUpperCase(), reason: why, status: "done", error: null, environment: env, requestId: data.requestId });
      return { refundId: refund.id, amountCents: refund.amount, status: refund.status };
    } catch (e) {
      const reason = getStripeErrorMessage(e);
      await record({ actorId: ctx.userId, actorEmail, targetUserId: null, targetEmail: "", action: "refund", target: data.subscriptionId, stripeObject: charge.id, amountCents: data.amountCents, currency: charge.currency.toUpperCase(), reason: why, status: "failed", error: reason, environment: env, requestId: data.requestId });
      throw new Error(`Stripe refused the refund: ${reason}`);
    }
  });

/** Stop a plan renewing, or let it carry on. Ends at the period end, never mid-year, so nobody loses access they paid for. */
export const setSubscriptionCancellation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ subscriptionId: z.string().min(3), cancel: z.boolean(), requestId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<{ cancelAtPeriodEnd: boolean }> => {
    const ctx = context as unknown as Ctx;
    const { actorEmail } = await requireBilling(ctx);
    const env = getPaymentsEnvironment();
    const d = await db();
    const { data: row } = await d.from("subscriptions").select("user_id, status").eq("stripe_subscription_id", data.subscriptionId).eq("environment", env).maybeSingle();
    const sub = row as { user_id: string; status: string } | null;
    if (!sub) throw new Error("That plan isn't on this account any more.");
    try {
      const stripe = createBillingStripeClient(env);
      const updated = await stripe.subscriptions.update(data.subscriptionId, { cancel_at_period_end: data.cancel });
      await record({ actorId: ctx.userId, actorEmail, targetUserId: sub.user_id, targetEmail: "", action: data.cancel ? "cancel_plan" : "resume_plan", target: data.subscriptionId, stripeObject: data.subscriptionId, amountCents: null, currency: null, reason: data.cancel ? "Stops at the renewal date" : "Renews again", status: "done", error: null, environment: env, requestId: data.requestId });
      return { cancelAtPeriodEnd: !!updated.cancel_at_period_end };
    } catch (e) {
      const reason = getStripeErrorMessage(e);
      await record({ actorId: ctx.userId, actorEmail, targetUserId: sub.user_id, targetEmail: "", action: data.cancel ? "cancel_plan" : "resume_plan", target: data.subscriptionId, stripeObject: data.subscriptionId, amountCents: null, currency: null, reason: data.cancel ? "Stops at the renewal date" : "Renews again", status: "failed", error: reason, environment: env, requestId: data.requestId });
      throw new Error(`Stripe refused that: ${reason}`);
    }
  });

/** The last 25 billing actions, newest first, with who did what. */
export const listBillingActions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<BillingAction[]> => {
    await requireBilling(context as unknown as Ctx);
    const d = await db();
    const { data } = await d.from("billing_actions" as never)
      .select("created_at, actor_email, action, target_email, amount_cents, currency, reason, status, error")
      .order("created_at", { ascending: false }).limit(25);
    const rows = (data ?? []) as {
      created_at: string; actor_email: string; action: string; target_email: string;
      amount_cents: number | null; currency: string | null; reason: string; status: string; error: string | null;
    }[];
    return rows.map((r) => ({
      createdAt: r.created_at, actorEmail: r.actor_email, action: r.action, targetEmail: r.target_email,
      amountCents: r.amount_cents, currency: r.currency, reason: r.reason, status: r.status, error: r.error,
    }));
  });

export type DuplicateChargeRow = ChargeFacts & { reading: ChargeReading };
export type DuplicateCheckResult = { charges: DuplicateChargeRow[]; groups: DuplicateGroup[] };

/**
 * What each of a member's recent payments actually is, straight from Stripe (founder, 2026-11-05), plus any two that
 * look like the same charge twice. The panel shows this before anyone can tick "Duplicate charge" — a hold that a bank
 * app draws like a charge is labelled as a hold, with the date it disappears by.
 *
 * One unreadable payment must never hide the rest, so each lookup is allowed to fail on its own.
 */
export const checkDuplicateCharges = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ userId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<DuplicateCheckResult> => {
    await requireBilling(context as unknown as Ctx);
    const env = getPaymentsEnvironment();
    const d = await db();
    const stripe = createBillingStripeClient(env);
    const [{ data: purchases }, { data: subs }] = await Promise.all([
      d.from("purchases").select("id, kind, stripe_session_id, created_at")
        .eq("user_id", data.userId).eq("environment", env).not("stripe_session_id", "is", null)
        .order("created_at", { ascending: false }).limit(12),
      d.from("subscriptions").select("stripe_customer_id")
        .eq("user_id", data.userId).eq("environment", env).not("stripe_customer_id", "is", null).limit(3),
    ]);

    const facts: ChargeFacts[] = [];
    const buyRows = (purchases ?? []) as { id: string; kind: string; stripe_session_id: string | null; created_at: string | null }[];
    await Promise.all(buyRows.map(async (p) => {
      if (!p.stripe_session_id) return;
      try {
        const session = await stripe.checkout.sessions.retrieve(p.stripe_session_id);
        const pi = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id ?? null;
        if (!pi) return;
        const intent = await stripe.paymentIntents.retrieve(pi, { expand: ["latest_charge"] });
        const charge = typeof intent.latest_charge === "string" ? null : intent.latest_charge;
        facts.push({
          id: charge?.id ?? intent.id,
          paymentIntent: intent.id,
          amountCents: charge?.amount ?? intent.amount,
          refundedCents: charge?.amount_refunded ?? 0,
          currency: (intent.currency ?? "usd").toLowerCase(),
          createdAt: new Date((intent.created ?? 0) * 1000).toISOString(),
          state: paymentState(intent.status, charge?.captured),
          item: purchaseKindLabel(p.kind),
          purchaseId: p.id,
        });
      } catch { /* one unreadable payment must not hide the others */ }
    }));

    const customerId = ((subs ?? []) as { stripe_customer_id: string | null }[]).find((s) => s.stripe_customer_id)?.stripe_customer_id;
    if (customerId) {
      try {
        const charges = await stripe.charges.list({ customer: customerId, limit: 20 });
        for (const c of charges.data) {
          facts.push({
            id: c.id,
            paymentIntent: typeof c.payment_intent === "string" ? c.payment_intent : c.payment_intent?.id ?? null,
            amountCents: c.amount,
            refundedCents: c.amount_refunded,
            currency: c.currency.toLowerCase(),
            createdAt: new Date(c.created * 1000).toISOString(),
            state: paymentState(c.status, c.captured),
            item: "Plan renewal",
            purchaseId: null,
          });
        }
      } catch { /* the purchases above still answer the question */ }
    }

    // A renewal bought through "Renew now" is one payment seen from two places: keep the first reading of it.
    const unique = new Map<string, ChargeFacts>();
    for (const f of facts) unique.set(f.paymentIntent ?? f.id, f);
    const charges = [...unique.values()].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
    return {
      charges: charges.map((c) => ({ ...c, reading: readCharge(c) })),
      groups: groupPossibleDuplicates(charges),
    };
  });
