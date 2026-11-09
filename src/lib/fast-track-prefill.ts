import {
  emptyContributor,
  emptyMetadata,
  formatDuration,
  type Contributor,
  type Metadata,
} from "@/lib/metadata";
import { withProfileFilled, type ArtistProfile } from "@/lib/artist-profile";
import type { CompositionMatch } from "@/lib/composition";
import type { Discography, PulledRelease, PulledTrack } from "@/lib/discography";

/**
 * Streaming Fast-Track, catalog prefill (PLAN-royalty-health-hub-v2 §4.6): a paid account's pulled discography becomes
 * catalog entries, so all that's left is uploading the masters. The recording side comes from the streaming pull
 * (title, artist, album, track number, duration, ISRC, UPC, release date, label, release type); the composition side
 * comes only from a work The MLC actually returned, never from a guess. A work that is unverified stays blank — the
 * Doctor says so, and blank is the honest answer.
 *
 * Two rules from the plan hold here:
 * - the track title is saved exactly as the platform has it, with no "(Master)" or casing changes, because that title
 *   is what gets embedded (TIT2) and what agencies match on;
 * - nothing already in the catalog is touched without the member's say. A song with the same ISRC is the same
 *   recording and is skipped. A song with the same title and artist but a different or missing ISRC (an entry made
 *   before the release, or with a placeholder code) is put to the member: keep theirs, take streaming's recording
 *   details onto it, or keep both. So a re-pull can never silently overwrite an entry the artist has filled in.
 */
/** Deezer/Spotify record types as the catalog's release types; anything unexpected stays unanswered. */
export const releaseTypeOf = (recordType?: string | undefined): string => {
  switch ((recordType ?? "").trim().toLowerCase()) {
    case "single":
    case "singles":
      return "Single";
    case "ep":
      return "EP";
    case "album":
      return "Album";
    case "compile":
    case "compilation":
      return "Compilation";
    default:
      return "";
  }
};

/** A work writer as The MLC filed them: legal name, PRO and IPI, with the both-halves role (the pull can't tell). */
const workWriter = (w: {
  name: string;
  pro?: string | undefined;
  ipi?: string | undefined;
}): Contributor => ({
  ...emptyContributor(),
  legalName: w.name.trim(),
  name: w.name.trim(),
  pro: w.pro ?? "",
  ipi: w.ipi ?? "",
  role: "Author/Composer",
});

const workPublisher = (p: { name: string; ipi?: string | undefined }): Contributor => ({
  ...emptyContributor(),
  name: p.name.trim(),
  ipi: p.ipi ?? "",
});

/**
 * One released recording as a catalog song. Release-level details (UPC, label, artwork date) come from the release;
 * a matched work supplies the writers, publishers and ISWC exactly as registered. Profile blanks are filled last, and
 * only where the song is still blank.
 */
export function songFromRelease(
  release: PulledRelease,
  track: PulledTrack,
  match: CompositionMatch | undefined,
  profile: ArtistProfile | null,
): Metadata {
  const work = match?.status === "matched" ? match.work : undefined;
  const base: Metadata = {
    ...emptyMetadataBase(track, release),
    ...(work?.iswc ? { iswc: work.iswc } : {}),
    ...(work?.writers.length ? { writers: work.writers.map(workWriter) } : {}),
    ...(work?.publishers.length ? { publishers: work.publishers.map(workPublisher) } : {}),
  };
  return withProfileFilled(base, profile);
}

function emptyMetadataBase(track: PulledTrack, release: PulledRelease): Metadata {
  const total = release.tracks.length;
  return {
    ...emptyMetadata(),
    // The title exactly as the platform has it: that is what gets embedded, so nothing is added or cleaned up.
    title: track.title,
    artist: track.artist,
    featured: [""],
    album: release.title,
    trackNumber: track.position ? String(track.position) : "",
    trackTotal: track.position && total > 1 ? String(total) : "",
    duration: track.duration ? formatDuration(track.duration) : "",
    releaseType: releaseTypeOf(release.recordType),
    releaseDate: release.releaseDate ?? "",
    label: release.label ?? "",
    isrc: track.isrc ?? "",
    upc: release.upc ?? "",
    // A released recording is not pre-distribution; a future date is how the catalog treats "not out yet".
    unreleased: false,
  };
}

export type ExistingSong = {
  /** The catalog row, so a "use streaming's details" choice can update it in place. */
  id?: string | undefined;
  title: string;
  artist: string;
  isrc?: string | undefined;
  album?: string | undefined;
};

export type PrefillInput = {
  discography: Discography;
  matches: CompositionMatch[];
  /** The songs already in My Catalog: an ISRC match is left alone, a title match is the member's choice. */
  existing: ExistingSong[];
  profile: ArtistProfile | null;
};

/** A pulled recording that looks like a song already in My Catalog (same title and artist, a different or no ISRC). */
export type PrefillConflict = { song: Metadata; existing: ExistingSong };

export type PrefillPlan = {
  /** New songs, in streaming order (newest release first, track order inside it). */
  songs: Metadata[];
  /** How many pulled recordings were already in the catalog under the same ISRC. */
  existingCount: number;
  /** How many of the new songs got their composition details from a work on file at The MLC. */
  matchedCount: number;
  /** The same recording listed on more than one release (a single that is also on the album), counted once. */
  repeatCount: number;
  /** Songs the member decides about: keep their entry, take streaming's details, or keep both. */
  conflicts: PrefillConflict[];
};

/**
 * Title and artist as matching keys. Unlike the composition matcher, a version tag stays: "Therapy - Official Clean
 * Version" is its own recording with its own ISRC, not the explicit "Therapy". Only "feat." credits, case and
 * punctuation are ignored.
 */
export const titleKey = (v: string) =>
  v
    .toLowerCase()
    .replace(/[([]\s*(?:feat\.?|ft\.?|featuring)\s[^)\]]*[)\]]/g, "")
    .replace(/\s(?:feat\.?|ft\.?|featuring)\s.*$/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, "");

const isrcKey = (v?: string | undefined) => (v ?? "").trim().toUpperCase();

/** A song already here under the same ISRC: the very same recording, so it is left exactly as it is. */
export function alreadyInCatalog(
  song: Pick<Metadata, "isrc">,
  existing: PrefillInput["existing"],
): boolean {
  const isrc = isrcKey(song.isrc);
  return !!isrc && existing.some((e) => isrcKey(e.isrc) === isrc);
}

const RELEASE_RANK: Record<string, number> = { Album: 0, Compilation: 1, EP: 2, Single: 3, "": 4 };

/**
 * Everything a pull adds to My Catalog, what it leaves alone, and what it asks about. Matches are in track order,
 * exactly as the pull returns them, so the flat position lines up with the discography's flat track order.
 *
 * One recording often sits on several releases (the single, then the album). It is saved once: on the release a
 * catalog entry of the same title already names as its album, otherwise on the album before the single.
 */
export function prefillPlan({
  discography,
  matches,
  existing,
  profile,
}: PrefillInput): PrefillPlan {
  type Pulled = {
    release: PulledRelease;
    track: PulledTrack;
    match: CompositionMatch | undefined;
    order: number;
  };
  const groups = new Map<string, Pulled[]>();
  let i = 0;
  for (const release of discography.releases)
    for (const track of release.tracks) {
      const item = { release, track, match: matches[i], order: i };
      i += 1;
      const key = isrcKey(track.isrc) || `#${item.order}`;
      groups.set(key, [...(groups.get(key) ?? []), item]);
    }

  const sameSong = (e: ExistingSong, title: string, artist: string) =>
    titleKey(e.title) === titleKey(title) && titleKey(e.artist) === titleKey(artist);
  const pick = (list: Pulled[]): Pulled => {
    const albums = existing
      .filter((e) => sameSong(e, list[0]!.track.title, list[0]!.track.artist))
      .map((e) => titleKey(e.album ?? ""));
    return (
      list.find((p) => albums.includes(titleKey(p.release.title))) ??
      [...list].sort(
        (a, b) =>
          RELEASE_RANK[releaseTypeOf(a.release.recordType)]! -
            RELEASE_RANK[releaseTypeOf(b.release.recordType)]! || a.order - b.order,
      )[0]!
    );
  };

  const songs: Metadata[] = [];
  const conflicts: PrefillConflict[] = [];
  const claimed = new Set<ExistingSong>();
  let existingCount = 0;
  let matchedCount = 0;
  let repeatCount = 0;
  const chosen = [...groups.values()]
    .map((list) => {
      repeatCount += list.length - 1;
      return pick(list);
    })
    .sort((a, b) => a.order - b.order);

  for (const { release, track, match } of chosen) {
    const song = songFromRelease(release, track, match, profile);
    if (alreadyInCatalog(song, existing)) {
      existingCount += 1;
      continue;
    }
    const candidates = existing.filter(
      (e) => !claimed.has(e) && sameSong(e, song.title, song.artist),
    );
    const twin =
      candidates.find((e) => titleKey(e.album ?? "") === titleKey(song.album)) ?? candidates[0];
    if (twin) {
      claimed.add(twin);
      conflicts.push({ song, existing: twin });
      continue;
    }
    if (match?.status === "matched") matchedCount += 1;
    songs.push(song);
  }
  return { songs, existingCount, matchedCount, repeatCount, conflicts };
}

/** What streaming confirms about a recording; everything else on a catalog entry is the member's own work. */
export const STREAMING_FIELDS = [
  "title",
  "album",
  "trackNumber",
  "trackTotal",
  "duration",
  "releaseType",
  "releaseDate",
  "isrc",
  "upc",
  "label",
] as const satisfies readonly (keyof Metadata)[];

/**
 * "Use streaming's details" on a song already in My Catalog: the recording fields streaming confirmed replace the
 * entry's, and its writers, publishers, lyrics, credits and master stay exactly as they are. A field streaming left
 * blank (Spotify no longer gives a label) keeps the entry's own value.
 */
export function withStreamingDetails(mine: Metadata, pulled: Metadata): Metadata {
  const out: Metadata = { ...mine, unreleased: false };
  for (const k of STREAMING_FIELDS) if (pulled[k]) (out as Record<string, unknown>)[k] = pulled[k];
  return out;
}
