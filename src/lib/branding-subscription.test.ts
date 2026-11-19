import { describe, expect, it } from "vitest";
import { isBrandingSubscription, kitYearActive, kitYearRow, type KitYearInput } from "./branding-subscription";

const year = (over: Partial<KitYearInput> = {}): KitYearInput => ({
  subscriptionId: "sub_123",
  periodStart: 1_793_000_000,
  periodEnd: 1_824_536_000,
  invoiceId: "in_1",
  paymentIntent: "pi_1",
  paid: true,
  ...over,
});

describe("which subscription is a kit's", () => {
  it("recognizes the branding lookup key", () => {
    expect(isBrandingSubscription({ items: { data: [{ price: { lookup_key: "branding_yearly" } }] } }, "branding_yearly")).toBe(true);
  });
  it("recognizes the kind on the metadata, and is never fooled by a plan", () => {
    expect(isBrandingSubscription({ metadata: { kind: "branding" }, items: { data: [{ price: { lookup_key: "catalog_plus_yearly" } }] } }, "branding_yearly")).toBe(true);
    expect(isBrandingSubscription({ metadata: { kind: "plan" }, items: { data: [{ price: { lookup_key: "catalog_plus_yearly" } }] } }, "branding_yearly")).toBe(false);
  });
});

describe("a kit's paid year", () => {
  it("counts its twelve months from the period that was paid for", () => {
    const row = kitYearRow(year())!;
    expect(row.key).toBe("sub:sub_123");
    expect(row.created_at).toBe(new Date(1_793_000_000 * 1000).toISOString());
    expect(row.details).toMatchObject({ subscription: "sub_123", invoice: "in_1", payment_intent: "pi_1" });
    expect(row.details["period_end"]).toBe(new Date(1_824_536_000 * 1000).toISOString());
    expect(kitYearActive(row.details)).toBe(true);
  });

  it("moves to the new period on a renewal, keeping the row keyed to the subscription", () => {
    const first = kitYearRow(year())!;
    const renewed = kitYearRow(year({ periodStart: 1_824_536_000, periodEnd: 1_856_072_000, invoiceId: "in_2", paymentIntent: "pi_2" }), first)!;
    expect(renewed.key).toBe("sub:sub_123");
    expect(renewed.created_at).toBe(new Date(1_824_536_000 * 1000).toISOString());
    expect(renewed.details).toMatchObject({ invoice: "in_2", payment_intent: "pi_2" });
  });

  it("writes nothing at all before the first payment clears", () => {
    expect(kitYearRow(year({ paid: false, invoiceId: null, paymentIntent: null }))).toBeNull();
  });

  it("keeps an existing year untouched while a later invoice is unpaid", () => {
    const first = kitYearRow(year())!;
    const row = kitYearRow(year({ paid: false, invoiceId: null, paymentIntent: null, periodStart: 1_824_536_000 }), first)!;
    expect(row).toEqual({ key: "sub:sub_123", details: first.details });
  });

  it("marks an ended subscription without shortening the paid year", () => {
    const first = kitYearRow(year())!;
    const ended = kitYearRow(year({ canceledAt: "2026-12-01T00:00:00.000Z" }), first)!;
    expect(ended.details["canceled_at"]).toBe("2026-12-01T00:00:00.000Z");
    expect(ended.created_at).toBe(first.created_at);
  });
});

describe("a refunded year can never be reopened", () => {
  const refunded = { details: { subscription: "sub_123", invoice: "in_1", payment_intent: "pi_1", period_end: "2027-11-19T00:00:00.000Z", refunded_at: "2026-11-20T00:00:00.000Z" } };

  it("ignores a later renewal", () => {
    const row = kitYearRow(year({ periodStart: 1_824_536_000, invoiceId: "in_2", paymentIntent: "pi_2" }), refunded)!;
    expect(row.details).toEqual(refunded.details);
    expect(row.created_at).toBeUndefined();
    expect(kitYearActive(row.details)).toBe(false);
  });

  it("ignores a cancellation and a re-sync", () => {
    const canceled = kitYearRow(year({ canceledAt: "2026-12-01T00:00:00.000Z" }), refunded)!;
    const resynced = kitYearRow(year({ paid: false }), refunded)!;
    expect(canceled.details).toEqual(refunded.details);
    expect(resynced.details).toEqual(refunded.details);
  });

  it("keeps anything else the row already carried", () => {
    const row = kitYearRow(year(), { details: { refunded_at: "2026-11-20T00:00:00.000Z", note: "kept" } })!;
    expect(row.details).toEqual({ refunded_at: "2026-11-20T00:00:00.000Z", note: "kept" });
  });
});
