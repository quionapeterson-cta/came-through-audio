export const PACKAGES = [
  { id: "Single", label: "Single", songs: 1, price: 2.99, save: "" },
  { id: "EP", label: "EP · up to 6 songs", songs: 6, price: 9.99, save: "Save $8" },
  { id: "Album", label: "Album · up to 12 songs", songs: 12, price: 16.99, save: "Save $19" },
  { id: "Plus", label: "Album+ · up to 20 songs", songs: 20, price: 24.99, save: "" },
] as const;
export type PackageId = (typeof PACKAGES)[number]["id"];

export const MAX_PROOF_SECONDS = 15;

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
