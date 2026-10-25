import type { BrandUse, PdfBrand } from "@/lib/brand-kit";
import { getContractBrand, getMyBrand } from "@/lib/brand-kit.functions";

/**
 * The Personal Branding kit for a PDF, or null for the Came Through Audio header. Never blocks a download: if the
 * check can't run (signed out, offline, migration not run yet), the document simply keeps our header.
 */
export async function myBrand(use: BrandUse): Promise<PdfBrand | null> {
  try { return await getMyBrand({ data: { use } }); } catch { return null; }
}

/** The sender's kit on a contract the signed-in user owns or was sent. */
export async function contractBrand(contractId: string): Promise<PdfBrand | null> {
  try { return await getContractBrand({ data: { contractId } }); } catch { return null; }
}
