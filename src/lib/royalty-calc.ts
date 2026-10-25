import { creditName, type Metadata } from "@/lib/metadata";
import { publisherPie } from "@/lib/readiness";

/**
 * Royalty Utility Suite math (PLAN-master-notes 3.4). Catalog splits are entered the way the song is owned: writer splits
 * add up to 100% of the writer half, publisher shares (the publisher pie) to 100% of the publisher half. Each US PRO
 * asks for them on its own scale:
 * - BMI: 200% in all, 100% for writers plus 100% for publishers, so a share is entered as is.
 * - ASCAP and SESAC: 100% in all, writers and publishers 50/50, so a share is entered at half.
 */
export const PRO_SCALES = {
  bmi: { name: "BMI", total: 200, factor: 1 },
  ascap: { name: "ASCAP", total: 100, factor: 0.5 },
  sesac: { name: "SESAC", total: 100, factor: 0.5 },
} as const;
export type ProScale = keyof typeof PRO_SCALES;

/** One share moved between PRO scales, e.g. 100% at BMI is 50% at ASCAP. */
export const convertBetween = (value: number, from: ProScale, to: ProScale) => (value / PRO_SCALES[from].factor) * PRO_SCALES[to].factor;

export type ShareRow = { label: string; half: "Writer" | "Publisher"; catalog: number; field: string };
/** A song's writer and publisher shares as the catalog holds them (each half out of 100%). */
export function songShareRows(m: Pick<Metadata, "writers" | "composers" | "publishers" | "selfPublished" | "bmiWriterPublishing">): ShareRow[] {
  const writers = [...m.writers.map((w, i) => ({ w, field: `writers-${i}-share` })), ...m.composers.map((w, i) => ({ w, field: `composers-${i}-share` }))]
    .filter(({ w }) => creditName(w))
    .map(({ w, field }) => ({ label: creditName(w), half: "Writer" as const, catalog: Number(w.percentage) || 0, field }));
  const publishers = publisherPie(m).parts.map((p) => ({ label: p.label, half: "Publisher" as const, catalog: p.share, field: p.field }));
  return [...writers, ...publishers];
}

/**
 * Published average payouts per stream (USD, paid to all rights holders together): the middle of each 2025 range in
 * the cited source. Platforms with no published average start at 0 so nobody mistakes a guess for a rate; every
 * rate is editable. Real rates vary by country, subscription tier and deal.
 */
export const RATE_SOURCES = {
  re: { label: "Royalty Exchange (2025)", url: "https://royaltyexchange.com/blog/how-music-streaming-platforms-calculate-payouts-per-stream-2025" },
  isrc: { label: "ISRC.com (2025)", url: "https://isrc.com/how-much-streaming-services-pay-artists-per-play-2025.php" },
} as const;
export const PLATFORMS: { id: string; name: string; rate: number; source?: keyof typeof RATE_SOURCES; note?: string }[] = [
  { id: "spotify", name: "Spotify", rate: 0.004, source: "re", note: "Tracks need 1,000 streams in 12 months to pay." },
  { id: "apple", name: "Apple Music", rate: 0.0085, source: "re" },
  { id: "amazon", name: "Amazon Music", rate: 0.004, source: "re", note: "Unlimited pays more than Prime." },
  { id: "youtube_music", name: "YouTube Music", rate: 0.0015, source: "re" },
  { id: "tidal", name: "TIDAL", rate: 0.014, source: "re" },
  { id: "deezer", name: "Deezer", rate: 0.006, source: "re" },
  { id: "pandora", name: "Pandora", rate: 0.00133, source: "isrc" },
  { id: "youtube", name: "YouTube (videos)", rate: 0, note: "No published per-stream average. Enter your own." },
  { id: "soundcloud", name: "SoundCloud", rate: 0, note: "No published per-stream average. Enter your own." },
  { id: "audiomack", name: "Audiomack", rate: 0, note: "No published per-stream average. Enter your own." },
  { id: "tiktok", name: "TikTok", rate: 0, note: "Paid per video use, not per stream. Enter your own." },
  { id: "meta", name: "Instagram / Facebook", rate: 0, note: "Paid per video use, not per stream. Enter your own." },
];

/**
 * Roughly how a streaming payout splits between the recording and the song: about 80% to the master side, 20% to
 * the songwriting side (performance plus mechanical). A planning rule of thumb, shown to users as such.
 */
export const MASTER_PORTION = 0.8;

export type EarningsInput = { streams: Record<string, number>; rates: Record<string, number>; masterShare: number; songShare: number; radioPlays: number; perPlay: number };
export function estimateEarnings(i: EarningsInput) {
  const yourCut = (MASTER_PORTION * i.masterShare + (1 - MASTER_PORTION) * i.songShare) / 100;
  const platforms = PLATFORMS.map((p) => {
    const total = (i.streams[p.id] ?? 0) * (i.rates[p.id] ?? p.rate);
    return { id: p.id, name: p.name, total, yours: total * yourCut };
  });
  // Radio, satellite (SiriusXM) and live plays are performance royalties: the song side only.
  const radio = i.radioPlays * i.perPlay * (i.songShare / 100);
  const yours = platforms.reduce((n, p) => n + p.yours, 0) + radio;
  return { platforms, radio, yours };
}

/** Your part of a song: your writer split and your publisher share, averaged (each is half of the song). */
export function yourSongShare(rows: ShareRow[], names: string[]) {
  const mine = (half: ShareRow["half"]) => rows.filter((r) => r.half === half && names.some((n) => r.label.toLowerCase().startsWith(n.toLowerCase()))).reduce((n, r) => n + r.catalog, 0);
  return (mine("Writer") + mine("Publisher")) / 2;
}
