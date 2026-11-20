import { describe, expect, it } from "vitest";
import {
  isVaultSubscription,
  pauseCheckoutRefusal,
  vaultChargeDates,
  vaultCollectionGaveUp,
  vaultMonthActive,
  vaultMonthKey,
  vaultMonthRow,
  vaultPriceShapeProblem,
  vaultTrialEnd,
} from "./vault-subscription";

const starts = "2026-11-10T00:00:00Z";
const endOf = (months: number) => {
  const d = new Date(starts);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString();
};

describe("the Vault subscription", () => {
  it("bills once per month of the pause, and never on or after its end", () => {
    for (const months of [1, 2, 3]) {
      const dates = vaultChargeDates(starts, endOf(months));
      expect(dates).toHaveLength(months);
      expect(dates[0]!.toISOString()).toBe(new Date(starts).toISOString());
      for (const d of dates) expect(d.getTime()).toBeLessThan(new Date(endOf(months)).getTime());
    }
    // A three-month pause: the start, the next month, and the month before the plan resumes.
    expect(vaultChargeDates(starts, endOf(3)).map((d) => d.toISOString().slice(0, 10))).toEqual([
      "2026-11-10",
      "2026-12-10",
      "2027-01-10",
    ]);
  });

  it("passes the monthly price it sells, and names what Stripe holds when it is anything else", () => {
    expect(vaultPriceShapeProblem({ lookup_key: "vault_month", type: "recurring", recurring: { interval: "month" } })).toBeNull();
    // The old shape: one charge for the whole pause.
    const oneTime = vaultPriceShapeProblem({ lookup_key: "vault_month", type: "one_time", recurring: null });
    expect(oneTime).toContain("must be a monthly subscription");
    expect(oneTime).toContain("one-time price");
    expect(oneTime).toContain("published price");
    // Billed once a year, which would take the whole pause fee up front and then a year later.
    const yearly = vaultPriceShapeProblem({ lookup_key: "vault_month", type: "recurring", recurring: { interval: "year" } });
    expect(yearly).toContain("recurring yearly price");
    // A recurring price with no interval reads as unset, never as fine.
    expect(vaultPriceShapeProblem({ type: "recurring", recurring: {} })).toContain("no interval set");
  });

  it("refuses a second pause before Stripe is called", () => {
    expect(pauseCheckoutRefusal({})).toBeNull();
    // A pause row already written, or a subscription whose checkout was just paid for but not yet filed.
    expect(pauseCheckoutRefusal({ livePause: true })).toContain("already have a pause");
    expect(pauseCheckoutRefusal({ liveSubscription: true })).toContain("already have a pause");
  });

  it("recognises a pause's subscription by its metadata or its lookup key", () => {
    expect(isVaultSubscription({ metadata: { kind: "vault" }, items: { data: [] } }, "vault_month")).toBe(true);
    expect(
      isVaultSubscription({ metadata: {}, items: { data: [{ price: { lookup_key: "vault_month" } }] } }, "vault_month"),
    ).toBe(true);
    expect(
      isVaultSubscription(
        { metadata: { kind: "plan" }, items: { data: [{ price: { lookup_key: "catalog_plus_yearly" } }] } },
        "vault_month",
      ),
    ).toBe(false);
  });

  it("waits for the renewal date as a trial, and charges now when that is closer than Stripe allows", () => {
    const now = new Date("2026-11-01T00:00:00Z");
    expect(vaultTrialEnd("2026-11-10T00:00:00Z", now)).toBe(
      Math.floor(new Date("2026-11-10T00:00:00Z").getTime() / 1000),
    );
    // 47 hours away: Stripe will not hold a trial that short, so the first month is charged now.
    expect(vaultTrialEnd("2026-11-02T23:00:00Z", now)).toBeNull();
    expect(vaultTrialEnd(now.toISOString(), now)).toBeNull();
    expect(vaultTrialEnd("not-a-date", now)).toBeNull();
  });

  it("files one row per paid month, and nothing for a $0 trial invoice", () => {
    expect(vaultMonthRow({ subscriptionId: "sub_v", invoiceId: "in_1", amountPaid: 0, periodEnd: 1 })).toBeNull();
    expect(vaultMonthRow({ subscriptionId: "sub_v", invoiceId: "in_1", amountPaid: null })).toBeNull();
    const periodEnd = Math.floor(new Date("2026-12-10T00:00:00Z").getTime() / 1000);
    const row = vaultMonthRow({
      subscriptionId: "sub_v",
      invoiceId: "in_2",
      amountPaid: 199,
      currency: "usd",
      paymentIntent: "pi_1",
      periodEnd,
    });
    expect(row).toEqual({
      key: "vault:in_2",
      details: {
        subscription: "sub_v",
        invoice: "in_2",
        payment_intent: "pi_1",
        period_end: "2026-12-10T00:00:00.000Z",
        amount: "199",
        currency: "USD",
      },
    });
    expect(vaultMonthKey("in_2")).toBe("vault:in_2");
    expect(vaultMonthActive(row!.details)).toBe(true);
  });

  it("never reopens a refunded month, however late the event", () => {
    const details = { refunded_at: "2026-12-11T00:00:00Z", subscription: "sub_v" };
    expect(vaultMonthRow({ subscriptionId: "sub_v", invoiceId: "in_2", amountPaid: 199 }, { details })).toEqual({
      key: "vault:in_2",
      details,
    });
    expect(vaultMonthActive(details)).toBe(false);
  });

  it("keeps the pause while Stripe still has a retry, and ends it when it does not", () => {
    expect(vaultCollectionGaveUp({ nextPaymentAttempt: 1_765_000_000, status: "past_due" })).toBe(false);
    expect(vaultCollectionGaveUp({ nextPaymentAttempt: null, status: "past_due" })).toBe(true);
    expect(vaultCollectionGaveUp({ nextPaymentAttempt: 1_765_000_000, status: "unpaid" })).toBe(true);
    expect(vaultCollectionGaveUp({ nextPaymentAttempt: 1_765_000_000, status: "canceled" })).toBe(true);
  });
});
