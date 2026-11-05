import { describe, expect, it } from "vitest";
import { dollarsToCents, formatUsd, proratedRefundCents, purchaseKindLabel, refundVerdict, windowDaysLeft } from "./billing-console";

const now = new Date("2026-11-05T12:00:00Z");
const base = { paidCents: 4499, refundedCents: 0, amountCents: 4499, paidAt: "2026-11-01T12:00:00Z", now };

describe("refund rules", () => {
  it("allows a full refund inside the window, no ceiling but the payment", () => {
    expect(refundVerdict(base)).toEqual({ ok: true, discretionary: false });
  });

  it("lets the biggest orders be refunded in full, with no fixed cap", () => {
    // A five-figure payment is refundable on its own merits; the old $500 cap used to block exactly this.
    const big = { ...base, paidCents: 1_250_000, amountCents: 1_250_000 };
    expect(refundVerdict(big)).toEqual({ ok: true, discretionary: false });
  });

  it("still stops at what was actually paid", () => {
    const v = refundVerdict({ ...base, amountCents: 5000 });
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toContain("$44.99");
  });

  it("knows what a partial refund leaves", () => {
    expect(refundVerdict({ ...base, refundedCents: 1000, amountCents: 3499 }).ok).toBe(true);
    expect(refundVerdict({ ...base, refundedCents: 1000, amountCents: 3500 }).ok).toBe(false);
  });

  it("refuses a payment already refunded in full", () => {
    const v = refundVerdict({ ...base, refundedCents: 4499 });
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toContain("already been refunded");
  });

  it("treats a refund past 30 days as a judgement call, not a refusal", () => {
    const late = refundVerdict({ ...base, paidAt: "2026-09-01T12:00:00Z" });
    expect(late).toEqual({ ok: true, discretionary: true });
  });

  it("never lets anyone refund more than was paid", () => {
    expect(refundVerdict({ ...base, amountCents: 4500 }).ok).toBe(false);
  });

  it("rejects a zero or nonsense amount", () => {
    expect(refundVerdict({ ...base, amountCents: 0 }).ok).toBe(false);
    expect(refundVerdict({ ...base, amountCents: Number.NaN }).ok).toBe(false);
  });
});

describe("prorated plan refunds", () => {
  it("gives back the unused part of the year", () => {
    // $89.99 Catalog Management, six months in: roughly half the year is left.
    const half = proratedRefundCents({ paidCents: 8999, paidAt: "2026-05-05T12:00:00Z", now });
    expect(half).toBeGreaterThan(4400);
    expect(half).toBeLessThan(4550);
  });

  it("matches the policy example: 120 days left of a $89.99 year", () => {
    const left = proratedRefundCents({ paidCents: 8999, paidAt: "2026-03-05T12:00:00Z", now });
    expect(Math.abs(left - 2959)).toBeLessThanOrEqual(1);
  });

  it("refunds nothing once the year has run out", () => {
    expect(proratedRefundCents({ paidCents: 8999, paidAt: "2024-11-05T12:00:00Z", now })).toBe(0);
  });

  it("refunds everything when the term hasn't started", () => {
    expect(proratedRefundCents({ paidCents: 8999, paidAt: "2026-12-01T12:00:00Z", now })).toBe(8999);
  });

  it("prorates whatever is left after an earlier partial refund", () => {
    const left = proratedRefundCents({ paidCents: 8999 - 2000, paidAt: "2026-05-05T12:00:00Z", now });
    expect(left).toBeGreaterThan(3400);
    expect(left).toBeLessThan(3600);
  });

  it("is zero for nonsense input", () => {
    expect(proratedRefundCents({ paidCents: 0, paidAt: "2026-05-05T12:00:00Z", now })).toBe(0);
    expect(proratedRefundCents({ paidCents: 8999, paidAt: "not a date", now })).toBe(0);
  });
});

describe("console helpers", () => {
  it("reads dollars the way a person types them", () => {
    expect(dollarsToCents("24.99")).toBe(2499);
    expect(dollarsToCents(" $1,200.5 ")).toBe(120050);
    expect(dollarsToCents("0")).toBeNull();
    expect(dollarsToCents("2.999")).toBeNull();
    expect(dollarsToCents("abc")).toBeNull();
  });

  it("labels purchases in plain words", () => {
    expect(purchaseKindLabel("expert")).toBe("Expert Registration");
    expect(purchaseKindLabel("something_new")).toBe("something new");
    expect(formatUsd(1250000)).toBe("$12500.00");
  });

  it("counts the window down from the payment date", () => {
    expect(windowDaysLeft("2026-11-01T12:00:00Z", now)).toBe(26);
    expect(windowDaysLeft("2026-09-01T12:00:00Z", now)).toBe(0);
  });
});
