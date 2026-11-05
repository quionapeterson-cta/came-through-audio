import { describe, expect, it } from "vitest";
import {
  DUPLICATE_CHECKS, addDays, assessDuplicateGroup, duplicateChecksDone, duplicateRefundBlock, groupPossibleDuplicates,
  paymentState, readCharge, type ChargeFacts,
} from "./duplicate-charges";

const at = (daysAgo: number) => new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString();

const charge = (over: Partial<ChargeFacts> = {}): ChargeFacts => ({
  id: "ch_1",
  paymentIntent: "pi_1",
  amountCents: 2499,
  refundedCents: 0,
  currency: "usd",
  createdAt: at(1),
  state: "succeeded",
  item: "AI Protection (one song)",
  purchaseId: "p_1",
  ...over,
});

describe("paymentState", () => {
  it("calls an uncaptured success an authorization, not a payment", () => {
    expect(paymentState("succeeded", false)).toBe("requires_capture");
    expect(paymentState("succeeded", true)).toBe("succeeded");
    expect(paymentState("requires_capture")).toBe("requires_capture");
    expect(paymentState("processing")).toBe("processing");
    expect(paymentState("pending")).toBe("processing");
    expect(paymentState("canceled")).toBe("failed");
  });
});

describe("readCharge", () => {
  it("treats a hold as money that never left, with a date it clears by", () => {
    const createdAt = "2026-10-01T00:00:00.000Z";
    const r = readCharge(charge({ state: "requires_capture", createdAt, paymentIntent: null }));
    expect(r.held).toBe(true);
    expect(r.settled).toBe(false);
    expect(r.clearsBy).toBe(addDays(createdAt, 7));
    expect(r.clearsBy).toBe("2026-10-08T00:00:00.000Z");
    expect(r.line).toMatch(/authorization/i);
    expect(r.line).toMatch(/Never refund it/);
  });

  it("keeps a processing payment in the wait bucket too", () => {
    const r = readCharge(charge({ state: "processing" }));
    expect(r.held).toBe(true);
    expect(r.clearsBy).not.toBeNull();
  });

  it("reads a settled payment as settled, and a fully refunded one as already back", () => {
    expect(readCharge(charge()).settled).toBe(true);
    expect(readCharge(charge()).clearsBy).toBeNull();
    const back = readCharge(charge({ refundedCents: 2499 }));
    expect(back.refunded).toBe(true);
    expect(back.line).toMatch(/already refunded in full/);
  });

  it("says plainly when no money moved", () => {
    expect(readCharge(charge({ state: "failed" })).line).toMatch(/No money moved/);
  });
});

describe("groupPossibleDuplicates", () => {
  it("only groups same-amount payments close together", () => {
    const groups = groupPossibleDuplicates([
      charge({ id: "a", paymentIntent: "pi_a", createdAt: at(1) }),
      charge({ id: "b", paymentIntent: "pi_b", createdAt: at(1) }),
      charge({ id: "c", paymentIntent: "pi_c", amountCents: 999, createdAt: at(1) }),
      charge({ id: "d", paymentIntent: "pi_d", createdAt: at(20) }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.charges.map((c) => c.id)).toEqual(["a", "b"]);
  });

  it("ignores zero-amount rows", () => {
    expect(groupPossibleDuplicates([charge({ amountCents: 0 }), charge({ id: "b", amountCents: 0 })])).toEqual([]);
  });
});

describe("assessDuplicateGroup", () => {
  it("calls two settled payments for the same thing a real duplicate and refunds the newer one", () => {
    const verdict = assessDuplicateGroup([
      charge({ id: "old", paymentIntent: "pi_old", createdAt: at(2) }),
      charge({ id: "new", paymentIntent: "pi_new", createdAt: at(1) }),
    ]);
    expect(verdict.kind).toBe("real_duplicate");
    if (verdict.kind !== "real_duplicate") throw new Error("expected a duplicate");
    expect(verdict.keepId).toBe("old");
    expect(verdict.refundId).toBe("new");
  });

  it("refuses to call two different things a duplicate", () => {
    const verdict = assessDuplicateGroup([
      charge({ id: "seat", item: "Artist seat", createdAt: at(2) }),
      charge({ id: "ai", paymentIntent: "pi_2", item: "AI Protection (one song)", createdAt: at(1) }),
    ]);
    expect(verdict.kind).toBe("not_duplicate");
    if (verdict.kind !== "not_duplicate") throw new Error("expected not a duplicate");
    expect(verdict.why).toMatch(/two different things/);
  });

  it("waits on a hold instead of refunding it, and says when it clears", () => {
    const verdict = assessDuplicateGroup([
      charge({ id: "hold", state: "requires_capture", paymentIntent: null, createdAt: at(1) }),
      charge({ id: "real", paymentIntent: "pi_real", createdAt: at(1) }),
    ]);
    expect(verdict.kind).toBe("wait");
    if (verdict.kind !== "wait") throw new Error("expected a wait");
    expect(verdict.clearsBy).not.toBeNull();
    expect(verdict.why).toMatch(/refund would fail/i);
  });

  it("recognises the refund as the second line", () => {
    const verdict = assessDuplicateGroup([
      charge({ id: "paid", createdAt: at(3) }),
      charge({ id: "back", paymentIntent: "pi_back", refundedCents: 2499, createdAt: at(2) }),
    ]);
    expect(verdict.kind).toBe("already_refunded");
  });

  it("does not call one payment shown twice a duplicate", () => {
    const verdict = assessDuplicateGroup([
      charge({ id: "same", paymentIntent: "pi_same", createdAt: at(2) }),
      charge({ id: "same-again", paymentIntent: "pi_same", createdAt: at(1) }),
    ]);
    expect(verdict.kind).toBe("not_duplicate");
  });
});

describe("duplicateRefundBlock", () => {
  const all = DUPLICATE_CHECKS.map((c) => c.id);

  it("needs every check ticked", () => {
    expect(duplicateChecksDone(all)).toBe(true);
    expect(duplicateChecksDone(all.slice(0, 3))).toBe(false);
    expect(duplicateRefundBlock({ checks: all.slice(0, 3), settled: true, held: false, refunded: false })).toMatch(/all 4 checks/);
  });

  it("refuses a hold, an unsettled payment and a payment already refunded, checks or not", () => {
    expect(duplicateRefundBlock({ checks: all, settled: false, held: true, refunded: false })).toMatch(/hasn't settled/);
    expect(duplicateRefundBlock({ checks: all, settled: false, held: false, refunded: false })).toMatch(/No money moved/);
    expect(duplicateRefundBlock({ checks: all, settled: true, held: false, refunded: true })).toMatch(/already refunded in full/);
  });

  it("lets a verified duplicate through", () => {
    expect(duplicateRefundBlock({ checks: all, settled: true, held: false, refunded: false })).toBeNull();
  });
});
