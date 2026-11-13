/**
 * The full registered name of a writer, built from the two records that hold it (founder, 2026-11-15).
 *
 * A repertoire search matches the name **as registered**. The founder's own case: "Qui-Ona Peterson" found nothing at
 * BMI, and "Qui-Ona LaShay Peterson" found her works — the catalog was missing the middle name the registration carries.
 * The agency list prints the name last-name-first in capitals ("PETERSON QUI ONA LASHAY") and often with a suffix in
 * brackets ("STEPHENS CALVIN ANDRE JR (MR)"), which is not what a member should paste into a search box or into the legal
 * name field. So this keeps the catalog's own spelling and order, adds the words only the registration has, and drops the
 * honourifics. Nothing is invented: every word comes from one of the two names.
 */

/** Words that are never part of the name that was registered. */
const SUFFIXES = new Set(["MR", "MRS", "MS", "MISS", "DR", "JR", "SR", "II", "III", "IV", "V", "ESQ"]);

const words = (name: string) =>
  name
    .replace(/\([^)]*\)|\[[^\]]*\]/g, " ")
    .split(/[\s,]+/)
    .map((w) => w.trim())
    .filter(Boolean)
    .filter((w) => !SUFFIXES.has(w.toUpperCase().replace(/[^A-Z]/gi, "")));

const key = (w: string) => w.toLowerCase().replace(/[^a-z0-9-]/g, "");

/** A word the registration adds, written the way a name is written ("LASHAY" → "Lashay"). */
const titled = (w: string) => w.toLowerCase().replace(/(^|[-'])([a-z])/g, (_m, sep: string, ch: string) => sep + ch.toUpperCase());

/**
 * The catalog's name with the registration's missing words in place: "Qui-Ona Peterson" + "PETERSON QUI ONA LASHAY" →
 * "Qui-Ona Lashay Peterson". When the two names share no words at all — a stage name against a legal name — the catalog
 * keeps its own name, because there is nothing to merge.
 */
export function registeredName(catalogName: string, agencyName = ""): string {
  const catalog = words(catalogName);
  const theirs = words(agencyName);
  const clean = catalogName.trim();
  if (!catalog.length || !theirs.length) return clean;
  const theirKeys = theirs.map(key);
  // "Qui-Ona" is two words to a PRO that prints QUI ONA, so the catalog is matched word by word.
  const mine = catalog.flatMap((w) => w.split("-").map(key).filter(Boolean));
  // Every word the catalog has must be in the registration, or these are two different names.
  if (!mine.every((w) => theirKeys.includes(w))) return clean;
  const extra = theirs.filter((w) => !mine.includes(key(w)));
  if (!extra.length) return catalog.join(" ");
  return [...catalog.slice(0, -1), ...extra.map(titled), catalog[catalog.length - 1]!].join(" ");
}
