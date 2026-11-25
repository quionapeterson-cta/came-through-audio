import { describe, expect, it } from "vitest";
import { emptyContributor, emptyMetadata } from "@/lib/metadata";
import {
  breakEvenStreams,
  contextForTrack,
  copyForAgency,
  fullReport,
  projectionCsv,
  taxSavings,
  type TrackLike,
} from "./financial-lab-copy";

const track: TrackLike = {
  title: "Midnight",
  metadata: {
    ...emptyMetadata(),
    title: "Midnight",
    artist: "Ann Lee",
    album: "Night",
    isrc: "USABC2600001",
    iswc: "T1234567890",
    duration: "03:45",
    writers: [
      {
        ...emptyContributor(),
        name: "Ann Lee",
        legalName: "Ann Lee",
        pro: "ASCAP",
        ipi: "123456789",
        percentage: "100",
        role: "Author/Composer",
        publishing: "self",
      },
    ],
  },
};

const context = contextForTrack(track, {
  earnings: {
    total: 400,
    radio: 0,
    masterShare: 100,
    songShare: 0,
    platforms: [{ name: "Spotify", streams: 100000, rate: 0.004, total: 400, yours: 320 }],
  },
});

describe("financial lab agency copy", () => {
  it("keeps the 100% and 200% agency scales distinct", () => {
    const bmi = copyForAgency("bmi", context);
    const ascap = copyForAgency("ascap", context);
    expect(bmi).toContain("200% (100% writer + 100% publisher) SCALE");
    expect(bmi).toContain("Ann Lee | Author/Composer | ASCAP | 123456789 | 100% | 0%");
    expect(bmi).toContain("Ann Lee, self-published | Publisher | ASCAP | 123456789 | 0% | 100%");
    expect(ascap).toContain("100% (50% writer + 50% publisher) SCALE");
    expect(ascap).toContain("Ann Lee | Author/Composer | ASCAP | 123456789 | 50% | 0%");
    expect(ascap).toContain("Ann Lee, self-published | Publisher | ASCAP | 123456789 | 0% | 50%");
  });

  it("writes The MLC's writer split and SoundExchange's master context", () => {
    expect(copyForAgency("mlc", context)).toContain(
      "SONGWRITER MECHANICAL SPLIT & METADATA — 100% SCALE",
    );
    expect(copyForAgency("mlc", context)).toContain(
      "Ann Lee | Author/Composer | ASCAP | 123456789 | 100%",
    );
    expect(copyForAgency("soundexchange", context)).toContain("Master share: 100%");
    expect(copyForAgency("soundexchange", context)).toContain("Ann Lee — Featured artist");
  });

  it("puts the itemized earnings and PRO table in the full report", () => {
    const report = fullReport(context);
    expect(report).toContain("PRO SHARE TABLE");
    expect(report).toContain(
      "Ann Lee | Author/Composer | ASCAP | 123456789 | 100% | 50% | 50% | 100%",
    );
    expect(report).toContain(
      "Ann Lee, self-published | Publisher | ASCAP | 123456789 | 100% | 50% | 50% | 100%",
    );
    expect(report).toContain("ASCAP (100%): 50% writer / 50% publisher");
    expect(report).toContain("Spotify | 100,000 | $0.0040 | $400.00 | $320.00");
    expect(report).toContain("PROJECTED TOTAL: $400.00");
  });

  it("formats a hand-entered share in every scale", () => {
    const manual = contextForTrack(undefined, { manual: { scale: "bmi", value: 100 } });
    const copy = copyForAgency("ascap", manual);
    expect(copy).toContain("Entered on the BMI 200% scale: 100%");
    expect(copy).toContain("ASCAP (100% scale): 50%");
    expect(copy).toContain("BMI (200% scale): 100%");
  });
});

describe("financial lab side drawers", () => {
  it("uses the member's own tax rate and rejects a zero net rate", () => {
    expect(taxSavings(1000, 30)).toBe(300);
    expect(taxSavings("", 30)).toBe(0);
    expect(breakEvenStreams(100, 0.004)).toBe(25000);
    expect(breakEvenStreams(100, 0)).toBeNull();
  });
});

describe("the projection CSV's tax block", () => {
  const base = () => ({
    ...contextForTrack(track),
    earnings: {
      total: 12,
      radio: 1,
      masterShare: 100,
      songShare: 100,
      platforms: [{ name: "Spotify", streams: 1000, rate: 0.004, total: 4, yours: 4 }],
    },
  });

  it("ends with the worksheet's deductible total and the estimate at the member's rate", () => {
    const csv = projectionCsv({
      ...base(),
      tax: { rate: 30, deductible: 1000, savings: 300, year: "2026" },
    });
    const lines = csv.split("\n");
    expect(lines).toContain("Midnight,Deductible expenses (tax worksheet),,,,1000.00");
    expect(lines).toContain("Midnight,Estimated tax savings at 30%,,,,300.00");
    expect(lines).toContain("Midnight,Tax year 2026,,,,");
  });

  it("leaves the file exactly as it was when there is no worksheet", () => {
    const csv = projectionCsv(base());
    expect(csv).not.toContain("Deductible");
    expect(csv).not.toContain("tax worksheet");
  });

  it("carries the snapshot through the context builder", () => {
    const context = contextForTrack(track, {
      tax: { rate: 30, deductible: 1000, savings: 300 },
    });
    expect(context.tax).toEqual({ rate: 30, deductible: 1000, savings: 300 });
  });

  it("still carries the worksheet when no streams have been entered", () => {
    const csv = projectionCsv({
      ...contextForTrack(track),
      tax: { rate: 25, deductible: 400, savings: 100 },
    });
    const lines = csv.split("\n");
    expect(lines).toContain("Midnight");
    expect(lines).toContain("Midnight,Deductible expenses (tax worksheet),,,,400.00");
    expect(lines).toContain("Midnight,Estimated tax savings at 25%,,,,100.00");
  });

  it("ignores an empty worksheet rather than printing a zero row", () => {
    const csv = projectionCsv({ ...base(), tax: { rate: 30, deductible: 0, savings: 0 } });
    expect(csv).not.toContain("Deductible");
  });
});
