import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { SEAL_ART, SEAL_ART_LABELS } from "./pdf-templates";

/**
 * The seal pictures are fetched from the site's own origin when a PDF is built, so a missing file is a blank seal rather
 * than a crash. These checks keep the paths honest.
 */
describe("seal artwork", () => {
  it("has a picture in public/ for every seal choice", () => {
    for (const path of Object.values(SEAL_ART)) {
      expect(path.startsWith("/icons/serious/flagship/")).toBe(true);
      expect(path.endsWith(".png"), `${path} must be a PNG: pdf-lib cannot embed webp`).toBe(true);
      expect(fs.existsSync(`public${path}`), `${path} is missing from public/`).toBe(true);
    }
  });

  it("names each choice for the studio", () => {
    expect(Object.keys(SEAL_ART_LABELS).sort()).toEqual(Object.keys(SEAL_ART).sort());
    for (const label of Object.values(SEAL_ART_LABELS))
      expect(label.trim().length).toBeGreaterThan(0);
  });
});
