import { describe, expect, it } from "vitest";
import type { CatalogTrack } from "@/lib/catalog";
import { beatMasterLine, isBeat, isSoldBeat, masterBeatLine, masterFromBeat, masterOfBeat } from "@/lib/beats";
import { emptyContributor, emptyMetadata } from "@/lib/metadata";
import { RELEASE_TICK, releaseItems } from "@/lib/release-checklist";

const beat = { ...emptyMetadata(), title: "Beat 12", instrumental: true, beatState: "unsold" as const,
  writers: [{ ...emptyContributor(), legalName: "Ann Lee", role: "Composer", percentage: "100" }] };
const track = (id: string, m = emptyMetadata()): CatalogTrack => ({ id, title: m.title, artist: m.artist, updatedAt: "", metadata: m });

describe("a beat's state", () => {
  it("is not a beat until the producer says so", () => {
    expect(isBeat(emptyMetadata())).toBe(false);
    expect(isSoldBeat(emptyMetadata())).toBe(false);
    expect(isBeat(beat)).toBe(true);
    expect(isSoldBeat(beat)).toBe(false);
  });
  it("finds its master by scanning the master's own link, and never invents one", () => {
    const master = track("m1", { ...emptyMetadata(), title: "Gold Teeth", beatMasterId: "b1" });
    expect(masterOfBeat("b1", [master])?.id).toBe("m1");
    expect(masterOfBeat("b2", [master])).toBeUndefined();
    expect(masterOfBeat("", [master])).toBeUndefined();
    expect(beatMasterLine(master)).toBe("Sold · master: Gold Teeth");
    expect(beatMasterLine({ ...master, metadata: { ...master.metadata, dealType: "Exclusive", dealContract: "c1" } }))
      .toBe("Sold · master: Gold Teeth · Exclusive · contract");
    expect(beatMasterLine()).toBe("Sold · no master linked yet");
  });
  it("reads the deal strip from the master, contract included", () => {
    expect(masterBeatLine("Beat 12", { dealType: "Exclusive", dealDate: "2026-11-09", dealStreams: "50000", dealContract: "c1" }))
      .toBe("From Beat 12 · Exclusive · 2026-11-09 · 50000 streams · contract");
    expect(masterBeatLine("", { dealType: "", dealDate: "", dealStreams: "", dealContract: "" })).toBe("From a beat");
  });
});

describe("creating the master from a beat", () => {
  it("carries the writers across and leaves the artist's release blank", () => {
    const m = masterFromBeat(beat, "b1");
    expect(m.beatMasterId).toBe("b1");
    expect(m.instrumental).toBe(false);
    expect(m.title).toBe("");
    expect(m.artist).toBe("");
    expect(m.isrc).toBe("");
    expect(m.writers.map((w) => w.legalName)).toEqual(["Ann Lee"]);
  });
});

describe("a beat's release checklist", () => {
  it("asks only for what a beat can honestly have", () => {
    const items = releaseItems(beat, {});
    expect(items.map((i) => i.id)).toEqual(["writers", "splits", "splitSheet", "beatContract"]);
    const ids = items.map((i) => i.id);
    expect(ids).not.toContain("isrc");
    expect(ids).not.toContain("upc");
    expect(ids).not.toContain("master");
    expect(ids).not.toContain("art");
  });
  it("when sold, asks for the split sheet, the beat contract and the linked master", () => {
    const items = releaseItems({ ...beat, beatState: "sold" }, {});
    expect(items.map((i) => i.id)).toEqual(["splitSheet", "beatContract", "linkedMaster"]);
    expect(items.find((i) => i.id === "linkedMaster")!.done).toBe(false);
    expect(releaseItems({ ...beat, beatState: "sold" }, {}, true).find((i) => i.id === "linkedMaster")!.done).toBe(true);
  });
  it("ticks the signed contracts, and counts both in the percentage", () => {
    expect(releaseItems(beat, { [RELEASE_TICK.beatContract]: "2026-11-09" }).find((i) => i.id === "beatContract")!.done).toBe(true);
    expect(releaseItems(beat, { [RELEASE_TICK.split]: "2026-11-09" }).find((i) => i.id === "splitSheet")!.done).toBe(true);
  });
});
