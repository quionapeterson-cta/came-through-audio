import { describe, expect, it } from "vitest";
import { albumKey, catalogReleases, routedKinds } from "./release-routing";

type Song = { id: string; title: string; album: string; releaseType: string };
const song = (id: string, title: string, album: string, releaseType = ""): Song => ({ id, title, album, releaseType });
const kinds = (songs: Song[]) => Object.fromEntries(routedKinds(songs, (s) => s, (s) => s.id));

describe("release routing", () => {
  it("files songs saved as Singles under the release they name, and counts its size", () => {
    expect(kinds([
      song("a", "Bloodline", "Summer Tape", "Single"),
      song("b", "Bossed Out", "Summer Tape"),
      song("c", "Beauty King", "Summer Tape", "Single"),
    ])).toEqual({ a: "EP", b: "EP", c: "EP" });
    const album = kinds(Array.from({ length: 8 }, (_, i) => song(`s${i}`, `Song ${i}`, "BAM", "Single")));
    expect(new Set(Object.values(album))).toEqual(new Set(["Album"]));
  });

  it("reads four singles on one release title as the EP they make", () => {
    expect(kinds([
      song("1", "Therapy", "Therapy Deluxe Edition", "Single"),
      song("2", "Therapy (Clean)", "Therapy Deluxe Edition", "Single"),
      song("3", "Therapy (Instrumental)", "Therapy Deluxe Edition", "Single"),
      song("4", "Therapy (Acapella)", "Therapy Deluxe Edition", "Single"),
    ])).toEqual({ "1": "EP", "2": "EP", "3": "EP", "4": "EP" });
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

  it("keeps a lone song that calls itself a Single on a single release", () => {
    expect(kinds([song("a", "BloodLine", "Bloodline (Single)", "Single")])).toEqual({ a: "Single" });
    expect(kinds([song("b", "Bloom", "Bloom", "")])).toEqual({ b: "Single" });
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

describe("the releases already in the catalog", () => {
  const song = (id: string, title: string, album: string, releaseType = "") => ({ id, metadata: { title, album, releaseType } });

  it("lists every release the catalog has, singles included (founder, 2026-11-16)", () => {
    const songs = [
      song("a", "One", "BAM", "Album"),
      song("b", "Two", "BAM", "Album"),
      song("c", "Three", "Tape", "EP"),
      song("d", "Loose", "", ""),
      song("e", "Called It", "Called It", "Single"),
    ];
    expect(catalogReleases(songs, (s) => s.metadata, (s) => s.id)).toEqual([
      { album: "BAM", kind: "Album" },
      { album: "Called It", kind: "Single" },
      { album: "Loose", kind: "Single" },
      { album: "Tape", kind: "EP" },
    ]);
  });

  it("names a release once, however many songs are on it", () => {
    const songs = [song("a", "One", "BAM"), song("b", "Two", "bam ")];
    expect(catalogReleases(songs, (s) => s.metadata, (s) => s.id)).toHaveLength(1);
  });
});
