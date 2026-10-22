import { describe, expect, it } from "vitest";
import { checkoutInput, planCheckout, purchaseRow, subscriptionRow, type StripeSubscriptionLike } from "./stripe-mapping";
import { paidTrackIds } from "./proof";
import { orderSongsOf } from "./registration";

const uuid = (i: number) => `3f1c2b8e-1d2a-4c3b-9e8f-${String(i).padStart(12, "0")}`;

const sub = (over: Partial<StripeSubscriptionLike> = {}): StripeSubscriptionLike => ({
  id: "sub_1",
  customer: "cus_1",
  status: "active",
  metadata: { userId: "u1" },
  cancel_at_period_end: false,
  items: { data: [{ price: { lookup_key: "catalog_collaborate_yearly", product: "prod_1" }, current_period_start: 1_800_000_000, current_period_end: 1_831_536_000 }] },
  ...over,
});

describe("checkout input", () => {
  it("rejects prices the browser makes up and unknown plans", () => {
    expect(() => checkoutInput.parse({ kind: "plan", priceId: "free_forever" })).toThrow();
    expect(() => checkoutInput.parse({ kind: "ai", package: "Huge" })).toThrow();
    expect(() => checkoutInput.parse({ kind: "expert", trackIds: [uuid(1)], agencies: ["MLC"] })).toThrow();
    expect(() => checkoutInput.parse({ kind: "expert", trackIds: [], agencies: ["The MLC"] })).toThrow();
    expect(() => checkoutInput.parse({ kind: "expert", trackIds: [uuid(1)], agencies: ["ASCAP", "BMI"] })).toThrow();
  });

  it("ignores a user ID or price sent from the browser", () => {
    const parsed = checkoutInput.parse({ kind: "plan", priceId: "catalog_plus_yearly", userId: "someone-else", items: [{ priceId: "x" }] });
    expect(planCheckout(parsed, "me")).toEqual({ mode: "subscription", items: [{ lookupKey: "catalog_plus_yearly", quantity: 1 }], metadata: { userId: "me" }, managed: true });
  });
});

describe("planCheckout", () => {
  it("maps an AI Protection package to its one-time price", () => {
    const p = planCheckout({ kind: "ai", package: "EP", trackIds: ["3f1c2b8e-1d2a-4c3b-9e8f-0a1b2c3d4e5f"] }, "me");
    expect(p.mode).toBe("payment");
    expect(p.items).toEqual([{ lookupKey: "ai_protection_ep", quantity: 1 }]);
    expect(p.metadata).toMatchObject({ userId: "me", kind: "ai", package: "EP", tracks_1: "3f1c2b8e-1d2a-4c3b-9e8f-0a1b2c3d4e5f" });
    expect(p.returnTab).toBe("protect");
    expect(p.managed).toBe(true);
  });

  it("carries up to 20 picked songs in metadata chunks a Stripe value can hold", () => {
    const ids = Array.from({ length: 20 }, (_, i) => `3f1c2b8e-1d2a-4c3b-9e8f-${String(i).padStart(12, "0")}`);
    const p = planCheckout(checkoutInput.parse({ kind: "ai", package: "Plus", trackIds: ids }), "me");
    expect(Object.values(p.metadata).every((v) => v.length <= 500)).toBe(true);
    expect(paidTrackIds([{ kind: "ai", details: p.metadata }])).toEqual(ids);
    expect(() => checkoutInput.parse({ kind: "ai", package: "Single", trackIds: ids.slice(0, 4) })).toThrow();
    const singles = planCheckout(checkoutInput.parse({ kind: "ai", package: "Single", trackIds: ids.slice(0, 3) }), "me");
    expect(singles.items).toEqual([{ lookupKey: "ai_protection_single", quantity: 3 }]);
    expect(singles.metadata["songs"]).toBe("3");
  });

  it("prices Expert Assistance on the server and merges repeated prices into one line", () => {
    // 24 album songs: base album fee + one small extended block ($14.99) + per-song-per-agency.
    const ids = Array.from({ length: 22 }, (_, i) => uuid(i));
    const p = planCheckout(checkoutInput.parse({ kind: "expert", trackIds: ids, newSongs: [{ title: "New One", artist: "Me" }, { title: "New Two", artist: "" }], agencies: ["The MLC", "BMI"] }), "me");
    expect(p.items).toEqual([
      { lookupKey: "expert_setup_album", quantity: 1 },
      { lookupKey: "expert_setup_single", quantity: 1 },
      { lookupKey: "expert_per_song_agency", quantity: 48 },
    ]);
    expect(p.metadata).toMatchObject({ userId: "me", kind: "expert", type: "album", songs: "24", agencies: "The MLC | BMI" });
    expect(Object.keys(p.metadata).length).toBeLessThanOrEqual(50);
    expect(Object.values(p.metadata).every((v) => v.length <= 500)).toBe(true);
    // The webhook reads back exactly the songs that were paid for.
    expect(orderSongsOf(p.metadata)).toEqual({ trackIds: ids, newSongs: [{ title: "New One", artist: "Me" }, { title: "New Two", artist: "" }] });
    // A service our team delivers can't go through Managed Payments.
    expect(p.managed).toBe(false);
  });

  it("sets Single/EP or album from the songs picked, counting each song once", () => {
    const p = planCheckout(checkoutInput.parse({ kind: "expert", trackIds: [uuid(1), uuid(1), uuid(2)], agencies: ["ASCAP"] }), "me");
    expect(p.items).toEqual([{ lookupKey: "expert_setup_single", quantity: 1 }, { lookupKey: "expert_per_song_agency", quantity: 2 }]);
    expect(p.metadata["type"]).toBe("single");
    expect(p.metadata["songs"]).toBe("2");
  });

  it("handles the largest order Stripe metadata can carry", () => {
    const p = planCheckout(checkoutInput.parse({ kind: "expert", trackIds: Array.from({ length: 200 }, (_, i) => uuid(i)), newSongs: Array.from({ length: 20 }, (_, i) => ({ title: "x".repeat(120), artist: "y".repeat(78) + i })), agencies: ["ASCAP", "The MLC", "SoundExchange"] }), "me");
    expect(Object.keys(p.metadata).length).toBeLessThanOrEqual(50 - 1); // priceIds is added at checkout
    expect(Object.values(p.metadata).every((v) => v.length <= 500)).toBe(true);
  });
});

describe("subscriptionRow", () => {
  it("maps a plan subscription to its tier price and period", () => {
    const row = subscriptionRow(sub(), "sandbox")!;
    expect(row).toMatchObject({
      stripe_subscription_id: "sub_1", stripe_customer_id: "cus_1", price_id: "catalog_collaborate_yearly",
      product_id: "prod_1", status: "active", cancel_at_period_end: false, environment: "sandbox",
      current_period_end: new Date(1_831_536_000 * 1000).toISOString(),
    });
  });

  it("reads period dates from the subscription on older API versions", () => {
    const row = subscriptionRow(sub({ current_period_end: 1_900_000_000, items: { data: [{ price: { lookup_key: "catalog_plus_yearly", product: { id: "prod_2" } } }] } }), "live")!;
    expect(row.current_period_end).toBe(new Date(1_900_000_000 * 1000).toISOString());
    expect(row.product_id).toBe("prod_2");
  });

  it("marks a scheduled cancellation", () => {
    expect(subscriptionRow(sub({ cancel_at: 1_831_536_000 }), "live")!.cancel_at_period_end).toBe(true);
  });

  it("ends access when the subscription ends, not at the old period end", () => {
    const row = subscriptionRow(sub({ status: "canceled", ended_at: 1_810_000_000 }), "live", true)!;
    expect(row.status).toBe("canceled");
    expect(row.current_period_end).toBe(new Date(1_810_000_000 * 1000).toISOString());
  });

  it("skips prices that aren't one of our plans", () => {
    expect(subscriptionRow(sub({ items: { data: [{ price: { lookup_key: "ai_protection_single", product: "p" } }] } }), "live")).toBeNull();
    expect(subscriptionRow(sub({ items: { data: [{ price: { lookup_key: null, product: "p" } }] } }), "live")).toBeNull();
  });
});

describe("purchaseRow", () => {
  const session = { id: "cs_1", mode: "payment", payment_status: "paid", metadata: { userId: "u1", kind: "ai", package: "Single", priceIds: "ai_protection_single", managed_payments: "true" } };

  it("records a paid one-time buy keyed by its checkout session", () => {
    expect(purchaseRow(session, "sandbox")).toEqual({
      user_id: "u1", stripe_session_id: "cs_1", kind: "ai", price_ids: ["ai_protection_single"],
      details: { userId: "u1", kind: "ai", package: "Single" }, environment: "sandbox",
    });
  });

  it("ignores unpaid, subscription and unlabelled sessions", () => {
    expect(purchaseRow({ ...session, payment_status: "unpaid" }, "live")).toBeNull();
    expect(purchaseRow({ ...session, mode: "subscription" }, "live")).toBeNull();
    expect(purchaseRow({ ...session, metadata: { kind: "ai" } }, "live")).toBeNull();
  });
});
