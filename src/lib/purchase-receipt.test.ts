import { describe, expect, it } from "vitest";
import { money, purchaseKind, purchaseLanding, purchasedPlan, receiptCopy, type PurchaseKind } from "./purchase-receipt";

const KINDS: PurchaseKind[] = ["plan", "seat", "vault", "branding", "contract", "ai", "expert", "renew"];

describe("purchaseLanding", () => {
  it("sends every purchase back to the page it unlocked, marked as a checkout return", () => {
    expect(purchaseLanding("plan")).toBe("/workspace?checkout=success");
    expect(purchaseLanding("seat")).toBe("/workspace?checkout=success");
    expect(purchaseLanding("vault")).toBe("/workspace?checkout=success");
    expect(purchaseLanding("ai")).toBe("/workspace?tab=protect&checkout=success");
    expect(purchaseLanding("expert")).toBe("/workspace?tab=health&checkout=success");
    expect(purchaseLanding("contract")).toBe("/workspace?tab=learn&checkout=success");
    expect(purchaseLanding("branding")).toBe("/profile?checkout=success#brand-kit");
    expect(purchaseLanding("renew")).toBe("/profile?checkout=success");
  });

  it("always marks the return, so the landing page knows it is a checkout", () => {
    for (const kind of KINDS) expect(purchaseLanding(kind)).toContain("checkout=success");
  });

  it("returns a site path, never an absolute or empty one", () => {
    for (const kind of KINDS) {
      const path = purchaseLanding(kind);
      expect(path.startsWith("/")).toBe(true);
      expect(path.startsWith("//")).toBe(false);
      expect(path.length).toBeGreaterThan(10);
    }
  });
});

describe("purchaseKind", () => {
  it("accepts the kinds checkout writes and refuses anything else", () => {
    for (const kind of KINDS) expect(purchaseKind(kind)).toBe(kind);
    expect(purchaseKind("gift")).toBeNull();
    expect(purchaseKind("")).toBeNull();
    expect(purchaseKind(undefined)).toBeNull();
  });
});

describe("purchasedPlan", () => {
  it("names the plan from its lookup key", () => {
    expect(purchasedPlan(["catalog_plus_yearly"])).toBe("plus");
    expect(purchasedPlan(["catalog_management_yearly"])).toBe("management");
  });

  it("is not fooled by seats, add-ons or an empty list", () => {
    expect(purchasedPlan(["artist_seat_plus_yearly"])).toBeNull();
    expect(purchasedPlan(["branding_yearly", "ai_protection_single"])).toBeNull();
    expect(purchasedPlan([])).toBeNull();
  });
});

describe("money", () => {
  it("formats what Stripe charged in the currency it charged", () => {
    expect(money(2499, "usd")).toBe("$24.99");
    expect(money(8999, "usd")).toBe("$89.99");
    expect(money(1000, "eur")).toBe("€10.00");
  });

  it("says nothing rather than guessing", () => {
    expect(money(null, "usd")).toBeNull();
    expect(money(2499, null)).toBeNull();
    expect(money(2499, "not-a-currency")).toBeNull();
  });
});

describe("receiptCopy", () => {
  it("names the plan that was bought", () => {
    expect(receiptCopy({ kind: "plan", plan: "plus" }).subject).toBe("Your Catalog Plus plan is active");
    expect(receiptCopy({ kind: "plan", plan: "management" }).heading).toContain("Catalog Management");
  });

  it("falls back to a plain plan name when Stripe didn't name one", () => {
    expect(receiptCopy({ kind: "plan" }).subject).toBe("Your plan is active");
  });

  it("carries the real charge, and no figure at all when there isn't one", () => {
    expect(receiptCopy({ kind: "plan", plan: "plus", paid: "$24.99" }).paragraphs[0]).toBe("We charged $24.99.");
    const without = receiptCopy({ kind: "contract" });
    expect(without.paragraphs.join(" ")).not.toContain("$");
    expect(without.paragraphs[0]).toBe("Your payment went through.");
  });

  it("gives every kind a real subject, heading and button", () => {
    for (const kind of KINDS) {
      const c = receiptCopy({ kind, plan: kind === "plan" ? "plus" : null });
      expect(c.subject.length).toBeGreaterThan(4);
      expect(c.heading.length).toBeGreaterThan(4);
      expect(c.cta.length).toBeGreaterThan(4);
      expect(c.paragraphs.length).toBeGreaterThan(0);
    }
  });

  it("names the renewal date when a Renew now moved it, never a trial end", () => {
    const moved = receiptCopy({ kind: "renew", renewsOn: "2028-10-23T23:08:44.000Z" });
    expect(moved.paragraphs.join(" ")).toContain("Your plan now renews on October 23, 2028");
    expect(moved.subject).toBe("Your plan now renews on October 23, 2028");
    // An unknown or broken date says nothing rather than guessing.
    expect(receiptCopy({ kind: "renew" }).paragraphs.join(" ")).not.toContain("renews on");
    expect(receiptCopy({ kind: "renew", renewsOn: "not-a-date" }).paragraphs.join(" ")).not.toContain("renews on");
  });

  it("says a pause is not a cancellation, as the policy does", () => {
    expect(receiptCopy({ kind: "vault" }).paragraphs.join(" ")).toContain("not a cancellation");
  });

  it("mentions Link's own receipt only when Link sold it", () => {
    expect(receiptCopy({ kind: "ai", managed: true }).paragraphs.join(" ")).toContain("Link");
    expect(receiptCopy({ kind: "expert", managed: false }).paragraphs.join(" ")).not.toContain("Link");
  });

  it("never promises a time, a date or a guarantee", () => {
    for (const kind of KINDS) {
      const text = [receiptCopy({ kind }).subject, receiptCopy({ kind }).heading, ...receiptCopy({ kind }).paragraphs].join(" ").toLowerCase();
      for (const forbidden of ["guarantee", "within", "{{", "instant"]) expect(text).not.toContain(forbidden);
    }
  });
});
