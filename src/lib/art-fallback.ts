import { localFallbacks } from "@/lib/art-url";

/**
 * Badge and clinic art comes from the R2 bucket, and the repo keeps the original as the fallback copy (AGENTS.md).
 * When a bucket picture is missing — the upload hasn't finished, a file was renamed, a bad deploy — the browser fires
 * an `error` event that never bubbles, so one capture-phase listener on the document swaps in the local copy instead
 * of leaving a broken image on the shelf.
 *
 * Sections in `VITE_ART_BASE` are fine here: with it unset `localFallbacks` returns nothing and this is inert.
 */
export function installArtFallback(): () => void {
  if (typeof document === "undefined") return () => {};
  const tried = new WeakMap<HTMLImageElement, number>();
  const onError = (event: Event) => {
    const img = event.target;
    if (!(img instanceof HTMLImageElement)) return;
    const options = localFallbacks(img.src);
    const next = tried.get(img) ?? 0;
    if (next >= options.length) return;
    tried.set(img, next + 1);
    img.src = options[next]!;
  };
  document.addEventListener("error", onError, true);
  return () => document.removeEventListener("error", onError, true);
}
