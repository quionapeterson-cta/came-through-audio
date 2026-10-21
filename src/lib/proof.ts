export const PACKAGES = [
  { id: "Single", label: "Single", songs: 1, price: 2.99, save: "" },
  { id: "EP", label: "EP · up to 6 songs", songs: 6, price: 9.99, save: "Save $8" },
  { id: "Album", label: "Album · up to 12 songs", songs: 12, price: 16.99, save: "Save $19" },
  { id: "Plus", label: "Album+ · up to 20 songs", songs: 20, price: 24.99, save: "Save $35" },
] as const;
export type PackageId = (typeof PACKAGES)[number]["id"];

/** The smallest package that covers this many songs (Album+ is the largest). */
export function packageFor(songs: number): PackageId {
  return (PACKAGES.find((p) => p.songs >= songs) ?? PACKAGES[PACKAGES.length - 1]!).id;
}

export const packageSongs = (id: string | undefined) => PACKAGES.find((p) => p.id === id)?.songs ?? 1;

type AiPurchase = { kind: string; details: Record<string, string> };

/** Certificates paid for: one per song in each package. Mirrors public.can_issue_ai_certificate. */
export function certificateCredits(purchases: AiPurchase[]): number {
  return purchases.filter((p) => p.kind === "ai" && !p.details["refunded_at"]).reduce((n, p) => n + packageSongs(p.details["package"]), 0);
}

/** Stripe metadata values hold 500 characters, so song IDs travel in chunks of 10. */
export const TRACKS_PER_KEY = 10;

/** Catalog song IDs picked at checkout, in order (older purchases carry a single trackId). */
export function paidTrackIds(purchases: AiPurchase[]): string[] {
  const ids = purchases.filter((p) => p.kind === "ai" && !p.details["refunded_at"]).flatMap((p) => {
    const keys = Object.keys(p.details).filter((k) => /^tracks_\d+$/.test(k)).sort((a, b) => Number(a.slice(7)) - Number(b.slice(7)));
    return [...(p.details["trackId"] ? [p.details["trackId"]] : []), ...keys.flatMap((k) => p.details[k]!.split(",").filter(Boolean))];
  });
  return [...new Set(ids)];
}

export const MIN_PROOF_SECONDS = 5;
export const MAX_PROOF_SECONDS = 60;
export const MAX_PROOF_BYTES = 52_428_800; // 50MB
export const PROOF_VIDEO_TYPES = ["video/mp4", "video/quicktime", "video/webm"];

/** Returns an error message, or null when the file is an acceptable proof video. */
export function proofFileError(file: { type: string; size: number }): string | null {
  if (!PROOF_VIDEO_TYPES.includes(file.type)) return "Use an MP4, MOV or WebM video.";
  if (file.size > MAX_PROOF_BYTES) return "Videos must be 50MB or smaller.";
  return null;
}

export async function sha256(buf: ArrayBuffer): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", buf);
  return [...new Uint8Array(d)].map((x) => x.toString(16).padStart(2, "0")).join("");
}

export function videoDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const v = document.createElement("video");
    v.preload = "metadata";
    v.muted = true;
    const url = URL.createObjectURL(file);
    v.onloadedmetadata = () => { v.pause(); URL.revokeObjectURL(url); resolve(v.duration); };
    v.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Could not read video")); };
    v.src = url;
  });
}

/** Days apart → Strong/Human chain; same day → Weak/timestamp only. */
export function chainStrength(first: Date, last: Date): "Strong Chain / Human Chain Certificate" | "Weak Chain / Timestamp Only" {
  const days = Math.abs(last.getTime() - first.getTime()) / 86_400_000;
  return days >= 1 ? "Strong Chain / Human Chain Certificate" : "Weak Chain / Timestamp Only";
}
