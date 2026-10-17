import { describe, expect, it } from "vitest";
import { emptyMetadata, sealLegalName, withLegalName, type Contributor, type Metadata } from "@/lib/metadata";
import { registrationReadiness, registrationWriters } from "@/lib/readiness";
import { exportGate, mlcRows, proCheatSheet } from "@/lib/agency-export";
import type { CatalogTrack } from "@/lib/catalog";

const w = (name: string, role: string, legalName?: string, pro = ""): Contributor => ({ name, role, pro, ipi: "", percentage: "", ...(legalName !== undefined && { legalName }) });
const song = (patch: Partial<Metadata>): Metadata => ({ ...emptyMetadata(), writers: [], composers: [], title: "Song", artist: "Artist", ...patch });
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
      { code: "legal_name", message: "Q: add legal name", field: "writers-1-legalName" },
      { code: "legal_name", message: "Beatz: add legal name", field: "writers-2-legalName" },
    ]);
  });
  it("counts entries saved before roles existed as composers", () => {
    expect(codes(song({ writers: [w("Q", "Author", "Quiona P")], composers: [w("Beatz", "", "John Doe")] }))).toEqual([]);
  });
  it("requires PRO affiliation only for PRO registration", () => {
    const m = song({ writers: [w("Q", "Author/Composer", "Quiona P", "None")] });
    expect(codes(m)).toEqual([]);
    expect(codes(m, "pro")).toEqual(["pro"]);
  });
});

describe("legal name seeding", () => {
  it("seeds legacy rows from the name typed into the old legal-name field, never overwriting", () => {
    expect(withLegalName([w("Quiona P", "Author"), w("Q", "Author", "")]).map((r) => r.legalName)).toEqual(["Quiona P", ""]);
  });
  it("seals new rows on save so a stage name is never seeded as a legal name", () => {
    expect(withLegalName(sealLegalName([w("Lil Q", "Author")]))[0]!.legalName).toBe("");
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
