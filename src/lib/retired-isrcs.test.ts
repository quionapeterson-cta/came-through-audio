import { describe, expect, it } from "vitest";
import { agencyRequestText, isrcKey, retiredRow, type CatalogRow } from "@/lib/retired-isrcs";

const row = (details: unknown, isrc = "GXESV2623521"): CatalogRow => ({
  id: "song-1",
  user_id: "member-1",
  track_title: "Do you Mind That?",
  artist_name: "Karma Came",
  album_title: "Karma Came",
  release_date: "2026-03-01",
  isrc,
  details,
  updated_at: "2026-11-12T10:00:00.000Z",
});

describe("the retired ISRC queue", () => {
  it("leaves a song with no retired code out of it", () => {
    expect(retiredRow(row({ retiredIscrs: [] }))).toBeNull();
    expect(retiredRow(row({}))).toBeNull();
    expect(retiredRow(row({ retiredIscrs: ["  "] }))).toBeNull();
  });

  it("never lists the live code twice, or the same old code twice", () => {
    const r = retiredRow(row({ retiredIscrs: ["QZNMY2291725", "qznmy-2291725", "GXESV2623521", ""] }));
    expect(r?.retired).toEqual(["QZNMY2291725"]);
    expect(isrcKey("gx-esv-2623521")).toBe("GXESV2623521");
  });

  it("writes the request as an entry of its own, with the old code left open", () => {
    const r = retiredRow(row({ retiredIscrs: ["QZNMY2291725"] }))!;
    const text = agencyRequestText(r);
    expect(text).toContain("- Current ISRC: GXESV2623521");
    expect(text).toContain("- Retired ISRC: QZNMY2291725");
    expect(text).toContain("register the recording under GXESV2623521 as an entry of its own");
    expect(text).toContain("leave the retired ISRC open");
    expect(text).not.toContain("remove");
  });

  it("says a missing current code out loud instead of leaving a gap", () => {
    const r = retiredRow(row({ retiredIscrs: ["QZNMY2291725"] }, ""))!;
    expect(agencyRequestText(r)).toContain("(not entered yet)");
    expect(agencyRequestText(r)).toContain("register the recording under the current ISRC as an entry of its own");
  });
});
