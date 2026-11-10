import { describe, expect, it } from "vitest";
import { BUSINESS_ADDRESS, emailLayout, resolveSiteUrl } from "./email-layout";

describe("emailLayout footer", () => {
  it("prints the postal address on mail that needs it", () => {
    expect(emailLayout("<p>hi</p>", { reason: "Because." })).toContain(BUSINESS_ADDRESS);
  });

  it("leaves the street address off support and Help Center mail", () => {
    const html = emailLayout("<p>hi</p>", { hideAddress: true, reason: "Because." });
    expect(html).not.toContain(BUSINESS_ADDRESS);
    expect(html).toContain("Came Through Audio, LLC");
  });

  it("still refuses marketing mail without an unsubscribe link", () => {
    expect(() => emailLayout("<p>hi</p>", { kind: "marketing", reason: "Because." })).toThrow(/unsubscribe/i);
  });
});

describe("resolveSiteUrl", () => {
  it("falls back to the published site when nothing is set", () => {
    expect(resolveSiteUrl(undefined)).toBe("https://pixel-perfect-studio-382.lovable.app");
    expect(resolveSiteUrl("   ")).toBe("https://pixel-perfect-studio-382.lovable.app");
  });

  it("uses the address the deployment was given, with no trailing slash", () => {
    expect(resolveSiteUrl("https://came-through-audio.example.workers.dev")).toBe("https://came-through-audio.example.workers.dev");
    expect(resolveSiteUrl("https://camethroughaudio.com/")).toBe("https://camethroughaudio.com");
  });
});
