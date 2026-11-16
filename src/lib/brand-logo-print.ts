import type { jsPDF as JsPDF } from "jspdf";
import type { PdfBrand } from "@/lib/brand-kit";

/**
 * A kit's logo is printed a few centimetres wide, so it is shrunk to print size before it goes on the page (founder,
 * 2026-11-16). A 4000px upload used to land in the file at full resolution, which turned a one-page split sheet into 56
 * MB — too big to email and slow to open on a phone. 600px is still about 190 dpi at the largest place a kit draws it
 * (the cover), so the page looks the same.
 */
export const LOGO_PRINT_PX = 600;

/** The page's own copy of a kit logo, once `printSizedLogo` has shrunk it. */
const printLogo = new WeakMap<JsPDF, string>();

const shrunken = new Map<string, Promise<string>>();

function shrink(dataUrl: string): Promise<string> {
  const key = `${dataUrl.length}:${dataUrl.slice(-64)}`;
  let work = shrunken.get(key);
  if (!work) {
    work = new Promise<string>((resolve) => {
      // A PDF is only built in the browser; anywhere else the upload is used unchanged.
      if (typeof document === "undefined") return resolve(dataUrl);
      const img = new Image();
      img.onload = () => {
        try {
          const width = img.naturalWidth || 1;
          const height = img.naturalHeight || 1;
          const scale = Math.min(1, LOGO_PRINT_PX / Math.max(width, height));
          if (scale === 1) return resolve(dataUrl);
          const canvas = document.createElement("canvas");
          canvas.width = Math.max(1, Math.round(width * scale));
          canvas.height = Math.max(1, Math.round(height * scale));
          const ctx = canvas.getContext("2d");
          if (!ctx) return resolve(dataUrl);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          // A picture that never uses its transparency becomes a JPEG, a fraction of the size of the same PNG.
          const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
          let opaque = true;
          for (let i = 3; i < data.length; i += 4) {
            if (data[i] !== 255) {
              opaque = false;
              break;
            }
          }
          resolve(opaque ? canvas.toDataURL("image/jpeg", 0.92) : canvas.toDataURL("image/png"));
        } catch {
          resolve(dataUrl);
        }
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });
    shrunken.set(key, work);
  }
  return work;
}

/**
 * Gives one page its print-sized logo. Called by `newBrandedPdf` before anything is drawn, so every header, cover,
 * watermark and footer on that page draws the small copy.
 */
export async function printSizedLogo(pdf: JsPDF, dataUrl: string): Promise<void> {
  printLogo.set(pdf, await shrink(dataUrl));
}

/** The logo to draw: the page's print-sized copy when there is one, otherwise the file as it was uploaded. */
export const logoFor = (pdf: JsPDF, brand: PdfBrand): string =>
  printLogo.get(pdf) ?? brand.logo?.dataUrl ?? "";
