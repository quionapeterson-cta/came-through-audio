import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createStripeClient, getStripeErrorMessage } from "@/lib/stripe.server";
import { checkoutEnvironmentError, getPaymentsEnvironment } from "@/lib/payments-env";
import { checkoutInput, planCheckout } from "@/lib/stripe-mapping";
import { isActiveSub, PRICE_TIER } from "@/lib/plans";
import { purchaseLanding } from "@/lib/purchase-receipt";

/**
 * Sales tax on sales Came Through Audio, LLC makes directly (Expert Assistance). Stays off until Stripe Tax is
 * turned on in the Stripe dashboard, because checkout fails otherwise.
 */
const STRIPE_TAX = false;

async function appOrigin() {
  const { getRequest } = await import("@tanstack/react-start/server");
  return new URL(getRequest().url).origin;
}

// Look up an existing Customer by userId metadata (then by email), or
// create one. Putting userId on the Customer object is what makes later
// reads (portal, dashboards, subscriptions.search) resolvable without
// depending on Session metadata, which is NOT searchable.
async function resolveOrCreateCustomer(
  stripe: ReturnType<typeof createStripeClient>,
  options: { email?: string | undefined; userId: string },
): Promise<string> {
  const found = await stripe.customers.search({ query: `metadata['userId']:'${options.userId}'`, limit: 1 });
  if (found.data[0]) return found.data[0].id;
  if (options.email) {
    const existing = await stripe.customers.list({ email: options.email, limit: 1 });
    const customer = existing.data[0];
    if (customer) {
      if (customer.metadata?.["userId"] !== options.userId) {
        await stripe.customers.update(customer.id, { metadata: { ...customer.metadata, userId: options.userId } });
      }
      return customer.id;
    }
  }
  const created = await stripe.customers.create({
    ...(options.email && { email: options.email }),
    metadata: { userId: options.userId },
  });
  return created.id;
}

type Stripe = ReturnType<typeof createStripeClient>;

/**
 * Stripe keys only exist where payments are switched on (Lovable's environment, or a deployment with its own secret
 * keys). A preview without them used to answer with the bare env-var name, which reads as a broken button; this says
 * what is actually going on and where the purchase does work.
 */
function stripeClient(env: "sandbox" | "live"): Stripe {
  try {
    return createStripeClient(env);
  } catch (e) {
    if (e instanceof Error && e.message.endsWith("is not configured")) {
      console.error("Payments are not configured here:", e.message);
      throw new Error("Card payments aren't switched on in this preview (no Stripe key here). Buy it on the published site: it appears on this account the moment Stripe confirms the payment.");
    }
    throw e;
  }
}

/**
 * A billing-portal page where the customer confirms switching to the plan they picked: Stripe shows the prorated
 * amount and takes the payment. Needs no plan switching set up in the portal settings: if Stripe asks for it, an
 * app-owned portal configuration that allows it is used instead. Picking the plan they already have opens the portal.
 */
async function planSwitchUrl(stripe: Stripe, customer: string, subscriptionId: string, lookupKey: string, returnUrl: string) {
  const [sub, prices] = await Promise.all([
    stripe.subscriptions.retrieve(subscriptionId),
    stripe.prices.list({ lookup_keys: [lookupKey], active: true, limit: 1 }),
  ]);
  const item = sub.items.data[0];
  const price = prices.data[0];
  if (!price) throw new Error("This item isn't available to buy yet. Contact support and we'll help right away.");
  if (!item || item.price.id === price.id) return (await stripe.billingPortal.sessions.create({ customer, return_url: returnUrl })).url;
  const flow = {
    customer,
    return_url: returnUrl,
    flow_data: {
      type: "subscription_update_confirm" as const,
      subscription_update_confirm: { subscription: subscriptionId, items: [{ id: item.id, price: price.id, quantity: 1 }] },
      after_completion: { type: "redirect" as const, redirect: { return_url: `${returnUrl}?checkout=success` } },
    },
  };
  try {
    return (await stripe.billingPortal.sessions.create(flow)).url;
  } catch (e) {
    console.warn("Plan switch with the default portal settings failed, retrying with the app's own:", getStripeErrorMessage(e));
    return (await stripe.billingPortal.sessions.create({ ...flow, configuration: await planSwitchConfiguration(stripe) })).url;
  }
}

/** The app's own portal configuration with plan switching on (made once, found again by its metadata). */
async function planSwitchConfiguration(stripe: Stripe) {
  const existing = await stripe.billingPortal.configurations.list({ active: true, limit: 100 });
  const found = existing.data.find((c) => c.metadata?.["app"] === "cta_plan_switch");
  if (found) return found.id;
  const prices = await stripe.prices.list({ lookup_keys: Object.keys(PRICE_TIER), active: true, limit: 20 });
  const byProduct = new Map<string, string[]>();
  for (const p of prices.data) {
    const product = typeof p.product === "string" ? p.product : p.product.id;
    byProduct.set(product, [...(byProduct.get(product) ?? []), p.id]);
  }
  const created = await stripe.billingPortal.configurations.create({
    metadata: { app: "cta_plan_switch" },
    features: {
      subscription_update: {
        enabled: true,
        default_allowed_updates: ["price"],
        proration_behavior: "always_invoice",
        products: [...byProduct].map(([product, ids]) => ({ product, prices: ids })),
      },
      // Cancelling goes through Profile → Cancel plan, so the Need more time and Pause offers are always seen first.
      subscription_cancel: { enabled: false },
      payment_method_update: { enabled: true },
      invoice_history: { enabled: true },
    },
  });
  return created.id;
}

/**
 * Renew now: a one-time payment for next year's plan at the plan's own price (read from the user's subscription,
 * never the browser). The webhook then moves the renewal a full year past the one paid for.
 */
async function renewCheckout(stripe: Stripe, env: "sandbox" | "live", userId: string, email: string | undefined, origin: string) {
  const [{ admin, loadState }, { canRenewEarly, renewalDate }] = await Promise.all([import("@/lib/retention.server"), import("@/lib/retention")]);
  const s = await loadState(await admin(), userId, env);
  if (!s.sub?.stripe_subscription_id || !canRenewEarly(s.sub, s.pauses)) throw new Error("Renew now isn't available on this plan right now.");
  try {
    const sub = await stripe.subscriptions.retrieve(s.sub.stripe_subscription_id, { expand: ["items.data.price.product"] });
    const price = sub.items.data[0]?.price;
    const product = price && (typeof price.product === "string" ? price.product : price.product.id);
    if (!price?.unit_amount || !product) throw new Error("This plan's price couldn't be read.");
    const name = typeof price.product === "object" && "name" in price.product ? price.product.name : "Plan";
    const session = await stripe.checkout.sessions.create({
      line_items: [{ price_data: { currency: price.currency, product, unit_amount: price.unit_amount }, quantity: 1 }],
      mode: "payment",
      ui_mode: "embedded_page",
      return_url: `${origin}${purchaseLanding("renew")}`,
      customer: await resolveOrCreateCustomer(stripe, { email, userId }),
      client_reference_id: userId,
      payment_intent_data: { description: `${name}: next year, renewed early` },
      metadata: { userId, kind: "renew", subscription: sub.id, renews: renewalDate(s.sub)!.toISOString(), priceIds: price.lookup_key ?? "", managed_payments: "true" },
      managed_payments: { enabled: true },
    } as Parameters<typeof stripe.checkout.sessions.create>[0]);
    if (!session.client_secret) throw new Error("Stripe did not return a client secret");
    return { clientSecret: session.client_secret };
  } catch (e) {
    const reason = getStripeErrorMessage(e);
    console.error("Renew now checkout failed:", reason, e);
    throw new Error(`Checkout could not open (${reason.slice(0, 200)}). Try again, or contact support and we'll help right away.`);
  }
}

/**
 * The environment the database counts (site_settings `payments`), or `null` when the row isn't set. `read: false`
 * means the read itself failed, and checkout is never blocked for that: a database hiccup must not close the shop.
 */
async function countedPaymentsEnvironment(): Promise<{ read: false } | { read: true; env: "sandbox" | "live" | null }> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.from("site_settings").select("content").eq("id", "payments").maybeSingle();
    if (error) throw new Error(error.message);
    const value = (data?.content as { environment?: string } | null)?.environment;
    return { read: true, env: value === "live" || value === "sandbox" ? value : null };
  } catch (e) {
    console.error("Could not read the payments environment; letting checkout through:", e);
    return { read: false };
  }
}

/**
 * Starts a checkout for the signed-in user. The buyer, prices and quantities are set here from what they chose,
 * never taken from the browser. Returns an embedded-checkout client secret, or, for someone who already has a
 * plan, a billing-portal link to switch plans (prorated) so nobody pays for two plans.
 */
export const createCheckoutSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => checkoutInput.parse(d))
  .handler(async ({ data, context }): Promise<{ clientSecret: string } | { portalUrl: string }> => {
    const env = getPaymentsEnvironment();
    // A checkout in one mode while the database counts the other takes money for a plan that never shows, or hands
    // out a paid plan for free (founder, 2026-11-12). Refused before Stripe is called, so nothing is charged.
    const counted = await countedPaymentsEnvironment();
    if (counted.read) {
      const refusal = checkoutEnvironmentError(env, counted.env);
      if (refusal) throw new Error(refusal);
    }
    const stripe = stripeClient(env);
    const origin = await appOrigin();
    // No confirmation check here any more (founder, 2026-11-05): paying comes first and the confirmation link is a
    // reminder that arrives alongside the purchase, so the email gate that used to stand in front of Stripe is gone.
    if (data.kind === "renew") return renewCheckout(stripe, env, context.userId, (context.claims as { email?: string }).email, origin);
    // Seat handoff: the artist starts a normal plan at the seat's tier, and the first charge waits for the seat's paid
    // period to end. The seat is read here, so the tier, the buyer and the date can't come from the browser.
    if (data.kind === "seat_handoff") {
      const { data: row, error } = await context.supabase.from("artist_seats" as never)
        .select("id, tier, status, member_user_id, current_period_end" as never)
        .eq("id" as never, data.seatId as never).maybeSingle();
      if (error) throw new Error(`Couldn't open that seat (${error.message}).`);
      const seat = row as { id: string; tier: string; status: string; member_user_id: string | null; current_period_end: string | null } | null;
      if (!seat || seat.member_user_id !== context.userId) throw new Error("That artist seat isn't on your account.");
      if (seat.status === "handed_off") throw new Error("You're already paying for this plan yourself.");
      if (seat.status === "ended") throw new Error("This seat has ended, so there is nothing to take over.");
      // A second click while the first handoff settles must not open a second plan: one live plan is the limit.
      const { data: mine } = await context.supabase.from("subscriptions")
        .select("status, current_period_end")
        .eq("user_id", context.userId).eq("environment", env)
        .not("stripe_subscription_id", "is", null);
      if (((mine ?? []) as { status: string; current_period_end: string | null }[]).some((s) => isActiveSub(s))) {
        throw new Error("You already have a plan of your own. Change or cancel it first in Profile → Manage billing, so you're never charged twice.");
      }
      const end = seat.current_period_end ? new Date(seat.current_period_end) : null;
      if (!end || end.getTime() <= Date.now()) throw new Error("This seat's paid period has ended, so there is nothing to take over.");
      const lookupKey = Object.entries(PRICE_TIER).find(([, t]) => t === seat.tier)?.[0];
      if (!lookupKey) throw new Error("This seat's plan isn't available right now. Contact support and we'll help.");
      try {
        const prices = await stripe.prices.list({ lookup_keys: [lookupKey], active: true, expand: ["data.product"], limit: 1 });
        const price = prices.data[0];
        if (!price) throw new Error("This seat's plan isn't available right now. Contact support and we'll help.");
        // Stripe's earliest trial_end is 48 hours out; a handoff in the last two days of the period therefore starts its
        // first charge just after the renewal rather than before it. Nothing is ever charged at handoff.
        const trialEnd = Math.max(
          Math.floor(end.getTime() / 1000),
          Math.floor(Date.now() / 1000) + 48 * 60 * 60,
        );
        const session = await stripe.checkout.sessions.create({
          line_items: [{ price: price.id, quantity: 1 }],
          mode: "subscription",
          ui_mode: "embedded_page",
          return_url: `${origin}/profile?checkout=success`,
          customer: await resolveOrCreateCustomer(stripe, { email: (context.claims as { email?: string }).email, userId: context.userId }),
          client_reference_id: context.userId,
          metadata: { userId: context.userId, kind: "seat_handoff", seatId: seat.id, priceIds: lookupKey, managed_payments: "true" },
          subscription_data: { trial_end: trialEnd, metadata: { userId: context.userId, kind: "seat_handoff", seatId: seat.id } },
          managed_payments: { enabled: true },
        } as Parameters<typeof stripe.checkout.sessions.create>[0]);
        if (!session.client_secret) throw new Error("Stripe did not return a client secret");
        return { clientSecret: session.client_secret };
      } catch (e) {
        const reason = getStripeErrorMessage(e);
        console.error(`Seat handoff checkout failed (${env}):`, reason, e);
        throw new Error(`Checkout could not open (${reason.slice(0, 200)}). Try again, or contact support and we'll help right away.`);
      }
    }
    const plan = planCheckout(data, context.userId);
    if (data.kind === "contract") {
      const { data: gen } = await context.supabase.from("contract_generations" as never).select("id, company, draft, contract_id").eq("id", data.generationId).eq("user_id", context.userId).maybeSingle();
      const g = gen as { company: boolean; draft: unknown; contract_id: string | null } | null;
      if (!g || g.company || !g.draft) throw new Error("That draft wasn't found. Draft it again and try once more.");
      if (g.contract_id) throw new Error("You already have this contract. Open it in My Contracts.");
    }
    // Kits are never refused at checkout (founder, 2026-11-07): anyone can buy as many as they like, whether or not the
    // kit their plan includes is set up yet. The old guard counted saved kits, so buying a second kit waited on filling in
    // the first, which is exactly what the founder hit while testing.
    if (data.kind === "vault") {
      // Pause is only sold when it can start: around renewal, after a failed renewal or during the grace period.
      const [{ admin, loadState }, { offers }] = await Promise.all([import("@/lib/retention.server"), import("@/lib/retention")]);
      const s = await loadState(await admin(), context.userId, env);
      const o = offers(s.sub, s.lapse, s.pauses);
      if (!o.canPause) throw new Error(o.pauseAgain ? "Pause can be used once every 12 months." : "Pause isn't available on this account right now.");
    }

    try {
      // A seat is a second subscription on the same customer, so it never goes through "switch plan". Buying the same
      // tier again is allowed: that is how an owner adds a second or third artist (founder, 2026-11-04).
      if (plan.mode === "subscription" && data.kind !== "seat") {
        const { data: subs } = await context.supabase.from("subscriptions")
          .select("stripe_subscription_id, stripe_customer_id, status, current_period_end")
          .eq("user_id", context.userId).eq("environment", env).not("stripe_subscription_id", "is", null)
          .order("created_at", { ascending: false });
        const current = subs?.find((s) => s.status !== "canceled" && isActiveSub(s));
        if (current?.stripe_customer_id && current.stripe_subscription_id) {
          return { portalUrl: await planSwitchUrl(stripe, current.stripe_customer_id, current.stripe_subscription_id, plan.items[0]!.lookupKey, `${origin}/workspace`) };
        }
      }

      // Resolve human-readable price IDs via lookup_keys.
      const prices = await stripe.prices.list({ lookup_keys: plan.items.map((i) => i.lookupKey), active: true, expand: ["data.product"], limit: 20 });
      const byKey = new Map(prices.data.map((p) => [p.lookup_key, p]));
      const missing = plan.items.find((i) => !byKey.has(i.lookupKey));
      if (missing) {
        console.error(`Stripe price with lookup key ${missing.lookupKey} not found (${env})`);
        throw new Error("This item isn't available to buy yet. Contact support and we'll help right away.");
      }
      const productNames = plan.items.map((i) => {
        const product = byKey.get(i.lookupKey)!.product;
        return typeof product === "object" && "name" in product ? product.name : i.lookupKey;
      });

      const email = (context.claims as { email?: string }).email;
      const customer = await resolveOrCreateCustomer(stripe, { email, userId: context.userId });
      // The page the purchase landed on is the same one the confirmation email's button opens (purchase-receipt.ts).
      const back = `${origin}${purchaseLanding(data.kind)}`;
      const metadata = { ...plan.metadata, priceIds: plan.items.map((i) => i.lookupKey).join(",") };

      const session = await stripe.checkout.sessions.create({
        line_items: plan.items.map((i) => ({ price: byKey.get(i.lookupKey)!.id, quantity: i.quantity })),
        mode: plan.mode,
        ui_mode: "embedded_page",
        return_url: back,
        customer,
        client_reference_id: context.userId,
        // One-off charges: the product name lands on the Charge so the payments dashboard
        // shows it instead of "Unknown product". Subscriptions resolve names server-side.
        ...(plan.mode === "payment" && { payment_intent_data: { description: productNames.join(" + ") } }),
        metadata: plan.managed ? { ...metadata, managed_payments: "true" } : metadata,
        ...(plan.mode === "subscription" && { subscription_data: { metadata: { userId: context.userId } } }),
        // Managed: Stripe handles tax, fraud protection, disputes and transaction support end-to-end.
        ...(plan.managed ? { managed_payments: { enabled: true } } : STRIPE_TAX ? { automatic_tax: { enabled: true } } : {}),
      } as Parameters<typeof stripe.checkout.sessions.create>[0]);
      if (!session.client_secret) throw new Error("Stripe did not return a client secret");
      return { clientSecret: session.client_secret };
    } catch (e) {
      const reason = getStripeErrorMessage(e);
      console.error(`Stripe checkout failed (${data.kind}):`, reason, e);
      if (e instanceof Error && e.message.startsWith("This item")) throw e;
      // Name the reason so a failing checkout can be fixed instead of guessed at (PLAN-registration-intake §0).
      throw new Error(`Checkout could not open (${reason.slice(0, 200)}). Try again, or contact support and we'll help right away.`);
    }
  });

/**
 * Opens the signed-in user's Stripe customer portal: cancel, update the card, see invoices, switch plans. The
 * customer is looked up through the caller's own session, so nobody can open someone else's billing.
 */
export const openBillingPortal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ url: string }> => {
    const env = getPaymentsEnvironment();
    const { data: subs } = await context.supabase.from("subscriptions").select("stripe_customer_id")
      .eq("user_id", context.userId).eq("environment", env)
      .not("stripe_customer_id", "is", null)
      .order("created_at", { ascending: false }).limit(1);
    const customer = subs?.[0]?.stripe_customer_id;
    if (!customer) throw new Error("No plan to manage yet. Pick a plan first.");
    try {
      const portal = await stripeClient(env).billingPortal.sessions.create({ customer, return_url: `${await appOrigin()}/workspace` });
      return { url: portal.url };
    } catch (e) {
      console.error("Stripe portal failed:", getStripeErrorMessage(e));
      throw new Error("Billing couldn't open. Contact support and we'll help right away.");
    }
  });
