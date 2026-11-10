import { RELEASE_TYPES, type Metadata } from "@/lib/metadata";

/**
 * The Release panel (PLAN-releases-and-roles §4.1) and the Unreleased section (§4.2).
 *
 * No new table: a release's status is read from the release date and the "isn't released yet" box the songs already
 * hold, exactly as the Hub reads it (`isUnreleased`), so the two screens can never disagree. Editing a release writes
 * those same fields to every song in it through the existing per-song save.
 */
const isoDay = () => new Date().toISOString().slice(0, 10);

export type ReleaseStatus = "unreleased" | "scheduled" | "released";
export type SongRelease = Pick<Metadata, "releaseType" | "album" | "releaseDate" | "unreleased">;
export type ReleaseDraft = { releaseType: string; album: string; releaseDate: string; status: ReleaseStatus | "" };
export type ReleasePatch = Pick<Metadata, "releaseType" | "album" | "releaseDate" | "unreleased">;

/** Out, dated in the future, or not out yet. A blank date with the box unticked has always meant released. */
export function releaseStatus(m: SongRelease, on = isoDay()): ReleaseStatus {
  if (m.releaseDate) return m.releaseDate > on ? "scheduled" : "released";
  return m.unreleased ? "unreleased" : "released";
}

/** The status in words, for a group header. */
export function statusWords(m: SongRelease, on = isoDay()): string {
  const s = releaseStatus(m, on);
  return s === "scheduled" ? `Scheduled for ${m.releaseDate}` : s === "released" ? "Released" : "Not released yet";
}

/**
 * What the Edit dialog opens with: the group's own fields. A release that is part out has no single status, so the
 * dialog opens with none chosen: guessing from the first song would let one Save release or un-release the rest.
 */
export function releaseDraft(songs: SongRelease[], on = isoDay()): ReleaseDraft {
  const first = songs[0];
  const out = songs.filter((m) => releaseStatus(m, on) === "released").length;
  const dates = [...new Set(songs.map((m) => m.releaseDate.trim()))];
  const status: ReleaseStatus | "" = !songs.length ? "unreleased"
    : out === songs.length ? "released"
    : out > 0 ? ""
    : songs.every((m) => releaseStatus(m, on) === "scheduled") ? "scheduled" : "unreleased";
  return {
    releaseType: first?.releaseType.trim() || "Single",
    album: first?.album.trim() ?? "",
    // Songs are meant to share one release date. If they differ, the first real one is shown rather than a blank that
    // Save would write over every song and quietly erase them all.
    releaseDate: (dates.find((d) => d) ?? "").trim(),
    status,
  };
}

/**
 * A release's status as a whole: released once every song is out, "N of M out" while it is coming out, and the date
 * only when every song carries the same future one.
 */
export function groupReleaseStatus(songs: SongRelease[], on = isoDay()): { out: number; total: number; status: ReleaseStatus; label: string } {
  const total = songs.length;
  const out = songs.filter((m) => releaseStatus(m, on) === "released").length;
  if (!total || out === total) return { out, total, status: "released", label: total ? "Released" : "Not released yet" };
  if (out > 0) return { out, total, status: "scheduled", label: `${out} of ${total} out` };
  const scheduled = songs.every((m) => releaseStatus(m, on) === "scheduled");
  const dates = [...new Set(songs.map((m) => m.releaseDate.trim()).filter(Boolean))];
  return { out, total, status: scheduled ? "scheduled" : "unreleased", label: scheduled && dates.length === 1 ? `Scheduled for ${dates[0]}` : "Not released yet" };
}

/**
 * What the dialog writes to every song in the group. The Status answer is the plain-language one: it sets the date and
 * the box together, so a chosen status can never contradict the fields.
 */
export function releasePatch(d: ReleaseDraft, on = isoDay()): { patch: ReleasePatch } | { error: string } {
  const releaseType = d.releaseType.trim();
  if (!(RELEASE_TYPES as readonly string[]).includes(releaseType)) return { error: "Pick a release type." };
  const album = d.album.trim();
  if (releaseType !== "Single" && !album) return { error: `An ${releaseType === "EP" ? "EP" : "album"} needs a release title.` };
  const releaseDate = d.releaseDate.trim();
  if (!d.status) return { error: "Choose the release's status." };
  if (d.status === "scheduled") {
    if (!releaseDate) return { error: "Pick the release date, or choose Not released yet." };
    if (releaseDate <= on) return { error: "That date isn't in the future. Choose Released, or pick a later date." };
    return { patch: { releaseType, album, releaseDate, unreleased: false } };
  }
  if (d.status === "released") {
    if (releaseDate && releaseDate > on) return { error: "That date is still in the future, so the release would stay unreleased. Pick a date up to today, or choose Scheduled." };
    return { patch: { releaseType, album, releaseDate, unreleased: false } };
  }
  // "Not released yet" is the plain answer: no date to read, and the box ticked, which is how it has always been said.
  return { patch: { releaseType, album, releaseDate: "", unreleased: true } };
}
