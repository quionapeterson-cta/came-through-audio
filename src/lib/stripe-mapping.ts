import { z } from "zod";
import { BRANDING_LOOKUP_KEY } from "@/lib/brand-kit";
import { CONTRACT_LOOKUP_KEY } from "@/lib/contract-generator";
import { assistanceItems, assistanceType, PRICE_TIER } from "@/lib/plans";
import { PACKAGES, TRACKS_PER_KEY, packageSongs } from "@/lib/proof";
import { ASSISTANCE_AGENCIES, MAX_NEW_SONGS, newSongKeys } from "@/lib/registration";
import { VAULT_LOOKUP_KEY } from "@/lib/retention";

/**
 * What the browser may ask to buy. Prices, quantities and the buyer are never taken from the browser: the server
 * turns this into Stripe line items (by lookup key) and attaches the signed-in user's ID itself.
 */
export const checkoutInput = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("plan"), priceId: z.enum(Object.keys(PRICE_TIER) as [string, ...string[]]) }),
  z.object({
    kind: z.literal("ai"),
    package: z.enum(PACKAGES.map((p) => p.id) as [string, ...string[]]),
    trackIds: z.array(z.string().uuid()).max(20).optional(),
  }),
  // Pause: the Vault fee, one per month paused, paid up front (PLAN-catalog-emptying §10).
  z.object({ kind: z.literal("vault"), months: z.number().int().min(1).max(3) }),
  // Personal Branding on split sheets: 12 months, bought once at a time (PLAN-master-notes 3.6).
  z.object({ kind: z.literal("branding") }),
  // One generated contract, $3.99 on any plan: the server checks the draft is the buyer's own and not yet paid.
  z.object({ kind: z.literal("contract"), generationId: z.string().uuid() }),
  // Renew now: next year's plan paid early. The server reads the plan and price from the user's own subscription.
  z.object({ kind: z.literal("renew") }),
  z.object({
    kind: z.literal("expert"),
    // Catalog songs picked, plus songs that aren't in the catalog yet (PLAN-registration-intake §1–2).
    trackIds: z.array(z.string().uuid()).max(200).default([]),
    newSongs: z.array(z.object({ title: z.string().trim().min(1).max(120), artist: z.string().trim().max(80) })).max(MAX_NEW_SONGS).default([]),
    agencies: z.array(z.enum(ASSISTANCE_AGENCIES)).min(1).max(ASSISTANCE_AGENCIES.length),
  }),
])
  .refine((a) => a.kind !== "ai" || (a.trackIds?.length ?? 0) <= packageSongs(a.package), { message: "Pick a bigger package for that many songs." })
  .refine((a) => a.kind !== "expert" || new Set(a.trackIds).size + a.newSongs.length > 0, { message: "Choose at least one song." })
  .refine((a) => a.kind !== "expert" || !(a.agencies.includes("ASCAP") && a.agencies.includes("BMI")), { message: "Songwriters can only belong to one PRO. Choose ASCAP or BMI." });
export type CheckoutInput = z.infer<typeof checkoutInput>;

export type CheckoutPlan = {
  mode: "subscription" | "payment";
  items: { lookupKey: string; quantity: number }[];
  /** Copied onto the Stripe session (and subscription) and back into purchases.details by the webhook. */
  metadata: Record<string, string>;
  /** Workspace tab to come back to after paying; "profile" returns to Profile → Brand kit. */
  returnTab?: "protect" | "health" | "learn" | "profile";
  /**
   * Sold through Stripe Managed Payments (Link is merchant of record). Only fully automated digital products
   * qualify, so services our team delivers (Expert Assistance) are sold by Came Through Audio, LLC directly.
   */
  managed: boolean;
};

/** Every checkout except Renew now, which is priced from the user's own subscription (payments.functions). */
export function planCheckout(input: CheckoutInput, userId: string): CheckoutPlan {
  if (input.kind === "renew") throw new Error("Renew now is priced from the subscription itself.");
  if (input.kind === "plan") {
    return { mode: "subscription", items: [{ lookupKey: input.priceId, quantity: 1 }], metadata: { userId }, managed: true };
  }
  if (input.kind === "vault") {
    return { mode: "payment", items: [{ lookupKey: VAULT_LOOKUP_KEY, quantity: input.months }], metadata: { userId, kind: "vault", months: String(input.months) }, managed: true };
  }
  if (input.kind === "contract") {
    return { mode: "payment", items: [{ lookupKey: CONTRACT_LOOKUP_KEY, quantity: 1 }], metadata: { userId, kind: "contract", generation: input.generationId }, returnTab: "learn", managed: true };
  }
  if (input.kind === "branding") {
    return { mode: "payment", items: [{ lookupKey: BRANDING_LOOKUP_KEY, quantity: 1 }], metadata: { userId, kind: "branding" }, returnTab: "profile", managed: true };
  }
  if (input.kind === "ai") {
    // Singles are bought per song (1–3); the other packages are one price for up to their song count.
    const songs = input.package === "Single" ? Math.max(1, input.trackIds?.length ?? 0) : packageSongs(input.package);
    return {
      mode: "payment",
      items: [{ lookupKey: `ai_protection_${input.package.toLowerCase()}`, quantity: input.package === "Single" ? songs : 1 }],
      metadata: { userId, kind: "ai", package: input.package, songs: String(songs), ...trackKeys(input.trackIds ?? []) },
      returnTab: "protect",
      managed: true,
    };
  }
  const trackIds = [...new Set(input.trackIds)];
  const songs = trackIds.length + input.newSongs.length;
  const type = assistanceType(songs);
  // Stripe needs one line per price; the $14.99 setup price can appear twice (base + small extended block).
  const merged = new Map<string, number>();
  for (const i of assistanceItems(type, songs, input.agencies.length)) merged.set(i.priceId, (merged.get(i.priceId) ?? 0) + i.quantity);
  return {
    mode: "payment",
    items: [...merged].map(([lookupKey, quantity]) => ({ lookupKey, quantity })),
    metadata: { userId, kind: "expert", type, songs: String(songs), agencies: input.agencies.join(" | "), ...trackKeys(trackIds), ...newSongKeys(input.newSongs) },
    returnTab: "health",
    managed: false,
  };
}

/** tracks_1, tracks_2…: comma-separated catalog song IDs, read back by paidTrackIds. */
function trackKeys(ids: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < ids.length; i += TRACKS_PER_KEY) out[`tracks_${i / TRACKS_PER_KEY + 1}`] = ids.slice(i, i + TRACKS_PER_KEY).join(",");
  return out;
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
