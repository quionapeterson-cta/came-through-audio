export type ChainResult = { status: "strong" | "weak" | "pending"; first?: string; latest?: string; days?: number };
export type Grade = "A+" | "A" | "C" | "Pending";

/** Strong Chain = two in-video dates more than 7 days apart. Fewer than two legible dates = Pending. */
export function rateChain(dates: string[]): ChainResult {
  const sorted = [...new Set(dates)].sort();
  if (sorted.length < 2) return { status: "pending" };
  const first = sorted[0]!, latest = sorted[sorted.length - 1]!;
  const days = Math.round((Date.parse(latest) - Date.parse(first)) / 86_400_000);
  return { status: days > 7 ? "strong" : "weak", first, latest, days };
}

/** A visible DAW session date is a bonus: Strong Chain + DAW date = A+. No DAW date is never a penalty. */
export function gradeProof(chain: ChainResult | undefined, dawDate: string | undefined): Grade {
  if (!chain || chain.status === "pending") return "Pending";
  if (chain.status === "weak") return "C";
  return dawDate ? "A+" : "A";
}

/** Spread sample points across the whole video so dates shown near the end are caught. */
export function framePoints(duration: number, fractions = [0.05, 0.25, 0.45, 0.65, 0.85, 0.97]): number[] {
  return fractions.map((f) => Math.min(duration - 0.2, Math.max(0.1, duration * f)));
}

/** Grabs JPEG frames from a local video spread across its full length (browser only). */
export async function extractFrames(file: File): Promise<string[]> {
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
    for (const s of framePoints(v.duration)) {
      await new Promise<void>((ok) => { v.onseeked = () => ok(); v.currentTime = s; });
      ctx.drawImage(v, 0, 0, c.width, c.height);
      out.push(c.toDataURL("image/jpeg", 0.8));
    }
    return out;
  } finally { URL.revokeObjectURL(url); }
}

/** Re-records a video at up to 720p (~2.5 Mbps) in real time. Browsers pause hidden tabs, so the page must stay open and on screen. */
export async function compressTo720p(file: File, onProgress?: (fraction: number) => void): Promise<File> {
  const url = URL.createObjectURL(file);
  const v = document.createElement("video");
  v.playsInline = true; v.src = url;
  try {
    await new Promise<void>((ok, bad) => { v.onloadedmetadata = () => ok(); v.onerror = () => bad(new Error("unreadable")); });
    const scale = Math.min(1, 720 / Math.min(v.videoWidth, v.videoHeight));
    const c = document.createElement("canvas");
    c.width = Math.round((v.videoWidth * scale) / 2) * 2; c.height = Math.round((v.videoHeight * scale) / 2) * 2;
    const ctx = c.getContext("2d")!;
    const stream = c.captureStream(30);
    const audio = new AudioContext();
    const dest = audio.createMediaStreamDestination();
    audio.createMediaElementSource(v).connect(dest);
    dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
    const mime = ["video/mp4", "video/webm;codecs=vp9,opus", "video/webm"].find((m) => MediaRecorder.isTypeSupported(m)) ?? "video/webm";
    const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 2_500_000, audioBitsPerSecond: 128_000 });
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    const stopped = new Promise<void>((ok) => { rec.onstop = () => ok(); });
    let raf = 0;
    const draw = () => { ctx.drawImage(v, 0, 0, c.width, c.height); raf = requestAnimationFrame(draw); };
    v.ontimeupdate = () => onProgress?.(v.duration ? v.currentTime / v.duration : 0);
    rec.start(1000);
    await v.play();
    draw();
    await new Promise<void>((ok) => { v.onended = () => ok(); });
    cancelAnimationFrame(raf); rec.stop(); await stopped; void audio.close();
    const type = mime.split(";")[0]!;
    const ext = type === "video/mp4" ? "mp4" : "webm";
    return new File(chunks, file.name.replace(/\.\w+$/, "") + `-720p.${ext}`, { type, lastModified: file.lastModified });
  } finally { URL.revokeObjectURL(url); }
}
