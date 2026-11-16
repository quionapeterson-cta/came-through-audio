/**
 * One cursive for every signature (founder, 2026-11-16): the legible script approved for the company block, Dancing
 * Script, is the signature everywhere — the company block, a member's typed signature, the way it previews on screen,
 * the way it prints in a contract, a split sheet, a block agreement or a filled form.
 *
 * Named in one place so a signature can never arrive in a second hand: `SIGNATURE_FONT` for a PDF that sets a family,
 * `SIGNATURE_CSS` for the screen, `SIGNATURE_FILE` for the file a PDF embeds. Poppins is the document's type, not the
 * signature's, and Times italic is only the fallback when the font file cannot be loaded — never a choice.
 */
export const SIGNATURE_FONT = "Dancing Script";
/** The periscope-proof CSS stack: the approved cursive, then a script every machine has, then the browser's own. */
export const SIGNATURE_CSS = `"${SIGNATURE_FONT}", "Segoe Script", cursive`;
/** The font file the app already ships for it (public/fonts), matched to `fontFile(SIGNATURE_FONT, "bold")`. */
export const SIGNATURE_FILE = "DancingScript-Bold.ttf";
/** The weight the signature is set in, on screen and on the page. */
export const SIGNATURE_WEIGHT = 600;
