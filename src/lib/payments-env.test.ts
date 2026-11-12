import { describe, expect, it } from "vitest";
import { checkoutEnvironmentError } from "@/lib/payments-env";

describe("checkout environment guard", () => {
  it("lets a matching pair through", () => {
    expect(checkoutEnvironmentError("sandbox", "sandbox")).toBeNull();
    expect(checkoutEnvironmentError("live", "live")).toBeNull();
  });

  it("refuses a live checkout while the database still counts test payments", () => {
    const unset = checkoutEnvironmentError("live", null);
    const testMode = checkoutEnvironmentError("live", "sandbox");
    expect(testMode).toContain("nothing was charged");
    expect(unset).toContain("nothing was charged");
    // The member is told what happened, never a raw reason.
    expect(testMode).not.toMatch(/site_settings|environment|sandbox/);
  });

  it("refuses a test checkout while the database counts live payments", () => {
    expect(checkoutEnvironmentError("sandbox", "live")).toContain("nothing was charged");
  });
});
