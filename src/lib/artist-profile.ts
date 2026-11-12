import { creditName, emptyContributor, emptyMetadata, withLegalName, type Contributor, type Metadata } from "@/lib/metadata";
import { supabase } from "@/integrations/supabase/client";
import { requestBadgeCheck } from "@/lib/badge-events";
import { currentBadge, DEFAULT_BADGE_PREFS, type BadgePrefs } from "@/lib/badges";
import type { AccountRole, Situation } from "@/lib/roles";

/** Recurring details a user can opt to prefill on every embed. Stored only in this browser. */
export const PROFILE_KEYS = [
  "artist", "label", "contactEmail", "primaryGenre", "secondaryGenre", "releaseType", "explicit", "copyright", "phonographic", "language",
  "writers", "composers", "producers", "publishers", "selfPublished", "bmiWriterPublishing", "recordedIn",
  // Usual answers that aren't song-specific (founder, 2026-10-25): they fill blanks only, never what a song already has.
  "samples", "writtenFor", "masterShare", "masterBasis", "credits",
  // The country and territory answers SoundExchange asks for (founder, 2026-11-12): the same on nearly every song, so
  // they are typed once here and filled into a song's blanks. They never join the meter's twelve checks.
  "masteredIn", "ownerNationality", "firstReleaseCountry", "releaseCountry", "collectionTerritories",
] as const;
export type ArtistProfile = Partial<Pick<Metadata, (typeof PROFILE_KEYS)[number]>>;

/** First-time setup: profile image, public release defaults, then private catalog details. */
export interface Onboarding {
  done: boolean;
  welcomed: boolean;
  avatar: string; // badge path, uploaded photo (data URL), or "" for none
  stageName: string;
  legalName: string;
  /** Country whose collection societies the Royalties and Registrations uses (src/lib/repertoires.ts code). */
  healthCountry?: string;
  /** What badges show (celebrations, hints, hidden collections, sharing). Badges are always earned regardless. */
  badgePrefs?: BadgePrefs;
  /**
   * The six roles confirmed on 2026-11-09 and where the member is with releases. Blank answers behave exactly as the app
   * did before the question existed; answers only choose what a NEW entry starts from (src/lib/roles.ts).
   */
  situations?: Situation[];
  roles?: AccountRole[];
  sellBeats?: boolean;
  /** The patient file handed over at the Royalties and Registrations's Front Desk, kept with the account, not just this browser. */
  patientFile?: { legalName: string; pro: string; ipi: string; publishing: "" | "publisher" | "self" | "bmi"; publisher: string };
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
 * The defaults that carry over to every song, as the twelve checks behind the meter in setup (founder, 2026-11-06). A
 * full profile is the other way to earn the defaults sky, without ticking the two blueprint checklists.
 */
export function profileChecks(ob: Onboarding, p: ArtistProfile): boolean[] {
  const named = (rows?: Contributor[]) => (rows ?? []).some((r) => (r.legalName ?? r.name ?? "").trim());
  const writer = (p.writers ?? []).find((r) => (r.legalName ?? "").trim());
  return [
    !!ob.stageName.trim(), !!p.label?.trim(), !!p.primaryGenre, !!p.language?.trim(), !!p.recordedIn?.trim(),
    !!(p.copyright?.trim() || p.phonographic?.trim()), !!p.samples, !!p.writtenFor,
    !!ob.legalName.trim(), !!writer?.pro?.trim(), !!writer?.ipi?.trim(), named(p.publishers) || !!p.selfPublished || !!p.bmiWriterPublishing,
  ];
}

type PatientFileShape = NonNullable<Onboarding["patientFile"]>;

/**
 * The Front Desk's patient file as the profile defaults already answer it: the member's own writer row (matched by legal
 * name, else the first named writer) for PRO and IPI, and the publishing answer from Catalog Defaults. A first visit
 * starts from this instead of a blank form; nothing is saved until the member submits it.
 */
export function patientFileFromDefaults(ob: Pick<Onboarding, "legalName"> | null, p: ArtistProfile | null): PatientFileShape {
  const legal = (ob?.legalName ?? "").trim();
  const rows = p?.writers ?? [];
  const named = rows.filter((r) => creditName(r).trim());
  // A lone row is the member's own, named or not: setup often stored their PRO/IPI before the name (see withOwnWriter).
  const own = named.find((r) => creditName(r).trim().toLowerCase() === legal.toLowerCase()) ?? (rows.length === 1 ? rows[0] : legal ? undefined : named[0]);
  const publisher = hasName(p?.publishers)[0];
  const publishing: PatientFileShape["publishing"] = publisher ? "publisher" : p?.bmiWriterPublishing ? "bmi" : p?.selfPublished ? "self" : "";
  return {
    legalName: legal || (own ? creditName(own).trim() : ""),
    pro: own?.pro?.trim() ?? "",
    ipi: own?.ipi?.trim() ?? "",
    publishing,
    publisher: publisher ? creditName(publisher).trim() : "",
  };
}

/** The member's own PRO and IPI, as their catalog defaults hold them, for contract fields that ask for them. */
export function ownProIpi(userId?: string): { pro: string; ipi: string } {
  const { pro, ipi } = patientFileFromDefaults(loadOnboarding(userId), loadProfile(userId));
  return { pro, ipi };
}

/** Every default filled in: the catalog (and stage name) is 100% complete. */
export const profileFilled = (ob: Onboarding, p: ArtistProfile) => profileChecks(ob, p).every(Boolean);

/**
 * The user's own writer row. Setup shows it prefilled with their legal name, but only stored the name once the row was
 * typed in, so a lone unnamed row (often holding their IPI/PRO) or no row at all takes the account's legal name.
 * Only fills a blank: an existing name is never replaced.
 */
export function withOwnWriter(rows: Contributor[] | undefined, legalName?: string): Contributor[] | undefined {
  const name = legalName?.trim();
  if (!name) return rows;
  if (!rows?.length) return [{ ...emptyContributor(), legalName: name, role: "Author/Composer" }];
  // A lone row that only ever held their PRO and IPI takes the name — and a role, if it has none. Without one, every
  // song filled from these defaults waits on the same answer, and the health meter sits at 33% until the member picks
  // it on each song separately (founder, 2026-11-12). An answer already given is never replaced.
  if (rows.length !== 1 || creditName(rows[0]!)) return rows;
  return [{ ...rows[0]!, legalName: name, role: rows[0]!.role?.trim() || "Author/Composer" }];
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

/**
 * A seat artist's saved defaults, read into this browser so an owner can edit them. Nothing is pushed back here: the
 * artist's account is not ours to overwrite just by opening it.
 */
export async function loadSeatArtistDefaults(artistId: string): Promise<{ profile: ArtistProfile | null; onboarding: Onboarding | null }> {
  const { data } = await supabase.from("profiles").select("artist_defaults, onboarding").eq("id", artistId).maybeSingle();
  const row = data as { artist_defaults?: ArtistProfile | null; onboarding?: Onboarding | null } | null;
  if (row?.artist_defaults) localStorage.setItem(key(artistId), JSON.stringify(row.artist_defaults));
  if (row?.onboarding) localStorage.setItem(onboardKey(artistId), JSON.stringify(row.onboarding));
  return { profile: row?.artist_defaults ?? null, onboarding: row?.onboarding ?? null };
}

/**
 * Saves a seat artist's Embed Defaults and Catalog Profile. The database checks the caller pays for that artist's seat
 * and writes those two columns only, so an owner can set up an artist without touching their name, plan or role.
 */
export async function saveSeatArtistDefaults(artistId: string, profile: ArtistProfile, onboarding: Onboarding): Promise<string | null> {
  localStorage.setItem(key(artistId), JSON.stringify(profile));
  localStorage.setItem(onboardKey(artistId), JSON.stringify(onboarding));
  const { error } = await supabase.rpc("set_seat_artist_defaults" as never, { _member: artistId, _artist_defaults: profile, _onboarding: onboarding } as never);
  return error ? error.message : null;
}

const hasName = (rows?: Contributor[]) => (rows ?? []).filter(creditName);

/** Fresh embed form with the saved profile applied (values stay editable). */
export function withProfile(p: ArtistProfile | null): Metadata {
  const base = emptyMetadata();
  if (!p) return base;
  const rows = (r?: Contributor[]) => (hasName(r).length ? hasName(r) : [emptyContributor()]);
  // Blank profile answers keep the song's own defaults (e.g. a blank master share stays 100%, not empty).
  const set = Object.fromEntries(Object.entries(p).filter(([, v]) => v !== "" && v !== undefined));
  return {
    ...base, ...set,
    writers: rows(p.writers), composers: rows(p.composers), producers: rows(p.producers), publishers: rows(p.publishers),
  };
}

/** Fill only empty fields of detected file metadata from the profile — never overwrite what the file already has. */
export function fillMissing(detected: Partial<Metadata>, p: ArtistProfile | null): Partial<Metadata> {
  if (!p) return detected;
  const out: Partial<Metadata> = { ...detected };
  for (const k of PROFILE_KEYS) {
    // A self-published song has its answer: the profile's publisher never fills in (it would contradict it).
    if (k === "publishers" && (out.selfPublished || out.bmiWriterPublishing)) continue;
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
      return saved ? { ...r, legalName: r.legalName || saved.legalName, pro: r.pro || saved.pro, ipi: r.ipi || saved.ipi, percentage: r.percentage || saved.percentage, hfa: r.hfa || saved.hfa, publishing: r.publishing || saved.publishing } : r;
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
  // Same for a BMI writer with no publishing company: the profile's answer fills songs that have no publisher.
  if (p.bmiWriterPublishing && !out.bmiWriterPublishing && !hasName(out.publishers).length) out.bmiWriterPublishing = true;
  return out;
}
