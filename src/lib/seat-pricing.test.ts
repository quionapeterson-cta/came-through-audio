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


  it("buys as many seats as the owner picks, on one subscription", () => {
    const one = planCheckout(checkoutInput.parse({ kind: "seat", tier: "management" }), "u1");
    expect(one.items).toEqual([{ lookupKey: "artist_seat_management_yearly", quantity: 1 }]);
    expect(one.metadata).toMatchObject({ kind: "seat", seatTier: "management", seats: "1" });
    const three = planCheckout(checkoutInput.parse({ kind: "seat", tier: "plus", quantity: 3 }), "u1");
    expect(three.items).toEqual([{ lookupKey: "artist_seat_plus_yearly", quantity: 3 }]);
    expect(three.metadata["seats"]).toBe("3");
    expect(() => checkoutInput.parse({ kind: "seat", tier: "plus", quantity: 0 })).toThrow();
    expect(() => checkoutInput.parse({ kind: "seat", tier: "plus", quantity: SEAT_MAX + 1 })).toThrow();
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
