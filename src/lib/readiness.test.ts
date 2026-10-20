import { describe, expect, it } from "vitest";
import { emptyMetadata, splitTrack, withLegalName, type Contributor, type Metadata } from "@/lib/metadata";
import { registrationReadiness, registrationWriters } from "@/lib/readiness";
import { exportGate, mlcRows, proCheatSheet } from "@/lib/agency-export";
import type { CatalogTrack } from "@/lib/catalog";

const w = (name: string, role: string, legalName?: string, pro = "", percentage = ""): Contributor => ({ name, role, pro, ipi: "", percentage, ...(legalName !== undefined && { legalName }) });
/** Shares the 100% evenly (last row takes the rounding) unless a test sets its own splits. */
const even = (rows: Contributor[]) => {
  const named = rows.filter((r) => r.name || r.legalName);
  const each = Math.floor(100 / Math.max(1, named.length));
  return rows.map((r) => !named.includes(r) ? r : { ...r, percentage: String(r === named.at(-1) ? 100 - each * (named.length - 1) : each) });
};
const song = (patch: Partial<Metadata>, splits = true): Metadata => {
  const m = { ...emptyMetadata(), writers: [], composers: [], title: "Song", artist: "Artist", ...patch };
  if (!splits || [...m.writers, ...m.composers].some((r) => r.percentage)) return m;
  const all = even([...m.writers, ...m.composers]);
  return { ...m, writers: all.slice(0, m.writers.length), composers: all.slice(m.writers.length) };
};
const codes = (m: Metadata, target?: "pro") => registrationReadiness(m, target).missing.map((i) => i.code);

describe("registration readiness", () => {
  it("is ready with an author and a composer who both have legal names", () => {
    expect(registrationReadiness(song({ writers: [w("Q", "Author", "Quiona P"), w("Beatz", "Composer", "John Doe")] })).ready).toBe(true);
  });
  it("counts Author/Composer toward both", () => {
    expect(codes(song({ writers: [w("Q", "Author/Composer", "Quiona P")] }))).toEqual([]);
  });
  it("needs an author unless instrumental", () => {
    const m = song({ writers: [w("Beatz", "Composer", "John Doe")] });
    expect(codes(m)).toEqual(["author"]);
    expect(codes({ ...m, instrumental: true })).toEqual([]);
  });
  it("always needs a composer", () => {
    expect(codes(song({ writers: [w("Q", "Author", "Quiona P")], instrumental: true }))).toEqual(["composer"]);
  });
  it("lists each writer missing a legal name with a link to that field", () => {
    const r = registrationReadiness(song({ writers: [w("", "Author"), w("Q", "Author/Composer", ""), w("Beatz", "Composer")] }));
    expect(r.missing).toEqual([
      { code: "legal_name", message: "Add a legal name for Q", field: "writers-1-legalName" },
      { code: "legal_name", message: "Add a legal name for Beatz", field: "writers-2-legalName" },
    ]);
  });
  it("counts entries saved before roles existed as composers", () => {
    expect(codes(song({ writers: [w("Q", "Author", "Quiona P")], composers: [w("Beatz", "", "John Doe")] }))).toEqual([]);
  });
  it("needs writer splits to equal exactly 100%, with a link to the first split box", () => {
    const missing = (m: Metadata) => registrationReadiness(m).missing.filter((x) => x.code === "split");
    expect(missing(song({ writers: [w("Q", "Author/Composer", "Quiona P")] }, false))[0]).toMatchObject({ field: "writers-0-share", message: expect.stringContaining("exactly 100%") });
    expect(missing(song({ writers: [w("Q", "Author", "Quiona P", "", "50"), w("B", "Composer", "John Doe", "", "35")] }))[0]?.message).toContain("Add the missing 15%");
    expect(missing(song({ writers: [w("Q", "Author", "Quiona P", "", "60"), w("B", "Composer", "John Doe", "", "50")] }))[0]?.message).toContain("Lower them by 10%");
    expect(missing(song({ writers: [w("Q", "Author", "Quiona P", "", "33.33"), w("B", "Composer", "John Doe", "", "33.33"), w("C", "Composer", "Cee", "", "33.34")] }))).toEqual([]);
  });
  it("needs publisher shares to equal exactly 100% when any publisher is listed", () => {
    const writers = [w("Q", "Author/Composer", "Quiona P", "", "100")];
    const pub = (percentage: string) => ({ name: "Lee Songs", pro: "", ipi: "", percentage });
    expect(codes(song({ writers }))).toEqual([]);
    expect(codes(song({ writers, publishers: [pub("100")] }))).toEqual([]);
    expect(codes(song({ writers, publishers: [pub("50"), { ...pub("50"), name: "Co Pub" }] }))).toEqual([]);
    expect(registrationReadiness(song({ writers, publishers: [pub("50")] })).missing).toEqual([
      { code: "split", message: "Publisher shares total 50%. Add the missing 50% so they equal exactly 100%.", field: "publishers-0-share" },
    ]);
    expect(codes(song({ writers, publishers: [pub("")] }))).toEqual(["split"]);
  });
  it("doesn't check splits for SoundExchange, which registers the recording", () => {
    expect(registrationReadiness(song({ writers: [w("Q", "Author/Composer", "Quiona P")] }, false), "soundexchange").ready).toBe(true);
  });
  it("requires PRO affiliation only for PRO registration", () => {
    const m = song({ writers: [w("Q", "Author/Composer", "Quiona P", "None")] });
    expect(codes(m)).toEqual([]);
    expect(codes(m, "pro")).toEqual(["pro"]);
  });
});

describe("legal name seeding", () => {
  it("fills a blank legal name from the older saved name, never overwriting or deleting", () => {
    const rows = withLegalName([w("Quiona P", "Author"), w("Q", "Author", ""), w("Lil Q", "Author", "Quiona Peterson")]);
    expect(rows.map((r) => r.legalName)).toEqual(["Quiona P", "Q", "Quiona Peterson"]);
    expect(rows.map((r) => r.name)).toEqual(["Quiona P", "Q", "Lil Q"]);
  });
  it("flags a writer row with a share but no name", () => {
    const r = registrationReadiness(song({ writers: [w("", "Author/Composer", "Quiona P", "", "50"), { ...w("", "Composer", ""), percentage: "50" }] }));
    expect(r.missing).toEqual([{ code: "legal_name", message: "Add a legal name for writer 2", field: "writers-1-legalName" }]);
  });
});

describe("track number", () => {
  it("splits 1/12 into track 1 of 12", () => {
    expect(splitTrack("1/12")).toEqual({ trackNumber: "1", trackTotal: "12" });
    expect(splitTrack("3")).toEqual({ trackNumber: "3", trackTotal: "" });
  });
});

describe("agency exports", () => {
  const track = (m: Metadata): CatalogTrack => ({ id: m.title, title: m.title, artist: m.artist, updatedAt: "", metadata: m });
  const ready = track(song({ title: "Ready", writers: [w("Lil Q", "Author/Composer", "Quiona Peterson", "BMI")] }));
  const notReady = track(song({ title: "Draft", writers: [w("Lil Q", "Author")] }));

  it("holds back songs that are not ready", () => {
    const { ready: ok, held } = exportGate("mlc", [ready, notReady]);
    expect(ok.map((t) => t.title)).toEqual(["Ready"]);
    expect(held.map((h) => h.track.title)).toEqual(["Draft"]);
  });
  it("uses legal names, never credited names", () => {
    const row = mlcRows([ready])[0]!;
    expect(row.slice(6, 10)).toEqual(["PETERSON", "QUIONA", "", "CA"]);
    expect(proCheatSheet([ready])).toContain("Quiona Peterson,Author/Composer");
    expect(proCheatSheet([ready])).not.toContain("Lil Q");
  });
  it("needs PRO affiliation only for the PRO export", () => {
    const noPro = track(song({ title: "NoPro", writers: [w("Lil Q", "Author/Composer", "Quiona Peterson")] }));
    expect(exportGate("mlc", [noPro]).held).toEqual([]);
    expect(exportGate("soundexchange", [noPro]).held).toEqual([]);
    expect(exportGate("pro", [noPro]).held).toHaveLength(1);
  });
  it("maps writers to their registration role", () => {
    expect(registrationWriters(song({ writers: [w("A", "Author", "a")], composers: [w("C", "", "c")] })).map((x) => x.role)).toEqual(["Author", "Composer"]);
  });
});

describe("embedded files", () => {
  it("round-trips track 1 of 12 and writer legal names", async () => {
    const { embedMetadata, readMetadata } = await import("@/lib/metadata");
    const blob = await embedMetadata(new Uint8Array([0xff, 0xfb, 0x90, 0x00, ...new Array(400).fill(0)]).buffer, song({ trackNumber: "1", trackTotal: "12", writers: [w("Lil Q", "Author/Composer", "Quiona Peterson")] }));
    // jsdom's Blob has no arrayBuffer(), so read it the old way.
    const buf = await new Promise<ArrayBuffer>((ok) => { const r = new FileReader(); r.onload = () => ok(r.result as ArrayBuffer); r.readAsArrayBuffer(blob); });
    const back = readMetadata(buf);
    expect([back.trackNumber, back.trackTotal]).toEqual(["1", "12"]);
    expect(back.writers?.[0]?.legalName).toBe("Quiona Peterson");
  });
});
