import type { MissingItem } from "@/lib/readiness";
import { MASTER_PORTION } from "@/lib/royalty-calc";

/**
 * The Financial Lab's royalty pipeline and recoupment maths.
 *
 * The pipeline takes the stream pool the Lab already forecasts and shows where it goes before it reaches the member: the
 * recording (paid by the distributor), the performance side (their PRO) and the mechanical side (The MLC). It reuses
 * MASTER_PORTION, because the Lab already teaches that rule of thumb, and reads the song half as half performance and
 * half mechanical rather than inventing a second split.
 */
export const MASTER_POOL_SHARE = MASTER_PORTION;
export const SONG_POOL_SHARE = 1 - MASTER_PORTION;
export const PIPELINE_SHARES = {
  master: MASTER_POOL_SHARE,
  pro: SONG_POOL_SHARE / 2,
  mlc: SONG_POOL_SHARE / 2,
} as const;
export type PipelineBucketId = keyof typeof PIPELINE_SHARES;

/**
 * SoundExchange's own published rates, not a per-stream average from a blog (founder, 2026-11-23). A "performance" is
 * one listener hearing one recording: Pandora radio and webcasts are licensed by the statutory rate, which is separate
 * from an on-demand Spotify or Apple Music stream. Satellite radio such as SiriusXM is deliberately not here, because
 * it pays a percentage of its revenue rather than a per-play rate. The 2026 commercial-webcaster memo keeps the 2025
 * figures while the Copyright Royalty Judges finish the 2026-2030 determination, so these are the rates
 * SoundExchange itself says a service pays today.
 */
export const SOUNDEXCHANGE = {
  source: {
    label: "SoundExchange commercial webcaster rates (2026)",
    url: "https://www.soundexchange.com/service-provider/commercial-webcaster",
  },
  services: [
    { id: "nonsubscription", label: "Pandora / webcast (non-subscription)", rate: 0.0025 },
    { id: "subscription", label: "Subscription radio", rate: 0.0032 },
  ],
  /**
   * 17 U.S.C. §114(g)(2): 50% to the recording's copyright owner, 45% to the featured artist, 2.5% each to the
   * non-featured musicians' and vocalists' funds. The two shares are different money: the master share only reaches the
   * owner half, because the 45% is paid for being the voice on the record, not for owning it. The 5% is administered
   * for session players and singers rather than paid to the artist.
   */
  ownerShare: 0.5,
  featuredShare: 0.45,
  nonFeaturedShare: 0.05,
} as const;
export type SoundExchangeServiceId = (typeof SOUNDEXCHANGE.services)[number]["id"];

const clampPercent = (value: number) =>
  Math.min(100, Math.max(0, Number.isFinite(value) ? value : 0)) / 100;

/**
 * Whole units only: 0.0000001 of float noise must never ask for an extra stream or shirt, and nothing owed is a plain
 * zero rather than the -0 that `Math.ceil(-0.000000001)` would leave behind.
 */
const wholeUp = (value: number) => (value > 0 ? Math.ceil(value - 1e-9) : 0);

export type PipelineBucket = {
  id: PipelineBucketId;
  /** The share of the pool this bucket holds, e.g. 0.8 for the master. */
  share: number;
  /** The money in the bucket, owed to everyone on that side together. */
  pool: number;
  /** The member's part of that bucket. */
  yours: number;
};

export function pipelineBuckets(input: {
  pool: number;
  masterShare: number;
  songShare: number;
}): PipelineBucket[] {
  const pool = Math.max(0, Number.isFinite(input.pool) ? input.pool : 0);
  const master = clampPercent(input.masterShare);
  const song = clampPercent(input.songShare);
  return [
    {
      id: "master",
      share: PIPELINE_SHARES.master,
      pool: pool * PIPELINE_SHARES.master,
      yours: pool * PIPELINE_SHARES.master * master,
    },
    {
      id: "pro",
      share: PIPELINE_SHARES.pro,
      pool: pool * PIPELINE_SHARES.pro,
      yours: pool * PIPELINE_SHARES.pro * song,
    },
    {
      id: "mlc",
      share: PIPELINE_SHARES.mlc,
      pool: pool * PIPELINE_SHARES.mlc,
      yours: pool * PIPELINE_SHARES.mlc * song,
    },
  ];
}

/**
 * The non-interactive master row: what the plays pay, and the member's part of it. Only the recording-owner half
 * follows the master share; the featured-artist half belongs to whoever sang the record, so a featured artist keeps it
 * in full and a producer who only owns part of the master does not.
 */
export function soundExchangeMath(input: {
  plays: number;
  rate: number;
  masterShare: number;
  /** The member sang the record, so they keep the featured-artist share as well as the owner share they own. */
  featuredArtist?: boolean;
}) {
  const plays = Math.max(0, Number.isFinite(input.plays) ? input.plays : 0);
  const rate = Math.max(0, Number.isFinite(input.rate) ? input.rate : 0);
  const gross = plays * rate;
  const owner = SOUNDEXCHANGE.ownerShare * clampPercent(input.masterShare);
  const share = (input.featuredArtist ?? true) ? owner + SOUNDEXCHANGE.featuredShare : owner;
  return { plays, rate, gross, share, yours: gross * share };
}

export type PipelineStageKind = "empty" | "waiting" | "mismatch" | "collected";
export type PipelineStage = { kind: PipelineStageKind; label: string; note: string };

/**
 * What a bucket's money is doing, read from the member's own answer plus the shared registration check:
 * - empty: nothing has landed there yet.
 * - waiting: money is being collected but the member is not registered, so it is black box until they are.
 * - mismatch: they marked it registered, yet the catalog still misses something the agency needs — so either the filing
 *   or the catalog has to change before the money can be matched to them.
 * - collected: registered and every requirement met.
 */
export function pipelineState(input: {
  agency: string;
  pool: number;
  registered: boolean;
  gaps: MissingItem[];
}): PipelineStage {
  const gap = input.gaps[0];
  if (!(input.pool > 0))
    return { kind: "empty", label: "Nothing yet", note: "No money has landed in this bucket yet." };
  if (!input.registered)
    return {
      kind: "waiting",
      label: "Black box",
      note: gap
        ? `Held until this is fixed: ${gap.message}`
        : `Register with ${input.agency} so it can reach you.`,
    };
  if (gap)
    return {
      kind: "mismatch",
      label: "Fix registration",
      note: `Marked registered, but the catalog still needs: ${gap.message}`,
    };
  return {
    kind: "collected",
    label: "Collected",
    note: `${input.agency} can match this money to you.`,
  };
}

export type RecoupmentTargets = {
  /** Streams that return the whole project cost at this platform's rate and the member's own cut. */
  spotify: number | null;
  apple: number | null;
  /** Units that return the cost at the merch calculator's margin; null when there is no margin yet. */
  merch: number | null;
};

/**
 * The reverse of the earnings forecast: a project cost over what one stream (or one shirt) actually pays the member. It
 * uses the Lab's own editable rates and combined stream cut, so changing a rate above moves these targets.
 */
export function recoupmentTargets(input: {
  cost: number;
  streamCut: number;
  spotifyRate: number;
  appleRate: number;
  merchProfit: number;
}): RecoupmentTargets {
  const cost = Math.max(0, Number.isFinite(input.cost) ? input.cost : 0);
  const cut = clampPercent(input.streamCut);
  const streams = (rate: number) => {
    const per = Math.max(0, Number.isFinite(rate) ? rate : 0) * cut;
    return per > 0 ? wholeUp(cost / per) : null;
  };
  const margin = Number.isFinite(input.merchProfit) ? input.merchProfit : 0;
  return {
    spotify: streams(input.spotifyRate),
    apple: streams(input.appleRate),
    merch: margin > 0 ? wholeUp(cost / margin) : null,
  };
}
