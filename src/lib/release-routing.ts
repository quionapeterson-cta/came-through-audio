import type { Metadata } from "./metadata";

/**
 * Which release a catalog song belongs to.
 *
 * The **album title** routes the songs, not each song's own release type (founder, 2026-11-10): a track that was filled
 * in or imported as a "Single" but names an album still belongs to that album, so one release can never split into an
 * album and a pile of singles. A song with no album, or a lone song whose album title is just its own title, is a
 * single. A release whose songs disagree about the type reads as an EP only when EP is the majority; anything else that
 * is a release is an album.
 *
 * My Catalog, Royalties and Registrations, release downloads and a release's health check all read this, so they can't disagree
 * about what is on a release.
 */
export type RoutedKind = "Single" | "EP" | "Album";

/** The EP ceiling the app already sells (an EP package holds up to six songs). */
const EP_MAX = 6;

export type ReleaseFields = Pick<Metadata, "album" | "releaseType" | "title">;

/** One spelling of an album title: trimmed, lower case, runs of spaces collapsed ("Therapy  Deluxe " ≡ "therapy deluxe"). */
export const albumKey = (album: string) => album.trim().toLowerCase().replace(/\s+/g, " ");

const declared = (releaseType: string): "EP" | "Album" | "" =>
  releaseType === "EP" ? "EP" : releaseType === "Album" || releaseType === "Compilation" ? "Album" : "";

/** The kind of release each song belongs to, by song id. */
export function routedKinds<T>(
  songs: readonly T[],
  fields: (song: T) => ReleaseFields,
  id: (song: T) => string,
): Map<string, RoutedKind> {
  const kinds = new Map<string, RoutedKind>();
  const albums = new Map<string, T[]>();
  for (const song of songs) {
    kinds.set(id(song), "Single");
    const key = albumKey(fields(song).album);
    if (!key) continue;
    albums.set(key, [...(albums.get(key) ?? []), song]);
  }
  for (const list of albums.values()) {
    const tags = list.map((song) => declared(fields(song).releaseType)).filter((tag): tag is "EP" | "Album" => !!tag);
    const eps = tags.filter((tag) => tag === "EP").length;
    const lps = tags.length - eps;
    const only = list.length === 1 ? list[0] : undefined;
    // A lone song whose album title is its own title is the single it is, not an album of one.
    const named = only ? albumKey(fields(only).album) !== albumKey(fields(only).title) : true;
    // A release of one counts only when the song doesn't call itself a Single: a blank type with a release title of its
    // own is a release of one, while an explicit Single stays a single whatever its album field says.
    // With no release type declared anywhere, the release's own size decides: the app already treats up to six songs as
    // an EP (the EP package's ceiling), and a longer run of songs on one title is an album.
    const kind: RoutedKind = eps > lps ? "EP" : lps > 0 ? "Album" : list.length > 1 ? (list.length <= EP_MAX ? "EP" : "Album") : named && !fields(only!).releaseType.trim() ? "Album" : "Single";
    if (kind === "Single") continue;
    for (const song of list) kinds.set(id(song), kind);
  }
  return kinds;
}
