import { describe, expect, it } from "vitest";
import { dominantColors } from "./logo-colors";
import { contrastRatio, contrastWarnings } from "./brand-kit";

/** RGBA pixels: `[r, g, b, a]` repeated. */
const pixels = (list: [number, number, number, number][]) => new Uint8ClampedArray(list.flat());

describe("dominantColors", () => {
  it("skips transparent pixels and white paper", () => {
    const art = pixels([
      [255, 255, 255, 255], [255, 255, 255, 255], [255, 255, 255, 255],
      [0, 74, 173, 255], [0, 74, 173, 255],
      [255, 0, 0, 255],
      [0, 0, 0, 0],
    ]);
    expect(dominantColors(art)).toEqual(["#004AAD", "#FF0000"]);
  });

  it("hands the palette back darkest first, whatever the biggest colour is", () => {
    // A pale blue covers most of the art, but the dark ink still comes first (founder, 2026-11-07).
    const art = pixels([[77, 140, 255, 255], [77, 140, 255, 255], [77, 140, 255, 255], [20, 20, 20, 255], [0, 74, 173, 255]]);
    const order = dominantColors(art);
    expect(order[0]).toBe("#141414");
    // The pale blue is the biggest colour but must not come first, and the darker blue is not the last either.
    expect(order.indexOf("#4D8CFF")).toBeGreaterThan(0);
    expect(order[order.length - 1]).toBe("#4D8CFF");
  });

  it("merges shades that read as the same colour", () => {
    const art = pixels([[10, 10, 10, 255], [18, 16, 14, 255], [200, 30, 40, 255]]);
    expect(dominantColors(art)).toEqual(["#0A0A0A", "#C81E28"]);
  });

  it("returns nothing for an empty or fully transparent image", () => {
    expect(dominantColors(pixels([]))).toEqual([]);
    expect(dominantColors(pixels([[10, 10, 10, 0]]))).toEqual([]);
  });

  it("caps the number of swatches", () => {
    const art = pixels([[0, 0, 0, 255], [255, 0, 0, 255], [0, 255, 0, 255], [0, 0, 255, 255], [255, 255, 0, 255], [0, 255, 255, 255]]);
    expect(dominantColors(art, { max: 3 })).toHaveLength(3);
  });
});

describe("contrast helpers", () => {
  it("scores black on white at the maximum and a pale pink as unreadable", () => {
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 0);
    expect(contrastRatio("#FFC0CB", "#FFFFFF")).toBeLessThan(2);
  });

  it("warns about a pale name and tagline but not a strong blue", () => {
    const strong = contrastWarnings({ colors: ["#004AAD", "#0B0B0B"], headerColor: null, style: "classic", options: { watermark: false, cover: false, signature: "line", accent: null, titleColor: null, corners: "rounded" } });
    expect(strong).toEqual([]);
    const pale = contrastWarnings({ colors: ["#FFC0CB", "#EEEEEE"], headerColor: null, style: "classic", options: { watermark: false, cover: false, signature: "line", accent: null, titleColor: null, corners: "rounded" } });
    expect(pale.map((w) => w.field)).toEqual(["name", "tagline"]);
    expect(pale[0]!.severe).toBe(true);
  });

  it("leaves a banner's name alone because the PDF picks readable text on the band", () => {
    const banner = contrastWarnings({ colors: ["#FFC0CB"], headerColor: null, style: "banner", options: { watermark: false, cover: false, signature: "line", accent: null, titleColor: null, corners: "rounded" } });
    expect(banner).toEqual([]);
  });

  it("checks the section title and accent colours too", () => {
    const kit = { colors: [], headerColor: "#EFEFEF", style: "classic" as const, options: { watermark: false, cover: false, signature: "line" as const, accent: "#F5F5F5", titleColor: null, corners: "rounded" as const } };
    expect(contrastWarnings(kit).map((w) => w.label)).toEqual(["Your section titles", "Your second accent colour"]);
    // The document title is checked at the large-text ratio, because it is set at 24 pt bold.
    expect(contrastWarnings({ ...kit, options: { ...kit.options, accent: null, titleColor: "#EFEFEF" } }).map((w) => w.field)).toEqual(["sectionTitles", "documentTitle"]);
  });
});
