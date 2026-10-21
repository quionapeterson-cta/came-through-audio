import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createStripeClient, getStripeErrorMessage } from "@/lib/stripe.server";
import { getPaymentsEnvironment } from "@/lib/payments-env";
import { checkoutInput, planCheckout } from "@/lib/stripe-mapping";
import { isActiveSub } from "@/lib/plans";

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

    try {
      if (plan.mode === "subscription") {
        const { data: subs } = await context.supabase.from("subscriptions")
          .select("stripe_subscription_id, stripe_customer_id, status, current_period_end")
          .eq("user_id", context.userId).eq("environment", env).not("stripe_subscription_id", "is", null)
          .order("created_at", { ascending: false });
        const current = subs?.find((s) => s.status !== "canceled" && isActiveSub(s));
        if (current?.stripe_customer_id && current.stripe_subscription_id) {
          const params = { customer: current.stripe_customer_id, return_url: `${origin}/workspace` };
          const portal = await stripe.billingPortal.sessions.create({
            ...params,
            flow_data: { type: "subscription_update", subscription_update: { subscription: current.stripe_subscription_id } },
          }).catch(() => stripe.billingPortal.sessions.create(params)); // plan switching not turned on in the portal yet
          return { portalUrl: portal.url };
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
        metadata: { ...metadata, managed_payments: "true" },
        ...(plan.mode === "subscription" && { subscription_data: { metadata: { userId: context.userId } } }),
        // Stripe handles tax, fraud protection, disputes and transaction support end-to-end.
        managed_payments: { enabled: true },
      } as Parameters<typeof stripe.checkout.sessions.create>[0]);
      if (!session.client_secret) throw new Error("Stripe did not return a client secret");
      return { clientSecret: session.client_secret };
    } catch (e) {
      console.error("Stripe checkout failed:", getStripeErrorMessage(e));
      if (e instanceof Error && e.message.startsWith("This item")) throw e;
      throw new Error("Checkout could not open. Try again, or contact support and we'll help right away.");
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
