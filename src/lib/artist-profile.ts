import { emptyMetadata, type Metadata } from "@/lib/metadata";

/** Unchanging "main artist" details a user can opt to prefill on every embed. Stored only in this browser. */
export const PROFILE_KEYS = ["artist", "label", "primaryGenre", "secondaryGenre", "writers", "composers", "producers", "publishers"] as const;
export type ArtistProfile = Partial<Pick<Metadata, (typeof PROFILE_KEYS)[number]>>;

const key = (userId: string) => `cta-artist-profile:${userId}`;

export function pickProfile(m: Metadata): ArtistProfile {
  const out: ArtistProfile = {};
  for (const k of PROFILE_KEYS) (out as Record<string, unknown>)[k] = m[k];
  return out;
}

export function loadProfile(userId?: string): ArtistProfile | null {
  if (!userId || typeof localStorage === "undefined") return null;
  try { const v = localStorage.getItem(key(userId)); return v ? (JSON.parse(v) as ArtistProfile) : null; } catch { return null; }
}

export function saveProfile(userId: string, p: ArtistProfile | null) {
  if (p) localStorage.setItem(key(userId), JSON.stringify(p)); else localStorage.removeItem(key(userId));
}

/** Fresh embed form with the saved profile applied (values stay editable). */
export function withProfile(p: ArtistProfile | null): Metadata {
  return { ...emptyMetadata(), ...(p ?? {}) };
}
