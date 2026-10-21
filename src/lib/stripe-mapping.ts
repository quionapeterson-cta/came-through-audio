import { z } from "zod";
import { assistanceItems, PRICE_TIER } from "@/lib/plans";
import { PACKAGES } from "@/lib/proof";

/**
 * What the browser may ask to buy. Prices, quantities and the buyer are never taken from the browser: the server
 * turns this into Stripe line items (by lookup key) and attaches the signed-in user's ID itself.
 */
export const checkoutInput = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("plan"), priceId: z.enum(Object.keys(PRICE_TIER) as [string, ...string[]]) }),
  z.object({
    kind: z.literal("ai"),
    package: z.enum(PACKAGES.map((p) => p.id) as [string, ...string[]]),
    trackId: z.string().uuid().optional(),
  }),
  z.object({
    kind: z.literal("expert"),
    type: z.enum(["single", "album"]),
    songs: z.number().int().min(1).max(500),
    agencies: z.array(z.string().trim().min(1).max(60)).min(1).max(12),
  }),
]);
export type CheckoutInput = z.infer<typeof checkoutInput>;

export type CheckoutPlan = {
  mode: "subscription" | "payment";
  items: { lookupKey: string; quantity: number }[];
  /** Copied onto the Stripe session (and subscription) and back into purchases.details by the webhook. */
  metadata: Record<string, string>;
  returnTab?: "protect" | "health";
};

export function planCheckout(input: CheckoutInput, userId: string): CheckoutPlan {
  if (input.kind === "plan") {
    return { mode: "subscription", items: [{ lookupKey: input.priceId, quantity: 1 }], metadata: { userId } };
  }
  if (input.kind === "ai") {
    return {
      mode: "payment",
      items: [{ lookupKey: `ai_protection_${input.package.toLowerCase()}`, quantity: 1 }],
      metadata: { userId, kind: "ai", package: input.package, ...(input.trackId ? { trackId: input.trackId } : {}) },
      returnTab: "protect",
    };
  }
  const songs = input.type === "single" ? Math.min(input.songs, 6) : input.songs;
  // Stripe needs one line per price; the $14.99 setup price can appear twice (base + small extended block).
  const merged = new Map<string, number>();
  for (const i of assistanceItems(input.type, songs, input.agencies.length)) merged.set(i.priceId, (merged.get(i.priceId) ?? 0) + i.quantity);
  return {
    mode: "payment",
    items: [...merged].map(([lookupKey, quantity]) => ({ lookupKey, quantity })),
    metadata: { userId, kind: "expert", type: input.type, songs: String(songs), agencies: input.agencies.join(" | ") },
    returnTab: "health",
  };
}

const iso = (unix: number | null | undefined) => (unix ? new Date(unix * 1000).toISOString() : null);
const idOf = (v: string | { id: string } | null | undefined) => (typeof v === "string" ? v : v?.id ?? null);

/** The parts of a Stripe subscription the app reads. Period dates sit on the item in newer API versions. */
export type StripeSubscriptionLike = {
  id: string;
  customer: string | { id: string };
  status: string;
  metadata?: Record<string, string> | null;
  cancel_at_period_end?: boolean | null;
  cancel_at?: number | null;
  ended_at?: number | null;
  current_period_start?: number | null;
  current_period_end?: number | null;
  items: { data: { price: { lookup_key?: string | null; product: string | { id: string } }; current_period_start?: number | null; current_period_end?: number | null }[] };
};

/** A subscriptions row from a Stripe subscription, or null when it isn't one of our plans. */
export function subscriptionRow(sub: StripeSubscriptionLike, env: "sandbox" | "live", deleted = false) {
  const item = sub.items.data[0];
  const priceId = item?.price.lookup_key;
  if (!item || !priceId || !PRICE_TIER[priceId]) return null;
  return {
    stripe_subscription_id: sub.id,
    stripe_customer_id: idOf(sub.customer),
    product_id: idOf(item.price.product) ?? priceId,
    price_id: priceId,
    status: deleted ? "canceled" : sub.status,
    current_period_start: iso(item.current_period_start ?? sub.current_period_start),
    // An ended subscription stops access when it ends, not at the end of the period it was cancelled in.
    current_period_end: deleted ? iso(sub.ended_at) ?? new Date().toISOString() : iso(item.current_period_end ?? sub.current_period_end),
    cancel_at_period_end: !!sub.cancel_at_period_end || !!sub.cancel_at,
    environment: env,
    updated_at: new Date().toISOString(),
  };
}

/** A purchases row from a completed one-time Checkout Session, or null when it isn't a paid one-time buy. */
export function purchaseRow(
  session: { id: string; mode: string; payment_status: string; metadata?: Record<string, string> | null },
  env: "sandbox" | "live",
) {
  const md = session.metadata ?? {};
  if (session.mode !== "payment" || session.payment_status !== "paid" || !md["userId"] || !md["kind"]) return null;
  const { priceIds = "", managed_payments: _managed, ...details } = md;
  return {
    user_id: md["userId"],
    stripe_session_id: session.id,
    kind: md["kind"],
    price_ids: priceIds.split(",").filter(Boolean),
    details,
    environment: env,
  };
}
