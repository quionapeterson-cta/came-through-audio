/**
 * Where the art is served from (founder, 2026-11-04).
 *
 * Badge and clinic art lives in the Cloudflare R2 bucket: the 512px web-ready copies mirror the repo's `/icons/...`
 * and `/art/...` paths at the bucket root, and the original 4K masters sit in the bucket's separate `4k/` folder,
 * which the app never asks for. Set `VITE_ART_BASE` to the bucket's public address and every picture points there.
 *
 * With `VITE_ART_BASE` unset — local dev, tests, a fresh clone — the same paths load from `public/`, so no page ever
 * breaks for want of a bucket. Paths stay literal in the data; this is the only place that knows the bucket exists.
 */

/** The bucket's public address, without a trailing slash. Empty means "serve from public/". */
const BASE = ((import.meta.env['VITE_ART_BASE'] as string | undefined) ?? "").trim().replace(/\/+$/, "");

/** The bucket holds .webp for every picture; the repo holds the original .png/.jpg. */
const PICTURE = /\.(png|jpe?g)$/i;

/** One art path, pointed at the bucket and at its web-ready copy. Pure, so the rule is testable. */
export function resolveArt(path: string, base: string): string {
  // Already absolute (an address, a data: URL, a signed link): leave it exactly as it is.
  if (!path.startsWith("/")) return path;
  if (!base) return path;
  return `${base.replace(/\/+$/, "")}${path.replace(PICTURE, ".webp")}`;
}

/** A path from `badges.ts`, `eagle-status.ts` or `ClinicArt.tsx` as the browser should request it. */
export const artUrl = (path: string) => resolveArt(path, BASE);

/**
 * The copies in `public/` a failed bucket address can fall back to, nearest first: the same path, then the original
 * `.png`/`.jpg` the bucket's `.webp` copy was made from. Empty when the address isn't ours to fix.
 */
export function localFallbacks(url: string): string[] {
  if (!BASE || !url.startsWith(BASE)) return [];
  const path = url.slice(BASE.length);
  if (!/^\//.test(path)) return [];
  if (!/\.webp$/i.test(path)) return [path];
  return [path, path.replace(/\.webp$/i, ".png"), path.replace(/\.webp$/i, ".jpg")];
}
