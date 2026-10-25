import { creditName, emptyContributor, emptyMetadata, withLegalName, type Contributor, type Metadata } from "@/lib/metadata";
import { supabase } from "@/integrations/supabase/client";
import { requestBadgeCheck } from "@/lib/badge-events";
import { currentBadge, DEFAULT_BADGE_PREFS, type BadgePrefs } from "@/lib/badges";

/** Recurring details a user can opt to prefill on every embed. Stored only in this browser. */
export const PROFILE_KEYS = [
  "artist", "label", "primaryGenre", "secondaryGenre", "releaseType", "explicit", "copyright", "phonographic", "language",
  "writers", "composers", "producers", "publishers", "selfPublished", "recordedIn",
] as const;
export type ArtistProfile = Partial<Pick<Metadata, (typeof PROFILE_KEYS)[number]>>;

/** First-time setup: profile image, public release defaults, then private catalog details. */
export interface Onboarding {
  done: boolean;
  welcomed: boolean;
  avatar: string; // badge path, uploaded photo (data URL), or "" for none
  stageName: string;
  legalName: string;
  /** Country whose collection societies the Royalty Health Hub uses (src/lib/repertoires.ts code). */
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
    const writers = withOwnWriter(p.writers && withLegalName(p.writers), loadOnboarding(userId)?.legalName);
    return { ...p, ...(writers && { writers }), ...(p.composers && { composers: withLegalName(p.composers) }) };
  } catch { return null; }
}

/**
 * The user's own writer row. Setup shows it prefilled with their legal name, but only stored the name once the row was
 * typed in, so a lone unnamed row (often holding their IPI/PRO) or no row at all takes the account's legal name.
 * Only fills a blank: an existing name is never replaced.
 */
export function withOwnWriter(rows: Contributor[] | undefined, legalName?: string): Contributor[] | undefined {
  const name = legalName?.trim();
  if (!name) return rows;
  if (!rows?.length) return [{ ...emptyContributor(), legalName: name, role: "Author/Composer" }];
  return rows.length === 1 && !creditName(rows[0]!) ? [{ ...rows[0]!, legalName: name }] : rows;
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
    // A self-published song has its answer: the profile's publisher never fills in (it would contradict it).
    if (k === "publishers" && out.selfPublished) continue;
    const cur = out[k] as unknown;
    const empty = cur === undefined || cur === "" || (Array.isArray(cur) && hasName(cur as Contributor[]).length === 0);
    if (empty && p[k] !== undefined) (out as Record<string, unknown>)[k] = p[k];
  }
  return out;
}

const ROW_GROUPS = ["writers", "composers", "producers", "publishers"] as const;

/** Private PRO/IPI/shares never live in files: rows matching a saved profile name get them back, blanks only. */
export function restoreRows(m: Partial<Metadata>, p: ArtistProfile | null): Partial<Metadata> {
  if (!p) return m;
  const out: Partial<Metadata> = { ...m };
  for (const g of ROW_GROUPS) {
    const rows = out[g];
    if (!rows) continue;
    out[g] = rows.map((r) => {
      const saved = creditName(r) && p[g]?.find((s) => creditName(s).toLowerCase() === creditName(r).toLowerCase());
      return saved ? { ...r, legalName: r.legalName || saved.legalName, pro: r.pro || saved.pro, ipi: r.ipi || saved.ipi, percentage: r.percentage || saved.percentage, hfa: r.hfa || saved.hfa } : r;
    });
  }
  return out;
}

/**
 * A catalog song with the profile filled in: empty fields take the Embed Defaults and Catalog Profile, matching writers
 * and publishers get their saved PRO/IPI/share, and no publisher + a self-published profile reads as self-published.
 * Only blanks are filled; nothing the song already has is replaced. Applied to the form, saved when the user saves.
 */
export function withProfileFilled(m: Metadata, p: ArtistProfile | null): Metadata {
  if (!p) return m;
  const out = { ...m, ...restoreRows(fillMissing(m, p), p) } as Metadata;
  if (p.selfPublished && !out.selfPublished && !hasName(out.publishers).length) out.selfPublished = true;
  return out;
}
