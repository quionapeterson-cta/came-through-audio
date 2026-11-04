import { describe, expect, it } from "vitest";
import { ARTIST_SEAT_PRICES, PRICE_TIER, SEAT_MAX, SEAT_TIER, highestTier, seatLookupKey } from "./plans";
import { checkoutInput, planCheckout } from "./stripe-mapping";

/** Add-on artist seats: the price staff quote, and the Stripe key checkout buys by (founder, 2026-11-04). */
describe("artist seats", () => {
  it("prices the three seats at the founder's 2026-11-04 rates", () => {
    expect(ARTIST_SEAT_PRICES.map((s) => [s.tier, s.price])).toEqual([
      ["plus", "$18.99"], ["collaborate", "$34.99"], ["management", "$69.99"],
    ]);
    expect(ARTIST_SEAT_PRICES.map((s) => s.monthly)).toEqual([
      "About $1.58 / month", "About $2.92 / month", "About $5.83 / month",
    ]);
  });

  it("maps each seat key to its tier, and back again", () => {
    for (const seat of ARTIST_SEAT_PRICES) {
      expect(SEAT_TIER[seat.lookupKey]).toBe(seat.tier);
      expect(seatLookupKey(seat.tier)).toBe(seat.lookupKey);
    }
    expect(Object.keys(SEAT_TIER)).toHaveLength(3);
  });


  it("buys many artists, on several tiers, with one payment", () => {
    const one = planCheckout(checkoutInput.parse({ kind: "seat", seats: { management: 1 } }), "u1");
    expect(one.items).toEqual([{ lookupKey: "artist_seat_management_yearly", quantity: 1 }]);
    expect(one.metadata).toMatchObject({ kind: "seat", seats: "1" });
    // Mixed tiers: one line each, so each artist's row keeps its own tier.
    const mixed = planCheckout(checkoutInput.parse({ kind: "seat", seats: { plus: 2, management: 1 } }), "u1");
    expect(mixed.items).toEqual([
      { lookupKey: "artist_seat_plus_yearly", quantity: 2 },
      { lookupKey: "artist_seat_management_yearly", quantity: 1 },
    ]);
    expect(mixed.metadata["seats"]).toBe("3");
    expect(mixed.mode).toBe("subscription");
    expect(() => checkoutInput.parse({ kind: "seat", seats: {} })).toThrow();
    expect(() => checkoutInput.parse({ kind: "seat", seats: { plus: SEAT_MAX + 1 } })).toThrow();
  });

  it("lifts an artist to the best of their own plan and their seats", () => {
    expect(highestTier()).toBe("free");
    expect(highestTier("free", "management")).toBe("management");
    expect(highestTier("collaborate", "plus")).toBe("collaborate");
    expect(highestTier("free", "plus", "collaborate")).toBe("collaborate");
  });

  it("never mistakes a seat for a plan", () => {
    for (const seat of ARTIST_SEAT_PRICES) {
      expect(PRICE_TIER[seat.lookupKey]).toBeUndefined();
      expect(seat.lookupKey).toMatch(/^artist_seat_.+_yearly$/);
    }
  });
});
