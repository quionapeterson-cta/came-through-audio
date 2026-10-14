export type ChainResult = { status: "strong" | "weak" | "pending"; first?: string; latest?: string; days?: number };

/** Strong Chain = two in-video dates more than 7 days apart. Fewer than two legible dates = Pending. */
export function rateChain(dates: string[]): ChainResult {
  const sorted = [...new Set(dates)].sort();
  if (sorted.length < 2) return { status: "pending" };
  const first = sorted[0]!, latest = sorted[sorted.length - 1]!;
  const days = Math.round((Date.parse(latest) - Date.parse(first)) / 86_400_000);
  return { status: days > 7 ? "strong" : "weak", first, latest, days };
}

/** Grabs JPEG frames from a local video at the given seconds (browser only). */
export async function extractFrames(file: File, seconds = [2, 5, 8, 12]): Promise<string[]> {
  const url = URL.createObjectURL(file);
  const v = document.createElement("video");
  v.muted = true; v.playsInline = true; v.preload = "auto"; v.src = url;
  try {
    await new Promise<void>((ok, bad) => { v.onloadeddata = () => ok(); v.onerror = () => bad(new Error("unreadable")); });
    const scale = Math.min(1, 1280 / Math.max(v.videoWidth, v.videoHeight));
    const c = document.createElement("canvas");
    c.width = Math.round(v.videoWidth * scale); c.height = Math.round(v.videoHeight * scale);
    const ctx = c.getContext("2d")!;
    const out: string[] = [];
    for (const s of seconds.filter((s) => s < v.duration)) {
      await new Promise<void>((ok) => { v.onseeked = () => ok(); v.currentTime = s; });
      ctx.drawImage(v, 0, 0, c.width, c.height);
      out.push(c.toDataURL("image/jpeg", 0.8));
    }
    return out;
  } finally { URL.revokeObjectURL(url); }
}
