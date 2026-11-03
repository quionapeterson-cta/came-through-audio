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
 * - nothing already in the catalog is touched. A song that is already there (same ISRC, or same title + artist) is
 *   skipped, so a re-pull can never overwrite a catalog entry the artist has since filled in.
 */
const norm = (v: string) =>
  v
    .toLowerCase()
    .replace(/\(.*?\)|\[.*?\]|\s-\s.*$|feat\..*$|ft\..*$/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, "");

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

export type PrefillInput = {
  discography: Discography;
  matches: CompositionMatch[];
  /** The songs already in My Catalog: anything matching one of these is left alone. */
  existing: { title: string; artist: string; isrc?: string | undefined }[];
  profile: ArtistProfile | null;
};

export type PrefillPlan = {
  /** New songs, in streaming order (newest release first, track order inside it). */
  songs: Metadata[];
  /** How many pulled tracks were already in the catalog. */
  existingCount: number;
  /** How many of the new songs got their composition details from a work on file at The MLC. */
  matchedCount: number;
};

/** A song already here if it shares an ISRC, or its title and artist with punctuation and "feat." bits ignored. */
export function alreadyInCatalog(
  song: Pick<Metadata, "title" | "artist" | "isrc">,
  existing: PrefillInput["existing"],
): boolean {
  const isrc = song.isrc.trim().toUpperCase();
  return existing.some(
    (e) =>
      (!!isrc && e.isrc?.trim().toUpperCase() === isrc) ||
      (norm(e.title) === norm(song.title) && norm(e.artist) === norm(song.artist)),
  );
}

/**
 * Everything a pull adds to My Catalog, and what it leaves alone. Matches are in track order, exactly as the pull
 * returns them, so the flat position lines up with the discography's flat track order.
 */
export function prefillPlan({
  discography,
  matches,
  existing,
  profile,
}: PrefillInput): PrefillPlan {
  const songs: Metadata[] = [];
  let existingCount = 0;
  let matchedCount = 0;
  let i = 0;
  for (const release of discography.releases) {
    for (const track of release.tracks) {
      const match = matches[i];
      i += 1;
      const song = songFromRelease(release, track, match, profile);
      if (alreadyInCatalog(song, existing)) {
        existingCount += 1;
        continue;
      }
      if (match?.status === "matched") matchedCount += 1;
      songs.push(song);
    }
  }
  return { songs, existingCount, matchedCount };
}
