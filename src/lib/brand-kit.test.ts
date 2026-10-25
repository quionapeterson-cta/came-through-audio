import { describe, expect, it } from "vitest";
import { brandAccess, brandingUntil, hexRgb, kitFromRow, kitReady } from "./brand-kit";
import { checkoutInput, planCheckout } from "./stripe-mapping";

const buy = (created_at: string, refunded = false) => ({ kind: "branding", created_at, details: refunded ? { refunded_at: created_at } : {} });

describe("Personal Branding", () => {
  it("lasts a year per purchase, stacking early renewals", () => {
    const now = new Date("2026-11-01T00:00:00Z");
    expect(brandingUntil([], now)).toBeNull();
    expect(brandingUntil([buy("2026-10-01T00:00:00Z")], now)?.toISOString()).toBe("2027-10-01T00:00:00.000Z");
    // Bought again before it ran out: the new year starts when the first one ends.
    expect(brandingUntil([buy("2026-10-01T00:00:00Z"), buy("2027-09-01T00:00:00Z")], now)?.toISOString()).toBe("2028-09-30T00:00:00.000Z");
    expect(brandingUntil([buy("2025-01-01T00:00:00Z")], now)).toBeNull();
    expect(brandingUntil([buy("2026-10-01T00:00:00Z", true)], now)).toBeNull();
    expect(brandingUntil([{ kind: "vault", created_at: "2026-10-01T00:00:00Z", details: {} }], now)).toBeNull();
  });

  it("Catalog Management includes it; the add-on turns it on for any plan", () => {
    const until = new Date("2027-01-01");
    expect(brandAccess("management", null)).toEqual({ contracts: true, splits: true });
    expect(brandAccess("free", until)).toEqual({ contracts: true, splits: true });
    expect(brandAccess("collaborate", until)).toEqual({ contracts: true, splits: true });
    expect(brandAccess("plus", null)).toEqual({ contracts: false, splits: false });
  });

  it("cleans kit rows and keeps every valid color", () => {
    const k = kitFromRow({ name: " Karma ", colors: ["#004aad", "nope", "#4D8CFF", "#FFFFFF", "#0B0B0B", "#123456"], font: "Comic Sans", show_footer: false });
    expect(k).toMatchObject({ name: "Karma", colors: ["#004AAD", "#4D8CFF", "#FFFFFF", "#0B0B0B", "#123456"], font: "Poppins", showFooter: false, logoPath: null });
    expect(kitReady(k)).toBe(true);
    expect(kitReady(kitFromRow({ name: "" }))).toBe(false);
    expect(hexRgb("#004AAD")).toEqual([0, 74, 173]);
  });

  it("checks out as a one-time branding_yearly purchase that returns to Profile", () => {
    expect(planCheckout(checkoutInput.parse({ kind: "branding" }), "u1")).toMatchObject({
      mode: "payment", items: [{ lookupKey: "branding_yearly", quantity: 1 }], metadata: { userId: "u1", kind: "branding" }, returnTab: "profile", managed: true,
    });
  });
});
