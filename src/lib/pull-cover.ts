/**
 * The cover a streaming pull already names (founder, 2026-11-12): Deezer and Spotify both hand back the release's own
 * artwork, which until now was only shown in the pull's preview and never reached the catalog — so a song that arrived
 * from a pull had no cover, and embedding wrote the master's own picture (or nothing) instead of the release art.
 *
 * The bytes are read in the browser because the upload is the browser's: the catalog keeps the file in the member's own
 * folder like any other cover. A platform CDN that refuses the request leaves the song exactly as it was, cover-less,
 * which is the honest outcome — the member can always add the art by hand.
 */
/** The two cover types the catalog accepts, so a webp or a gif never lands in a folder the app won't read back. */
export const coverExtension = (type: string) => (type === "image/png" ? "png" : "jpg");

/** A cover as a file, or nothing when the picture can't be read, isn't a JPEG/PNG, or the request fails. */
export async function coverFileFrom(url: string, name = "cover"): Promise<File | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    const type = blob.type === "image/png" ? "image/png" : blob.type === "image/jpeg" ? "image/jpeg" : "";
    if (!type) return null;
    return new File([blob], `${name.replace(/[\\/:*?"<>|]/g, "-") || "cover"}.${coverExtension(type)}`, { type });
  } catch {
    return null;
  }
}

/**
 * The small tile the catalog shows beside a song (64px) and on a release's header (56px): 160px keeps it sharp on a
 * retina screen without storing a second full-size picture per song.
 */
export function coverThumb(file: File, size = 160): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const scale = Math.min(1, size / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("no canvas");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.8));
      } catch (e) {
        reject(e);
      } finally {
        URL.revokeObjectURL(url);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("The cover couldn't be read."));
    };
    img.src = url;
  });
}
