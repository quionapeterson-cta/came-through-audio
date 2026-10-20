import { creditName, emptyContributor, emptyMetadata, withLegalName, type Contributor, type Metadata } from "@/lib/metadata";
import { supabase } from "@/integrations/supabase/client";
import { requestBadgeCheck } from "@/lib/badge-events";
import { currentBadge, DEFAULT_BADGE_PREFS, type BadgePrefs } from "@/lib/badges";

/** Recurring details a user can opt to prefill on every embed. Stored only in this browser. */
export const PROFILE_KEYS = [
  "artist", "label", "primaryGenre", "secondaryGenre", "releaseType", "explicit", "copyright", "phonographic", "language",
  "writers", "composers", "producers", "publishers", "recordedIn",
] as const;
export type ArtistProfile = Partial<Pick<Metadata, (typeof PROFILE_KEYS)[number]>>;

/** First-time setup: profile image, public release defaults, then private catalog details. */
export interface Onboarding {
  done: boolean;
  welcomed: boolean;
  avatar: string; // badge path, uploaded photo (data URL), or "" for none
  stageName: string;
  legalName: string;
  /** Country whose collection societies the Royalty Health Check uses (src/lib/repertoires.ts code). */
  healthCountry?: string;
  /** What badges show (celebrations, hints, hidden collections, sharing). Badges are always earned regardless. */
  badgePrefs?: BadgePrefs;
}

export const badgePrefs = (o?: Onboarding | null): BadgePrefs => ({ ...DEFAULT_BADGE_PREFS, ...o?.badgePrefs });

const key = (userId: string) => `cta-artist-profile:${userId}`;
const onboardKey = (userId: string) => `cta-onboarding:${userId}`;

export function pickProfile(m: Metadata): ArtistProfile {
  const out: ArtistProfile = {};
  for (const k of PROFILE_KEYS) (out as Record<string, unknown>)[k] = m[k];
  return out;
}

export function loadProfile(userId?: string): ArtistProfile | null {
  if (!userId || typeof localStorage === "undefined") return null;
  try {
    const v = localStorage.getItem(key(userId));
    if (!v) return null;
    const p = JSON.parse(v) as ArtistProfile;
    return { ...p, ...(p.writers && { writers: withLegalName(p.writers) }), ...(p.composers && { composers: withLegalName(p.composers) }) };
  } catch { return null; }
}

// The account (profiles row) is the source of truth; localStorage is a fast local cache.
const pushCloud = (userId: string, patch: Record<string, unknown>) => {
  void supabase.from("profiles").update(patch as never).eq("id", userId).then(({ error }) => {
    if (error) console.error("Profile sync failed", error.message);
  });
};

export function saveProfile(userId: string, profile: ArtistProfile | null) {
  if (profile) localStorage.setItem(key(userId), JSON.stringify(profile)); else localStorage.removeItem(key(userId));
  pushCloud(userId, { artist_defaults: profile });
}

export function loadOnboarding(userId?: string): Onboarding | null {
  if (!userId || typeof localStorage === "undefined") return null;
  try { const v = localStorage.getItem(onboardKey(userId)); return v ? withCurrentBadge(JSON.parse(v) as Onboarding) : null; } catch { return null; }
}

const withCurrentBadge = (o: Onboarding): Onboarding => ({ ...o, avatar: currentBadge(o.avatar) ?? "" });

export function saveOnboarding(userId: string, o: Onboarding) {
  localStorage.setItem(onboardKey(userId), JSON.stringify(o));
  pushCloud(userId, { onboarding: o });
  if (o.welcomed) requestBadgeCheck();
}

/** Pull the account's saved profile into this device. Uploads local-only data from before sync existed. */
export async function syncFromCloud(userId: string): Promise<Onboarding | null> {
  const { data } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
  const row = data as { artist_defaults?: ArtistProfile | null; onboarding?: Onboarding | null } | null;
  const localP = loadProfile(userId), localO = loadOnboarding(userId);
  if (row?.artist_defaults) localStorage.setItem(key(userId), JSON.stringify(row.artist_defaults));
  else if (localP) pushCloud(userId, { artist_defaults: localP });
  if (row?.onboarding) localStorage.setItem(onboardKey(userId), JSON.stringify(row.onboarding));
  else if (localO) pushCloud(userId, { onboarding: localO });
  return row?.onboarding ? withCurrentBadge(row.onboarding) : localO;
}

const hasName = (rows?: Contributor[]) => (rows ?? []).filter(creditName);

/** Fresh embed form with the saved profile applied (values stay editable). */
export function withProfile(p: ArtistProfile | null): Metadata {
  const base = emptyMetadata();
  if (!p) return base;
  const rows = (r?: Contributor[]) => (hasName(r).length ? hasName(r) : [emptyContributor()]);
  return {
    ...base, ...p,
    writers: rows(p.writers), composers: rows(p.composers), producers: rows(p.producers), publishers: rows(p.publishers),
  };
}

/** Fill only empty fields of detected file metadata from the profile — never overwrite what the file already has. */
export function fillMissing(detected: Partial<Metadata>, p: ArtistProfile | null): Partial<Metadata> {
  if (!p) return detected;
  const out: Partial<Metadata> = { ...detected };
  for (const k of PROFILE_KEYS) {
    const cur = out[k] as unknown;
    const empty = cur === undefined || cur === "" || (Array.isArray(cur) && hasName(cur as Contributor[]).length === 0);
    if (empty && p[k] !== undefined) (out as Record<string, unknown>)[k] = p[k];
  }
  return out;
}
