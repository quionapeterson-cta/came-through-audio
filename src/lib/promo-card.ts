import type { PromoContext } from "@/lib/promo-copy";

/** Canvas has no access to theme tokens, so the brand palette is spelled out here (as in the PDF exports). */
const BLACK = "#0b0b0b", WHITE = "#ffffff", COBALT = "#004AAD", ELECTRIC = "#4D8CFF", MUTED = "#a3a3a3";

export type CardInput = { ctx: PromoContext; avatar: string; round: boolean; artist: string; title?: string | undefined; count?: number | undefined };

/** The words on the teaser card for each spot. Exported for tests. */
export function cardText({ ctx, artist, title, count }: Omit<CardInput, "avatar" | "round">) {
  if (ctx === "embed") return { kicker: title ? "NEW SINGLE" : "NEW MUSIC", headline: title ? `“${title}”` : "Coming Soon", sub: artist, footer: title ? "COMING SOON" : "STAY TUNED" };
  if (ctx === "catalog") return count
    ? { kicker: "MY CATALOG", headline: count === 1 ? "My First Song" : `${count} Songs`, sub: artist, footer: "ORGANIZED · CREDITED · PROTECTED" }
    : { kicker: "MY CATALOG", headline: "Organized", sub: artist, footer: "CREDITED · PROTECTED · READY" };
  return { kicker: "INDEPENDENT ARTIST", headline: artist || "Came Through", sub: "", footer: "DOING IT THE RIGHT WAY" };
}

const loadImage = (src: string) => new Promise<HTMLImageElement>((ok, fail) => { const i = new Image(); i.onload = () => ok(i); i.onerror = fail; i.src = src; });

type Trimmed = CanvasImageSource & { width: number; height: number; shiftX?: number };

/**
 * Crops a badge's transparent padding so the artwork itself sits next to the text, and works out its optical
 * center: lopsided art like the music note looks centered on its wide solid parts (the note head), not on its
 * outer edges, so each row counts by its width squared. Halfway between that and the edge center keeps thin
 * parts like the flag from swinging it too far; symmetrical badges don't move. `shiftX` is in trimmed pixels.
 */
function trimmed(img: HTMLImageElement): Trimmed {
  const c = document.createElement("canvas"); c.width = img.naturalWidth; c.height = img.naturalHeight;
  const g = c.getContext("2d", { willReadFrequently: true })!; g.drawImage(img, 0, 0);
  try {
    const { data, width, height } = g.getImageData(0, 0, c.width, c.height);
    let x0 = width, y0 = height, x1 = -1, y1 = -1;
    for (let y = 0; y < height; y += 2) for (let x = 0; x < width; x += 2) if (data[(y * width + x) * 4 + 3]! > 16) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    if (x1 < 0) return img;
    let weight = 0, sum = 0;
    for (let y = y0; y <= y1; y += 2) {
      let left = -1, right = -1;
      for (let x = x0; x <= x1; x += 2) if (data[(y * width + x) * 4 + 3]! > 16) { if (left < 0) left = x; right = x; }
      if (left < 0) continue;
      const w = (right - left) ** 2; weight += w; sum += w * (left + right) / 2;
    }
    const edges = (x0 + x1) / 2, optical = weight ? (edges + sum / weight) / 2 : edges;
    const out: HTMLCanvasElement & { shiftX?: number } = document.createElement("canvas"); out.width = x1 - x0 + 2; out.height = y1 - y0 + 2;
    out.getContext("2d")!.drawImage(c, x0, y0, out.width, out.height, 0, 0, out.width, out.height);
    out.shiftX = Math.max(-0.12, Math.min(0.12, (optical - edges) / out.width)) * out.width;
    return out;
  } catch { return img; }
}

/** Draws the square 1080px teaser card: badge, song or catalog headline, and the Came Through Audio wordmark. */
export async function drawPromoCard(input: CardInput): Promise<Blob> {
  const S = 1080, c = document.createElement("canvas"); c.width = S; c.height = S;
  const g = c.getContext("2d")!;
  await Promise.all(["700 76px Poppins", "600 34px Poppins", "500 40px Poppins"].map((f) => document.fonts?.load(f).catch(() => undefined)));
  const t = cardText(input);

  g.fillStyle = BLACK; g.fillRect(0, 0, S, S);
  g.strokeStyle = COBALT; g.lineWidth = 6; g.strokeRect(36, 36, S - 72, S - 72);

  // Badge and text are centered together above the wordmark, so wide badges don't leave a gap.
  const box = 420, wide = 540, textBlock = t.sub ? 340 : 270, area = 880;
  const loaded = await loadImage(input.avatar).catch(() => undefined);
  const img = loaded && (input.round ? loaded : trimmed(loaded));
  const k = img ? (input.round ? box / Math.min(img.width, img.height) : Math.min(wide / img.width, box / img.height)) : 0;
  const bh = img ? (input.round ? box : img.height * k) : 0;
  const y = Math.max(80, (area - bh - textBlock) / 2 + 40);
  if (img) {
    const x = (S - box) / 2;
    if (input.round) {
      g.save(); g.beginPath(); g.arc(S / 2, y + box / 2, box / 2, 0, Math.PI * 2); g.clip();
      const m = Math.min(img.width, img.height);
      g.drawImage(img, (img.width - m) / 2, (img.height - m) / 2, m, m, x, y, box, box); g.restore();
    } else {
      const w = img.width * k;
      g.drawImage(img, (S - w) / 2 - ((img as Trimmed).shiftX ?? 0) * k, y, w, bh);
    }
  }

  const text = (s: string, y: number, font: string, color: string, spacing = 0, max = S - 160) => {
    if (!s) return;
    let size = Number(/(\d+)px/.exec(font)?.[1] ?? 40);
    const set = () => { g.font = font.replace(/\d+px/, `${size}px`) + ", sans-serif"; (g as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = `${spacing}px`; };
    set();
    while (g.measureText(s).width > max && size > 24) { size -= 2; set(); }
    g.fillStyle = color; g.textAlign = "center"; g.fillText(s, S / 2, y);
  };
  const top = y + bh + 90;
  text(t.kicker, top, "600 34px Poppins", ELECTRIC, 8);
  text(t.headline, top + 100, "700 76px Poppins", WHITE);
  text(t.sub, top + 170, "500 40px Poppins", MUTED);
  text(t.footer, top + (t.sub ? 250 : 180), "600 30px Poppins", WHITE, 6);

  // Wordmark on dark: "Came Through" in white, "Audio" in Electric Cobalt (BRANDING.md §2).
  g.font = "700 36px Poppins, sans-serif"; (g as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = "0px"; g.textAlign = "left";
  const a = "Came Through ", b = "Audio", wa = g.measureText(a).width, wb = g.measureText(b).width, x0 = (S - wa - wb) / 2;
  g.fillStyle = WHITE; g.fillText(a, x0, 970); g.fillStyle = ELECTRIC; g.fillText(b, x0 + wa, 970);
  text("YOUR FIRST STOP BEFORE DISTRIBUTION", 1010, "500 18px Poppins", MUTED, 2);

  return toPng(c);
}

const toPng = (c: HTMLCanvasElement) => new Promise<Blob>((ok, fail) => c.toBlob((blob) => (blob ? ok(blob) : fail(new Error("Could not draw the card."))), "image/png"));

/**
 * The same card as a 1200 × 630 link preview (founder, 2026-10-27: Facebook cut off the top of the square card).
 * Link previews are this wide shape, so everything fits: badge on the left, words on the right, wordmark below them.
 */
export async function drawPromoPreview(input: CardInput): Promise<Blob> {
  const W = 1200, H = 630, c = document.createElement("canvas"); c.width = W; c.height = H;
  const g = c.getContext("2d")! as CanvasRenderingContext2D & { letterSpacing?: string };
  await Promise.all(["700 64px Poppins", "600 26px Poppins", "500 32px Poppins"].map((f) => document.fonts?.load(f).catch(() => undefined)));
  const t = cardText(input);
  g.fillStyle = BLACK; g.fillRect(0, 0, W, H);
  g.strokeStyle = COBALT; g.lineWidth = 5; g.strokeRect(24, 24, W - 48, H - 48);

  // Badge or photo: left half, centered top to bottom.
  const box = 400, bx = 80, by = (H - box) / 2;
  const loaded = await loadImage(input.avatar).catch(() => undefined);
  const img = loaded && (input.round ? loaded : trimmed(loaded));
  if (img) {
    if (input.round) {
      g.save(); g.beginPath(); g.arc(bx + box / 2, by + box / 2, box / 2, 0, Math.PI * 2); g.clip();
      const m = Math.min(img.width, img.height);
      g.drawImage(img, (img.width - m) / 2, (img.height - m) / 2, m, m, bx, by, box, box); g.restore();
    } else {
      const k = Math.min(box / img.width, box / img.height), w = img.width * k, h = img.height * k;
      g.drawImage(img, bx + (box - w) / 2 - ((img as Trimmed).shiftX ?? 0) * k, by + (box - h) / 2, w, h);
    }
  }

  // Words: left-aligned in the right half, shrinking to fit.
  const x = 540, max = W - x - 70;
  const text = (s: string, y: number, font: string, color: string, spacing = 0) => {
    if (!s) return;
    let size = Number(/(\d+)px/.exec(font)?.[1] ?? 32);
    const set = () => { g.font = font.replace(/\d+px/, `${size}px`) + ", sans-serif"; g.letterSpacing = `${spacing}px`; };
    set();
    while (g.measureText(s).width > max && size > 20) { size -= 2; set(); }
    g.fillStyle = color; g.textAlign = "left"; g.fillText(s, x, y);
  };
  text(t.kicker, 175, "600 26px Poppins", ELECTRIC, 6);
  text(t.headline, 265, "700 64px Poppins", WHITE);
  text(t.sub, 325, "500 32px Poppins", MUTED);
  text(t.footer, t.sub ? 390 : 340, "600 22px Poppins", WHITE, 4);

  // Wordmark on dark: "Came Through" in white, "Audio" in Electric Cobalt (BRANDING.md §2).
  g.font = "700 30px Poppins, sans-serif"; g.letterSpacing = "0px"; g.textAlign = "left";
  const a = "Came Through ", wa = g.measureText(a).width;
  g.fillStyle = WHITE; g.fillText(a, x, 500); g.fillStyle = ELECTRIC; g.fillText("Audio", x + wa, 500);
  text("YOUR FIRST STOP BEFORE DISTRIBUTION", 535, "500 16px Poppins", MUTED, 2);
  return toPng(c);
}
