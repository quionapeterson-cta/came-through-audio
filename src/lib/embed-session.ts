import { readMetadata, type Metadata } from "@/lib/metadata";

/**
 * Embed Metadata helpers (PLAN-master-notes 3.1): the unsaved form survives leaving the tab or reloading, and an
 * album dropped in all at once lines up first song first.
 */

const draftKey = (userId?: string) => `cta-embed-draft:${userId ?? "guest"}`;

/** The details typed into Embed Metadata, kept in this browser until the song is submitted to the catalog. */
export function loadEmbedDraft(userId?: string): Metadata | undefined {
  try {
    const raw = localStorage.getItem(draftKey(userId));
    const m = raw ? (JSON.parse(raw) as Metadata) : undefined;
    return m && typeof m === "object" && typeof m.title === "string" ? m : undefined;
  } catch { return undefined; }
}

/** Saves the draft, or clears it when the form only holds the profile's defaults (nothing typed yet). */
export function saveEmbedDraft(userId: string | undefined, m: Metadata, defaults: Metadata) {
  try {
    if (JSON.stringify(m) === JSON.stringify(defaults)) localStorage.removeItem(draftKey(userId));
    else localStorage.setItem(draftKey(userId), JSON.stringify(m));
  } catch { /* storage full or blocked: the form still works, it just won't survive a reload */ }
}

export function clearEmbedDraft(userId?: string) {
  try { localStorage.removeItem(draftKey(userId)); } catch { /* storage blocked */ }
}

/** The first number in a file name ("03 - Bloodline.mp3" → 3), or Infinity when there isn't one. */
export function fileNumber(name: string): number {
  const m = /\d+/.exec(name.replace(/\.[a-z0-9]+$/i, ""));
  return m ? Number(m[0]) : Infinity;
}

/** Album order: track number in the tags, then the number in the file name, then the name. */
export function orderFiles<T extends { name: string }>(files: T[], tagTrack: (f: T) => number): T[] {
  return files
    .map((f) => ({ f, tag: tagTrack(f), num: fileNumber(f.name) }))
    .sort((a, b) => a.tag - b.tag || a.num - b.num || a.f.name.localeCompare(b.f.name, undefined, { numeric: true }))
    .map((x) => x.f);
}

/** Reads the track number from an MP3's tags (the first megabyte holds the text frames), or Infinity. */
async function tagTrack(file: File): Promise<number> {
  if (!/\.mp3$/i.test(file.name)) return Infinity; // WAV tags sit at the end of large files; the file name decides.
  try {
    const n = Number(readMetadata(await file.slice(0, 1024 * 1024).arrayBuffer()).trackNumber);
    return n > 0 ? n : Infinity;
  } catch { return Infinity; }
}

/** Sorts dropped audio files into album order, first song first. */
export async function orderAudioFiles(files: File[]): Promise<File[]> {
  if (files.length < 2) return files;
  const tags = new Map(await Promise.all(files.map(async (f) => [f, await tagTrack(f)] as const)));
  return orderFiles(files, (f) => tags.get(f) ?? Infinity);
}
