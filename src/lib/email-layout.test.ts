import { describe, expect, it } from "vitest";
import { resolveSiteUrl } from "./email-layout";

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
