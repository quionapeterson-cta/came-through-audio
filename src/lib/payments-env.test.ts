import { describe, expect, it } from "vitest";
import { CHECKOUT_CLOSED, CHECKOUT_UNAVAILABLE, checkoutEnvironmentError } from "@/lib/payments-env";

describe("checkout environment guard", () => {
  it("lets a matching pair through", () => {
    expect(checkoutEnvironmentError("sandbox", "sandbox")).toBeNull();
    expect(checkoutEnvironmentError("live", "live")).toBeNull();
  });

  it("refuses a live checkout while the site isn't open for sales, charging nothing", () => {
    expect(checkoutEnvironmentError("live", "sandbox")).toBe(CHECKOUT_CLOSED);
    expect(checkoutEnvironmentError("live", null)).toBe(CHECKOUT_CLOSED);
    // The published link says what happened and nothing about internals.
    expect(CHECKOUT_CLOSED).toContain("nothing was charged");
    expect(CHECKOUT_CLOSED).not.toMatch(/site_settings|environment|sandbox|test mode/i);
  });

  it("refuses a test checkout while the database counts live payments", () => {
    expect(checkoutEnvironmentError("sandbox", "live")).toContain("nothing was charged");
  });

  it("keeps the read-failure message free of internals too", () => {
    expect(CHECKOUT_UNAVAILABLE).toContain("nothing was charged");
    expect(CHECKOUT_UNAVAILABLE).not.toMatch(/site_settings|database|environment/i);
  });
});
