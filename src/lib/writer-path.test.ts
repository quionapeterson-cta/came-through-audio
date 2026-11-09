import { describe, expect, it } from "vitest";
import type { CatalogTrack } from "@/lib/catalog";
import { auditTrack } from "@/lib/audit";
import { emptyMetadata, emptyContributor } from "@/lib/metadata";
import { releaseItems } from "@/lib/release-checklist";
import { trackReport } from "@/lib/health";
import { countryByCode } from "@/lib/repertoires";

const song = (patch: Partial<ReturnType<typeof emptyMetadata>> = {}): CatalogTrack => {
  const m = { ...emptyMetadata(), title: "Placed Song", artist: "", ...patch };
  return { id: "w1", title: m.title, artist: m.artist, updatedAt: "", metadata: m };
};
const external = (patch: Partial<ReturnType<typeof emptyMetadata>> = {}) => song({ recordingSide: "external", ...patch });
const US = countryByCode("US")!;
const written = () => [{ ...emptyContributor(), legalName: "Ann Lee", role: "Author/Composer", pro: "BMI", ipi: "123456789", percentage: "100" }];

describe("writer path: someone else performs it", () => {
  it("never asks for the recording's ISRC or artist tag", () => {
    expect(auditTrack(external()).filter((i) => i.field === "isrc" || i.field === "artist")).toEqual([]);
    // The member's own recording still gets both.
    expect(auditTrack(song()).some((i) => i.field === "isrc")).toBe(true);
    expect(auditTrack(song()).some((i) => i.field === "artist")).toBe(true);
  });
  it("never grades an ISRC pasted in from the artist's release", () => {
    expect(auditTrack(external({ isrc: "nope" })).filter((i) => i.field === "isrc")).toEqual([]);
  });
  it("keeps the lyrics item while dropping the artwork one", () => {
    const items = releaseItems(external({ writers: written() }).metadata, {});
    expect(items.map((i) => i.id)).toContain("lyrics");
    expect(items.find((i) => i.id === "lyrics")!.title).toBe("Lyrics");
  });
  it("drops the release's recording items, and keeps the composition's", () => {
    const ids = releaseItems(external({ writers: written() }).metadata, {}).map((i) => i.id);
    expect(ids).not.toContain("isrc");
    expect(ids).not.toContain("upc");
    expect(ids).not.toContain("master");
    expect(ids).not.toContain("art");
    expect(ids).toContain("writers");
    expect(ids).toContain("splits");
    // An own recording keeps every one of them.
    expect(releaseItems(song({ writers: written() }).metadata, {}).map((i) => i.id)).toContain("master");
  });
  it("is read on the composition only: no SoundExchange pillar for their recording", () => {
    expect(trackReport(external({ writers: written() }), US, []).pillars.map((p) => p.pillar)).toEqual(["performance", "mechanical"]);
    expect(trackReport(song({ writers: written() }), US, []).pillars.map((p) => p.pillar)).toContain("digital");
  });
});
