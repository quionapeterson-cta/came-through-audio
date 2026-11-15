/**
 * PDF → template zones (founder, 2026-11-15).
 *
 * pdf.js gives a page as positioned text fragments; a person reads them as lines. This groups fragments that share a
 * baseline into one zone with a box above the page preview, so an admin can click "Release date: 15 Nov 2026" and turn
 * the value into {{RELEASE_DATE}}. Pure and measured in page fractions, so the same zones fit any preview size.
 */

export type PdfTextItem = { str: string; x: number; y: number; width: number; height: number };

export type PdfZone = {
  id: string;
  /** Fractions of the page, from its top-left, so a preview can scale without recalculating. */
  left: number;
  top: number;
  width: number;
  height: number;
  text: string;
};

/** Two fragments belong to one line when their baselines sit within this fraction of the page height. */
const LINE_TOLERANCE = 0.008;
/** And they are the same zone while the horizontal gap stays under this fraction of the page width. */
const GAP_TOLERANCE = 0.035;

/**
 * Turns a page's fragments into line zones. Items are merged left to right on their baseline, a wide gap starts a new
 * zone (so two columns never read as one field), and empty fragments are dropped.
 */
export function groupZones(
  items: PdfTextItem[],
  page: { width: number; height: number },
): PdfZone[] {
  const usable = items
    .filter((item) => item.str.trim().length > 0 && page.width > 0 && page.height > 0)
    .map((item) => ({
      text: item.str,
      left: item.x / page.width,
      top: item.y / page.height,
      width: item.width / page.width,
      height: item.height / page.height,
    }))
    .sort((a, b) => a.top - b.top || a.left - b.left);

  const lines: { left: number; top: number; right: number; bottom: number; text: string }[] = [];
  for (const item of usable) {
    const line = lines.find((candidate) => Math.abs(candidate.top - item.top) <= LINE_TOLERANCE);
    if (!line) {
      lines.push({
        left: item.left,
        top: item.top,
        right: item.left + item.width,
        bottom: item.top + item.height,
        text: item.text,
      });
      continue;
    }
    const gap = item.left - line.right;
    if (gap > GAP_TOLERANCE) {
      lines.push({
        left: item.left,
        top: item.top,
        right: item.left + item.width,
        bottom: item.top + item.height,
        text: item.text,
      });
      continue;
    }
    line.text = gap > 0.01 ? `${line.text} ${item.text}` : `${line.text}${item.text}`;
    line.left = Math.min(line.left, item.left);
    line.right = Math.max(line.right, item.left + item.width);
    line.bottom = Math.max(line.bottom, item.top + item.height);
  }

  return lines
    .sort((a, b) => a.top - b.top || a.left - b.left)
    .map((line, index) => ({
      id: `zone-${index + 1}`,
      left: line.left,
      top: line.top,
      width: Math.max(0.02, line.right - line.left),
      height: Math.max(0.012, line.bottom - line.top),
      text: line.text.trim(),
    }));
}

/** The page's words with every mapped zone swapped for its token — what a converted template carries. */
export function zonesToText(zones: PdfZone[], mapped: Record<string, string>): string {
  return zones.map((zone) => mapped[zone.id] ?? zone.text).join("\n");
}
