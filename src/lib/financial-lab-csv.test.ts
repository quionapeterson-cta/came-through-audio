import { describe, expect, it } from "vitest";
import { contextForTrack, projectionCsv } from "./financial-lab-copy";

const context = contextForTrack(undefined, {
  earnings: {
    total: 512,
    radio: 0,
    masterShare: 100,
    songShare: 100,
    distributor: 15,
    net: 435.2,
    platforms: [
      { name: "Audiomack, Africa", streams: 128000, rate: 0.004, total: 512, yours: 512 },
    ],
  },
});

describe("projectionCsv", () => {
  it("writes the CTA brand, a header, one row per platform and the net line", () => {
    const rows = projectionCsv(context).split("\n");
    expect(rows[0]).toContain("CAME THROUGH AUDIO — ROYALTY PROJECTION");
    expect(rows[1]).toContain("Your First Stop Before Distribution");
    expect(rows[3]).toContain("Rate (USD)");
    expect(rows[4]).toBe('No song selected,"Audiomack, Africa",128000,0.004,512.00,512.00');
    expect(rows.some((r) => r.includes("You keep") && r.endsWith("435.20"))).toBe(true);
  });

  it("puts a member's own kit on the projection when one is passed", () => {
    const csv = projectionCsv(context, { name: "Karma Came", tagline: "Independent artist" });
    expect(csv).toContain("KARMA CAME — ROYALTY PROJECTION");
    expect(csv).toContain("Independent artist");
    expect(csv).not.toContain("CAME THROUGH AUDIO — ROYALTY PROJECTION");
  });

  it("quotes a name that carries a comma", () => {
    expect(projectionCsv(context)).toContain('"Audiomack, Africa"');
  });
});
