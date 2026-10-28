import { describe, expect, it } from "vitest";
import { captionForX, promoCaption, promoCount, promoOrder, PROMO_SITE, type PromoContext } from "@/lib/promo-copy";
import { cardText } from "@/lib/promo-card";

const all = (ctx: PromoContext, input: Parameters<typeof promoCaption>[2]) => Array.from({ length: promoCount(ctx) }, (_, i) => promoCaption(ctx, i, input));

describe("promo captions", () => {
  it("names the single when there is a title, and stays generic when hidden", () => {
    expect(promoCaption("embed", 0, { title: "Midnight Drive" })).toContain('"Midnight Drive"');
    expect(promoCaption("embed", 0, {})).toBe(`I'm embedding my new single with metadata on Came Through Audio RN! New music dropping soon! 🔥\n${PROMO_SITE}\n#CameThrough #CameThroughAudio #NewMusic #IndependentArtist #UpcomingArtist`);
  });
  it("every caption has the site and five hashtags for the genre, and the line stays short", () => {
    for (const ctx of ["embed", "catalog", "profile"] as const) for (const c of all(ctx, { title: "A Fairly Long Song Title", count: 12, genre: "R&B/Soul" })) {
      const [line, site, tags] = c.split("\n");
      expect(site).toBe(PROMO_SITE);
      expect(tags).toBe("#CameThrough #CameThroughAudio #RnB #SoulMusic #NewRnB");
      expect(line!.length).toBeLessThanOrEqual(130);
    }
  });
  it("X gets just two hashtags and fits in a post", () => {
    for (const c of all("embed", { title: "A Fairly Long Song Title", genre: "Hip-Hop/Rap" })) {
      const x = captionForX(c, "Hip-Hop/Rap");
      expect(x.endsWith("\n#CameThrough #HipHop")).toBe(true);
      expect(x).not.toContain("#CameThroughAudio");
      expect(x.length).toBeLessThanOrEqual(280);
    }
  });
  it("catalog captions read right for one song, many songs, or a hidden count", () => {
    expect(all("catalog", { count: 1 }).join(" ")).not.toMatch(/\b1 songs\b/);
    expect(all("catalog", { count: 12 }).some((c) => c.includes("12 songs"))).toBe(true);
    expect(all("catalog", {}).join(" ")).not.toMatch(/undefined|\d+ songs/);
  });
  it("Generate goes through every style before repeating", () => {
    expect([...promoOrder("embed")].sort((a, b) => a - b)).toEqual(Array.from({ length: promoCount("embed") }, (_, i) => i));
  });
});

describe("teaser card", () => {
  it("matches the spot it was opened from", () => {
    expect(cardText({ ctx: "embed", artist: "Q", title: "Midnight Drive" })).toMatchObject({ kicker: "NEW SINGLE", headline: "“Midnight Drive”" });
    expect(cardText({ ctx: "embed", artist: "Q" }).kicker).toBe("NEW MUSIC");
    expect(cardText({ ctx: "catalog", artist: "Q", count: 12 }).headline).toBe("12 Songs");
    expect(cardText({ ctx: "catalog", artist: "Q", count: 1 }).headline).toBe("My First Song");
    expect(cardText({ ctx: "profile", artist: "Q" }).headline).toBe("Q");
  });
});

describe("caption library size", () => {
  it("has a big, repeat-free set for every spot", () => {
    for (const ctx of ["embed", "catalog", "profile"] as const) {
      const all = Array.from({ length: promoCount(ctx) }, (_, i) => promoCaption(ctx, i, { title: "Bloodline", count: 5, genre: "Trap" }).split("\n")[0]);
      expect(new Set(all).size).toBe(all.length);
      expect(all.length).toBeGreaterThanOrEqual(40);
      for (const line of all) expect(line).not.toMatch(/—/);
    }
  });
});
