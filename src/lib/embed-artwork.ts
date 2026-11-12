/**
 * Which cover an embed uses (founder, 2026-11-12).
 *
 * The member's choice always wins over the picture baked into the audio file. Re-embedding a master that was already
 * embedded used to bring its **old** artwork back and quietly replace the cover just chosen, which read as the form
 * "reverting to a cover I previously embedded". The rule lives here, apart from the component, so it is one answer
 * everywhere and can be tested without a browser.
 */
export type ArtworkChoice = "keep-chosen" | "use-file" | "none";

export function artworkChoice(chosen: boolean, fromFile: boolean): ArtworkChoice {
  if (chosen) return "keep-chosen";
  return fromFile ? "use-file" : "none";
}

/** Said once, in plain words, when a file's own artwork was passed over. */
export const FILE_ART_IGNORED = "The audio file's own artwork was ignored — your cover is used.";

/**
 * The cover kept with the session (`cta-embed-cover:<account>`, a data URL) back as a real File, so a restored sitting
 * embeds the artwork the member chose instead of leaving the file's old picture in the master. Anything that isn't an
 * image data URL returns nothing, so a corrupt entry never reaches the form.
 */
export function coverFile(dataUrl: string, name = "cover.jpg"): File | undefined {
  const m = /^data:(image\/[a-z+.-]+);base64,([A-Za-z0-9+/=\s]+)$/i.exec((dataUrl ?? "").trim());
  if (!m) return undefined;
  try {
    const binary = atob(m[2]!.replace(/\s+/g, ""));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    if (!bytes.length) return undefined;
    // A jpeg keeps its .jpg name so a saved copy never claims to be a png.
    const type = m[1]!.toLowerCase();
    return new File([bytes], type === "image/png" ? name.replace(/\.jpe?g$/i, ".png") : name, { type });
  } catch {
    return undefined;
  }
}
