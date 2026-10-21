import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { type StripeEnv, createStripeClient, getStripeErrorMessage } from "@/lib/stripe.server";

type CheckoutSessionResult = { clientSecret: string } | { error: string };

const PRICE_ID = /^[a-zA-Z0-9_-]+$/;

// Look up an existing Customer by userId metadata (then by email), or
// create one. Putting userId on the Customer object is what makes later
// reads (portal, dashboards, subscriptions.search) resolvable without
// depending on Session metadata, which is NOT searchable.
async function resolveOrCreateCustomer(
  stripe: ReturnType<typeof createStripeClient>,
  options: { email?: string; userId?: string },
): Promise<string> {
  if (options.userId && !/^[a-zA-Z0-9_-]+$/.test(options.userId)) {
    throw new Error("Invalid userId");
  }
  if (options.userId) {
    const found = await stripe.customers.search({
      query: `metadata['userId']:'${options.userId}'`,
      limit: 1,
    });
    if (found.data.length) return found.data[0].id;
  }
  if (options.email) {
    const existing = await stripe.customers.list({ email: options.email, limit: 1 });
    if (existing.data.length) {
      const customer = existing.data[0];
      if (options.userId && customer.metadata?.userId !== options.userId) {
        await stripe.customers.update(customer.id, {
          metadata: { ...customer.metadata, userId: options.userId },
        });
      }
      return customer.id;
    }
  }
  const created = await stripe.customers.create({
    ...(options.email && { email: options.email }),
    ...(options.userId && { metadata: { userId: options.userId } }),
  });
  return created.id;
}

/**
 * Creates an embedded-checkout session. Items use our human-readable price IDs (Stripe lookup keys).
 * customData (userId, kind, package, trackId…) is mirrored onto the Session as metadata so the
 * webhook can credit the right person and record one-time purchases.
 */
export const createCheckoutSession = createServerFn({ method: "POST" })
  .inputValidator((data: {
    items: { priceId: string; quantity: number }[];
    customerEmail?: string;
    userId?: string;
    customData?: Record<string, string>;
    returnUrl: string;
    environment: StripeEnv;
  }) => {
    if (!Array.isArray(data.items) || data.items.length === 0 || data.items.length > 10) throw new Error("No items to check out.");
    for (const i of data.items) {
      if (!PRICE_ID.test(i.priceId)) throw new Error("Invalid priceId");
      if (!Number.isInteger(i.quantity) || i.quantity < 1 || i.quantity > 100) throw new Error("Invalid quantity");
    }
    if (data.userId && !PRICE_ID.test(data.userId)) throw new Error("Invalid userId");
    const meta: Record<string, string> = {};
    for (const [k, v] of Object.entries(data.customData ?? {})) {
      if (!PRICE_ID.test(k) || typeof v !== "string" || v.length > 450) throw new Error("Invalid checkout data");
      meta[k] = v;
    }
    return { ...data, customData: meta };
  })
  .handler(async ({ data }): Promise<CheckoutSessionResult> => {
    try {
      const stripe = createStripeClient(data.environment);

      // Resolve human-readable price IDs via lookup_keys.
      const lineItems: { price: string; quantity: number }[] = [];
      let isRecurring = false;
      const productNames: string[] = [];
      for (const item of data.items) {
        const prices = await stripe.prices.list({ lookup_keys: [item.priceId] });
        if (!prices.data.length) throw new Error(`Price not found: ${item.priceId}`);
        const stripePrice = prices.data[0];
        if (stripePrice.type === "recurring") isRecurring = true;
        lineItems.push({ price: stripePrice.id, quantity: item.quantity });
        const productId = typeof stripePrice.product === "string" ? stripePrice.product : stripePrice.product.id;
        productNames.push((await stripe.products.retrieve(productId)).name);
      }

      const customerId = (data.customerEmail || data.userId)
        ? await resolveOrCreateCustomer(stripe, { email: data.customerEmail, userId: data.userId })
        : undefined;

      const metadata = { ...data.customData, ...(data.userId && { userId: data.userId }) };

      const session = await stripe.checkout.sessions.create({
        line_items: lineItems,
        mode: isRecurring ? "subscription" : "payment",
        ui_mode: "embedded_page",
        return_url: data.returnUrl,
        ...(customerId && { customer: customerId }),
        // One-off charges: the product name lands on the Charge so the payments dashboard
        // shows it instead of "Unknown product". Subscriptions resolve names server-side.
        ...(!isRecurring && { payment_intent_data: { description: productNames.join(" + ") } }),
        metadata: { ...metadata, managed_payments: "true" },
        ...(data.userId && isRecurring && { subscription_data: { metadata: { userId: data.userId } } }),
        // Stripe handles tax, fraud protection, disputes and transaction support end-to-end.
        managed_payments: { enabled: true },
      } as Parameters<typeof stripe.checkout.sessions.create>[0]);

      return { clientSecret: session.client_secret ?? "" };
    } catch (error) {
      return { error: getStripeErrorMessage(error) };
    }
  });

/**
 * Switches the signed-in user's active plan to a new price, pro-rated and effective immediately
 * (upgrades charge the difference now; downgrades credit it). The webhook updates local access.
 */
export const changePlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { priceId: string; environment: StripeEnv }) => {
    if (!PRICE_ID.test(data.priceId)) throw new Error("Invalid priceId");
    return data;
  })
  .handler(async ({ data, context }): Promise<{ ok: true } | { error: string }> => {
    const { data: subs } = await context.supabase.from("subscriptions")
      .select("stripe_subscription_id, price_id, status, current_period_end")
      .eq("user_id", context.userId).eq("environment", data.environment)
      .order("created_at", { ascending: false });
    const row = (subs ?? []).find((s) => s.stripe_subscription_id
      && (["active", "trialing", "past_due"].includes(s.status)
        || (s.status === "canceled" && s.current_period_end && new Date(s.current_period_end) > new Date())));
    if (!row?.stripe_subscription_id) return { error: "No active plan to change. Pick a plan to subscribe first." };
    if (row.price_id === data.priceId) return { error: "That's already your plan." };
    try {
      const stripe = createStripeClient(data.environment);
      const prices = await stripe.prices.list({ lookup_keys: [data.priceId] });
      if (!prices.data.length) throw new Error("Price not found");
      const sub = await stripe.subscriptions.retrieve(row.stripe_subscription_id);
      const item = sub.items?.data?.[0];
      if (!item) throw new Error("Subscription has no items");
      await stripe.subscriptions.update(row.stripe_subscription_id, {
        items: [{ id: item.id, price: prices.data[0].id }],
        proration_behavior: "create_prorations",
      });
      return { ok: true };
    } catch (error) {
      return { error: getStripeErrorMessage(error) };
    }
  });

/**
 * Opens the signed-in user's Stripe customer portal: cancel, update the card, see invoices. The subscription is
 * looked up through the caller's own session, so nobody can open someone else's billing.
 */
export const openBillingPortal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { environment: StripeEnv; returnUrl?: string }) => ({ environment: data.environment === "live" ? "live" as const : "sandbox" as const, returnUrl: data.returnUrl }))
  .handler(async ({ data, context }): Promise<{ url: string } | { error: string }> => {
    const { data: subs } = await context.supabase.from("subscriptions").select("stripe_customer_id")
      .eq("user_id", context.userId).eq("environment", data.environment)
      .not("stripe_customer_id", "is", null)
      .order("created_at", { ascending: false }).limit(1);
    const sub = subs?.[0];
    if (!sub?.stripe_customer_id) return { error: "No plan to manage yet. Pick a plan first." };
    try {
      const stripe = createStripeClient(data.environment);
      const portal = await stripe.billingPortal.sessions.create({
        customer: sub.stripe_customer_id,
        ...(data.returnUrl && { return_url: data.returnUrl }),
      });
      return { url: portal.url };
    } catch (error) {
      return { error: getStripeErrorMessage(error) };
    }
  });
