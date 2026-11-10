import type { Metadata } from "@/lib/metadata";

/**
 * The amendment's fields start from the deal the member already recorded (§13), and only from there: a blank deal
 * leaves a blank amendment rather than a number we invented.
 */
export function amendmentPrefill(master: Pick<Metadata, "dealDate" | "dealStreams">, beatTitle: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (beatTitle.trim()) out["beatTitle"] = beatTitle.trim();
  if (master.dealDate.trim()) out["originalLicenseDate"] = master.dealDate.trim();
  if (master.dealStreams.trim()) out["originalCap"] = master.dealStreams.trim();
  return out;
}
