import { describe, expect, it } from "vitest";
import {
  GOOGLE_CALLBACK_PATH,
  googleLandingPath,
  googleRedirectUrl,
  oauthError,
} from "@/lib/google-auth";
import { PRICE_TIER } from "@/lib/plans";

describe("googleRedirectUrl", () => {
  it("returns to our own callback on the origin the sign-in started from", () => {
    expect(googleRedirectUrl("https://came-through-audio.vercel.app")).toBe(
      `https://came-through-audio.vercel.app${GOOGLE_CALLBACK_PATH}`,
    );
  });

  it("drops a trailing slash instead of doubling the separator", () => {
    expect(googleRedirectUrl("https://came-through-audio.vercel.app/")).toBe(
      "https://came-through-audio.vercel.app/auth/callback",
    );
    expect(googleRedirectUrl("https://came-through-audio.vercel.app///")).toBe(
      "https://came-through-audio.vercel.app/auth/callback",
    );
  });

  it("keeps a local development origin, port and all", () => {
    expect(googleRedirectUrl("http://localhost:5173")).toBe("http://localhost:5173/auth/callback");
  });
});

describe("oauthError", () => {
  it("says nothing when the browser came back with no refusal", () => {
    expect(oauthError("")).toBeNull();
    expect(oauthError("?code=abc123")).toBeNull();
  });

  it("reads the provider's description and undoes the URL's plus signs", () => {
    expect(oauthError("?error=access_denied&error_description=The+user+denied+the+request")).toBe(
      "The user denied the request",
    );
  });

  it("falls back to the bare code when there is no description", () => {
    expect(oauthError("?error=access_denied")).toBe("access_denied");
  });
});

describe("googleLandingPath", () => {
  it("carries the picked plan into the workspace so checkout still opens", () => {
    const priceId = Object.keys(PRICE_TIER)[0]!;
    expect(googleLandingPath(priceId, null)).toBe(`/workspace?tab=health&plan=${priceId}`);
  });

  it("opens the workspace on health when no plan was picked", () => {
    expect(googleLandingPath(null, null)).toBe("/workspace?tab=health");
  });

  it("lets a saved invite path win, so an invited signer lands on their own page", () => {
    expect(googleLandingPath(Object.keys(PRICE_TIER)[0]!, "/split/abc")).toBe("/split/abc");
  });
});
