import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { budgetWorkbook } from "@/lib/budget-xlsx";
import { emptyLabNumbers } from "@/lib/financial-lab-scenario";
import { newTaxRow, type TaxSheet } from "@/lib/financial-lab-tax";
import { TAX_TABLES } from "@/lib/tax-brackets";
import {
  packetKinds,
  packetPlatforms,
  packetRoyalty,
  packetScopeSongs,
  packetTallySlot,
  packetTallyTotal,
  packetTallyUsed,
  packetTax,
  packetTotals,
  packetYears,
  sanitizePacketTally,
  type PacketSong,
} from "@/lib/lab-packet";
import { buildPacketPdfBytes, packetFilename, packetTallyScript } from "@/lib/lab-packet-pdf";
import { taxWorkbook } from "@/lib/tax-xlsx";

const tracks = [
  { id: "bam-1", title: "BAM", metadata: { album: "BAM", releaseType: "Album", title: "BAM" } },
  {
    id: "bam-2",
    title: "Midnight",
    metadata: { album: "BAM", releaseType: "Album", title: "Midnight" },
  },
  {
    id: "ep-1",
    title: "Therapy",
    metadata: { album: "Therapy", releaseType: "EP", title: "Therapy" },
  },
  {
    id: "ep-2",
    title: "Waiting",
    metadata: { album: "Therapy", releaseType: "EP", title: "Waiting" },
  },
  { id: "single", title: "Loose", metadata: { album: "", releaseType: "Single", title: "Loose" } },
];

const blankTax = (year = "2026"): TaxSheet => ({
  year,
  rate: "",
  status: "",
  selfEmployment: "none",
  rows: [],
});

function song(overrides: Partial<PacketSong> & { id: string; title: string }): PacketSong {
  return {
    release: "BAM",
    kind: "Album",
    numbers: emptyLabNumbers(),
    tax: blankTax(),
    budget: null,
    ...overrides,
  };
}

function streams(
  platform: string,
  count: number,
  rate: string,
  distributor = "0",
): PacketSong["numbers"] {
  const base = emptyLabNumbers();
  return {
    ...base,
    streams: { ...base.streams, [platform]: String(count) },
    rates: { ...base.rates, [platform]: rate },
    distributor,
  };
}

describe("packet scope", () => {
  it("covers one song, one release, ticked songs or the whole catalog", () => {
    expect(packetScopeSongs(tracks, { mode: "song", songId: "ep-2" })).toEqual({
      ids: ["ep-2"],
      label: "Waiting",
    });
    expect(packetScopeSongs(tracks, { mode: "song" }).ids).toEqual([]);
    // A release is matched the way My Catalog matches it: case and spacing do not matter.
    expect(packetScopeSongs(tracks, { mode: "release", release: "  bam " }).ids).toEqual([
      "bam-1",
      "bam-2",
    ]);
    expect(packetScopeSongs(tracks, { mode: "songs", songIds: ["single", "ep-2"] })).toEqual({
      ids: ["ep-2", "single"],
      label: "2 selected songs",
    });
    expect(packetScopeSongs(tracks, { mode: "catalog" })).toEqual({
      ids: ["bam-1", "bam-2", "ep-1", "ep-2", "single"],
      label: "Entire catalog",
    });
  });

  it("routes each song to the release My Catalog shows", () => {
    const kinds = packetKinds(tracks);
    expect(kinds.get("bam-1")).toBe("Album");
    expect(kinds.get("ep-1")).toBe("EP");
    expect(kinds.get("single")).toBe("Single");
  });
});

describe("packet tax worksheet", () => {
  const songs = [
    song({
      id: "a",
      title: "BAM",
      tax: {
        ...blankTax("2026"),
        rate: "30",
        selfEmployment: "full",
        rows: [{ ...newTaxRow("mix"), amount: "600" }],
      },
    }),
    song({
      id: "b",
      title: "Midnight",
      tax: {
        ...blankTax("2026"),
        rate: "30",
        rows: [{ ...newTaxRow("merch"), amount: "400.50", kept: true }],
      },
    }),
    song({
      id: "c",
      title: "Old song",
      tax: { ...blankTax("2025"), rate: "30", rows: [{ ...newTaxRow("studio"), amount: "100" }] },
    }),
  ];

  it("merges the scope's lines for one year and leaves another year's out", () => {
    const tax = packetTax(songs, 2026, TAX_TABLES, new Date(2026, 5, 1));
    expect(tax.lines).toHaveLength(2);
    expect(tax.lines.map((line) => line.song)).toEqual(["BAM", "Midnight"]);
    expect(tax.total).toBeCloseTo(1000.5, 2);
    expect(tax.included).toEqual(["BAM", "Midnight"]);
    expect(tax.skipped).toEqual(["Old song"]);
    expect(tax.rate).toBe(30);
    // Self-employment is counted when any worksheet in the scope counted it.
    expect(tax.seRate).toBeGreaterThan(0);
    expect(tax.income).toBeCloseTo(300.15, 2);
    expect(tax.savings).toBeCloseTo(tax.income + tax.se, 2);
  });

  it("prices a blank year as the calendar year and a 2025 packet as 2025 only", () => {
    const blank = song({
      id: "d",
      title: "No year yet",
      tax: { ...blankTax(""), rate: "22", rows: [{ ...newTaxRow("gear"), amount: "250" }] },
    });
    const thisYear = packetTax([blank], 2026, TAX_TABLES, new Date(2026, 5, 1));
    expect(thisYear.total).toBe(250);
    expect(thisYear.included).toEqual(["No year yet"]);

    const lastYear = packetTax(songs, 2025, TAX_TABLES, new Date(2026, 5, 1));
    expect(lastYear.lines.map((line) => line.song)).toEqual(["Old song"]);
    expect(lastYear.total).toBe(100);
    expect(lastYear.skipped).toEqual(["BAM", "Midnight"]);
  });

  it("offers the bracket table years, newest first", () => {
    expect(packetYears(TAX_TABLES, new Date(2026, 5, 1))).toEqual([2027, 2026]);
    expect(packetYears([], new Date(2026, 5, 1))).toEqual([2026]);
  });
});

describe("packet royalties", () => {
  it("reads a song's saved streams, rates and distributor exactly as the Lab does", () => {
    const one = packetRoyalty(
      song({ id: "a", title: "BAM", numbers: streams("spotify", 1000, "0.004", "10") }),
    );
    expect(one.streams).toBe(1000);
    expect(one.gross).toBeCloseTo(4, 4);
    expect(one.net).toBeCloseTo(3.6, 4);
    expect(one.platforms.find((line) => line.id === "spotify")?.rate).toBeCloseTo(0.004, 6);
  });

  it("leaves radio and live money outside the distributor's cut", () => {
    const base = streams("spotify", 1000, "0.004", "10");
    const one = packetRoyalty(
      song({
        id: "a",
        title: "BAM",
        numbers: { ...base, radio: { plays: "100", perPlay: "0.01" } },
      }),
    );
    expect(one.radio).toBeCloseTo(1, 4);
    expect(one.gross).toBeCloseTo(5, 4);
    // 10% comes off the platform pool only: 4 × 0.9 + 1.
    expect(one.net).toBeCloseTo(4.6, 4);
  });

  it("adds the scope's streams and prints the blended rate the scope actually paid", () => {
    const rows = packetPlatforms([
      song({ id: "a", title: "BAM", numbers: streams("spotify", 1000, "0.004") }),
      song({ id: "b", title: "Midnight", numbers: streams("spotify", 2000, "0.006") }),
    ]);
    const spotify = rows.find((line) => line.id === "spotify")!;
    expect(spotify.streams).toBe(3000);
    expect(spotify.pool).toBeCloseTo(16, 4);
    expect(spotify.rate).toBeCloseTo(16 / 3000, 8);
  });

  it("prices a typed scope tally at the scope's blended rate and share", () => {
    const songs = [
      song({ id: "a", title: "BAM", numbers: streams("spotify", 1000, "0.004") }),
      song({ id: "b", title: "Midnight", numbers: streams("spotify", 2000, "0.006") }),
    ];
    const rows = packetPlatforms(songs, { spotify: "5000" });
    const spotify = rows.find((line) => line.id === "spotify")!;
    expect(spotify.streams).toBe(5000);
    expect(spotify.rate).toBeCloseTo(16 / 3000, 8);
    expect(spotify.pool).toBeCloseTo(5000 * (16 / 3000), 6);
    expect(spotify.yours).toBeCloseTo(5000 * (16 / 3000), 6);

    // A platform with no tally keeps its saved streams.
    const mixed = packetPlatforms(songs, { spotify: "5000" });
    const apple = mixed.find((line) => line.id === "apple")!;
    expect(apple.streams).toBe(0);

    const tax = packetTax(songs, 2026, TAX_TABLES, new Date(2026, 5, 1));
    const totals = packetTotals(songs, tax, { spotify: "5000" });
    expect(totals.streams).toBe(5000);
    expect(totals.royalty).toBeCloseTo(5000 * (16 / 3000), 6);
  });

  it("sanitizes a saved tally and keys it to the scope and year", () => {
    expect(sanitizePacketTally({ spotify: "1,234 streams", apple: "  ", bogus: "9" })).toEqual({
      spotify: "1234",
    });
    expect(packetTallyTotal({ spotify: "1000", apple: "250" })).toBe(1250);
    // A typed 0 is a real answer; only a blank box keeps the saved streams.
    expect(packetTallyUsed({ spotify: "0" })).toBe(true);
    expect(packetTallyUsed({ spotify: "" })).toBe(false);
    const one = song({ id: "a", title: "BAM", numbers: streams("spotify", 1000, "0.004") });
    expect(
      packetPlatforms([one], { spotify: "0" }).find((row) => row.id === "spotify")?.streams,
    ).toBe(0);
    expect(packetTallySlot(["b", "a"], 2026)).toBe(packetTallySlot(["a", "b"], 2026));
    expect(packetTallySlot(["a"], 2026)).not.toBe(packetTallySlot(["a"], 2025));
  });

  it("totals streams, royalties, budgets and the worksheet for the summary", () => {
    const songs = [
      song({
        id: "a",
        title: "BAM",
        numbers: streams("spotify", 1000, "0.004"),
        budget: {
          project: "Music video",
          target: 1000,
          rows: [
            {
              id: "r1",
              category: "Mixing & Mastering",
              item: "Mix",
              budget: 500,
              actual: "400",
              paid: true,
            },
            {
              id: "r2",
              category: "Studio Time",
              item: "Room",
              budget: 500,
              actual: "",
              paid: false,
            },
          ],
        },
        tax: { ...blankTax("2026"), rate: "30", rows: [{ ...newTaxRow("mix"), amount: "400" }] },
      }),
      song({
        id: "b",
        title: "Midnight",
        release: "Therapy",
        numbers: streams("spotify", 1000, "0.004"),
      }),
    ];
    const tax = packetTax(songs, 2026, TAX_TABLES, new Date(2026, 5, 1));
    const totals = packetTotals(songs, tax);
    expect(totals.songs).toBe(2);
    expect(totals.releases).toBe(2);
    expect(totals.streams).toBe(2000);
    expect(totals.royalty).toBeCloseTo(8, 4);
    expect(totals.budget).toMatchObject({
      plans: 1,
      target: 1000,
      planned: 1000,
      spent: 400,
      remaining: 600,
    });
    expect(totals.deductible).toBe(400);
    expect(totals.incomeTax).toBeCloseTo(120, 2);
  });
});

describe("recalculation and the packet file", () => {
  it("asks Excel to recalculate both Lab workbooks the moment they open", async () => {
    const tax = await taxWorkbook({
      ...blankTax(),
      rows: [{ ...newTaxRow("mix"), amount: "100" }],
    });
    const budget = await budgetWorkbook({
      project: "Music video",
      target: 1000,
      tip: "",
      allocated: [],
      rows: [{ id: "r1", category: "Mixing", item: "Mix", budget: 500, actual: "", paid: false }],
    });
    expect(tax.calcProperties.fullCalcOnLoad).toBe(true);
    expect(budget.calcProperties.fullCalcOnLoad).toBe(true);
  });

  it("builds one branded PDF with a page for every section", async () => {
    const songs = [
      song({
        id: "a",
        title: "BAM",
        numbers: streams("spotify", 1000, "0.004"),
        tax: { ...blankTax("2026"), rate: "30", rows: [{ ...newTaxRow("mix"), amount: "600" }] },
      }),
    ];
    const bytes = await buildPacketPdfBytes(songs, {
      label: "BAM",
      year: 2026,
      tables: TAX_TABLES,
      madeAt: new Date(2026, 5, 1),
    });
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
    const doc = await PDFDocument.load(bytes);
    // Cover, summary, tax, budget, tally and projection — one page each for a single song.
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(6);
  });

  it("turns the tally boxes into fields whose total adds itself up", async () => {
    const songs = [
      song({
        id: "a",
        title: "BAM",
        numbers: streams("spotify", 1000, "0.004"),
        tax: { ...blankTax("2026"), rate: "30", rows: [{ ...newTaxRow("mix"), amount: "600" }] },
      }),
    ];
    const bytes = await buildPacketPdfBytes(songs, {
      label: "BAM",
      year: 2026,
      tables: TAX_TABLES,
      madeAt: new Date(2026, 5, 1),
      tally: { spotify: "5000", apple: "250" },
    });
    const form = (await PDFDocument.load(bytes)).getForm();
    expect(form.getTextField("tally-spotify").getText()).toBe("5000");
    expect(form.getTextField("tally-apple").getText()).toBe("250");
    expect(form.getTextField("tally-total").getText()).toBe("5,250");
    const script = packetTallyScript(["spotify", "apple"]);
    expect(script).toContain('"spotify"');
    expect(script).toContain('this.getField("tally-"+ctaIds[ctaI])');
  });

  it("names the file after the scope", () => {
    expect(packetFilename("BAM / Deluxe")).toBe("BAM Deluxe financial lab packet.pdf");
    expect(packetFilename("   ")).toBe("Financial Lab financial lab packet.pdf");
  });
});
