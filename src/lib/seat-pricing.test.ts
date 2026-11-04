import { describe, expect, it } from "vitest";
import { ARTIST_SEAT_PRICES, PRICE_TIER, SEAT_TIER, seatLookupKey } from "./plans";

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

  it("never mistakes a seat for a plan", () => {
    for (const seat of ARTIST_SEAT_PRICES) {
      expect(PRICE_TIER[seat.lookupKey]).toBeUndefined();
      expect(seat.lookupKey).toMatch(/^artist_seat_.+_yearly$/);
    }
  });
});
