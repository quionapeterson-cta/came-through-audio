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
