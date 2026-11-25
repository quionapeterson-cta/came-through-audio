import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { emptyLabNumbers } from "@/lib/financial-lab-scenario";
import { newTaxRow, type TaxSheet } from "@/lib/financial-lab-tax";
import type { CopyContext } from "@/lib/financial-lab-copy";
import { packetSheetCsv, packetWorkbook } from "@/lib/lab-packet-sheet";
import type { PacketSong } from "@/lib/lab-packet";
import { buildProjectionPdfBytes } from "@/lib/projection-pdf";
import { projectionSheetCsv, projectionWorkbook } from "@/lib/projection-sheet";

const context: CopyContext = {
  title: "BAM",
  artist: "Karma Came",
  album: "BAM",
  isrc: "US-CTA-26-00121",
  iswc: "",
  upc: "",
  duration: "3:20",
  releaseDate: "2026-01-01",
  label: "Came Through Audio",
  rows: [],
  master: { share: "100%", basis: "Copyright Owner", performers: [] },
  earnings: {
    total: 28.2,
    radio: 0,
    masterShare: 100,
    songShare: 100,
    distributor: 0,
    net: 28.2,
    platforms: [
      { name: "Spotify", streams: 4500, rate: 0.004, total: 18, yours: 18 },
      { name: "Apple Music", streams: 1200, rate: 0.0085, total: 10.2, yours: 10.2 },
    ],
  },
};

const blankTax = (year = "2026"): TaxSheet => ({
  year,
  rate: "30",
  status: "",
  selfEmployment: "none",
  rows: [{ ...newTaxRow("mix"), amount: "600" }],
});
const song = (): PacketSong => ({
  id: "bam",
  title: "BAM",
  release: "BAM",
  kind: "Album",
  numbers: { ...emptyLabNumbers(), streams: { spotify: "1000" } },
  tax: blankTax(),
  budget: null,
});

describe("projection downloads", () => {
  it("writes a Google Sheets CSV whose arithmetic is live", () => {
    const csv = projectionSheetCsv(context);
    expect(csv).toContain("Spotify,4500,0.004,=B11*C11");
    expect(csv).toContain("=SUM(E11:E13)");
    expect(csv).toContain("$B$8");
  });

  it("writes an Excel workbook with the same formulas and the brand band", async () => {
    const wb = await projectionWorkbook(context, {
      name: "Karma Came",
      tagline: "Independent artist",
      colors: ["#2E073E"],
    });
    const ws = wb.getWorksheet("Projection")!;
    expect(String(ws.getCell("A1").value)).toContain("Karma Came");
    expect(ws.getCell("D11").value).toMatchObject({ formula: "B11*C11" });
    expect(String((ws.getCell("E11").value as { formula: string }).formula)).toContain("$B$6");
    expect(ws.getCell("D10").value).toBe("Platform pays (USD)");
    expect(ws.getCell("E10").value).toBe("Your share (USD)");
    expect(ws.getCell("F6").value).toBe(0);
  });

  it("writes a fillable projection PDF with working calculation fields", async () => {
    const bytes = await buildProjectionPdfBytes(context);
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
    const form = (await PDFDocument.load(bytes)).getForm();
    expect(form.getTextField("streams-1").getText()).toBe("4500");
    expect(form.getTextField("pool-1").getText()).toBe("$18.00");
    expect(form.getTextField("estimate-1").getText()).toBe("$18.00");
    expect(form.getTextField("total-estimate").getText()).toBe("$28.20");
    expect(form.getTextField("total-keep").getText()).toBe("$28.20");
    expect(form.getTextField("total-keep").isReadOnly()).toBe(true);
  });

  it("prices the estimate at the master/song split, not a flat share", async () => {
    const split: CopyContext = {
      ...context,
      earnings: {
        ...context.earnings!,
        total: 6,
        net: 6,
        masterShare: 50,
        songShare: 100,
        platforms: [{ name: "Spotify", streams: 1000, rate: 0.01, total: 10, yours: 5 }],
      },
    };
    const form = (await PDFDocument.load(await buildProjectionPdfBytes(split))).getForm();
    expect(form.getTextField("pool-1").getText()).toBe("$10.00");
    expect(form.getTextField("estimate-1").getText()).toBe("$6.00");
    expect(form.getTextField("total-estimate").getText()).toBe("$6.00");
  });
});

describe("packet downloads", () => {
  const meta = {
    label: "BAM",
    year: 2026,
    tally: { spotify: "5000" },
    madeAt: new Date(2026, 5, 1),
    brand: { name: "Karma Came", tagline: "Independent artist", colors: ["#2E073E"] },
  };

  it("writes a Google Sheets CSV with the tally and projection live", () => {
    const csv = packetSheetCsv([song()], meta);
    expect(csv).toContain("KARMA CAME — FINANCIAL LAB PACKET");
    expect(csv).toContain("Spotify");
    expect(csv).toContain("5000");
    expect(csv).toContain("=SUM(C");
    expect(csv).toContain("=IF(COUNT(C");
    expect(csv).toContain("Platform pays (USD)");
    expect(csv).toContain("Your share (USD)");
    expect(csv).toContain("You keep after distributor");
    expect(csv).toMatch(/You keep after distributor,\d+(\.\d{1,2})?\r?$/m);
  });

  it("keeps radio income in the packet CSV and Excel projection", async () => {
    const withRadio: PacketSong = {
      ...song(),
      numbers: {
        ...emptyLabNumbers(),
        streams: { spotify: "1000" },
        radio: { plays: "1000", perPlay: "0.01" },
      },
    };
    const untallied = {
      label: meta.label,
      year: meta.year,
      madeAt: meta.madeAt,
      brand: meta.brand,
    };
    const csv = packetSheetCsv([withRadio], untallied);
    expect(csv).toContain("Radio / SiriusXM / live");
    expect(csv).toMatch(/Distributor's cut,,,,,=\(F\d+-F\d+\)\*\$B\$\d+\/100/);

    const wb = await packetWorkbook([withRadio], untallied);
    const projection = wb.getWorksheet("Projection")!;
    expect(projection.getCell("A22").value).toBe("Radio / SiriusXM / live");
    expect(projection.getCell("F22").value).toBe(10);
    expect(projection.getCell("F23").value).toMatchObject({ formula: "SUM(F10:F22)" });
    expect(projection.getCell("F24").value).toMatchObject({
      formula: "(F23-F22)*$B$7/100",
    });
  });

  it("writes an Excel packet with a sheet per section and cross-sheet formulas", async () => {
    const wb = await packetWorkbook([song()], meta);
    expect(wb.worksheets.map((ws) => ws.name)).toEqual([
      "Summary",
      "Tax worksheet",
      "Production budget",
      "Tally",
      "Projection",
    ]);
    const tally = wb.getWorksheet("Tally")!;
    expect(tally.getCell("C9").value).toBe(5000);
    const projection = wb.getWorksheet("Projection")!;
    expect(projection.getCell("C10").value).toMatchObject({
      formula: "IF(COUNT(Tally!C9)=0,B10,Tally!C9)",
    });
    expect(projection.getCell("E10").value).toMatchObject({ formula: "C10*D10" });
    expect(projection.getCell("E9").value).toBe("Platform pays (USD)");
    expect(projection.getCell("F9").value).toBe("Your share (USD)");
    expect(projection.getCell("F10").value).toMatchObject({ formula: "E10*$B$6/100" });
    expect(wb.calcProperties.fullCalcOnLoad).toBe(true);
  });
});
