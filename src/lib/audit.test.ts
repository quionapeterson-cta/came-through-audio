import { describe, expect, it } from "vitest";
import { auditCatalog, auditTrack, hasPro, isIsrc, isIswc } from "./audit";
import { emptyMetadata } from "./metadata";
import type { CatalogTrack } from "./catalog";

const track = (patch: Partial<ReturnType<typeof emptyMetadata>>): CatalogTrack => {
  const m = { ...emptyMetadata(), title: "Song", artist: "Artist", ...patch };
  return { id: "1", title: m.title, artist: m.artist, updatedAt: "", metadata: m };
};
const ready = track({
  isrc: "US-ABC-24-00001", iswc: "T-123.456.789-0", duration: "3:25",
  writers: [{ name: "A", pro: "BMI", ipi: "123456789", percentage: "100" }],
  composers: [], publishers: [{ name: "Pub", pro: "BMI", ipi: "987654321", percentage: "100" }],
});

describe("royalty audit", () => {
  it("validates ISRC and ISWC formats", () => {
    expect(isIsrc("USABC2400001")).toBe(true);
    expect(isIsrc("USABC24")).toBe(false);
    expect(isIswc("T-123.456.789-0")).toBe(true);
  });
  it("a complete track is 100% ready", () => {
    expect(auditTrack(ready)).toEqual([]);
    expect(auditCatalog([ready]).score).toBe(100);
  });
  it("a missing ISRC flags SoundExchange only", () => {
    const issues = auditTrack({ ...ready, metadata: { ...ready.metadata, isrc: "" } });
    expect(issues.map((i) => i.pillar)).toEqual(["digital"]);
  });
  it("accepts any worldwide or typed-in PRO, not only US societies", () => {
    for (const pro of ["PRS for Music", "SOCAN", "GEMA", "SACEM", "MÜST"]) {
      expect(auditTrack({ ...ready, metadata: { ...ready.metadata, writers: [{ ...ready.metadata.writers[0]!, pro }] } })).toEqual([]);
    }
  });
  it("needs a duration to reach 100%", () => {
    expect(auditTrack({ ...ready, metadata: { ...ready.metadata, duration: "" } }).map((i) => i.field)).toEqual(["duration"]);
  });
  it("needs a PRO for a listed publisher, but not for Self-published or BMI writers with no publisher", () => {
    expect(auditTrack({ ...ready, metadata: { ...ready.metadata, publishers: [{ ...ready.metadata.publishers[0]!, pro: "" }] } }).map((i) => i.field)).toEqual(["publishers-0-pro"]);
    expect(auditTrack({ ...ready, metadata: { ...ready.metadata, publishers: [], selfPublished: true } })).toEqual([]);
    expect(auditTrack({ ...ready, metadata: { ...ready.metadata, publishers: [] } })).toEqual([]);
  });
  it("flags writers with no PRO", () => {
    expect(["", " ", "None", "Other"].map(hasPro)).toEqual([false, false, false, false]);
  });
});
