import { fontFile } from "@/lib/brand-kit";

const loaded = new Set<string>(["Poppins", "Arial"]);

/** Loads one of our public/fonts families (medium + bold) into the page, once; the PDFs use the same files. */
export function loadWebFont(family: string) {
  if (loaded.has(family) || typeof FontFace === "undefined") return;
  loaded.add(family);
  for (const [weight, w] of [["500", "medium"], ["700", "bold"]] as const) {
    new FontFace(family, `url(/fonts/${fontFile(family, w)}.ttf)`, { weight }).load().then((face) => document.fonts.add(face)).catch(() => loaded.delete(family));
  }
}
