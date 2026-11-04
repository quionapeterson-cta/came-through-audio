import { localFallbacks } from "@/lib/art-url";

/**
 * Badge and clinic art comes from the R2 bucket, and the repo keeps the original as the fallback copy (AGENTS.md).
 * When a bucket picture is missing — the upload hasn't finished, a file was renamed, a bad deploy — the browser fires
 * an `error` event that never bubbles, so a capture-phase listener on the document swaps in the local copy instead of
 * leaving a broken image on the shelf.
 *
 * The pictures in the server-rendered HTML start loading before this script runs, so anything already broken is swept
 * as soon as the listener is installed; that is the common case on a cold page load, not the exception.
 *
 * Sections in `VITE_ART_BASE` are fine here: with it unset `localFallbacks` returns nothing and this is inert.
 */
export function installArtFallback(): () => void {
  if (typeof document === "undefined") return () => {};
  const tried = new WeakMap<HTMLImageElement, number>();

  const fix = (img: HTMLImageElement) => {
    const options = localFallbacks(img.src);
    const next = tried.get(img) ?? 0;
    if (next >= options.length) return;
    tried.set(img, next + 1);
    img.dataset["artFallback"] = "local";
    img.src = options[next]!;
  };

  const onError = (event: Event) => {
    if (event.target instanceof HTMLImageElement) fix(event.target);
  };

  document.addEventListener("error", onError, true);
  for (const img of Array.from(document.images)) {
    if (img.complete && img.naturalWidth === 0) fix(img);
  }
  return () => document.removeEventListener("error", onError, true);
}
