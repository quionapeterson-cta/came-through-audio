import { describe, expect, it } from "vitest";
import { groupZones, zonesToText } from "./pdf-template-convert";

const page = { width: 600, height: 800 };

describe("groupZones", () => {
  it("joins fragments on one baseline into a single line", () => {
    const zones = groupZones(
      [
        { str: "Track:", x: 40, y: 100, width: 40, height: 10 },
        { str: "Roll Out", x: 90, y: 101, width: 60, height: 10 },
      ],
      page,
    );
    expect(zones).toHaveLength(1);
    expect(zones[0]!.text).toBe("Track: Roll Out");
  });

  it("keeps a wide gap as its own zone, so two columns never merge", () => {
    const zones = groupZones(
      [
        { str: "Artist", x: 40, y: 200, width: 50, height: 10 },
        { str: "Karma Came", x: 400, y: 200, width: 90, height: 10 },
      ],
      page,
    );
    expect(zones.map((z) => z.text)).toEqual(["Artist", "Karma Came"]);
  });

  it("reads the page top to bottom", () => {
    const zones = groupZones(
      [
        { str: "second", x: 40, y: 300, width: 50, height: 10 },
        { str: "first", x: 40, y: 100, width: 40, height: 10 },
      ],
      page,
    );
    expect(zones.map((z) => z.text)).toEqual(["first", "second"]);
  });

  it("drops blank fragments and measures the box as a fraction of the page", () => {
    const zones = groupZones(
      [
        { str: "   ", x: 10, y: 10, width: 5, height: 5 },
        { str: "Release date", x: 60, y: 80, width: 120, height: 10 },
      ],
      page,
    );
    expect(zones).toHaveLength(1);
    expect(zones[0]).toMatchObject({ left: 0.1, top: 0.1 });
    expect(zones[0]!.width).toBeCloseTo(0.2, 5);
  });
});

describe("zonesToText", () => {
  it("swaps a mapped zone for its token and keeps the rest as words", () => {
    const zones = [
      { id: "a", left: 0, top: 0, width: 1, height: 1, text: "Track: Roll Out" },
      { id: "b", left: 0, top: 0.1, width: 1, height: 1, text: "Released 15 November 2026" },
    ];
    expect(zonesToText(zones, { a: "{{TRACK_TITLE}}" })).toBe(
      "{{TRACK_TITLE}}\nReleased 15 November 2026",
    );
  });
});
