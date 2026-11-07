/**
 * Colours from a logo (founder, 2026-11-06): upload the art, get its own colours suggested as the kit's accents. It runs
 * in the browser on a small copy of the image, so nothing is uploaded twice and no server work is spent on it.
 */

/** How different two colours must be before they count as separate swatches. */
const MERGE_DISTANCE = 42;

type Bin = { count: number; r: number; g: number; b: number };
const toHex = ({ r, g, b }: { r: number; g: number; b: number }) =>
  `#${[r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("").toUpperCase()}`;
const parse = (hex: string) => ({ r: parseInt(hex.slice(1, 3), 16), g: parseInt(hex.slice(3, 5), 16), b: parseInt(hex.slice(5, 7), 16) });
const distance = (a: string, b: { r: number; g: number; b: number }) => {
  const c = parse(a);
  return Math.sqrt((c.r - b.r) ** 2 + (c.g - b.g) ** 2 + (c.b - b.b) ** 2);
};
/** Relative luminance, the WCAG way: higher is lighter. This is what puts the darkest colour first. */
const luminance = (hex: string) => {
  const { r, g, b } = parse(hex);
  const ch = (v: number) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
};

/**
 * The colours a logo is mostly made of, as `#RRGGBB`. Transparent pixels and near-white paper are ignored: a logo is
 * normally drawn on a white page, so paper would win every time. Shades close enough to be the same colour to the eye are
 * merged, so five swatches really are five choices, and the list comes back darkest first (founder, 2026-11-07): the
 * darkest names the document, the second sets the tagline, and the darkest is what heads the sections.
 */
export function dominantColors(pixels: ArrayLike<number>, { max = 5, alphaMin = 160 }: { max?: number; alphaMin?: number } = {}): string[] {
  const bins = new Map<number, Bin>();
  for (let i = 0; i + 3 < pixels.length; i += 4) {
    const a = pixels[i + 3]!;
    if (a < alphaMin) continue;
    const r = pixels[i]!, g = pixels[i + 1]!, b = pixels[i + 2]!;
    // Paper: white and the lightest greys, which say nothing about the brand.
    if (r > 240 && g > 240 && b > 240) continue;
    // 5 bits per channel: shades that are nearly identical share a bin, so the count means something.
    const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
    const bin = bins.get(key) ?? { count: 0, r: 0, g: 0, b: 0 };
    bin.count += 1; bin.r += r; bin.g += g; bin.b += b;
    bins.set(key, bin);
  }
  const out: string[] = [];
  for (const bin of [...bins.values()].sort((a, b) => b.count - a.count)) {
    const c = { r: bin.r / bin.count, g: bin.g / bin.count, b: bin.b / bin.count };
    if (out.some((hex) => distance(hex, c) < MERGE_DISTANCE)) continue;
    out.push(toHex(c));
    if (out.length >= max) break;
  }
  // Darkest first: a mostly-pale logo would otherwise hand a member white-on-white type (founder, 2026-11-07).
  return out.sort((a, b) => luminance(a) - luminance(b));
}

/**
 * Draws an uploaded image small (64px) and reads its palette. Returns an empty list rather than throwing when a browser
 * can't decode the file, so the editor simply offers no suggestions.
 */
export async function logoPalette(file: Blob): Promise<string[]> {
  try {
    const bitmap = await createImageBitmap(file);
    const size = 64;
    const canvas = document.createElement("canvas");
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return [];
    // Fit inside the square and keep the shape: the rest stays transparent, which the reader ignores.
    const scale = Math.min(size / bitmap.width, size / bitmap.height);
    ctx.drawImage(bitmap, 0, 0, bitmap.width * scale, bitmap.height * scale);
    const { data } = ctx.getImageData(0, 0, size, size);
    bitmap.close?.();
    return dominantColors(data);
  } catch { return []; }
}
