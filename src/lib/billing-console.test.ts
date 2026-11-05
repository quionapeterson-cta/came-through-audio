import { describe, expect, it } from "vitest";
import { REFUND_CAP_CENTS, dollarsToCents, formatUsd, purchaseKindLabel, refundVerdict, windowDaysLeft } from "./billing-console";

const now = new Date("2026-11-05T12:00:00Z");
const base = { paidCents: 4499, refundedCents: 0, amountCents: 4499, paidAt: "2026-11-01T12:00:00Z", now };

describe("refund rules", () => {
  it("allows a full refund inside the window under the cap", () => {
    expect(refundVerdict(base)).toEqual({ ok: true });
  });

  it("stops at what was actually paid", () => {
    const v = refundVerdict({ ...base, amountCents: 5000 });
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toContain("$44.99");
  });

  it("knows what a partial refund leaves", () => {
    expect(refundVerdict({ ...base, refundedCents: 1000, amountCents: 3499 })).toEqual({ ok: true });
    const over = refundVerdict({ ...base, refundedCents: 1000, amountCents: 3500 });
    expect(over.ok).toBe(false);
  });

  it("refuses a payment already refunded in full", () => {
    const v = refundVerdict({ ...base, refundedCents: 4499 });
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toContain("already been refunded");
  });

  it("holds Finance to the cap and the 30-day window, and lets a super admin through", () => {
    const big = { ...base, paidCents: 120_000, amountCents: 120_000, paidAt: "2026-11-04T12:00:00Z" };
    const capped = refundVerdict(big);
    expect(capped.ok).toBe(false);
    if (!capped.ok) expect(capped.reason).toContain(formatUsd(REFUND_CAP_CENTS));
    expect(refundVerdict({ ...big, superAdmin: true })).toEqual({ ok: true });

    const old = { ...base, paidAt: "2026-09-01T12:00:00Z" };
    const late = refundVerdict(old);
    expect(late.ok).toBe(false);
    if (!late.ok) expect(late.reason).toContain("window has closed");
    expect(refundVerdict({ ...old, superAdmin: true })).toEqual({ ok: true });
  });

  it("never lets anyone refund more than was paid, super admin or not", () => {
    expect(refundVerdict({ ...base, amountCents: 4500, superAdmin: true }).ok).toBe(false);
  });

  it("rejects a zero or nonsense amount", () => {
    expect(refundVerdict({ ...base, amountCents: 0 }).ok).toBe(false);
    expect(refundVerdict({ ...base, amountCents: Number.NaN }).ok).toBe(false);
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
  });

  it("counts the window down from the payment date", () => {
    expect(windowDaysLeft("2026-11-01T12:00:00Z", now)).toBe(26);
    expect(windowDaysLeft("2026-09-01T12:00:00Z", now)).toBe(0);
  });
});
