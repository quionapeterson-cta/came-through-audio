import type { CatalogTrack } from "@/lib/catalog";
import { emptyMetadata, type Metadata } from "@/lib/metadata";
import { isUnreleased } from "@/lib/release-checklist";

/**
 * The producer's beat path (PLAN-releases-and-roles §4.5).
 *
 * `beatState` is the only new answer on the beat: blank means "not a beat" and every song saved before this behaves
 * exactly as it did. The link lives on the master (`beatMasterId` points at the beat), is written one way, and is read
 * back by scanning the catalog, so nothing can dangle.
 */
export const DEAL_TYPES = ["Exclusive", "Non-exclusive", "Lease", "Other"] as const;

export const isBeat = (m: Pick<Metadata, "beatState">): boolean => m.beatState !== "";
export const isSoldBeat = (m: Pick<Metadata, "beatState">): boolean => m.beatState === "sold";

/** The song made from this beat, found through the master's own link. */
export function masterOfBeat(beatId: string, tracks: CatalogTrack[]): CatalogTrack | undefined {
  if (!beatId) return undefined;
  return tracks.find((t) => t.metadata.beatMasterId.trim() === beatId);
}

/** The deal, as a card shows it: `Exclusive · 2026-11-09 · 50000 streams · contract`. */
function dealLine(deal: Pick<Metadata, "dealType" | "dealDate" | "dealStreams" | "dealContract">): string[] {
  return [deal.dealType, deal.dealDate, deal.dealStreams && `${deal.dealStreams} streams`, deal.dealContract && "contract"].filter((v): v is string => !!v);
}

/** The beat's card: `Sold · master: Gold Teeth · Exclusive · contract`. */
export function beatMasterLine(master?: CatalogTrack): string {
  return master
    ? ["Sold", `master: ${master.title || "Untitled"}`, ...dealLine(master.metadata)].join(" · ")
    : "Sold · no master linked yet";
}

/** The master's card: `From Beat 12 · Exclusive · 2026-11-09 · 50000 streams · contract`. */
export function masterBeatLine(beatTitle: string, deal: Pick<Metadata, "dealType" | "dealDate" | "dealStreams" | "dealContract">): string {
  return [`From ${beatTitle || "a beat"}`, ...dealLine(deal)].join(" · ");
}

/**
 * What "Create the master recording" opens: a separate entry for the song made from this beat. The buyer performs it,
 * the beat's writer credits come across as a starting point, and the release fields, ISRC and artwork stay blank
 * because the artist's release brings those.
 */
export function masterFromBeat(beat: Metadata, beatId: string): Metadata {
  return {
    ...emptyMetadata(),
    writers: beat.writers.map((w) => ({ ...w })),
    instrumental: false,
    beatMasterId: beatId,
  };
}

/**
 * Decision 16: a sold beat waits in Unreleased until the song made from it is out. Then it is sold *and* out, and leaves
 * the section. With no master linked, or a master still waiting, it keeps waiting: selling a beat does not release it.
 */
export function beatIsOut(beat: CatalogTrack, tracks: CatalogTrack[], on?: string): boolean {
  if (!isSoldBeat(beat.metadata)) return false;
  const master = masterOfBeat(beat.id, tracks);
  return !!master && !isUnreleased(master.metadata, on);
}
