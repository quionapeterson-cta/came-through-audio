import { describe, expect, it } from "vitest";
import { emptyMetadata } from "./metadata";
import type { CatalogTrack } from "./catalog";
import { compareLookup, lookupSong } from "./lookups";
import { countryByCode, guessCountry, societyForPro } from "./repertoires";
import { healthReport, societiesFor, type RepertoireCheck } from "./health";

const track = (patch: Partial<ReturnType<typeof emptyMetadata>>, id = "t1"): CatalogTrack => {
  const m = { ...emptyMetadata(), title: "Cut to the Feeling", artist: "Carly Rae Jepsen", ...patch };
  return { id, title: m.title, artist: m.artist, updatedAt: "", metadata: m };
};
const ready = track({
  isrc: "USUM71703861", iswc: "T-919.481.654-1",
  writers: [{ name: "", legalName: "Carly Rae Jepsen", pro: "SOCAN", ipi: "123456789", percentage: "100" }],
  composers: [], publishers: [{ name: "Pub", pro: "SOCAN", ipi: "987654321", percentage: "100" }],
});
const US = countryByCode("US")!;
const check = (society: string, status: RepertoireCheck["status"], details?: unknown): RepertoireCheck =>
  ({ trackId: "t1", society, status, source: details ? "auto" : "self", details, checkedAt: "2026-10-18" });

describe("repertoires", () => {
  it("finds a writer's society worldwide, by name or alias", () => {
    expect(societyForPro("PRS for Music")?.id).toBe("prs");
    expect(societyForPro("gema")?.id).toBe("gema");
    expect(societyForPro("BUMA/STEMRA")?.id).toBe("buma-stemra");
    expect(societyForPro("None")).toBeUndefined();
  });
  it("guesses the catalog's country from its writers' PROs", () => {
    expect(guessCountry(["SOCAN", "SOCAN", "ASCAP"])).toBe("CA");
    expect(guessCountry([""])).toBeUndefined();
  });
  it("performance checks follow the writer's own PRO, even outside the chosen country", () => {
    expect(societiesFor(ready, US, "performance").map((s) => s.id)).toEqual(["socan"]);
    expect(societiesFor(track({ writers: [] }), US, "performance").map((s) => s.id)).toEqual(["ascap", "bmi", "sesac", "gmr"]);
    expect(societiesFor(ready, US, "mechanical").map((s) => s.id)).toEqual(["mlc"]);
  });
});

describe("health report", () => {
  it("scores data and registration separately", () => {
    const none = healthReport([ready], US, []);
    expect(none.dataScore).toBe(100);
    expect(none.registeredScore).toBe(0);
    expect(none.score).toBe(50);
    const all = healthReport([ready], US, [check("socan", "found"), check("soundexchange", "found"), check("mlc", "found")]);
    expect(all.registeredScore).toBe(100);
    expect(all.score).toBe(100);
  });
  it("a society marked not listed needs action", () => {
    const r = healthReport([ready], US, [check("mlc", "not_listed")]);
    expect(r.rows[0]!.pillars.find((p) => p.pillar === "mechanical")!.state).toBe("missing");
    expect(r.needsAction).toBe(1);
  });
  it("turns saved lookups into findings", () => {
    const r = healthReport([track({ ...ready.metadata, iswc: "" })], US, [check("musicbrainz", "found", { recordingTitle: "Cut to the Feeling", artist: "Carly Rae Jepsen", iswcs: ["T-919.481.654-1"], writers: ["Carly Rae Jepsen", "Simon Wilcox"], link: "" })]);
    const text = r.rows[0]!.findings.map((f) => f.text).join(" ");
    expect(text).toContain("T-919.481.654-1");
    expect(text).toContain("Simon Wilcox");
  });
});

describe("lookups", () => {
  const responses: Record<string, unknown> = {
    "https://api.deezer.com/track/isrc:USUM71703861": { id: 1, title: "Cut To The Feeling", isrc: "USUM71703861", link: "https://www.deezer.com/track/1", artist: { name: "Carly Rae Jepsen" } },
    "https://musicbrainz.org/ws/2/isrc/USUM71703861?inc=artist-credits&fmt=json": { recordings: [{ id: "r1", title: "Cut to the Feeling", "artist-credit": [{ name: "Carly Rae Jepsen" }] }] },
    "https://musicbrainz.org/ws/2/recording/r1?inc=work-rels&fmt=json": { relations: [{ type: "performance", work: { id: "w1", title: "Cut to the Feeling", iswcs: ["T-919.481.654-1"] } }] },
    "https://musicbrainz.org/ws/2/work/w1?inc=artist-rels&fmt=json": { relations: [{ type: "writer", artist: { name: "Carly Rae Jepsen" } }, { type: "writer", artist: { name: "Sir Nolan" } }] },
  };
  const fake = async (url: string) => url in responses ? new Response(JSON.stringify(responses[url])) : new Response("{}", { status: 404 });

  it("looks up streaming, the composition, its ISWC and writers by ISRC", async () => {
    const r = await lookupSong({ isrc: "US-UM7-17-03861", title: "Cut to the Feeling", artist: "Carly Rae Jepsen" }, fake, 0);
    expect(r.streaming?.title).toBe("Cut To The Feeling");
    expect(r.work).toMatchObject({ iswcs: ["T-919.481.654-1"], writers: ["Carly Rae Jepsen", "Sir Nolan"] });
  });
  it("returns nothing found rather than failing", async () => {
    const r = await lookupSong({ isrc: "XX0000000000", title: "", artist: "" }, fake, 0);
    expect(r).toEqual({ streaming: null, work: null });
  });
  it("flags a title that doesn't match streaming, but ignores case and feat. credits", () => {
    const hit = { streaming: { title: "Cut To The Feeling (feat. Someone)", artist: "Carly Rae Jepsen", link: "" }, work: null };
    expect(compareLookup(hit, { title: "Cut to the Feeling", artist: "Carly Rae Jepsen", writers: [] }).filter((f) => f.level === "warn")).toEqual([]);
    const off = compareLookup({ ...hit, streaming: { ...hit.streaming, title: "Cut 2 the Feeling" } }, { title: "Cut to the Feeling", artist: "Carly Rae Jepsen", writers: [] });
    expect(off.some((f) => f.field === "title")).toBe(true);
  });
});
