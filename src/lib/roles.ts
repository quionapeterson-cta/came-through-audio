import type { Metadata } from "@/lib/metadata";

/**
 * The six roles a member can hold (founder, 2026-11-09: PLAN-releases-and-roles §4.7), and where they are with releases.
 * Answers only choose what a NEW entry starts from. They never remove, hide or reorder anything an artist already has,
 * and an account with no answers behaves exactly as it did before the question existed.
 */
export const ACCOUNT_ROLES = ["Songwriter", "Recording artist", "Producer", "Label", "Artist manager", "Session musician"] as const;
export type AccountRole = (typeof ACCOUNT_ROLES)[number];

export const SITUATIONS = ["released", "planning", "writer"] as const;
export type Situation = (typeof SITUATIONS)[number];
export const SITUATION_LABEL: Record<Situation, string> = {
  released: "I have songs released",
  planning: "I have no released songs yet, but I'm planning a release",
  writer: "I have songs registered as a writer, but I'm not the performing artist",
};

export type RoleAnswers = { roles?: AccountRole[] | undefined; situations?: Situation[] | undefined; sellBeats?: boolean | undefined };

/** Which side of a song the member is on. Blank is `"own"`: every row saved before this field existed reads as today. */
export type RecordingSide = "" | "own" | "external";
/** Someone else performs it: the recording's ISRC, artwork, UPC and SoundExchange step belong to their release. */
export const isExternal = (m: Pick<Metadata, "recordingSide">) => m.recordingSide === "external";

/** A role that releases music itself: another role may add an option, never take the artist's path away. */
const RELEASING: AccountRole[] = ["Recording artist", "Label"];

/** No answers, or Recording artist among them, keeps today's catalog exactly (founder, 2026-11-09). */
export const picksArtist = (a: RoleAnswers) => !a.roles?.length || a.roles.includes("Recording artist");

/** Songs registered as a writer while someone else performs them, and no release of their own. Ticking only the
 *  situation is enough: the roles are optional, so one answer must never be ignored. */
export const writerOnly = (a: RoleAnswers) => (!!a.roles?.includes("Songwriter") || (a.situations?.length === 1 && a.situations[0] === "writer"))
  && !(a.roles ?? []).some((r) => RELEASING.includes(r))
  && !a.situations?.some((s) => s === "released" || s === "planning");

/** No released songs yet, but planning one: new entries start unreleased so the release checklist comes first. */
export const planningRelease = (a: RoleAnswers) => !!a.situations?.includes("planning") && !a.situations.includes("released");

/** A producer who sells beats, and only then: the beat answers never appear for anyone else (decision 10). */
export const sellsBeats = (a: RoleAnswers) => a.sellBeats === true && !!a.roles?.includes("Producer");

/**
 * What a new catalog entry starts from. Never applied to a song that is already saved: it is a starting point, the way
 * Embed Defaults are.
 */
export function roleDefaults(a: RoleAnswers): { recordingSide: RecordingSide; unreleased: boolean } {
  const external = writerOnly(a);
  return { recordingSide: external ? "external" : "", unreleased: !external && planningRelease(a) };
}

/** A fresh entry with the member's role answers applied to blanks only. */
export function withRoleDefaults(m: Metadata, a: RoleAnswers): Metadata {
  const d = roleDefaults(a);
  return { ...m, recordingSide: m.recordingSide || d.recordingSide, unreleased: m.unreleased || d.unreleased };
}
