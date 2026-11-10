import { describe, expect, it } from "vitest";
import { albumKey, routedKinds } from "./release-routing";

type Song = { id: string; title: string; album: string; releaseType: string };
const song = (id: string, title: string, album: string, releaseType = ""): Song => ({ id, title, album, releaseType });
const kinds = (songs: Song[]) => Object.fromEntries(routedKinds(songs, (s) => s, (s) => s.id));

describe("release routing", () => {
  it("files a song saved as a Single under the album it names", () => {
    expect(kinds([
      song("a", "Bloodline", "BAM", "Single"),
      song("b", "Bossed Out", "BAM"),
      song("c", "Beauty King", "BAM", "Single"),
    ])).toEqual({ a: "Album", b: "Album", c: "Album" });
  });

  it("keeps an EP together when its songs disagree, however the title is typed", () => {
    const out = kinds([
      song("a", "Therapy", " Therapy  Deluxe ", "EP"),
      song("b", "Therapy (Clean)", "therapy deluxe", "Single"),
      song("c", "Therapy (Instrumental)", "Therapy Deluxe"),
    ]);
    expect(new Set(Object.values(out))).toEqual(new Set(["EP"]));
  });

  it("leaves a song with no album, or an album named after itself, a single", () => {
    const out = kinds([
      song("a", "Quit Playing With Me", "Quit Playing With Me"),
      song("b", "Bloodline", "Bloodline", "Single"),
      song("c", "Loose Song", ""),
    ]);
    expect(out).toEqual({ a: "Single", b: "Single", c: "Single" });
  });

  it("still takes a declared release of one", () => {
    const out = kinds([song("a", "Bloom", "Bloom", "EP"), song("b", "Solo", "Solo", "Album")]);
    expect(out).toEqual({ a: "EP", b: "Album" });
  });

  it("reads Compilation as an album and a majority EP as an EP", () => {
    expect(kinds([song("a", "One", "Best Of", "Compilation")])).toEqual({ a: "Album" });
    expect(kinds([song("a", "One", "Mix", "EP"), song("b", "Two", "Mix", "EP"), song("c", "Three", "Mix", "Album")]))
      .toEqual({ a: "EP", b: "EP", c: "EP" });
  });

  it("normalises an album title for grouping", () => {
    expect(albumKey("  Therapy   Deluxe Edition  ")).toBe("therapy deluxe edition");
    expect(albumKey("")).toBe("");
  });
});
