import type { Metadata } from "@/lib/metadata";
import { proAccountGaps, registrationReadiness } from "@/lib/readiness";
import { isExternal } from "@/lib/roles";

/**
 * Pre-distribution health (PLAN-pre-distribution, approved 2026-10-25): a song that isn't out yet is read against what
 * to have ready before distributing, not marked down for things only a released song can have. Writer, role, legal
 * name, PRO and split items come from the shared readiness module, never re-checked here.
 */

const today = () => new Date().toISOString().slice(0, 10);

/** Not released yet: its release date is in the future, or "This song isn't released yet" is ticked. */
export function isUnreleased(m: Pick<Metadata, "releaseDate" | "unreleased">, on = today()): boolean {
  if (m.releaseDate) return m.releaseDate > on;
  return !!m.unreleased;
}

/** Saved checklist ticks for the release items people tick themselves. */
export const RELEASE_TICK = { split: "release:split", upc: "release:upc", ai: "release:ai", beatContract: "release:beatContract" } as const;

export type ReleaseItem = {
  id: string;
  title: string;
  done: boolean;
  /** Ticks itself from the song's details (no checkbox). */
  auto: boolean;
  /** Not counted in the % (AI Protection is optional). */
  optional?: boolean;
  /** A tick the person sets (saved under this checklist key). */
  tick?: string | undefined;
  field?: string | undefined;
  items?: { text: string; field?: string | undefined }[];
  why: string;
};

/**
 * Items 1–8 and the optional AI Protection certificate. Items 9–10 (registered with the PRO and the mechanical
 * society) are the song's existing Register steps, counted alongside these (songChecklist).
 */
export function releaseItems(m: Metadata, ticks: Record<string, string | undefined>, linkedMaster = false): ReleaseItem[] {
  // A beat (§4.5) is read on what a producer can honestly have. The recording's ISRC, UPC, master, artwork and
  // SoundExchange step belong to the artist's release of the song made from it, not to the beat itself.
  if (m.beatState) {
    const beatCore = registrationReadiness(m);
    const gapList = (items: { message: string; field: string }[]) => items.map((i) => ({ text: i.message, field: i.field }));
    const people = beatCore.missing.filter((i) => i.code !== "pro");
    // Sold: the song made from it now exists somewhere, and these three are what the producer still owes the sale.
    if (m.beatState === "sold") return [
      { id: "splitSheet", title: "Split sheet signed", auto: false, tick: RELEASE_TICK.split, done: !!ticks[RELEASE_TICK.split] || ticks["checkin:split"] === "yes",
        why: "A signed split sheet settles who owns what after the sale." },
      { id: "beatContract", title: "Beat contract signed", auto: false, tick: RELEASE_TICK.beatContract, done: !!ticks[RELEASE_TICK.beatContract],
        why: "It records what the artist may do with the beat, and what you're owed." },
      { id: "linkedMaster", title: "Linked to the master recording", auto: true, done: linkedMaster,
        why: "The song made from the beat is its own entry, so the deal, the credit and the money can be followed." },
    ];
    return [
      { id: "writers", title: "Composer and writer credits", auto: true, done: !people.length, items: gapList(people), field: people[0]?.field,
        why: "The artist's registration lists you under your legal name, so your PRO and The MLC can pay you." },
      { id: "splits", title: "Splits settled", auto: true, done: !beatCore.warnings.length, items: gapList(beatCore.warnings), field: beatCore.warnings[0]?.field,
        why: "Everyone's share must add up to exactly 100% before the beat brings money in." },
      { id: "splitSheet", title: "Split sheet signed", auto: false, tick: RELEASE_TICK.split, done: !!ticks[RELEASE_TICK.split] || ticks["checkin:split"] === "yes",
        why: "A signed split sheet settles who owns what after the sale." },
      { id: "beatContract", title: "Beat contract signed", auto: false, tick: RELEASE_TICK.beatContract, done: !!ticks[RELEASE_TICK.beatContract],
        why: "It records what the artist may do with the beat, and what you're owed." },
    ];
  }
  const core = registrationReadiness(m);
  const people = core.missing.filter((i) => i.code !== "pro");
  // The item is titled "PRO and IPI for each writer", so it waits for both (founder, 2026-11-13): it used to tick
  // once each writer named a PRO, while the IPI it also asks for could still be blank.
  const proGaps = proAccountGaps(m);
  const splitGaps = core.warnings;
  const list = (items: { message: string; field: string }[]) => items.map((i) => ({ text: i.message, field: i.field }));
  const has = (v: string) => !!v.trim();
  const items: ReleaseItem[] = [
    { id: "writers", title: "Writers and roles", auto: true, done: !people.length, items: list(people), field: people[0]?.field,
      why: "Registrations and split sheets need every writer's legal name and role." },
    { id: "splits", title: "Splits settled", auto: true, done: !splitGaps.length, items: list(splitGaps), field: splitGaps[0]?.field,
      why: "Agencies reject splits that don't add up to exactly 100%." },
    { id: "splitSheet", title: "Split sheet signed", auto: false, tick: RELEASE_TICK.split, done: !!ticks[RELEASE_TICK.split] || ticks["checkin:split"] === "yes",
      why: "A signed split sheet settles ownership before any money arrives." },
    { id: "pro", title: "PRO and IPI for each writer", auto: true, done: !proGaps.length, items: list(proGaps), field: proGaps[0]?.field,
      why: "Your PRO matches plays to you by your affiliation and IPI number." },
    { id: "isrc", title: "ISRC", auto: true, done: has(m.isrc), field: "isrc",
      why: "Stores match the recording by its ISRC; your distributor asks for it or assigns one." },
    { id: "upc", title: "UPC (or your distributor assigns it)", auto: false, tick: RELEASE_TICK.upc, done: has(m.upc) || !!ticks[RELEASE_TICK.upc], field: "upc",
      why: "The release itself needs a UPC. Tick this if your distributor will assign one." },
    { id: "master", title: "Master embedded and stored", auto: true, done: has(m.audioPath), field: "audio",
      why: "Every copy you send carries your credits." },
    { id: "art", title: m.instrumental ? "Artwork" : "Artwork and lyrics", auto: true, done: has(m.artPath) && (m.instrumental || has(m.lyrics)), field: has(m.artPath) ? "lyrics" : "artwork",
      why: "Stores and lyric sites ask for them at upload." },
    { id: "ai", title: "AI Protection certificate (optional)", auto: false, optional: true, tick: RELEASE_TICK.ai, done: !!ticks[RELEASE_TICK.ai],
      why: "Proof of creation dated before the song is public." },
  ];
  // Someone else performs it: the ISRC, UPC, master and artwork come with their release (§10). The lyrics stay, because
  // they are the composition's, not the recording's.
  if (!isExternal(m)) return items;
  return items.flatMap((i) => i.id === "art"
    ? [{ ...i, id: "lyrics", title: "Lyrics", field: "lyrics", done: has(m.lyrics) || m.instrumental, why: "Lyric sites and your PRO registration ask for the words." }]
    : ["isrc", "upc", "master"].includes(i.id) ? [] : [i]);
}

/** Share of required release items done (0–100), counting any extra required steps passed in (the PRO/MLC registrations). */
export function releasePct(items: { done: boolean; optional?: boolean | undefined }[]): number {
  const req = items.filter((i) => !i.optional);
  return req.length ? Math.round((req.filter((i) => i.done).length / req.length) * 100) : 0;
}
