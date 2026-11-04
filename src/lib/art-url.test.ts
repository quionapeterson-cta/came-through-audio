import { describe, expect, it } from "vitest";
import { artUrl, localFallbacks, resolveArt } from "@/lib/art-url";

const BASE = "https://art.example.com";
const BADGE = "/icons/playful/bedazzled_band.png";

describe("artUrl", () => {
  it("serves from public/ when no bucket is configured", () => {
    expect(artUrl(BADGE)).toBe(BADGE);
  });

  it("points a picture at the bucket's web-ready copy", () => {
    expect(resolveArt(BADGE, BASE)).toBe(`${BASE}/icons/playful/bedazzled_band.webp`);
  });

  it("keeps the extension for art with no web-ready copy", () => {
    expect(resolveArt("/art/clinic/exam.svg", BASE)).toBe(`${BASE}/art/clinic/exam.svg`);
  });

  it("trims a trailing slash on the base and never doubles one", () => {
    expect(resolveArt("/icons/a.jpg", `${BASE}/`)).toBe(`${BASE}/icons/a.webp`);
  });

  it("leaves an address that is already absolute alone", () => {
    expect(resolveArt(`${BASE}/icons/a.webp`, BASE)).toBe(`${BASE}/icons/a.webp`);
  });

  it("has no local fallback to offer while the bucket is unset", () => {
    expect(localFallbacks(`${BASE}/icons/a.webp`)).toEqual([]);
  });
});
