import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createStripeClient, getStripeErrorMessage } from "@/lib/stripe.server";
import { getPaymentsEnvironment } from "@/lib/payments-env";
import { checkoutInput, planCheckout } from "@/lib/stripe-mapping";
import { isActiveSub, PRICE_TIER } from "@/lib/plans";

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
 * Starts a checkout for the signed-in user. The buyer, prices and quantities are set here from what they chose,
 * never taken from the browser. Returns an embedded-checkout client secret, or, for someone who already has a
 * plan, a billing-portal link to switch plans (prorated) so nobody pays for two plans.
 */
export const createCheckoutSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => checkoutInput.parse(d))
  .handler(async ({ data, context }): Promise<{ clientSecret: string } | { portalUrl: string }> => {
    const env = getPaymentsEnvironment();
    const stripe = createStripeClient(env);
    const origin = await appOrigin();
    const plan = planCheckout(data, context.userId);
    if (data.kind === "vault") {
      // Pause is only sold when it can start: around renewal, after a failed renewal or during the grace period.
      const [{ admin, loadState }, { offers }] = await Promise.all([import("@/lib/retention.server"), import("@/lib/retention")]);
      const s = await loadState(await admin(), context.userId, env);
      const o = offers(s.sub, s.lapse, s.pauses);
      if (!o.canPause) throw new Error(o.pauseAgain ? "Pause can be used once every 12 months." : "Pause isn't available on this account right now.");
    }

    try {
      if (plan.mode === "subscription") {
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
      const back = `${origin}/workspace${plan.returnTab ? `?tab=${plan.returnTab}&` : "?"}checkout=success`;
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
      const portal = await createStripeClient(env).billingPortal.sessions.create({ customer, return_url: `${await appOrigin()}/workspace` });
      return { url: portal.url };
    } catch (e) {
      console.error("Stripe portal failed:", getStripeErrorMessage(e));
      throw new Error("Billing couldn't open. Contact support and we'll help right away.");
    }
  });
