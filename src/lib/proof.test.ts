import { describe, expect, it } from "vitest";
import { certificateCredits, PACKAGES, packageFor, packagePrice, proofFileError } from "./proof";
import { assistanceTotal } from "@/lib/plans";

describe("proof rules", () => {
  it("big phone videos are accepted", () => expect(proofFileError({ type: "video/quicktime", name: "IMG_1.MOV", size: 76 * 1048576 })).toBeNull());
  it("videos over 1GB are rejected", () => expect(proofFileError({ type: "video/mp4", name: "a.mp4", size: 1_073_741_825 })).not.toBeNull());
  it("blank file type is read from the extension", () => expect(proofFileError({ type: "", name: "clip.m4v", size: 10 })).toBeNull());
  it("non-video rejected", () => expect(proofFileError({ type: "audio/mpeg", name: "a.mp3", size: 10 })).not.toBeNull());
  it("singles stack up to 3 songs before the EP", () => {
    expect([1, 2, 3, 4, 6, 7].map(packageFor)).toEqual(["Single", "Single", "Single", "EP", "EP", "Album"]);
    expect([1, 2, 3].map((n) => packagePrice("Single", n))).toEqual([2.99, 5.98, 8.97]);
    expect(packagePrice("EP", 4)).toBe(9.99);
  });
  it("credits: Singles count songs bought, packages their size, refunds nothing", () => expect(certificateCredits([
    { kind: "ai", details: { package: "Single", songs: "3" } }, { kind: "ai", details: { package: "Single" } },
    { kind: "ai", details: { package: "EP", songs: "4" } }, { kind: "ai", details: { package: "EP", refunded_at: "x" } },
  ])).toBe(10));
  it("package prices", () => expect(PACKAGES.map((p) => p.price)).toEqual([2.99, 9.99, 16.99, 24.99]));
});
describe("registration assistance", () => {
  it("singles cap at 6", () => expect(assistanceTotal("single", 10, 1)).toBeCloseTo(14.99 + 4.99 * 6));
  it("21 album tracks add a $14.99 Extended Repertoire Fee", () => expect(assistanceTotal("album", 21, 1)).toBeCloseTo(29.99 + 14.99 + 4.99 * 21));
  it("blank inputs total 0", () => expect(assistanceTotal("album", 0, 0)).toBe(0));
});
