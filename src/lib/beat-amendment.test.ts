import { describe, expect, it } from "vitest";
import { amendmentPrefill } from "@/lib/beat-amendment";

describe("the amendment starts from the deal on file", () => {
  it("fills the beat, the original date and the original cap", () => {
    expect(amendmentPrefill({ dealDate: "2026-11-09", dealStreams: "50000" }, "Beat 12"))
      .toEqual({ beatTitle: "Beat 12", originalLicenseDate: "2026-11-09", originalCap: "50000" });
  });
  it("invents nothing when the deal is blank", () => {
    expect(amendmentPrefill({ dealDate: "", dealStreams: "" }, "")).toEqual({});
    expect(amendmentPrefill({ dealDate: "", dealStreams: "" }, "Beat 12")).toEqual({ beatTitle: "Beat 12" });
  });
});
