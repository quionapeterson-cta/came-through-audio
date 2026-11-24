import { creditName, type Metadata } from "@/lib/metadata";
import { publisherPie } from "@/lib/readiness";

/**
 * The Financial Lab math (PLAN-master-notes 3.4). Catalog splits are entered the way the song is owned: writer splits
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
export const convertBetween = (value: number, from: ProScale, to: ProScale) =>
  (value / PRO_SCALES[from].factor) * PRO_SCALES[to].factor;

export type ShareRow = {
  label: string;
  half: "Writer" | "Publisher";
  catalog: number;
  field: string;
};
/** A song's writer and publisher shares as the catalog holds them (each half out of 100%). */
export function songShareRows(
  m: Pick<
    Metadata,
    "writers" | "composers" | "publishers" | "selfPublished" | "bmiWriterPublishing"
  >,
): ShareRow[] {
  const writers = [
    ...m.writers.map((w, i) => ({ w, field: `writers-${i}-share` })),
    ...m.composers.map((w, i) => ({ w, field: `composers-${i}-share` })),
  ]
    .filter(({ w }) => creditName(w))
    .map(({ w, field }) => ({
      label: creditName(w),
      half: "Writer" as const,
      catalog: Number(w.percentage) || 0,
      field,
    }));
  const publishers = publisherPie(m).parts.map((p) => ({
    label: p.label,
    half: "Publisher" as const,
    catalog: p.share,
    field: p.field,
  }));
  return [...writers, ...publishers];
}

/**
 * Published average payouts per stream (USD, paid to all rights holders together), checked against each source in
 * 2026. No interactive service publishes a fixed per-stream rate: each pools its revenue and splits it by share of
 * streams, so these are the averages the cited pages report and every rate is editable. Audiomack publishes only its
 * 50% revenue share, so its default sits inside the published estimate range and the member can replace it with their
 * own statement totals. A platform that pays per video use rather than per stream (TikTok, Instagram/Facebook)
 * starts at 0, because a per-stream figure there would be the wrong unit. Real rates vary by country, tier and deal.
 */
export const RATE_SOURCES = {
  re: {
    label: "Royalty Exchange (2026)",
    url: "https://royaltyexchange.com/blog/how-much-do-streaming-platforms-pay-per-stream",
  },
  isrc: {
    label: "ISRC.com (2025)",
    url: "https://isrc.com/how-much-streaming-services-pay-artists-per-play-2025.php",
  },
  contentId: {
    label: "RouteNote (2025)",
    url: "https://routenote.com/blog/how-much-music-streaming-services-pay/",
  },
  soundcloud: {
    label: "SoundCloud payout comparison (2026)",
    url: "https://soundcloud.com/topic/category/which-music-streaming-service-pays-artists-the-most",
  },
  audiomack: {
    label: "Artist Payout estimate (2025)",
    url: "https://artistpayout.com/streaming-royalty-calculator/audiomack",
  },
} as const;
export const PLATFORMS: {
  id: string;
  name: string;
  rate: number;
  source?: keyof typeof RATE_SOURCES;
  note?: string;
}[] = [
  {
    id: "spotify",
    name: "Spotify",
    rate: 0.004,
    source: "re",
    note: "Tracks need 1,000 streams in 12 months to pay.",
  },
  { id: "apple", name: "Apple Music", rate: 0.0085, source: "re" },
  {
    id: "amazon",
    name: "Amazon Music",
    rate: 0.004,
    source: "re",
    note: "Unlimited pays more than Prime.",
  },
  { id: "youtube_music", name: "YouTube Music", rate: 0.0015, source: "re" },
  { id: "tidal", name: "TIDAL", rate: 0.014, source: "re" },
  { id: "deezer", name: "Deezer", rate: 0.006, source: "re" },
  { id: "pandora", name: "Pandora", rate: 0.00133, source: "isrc" },
  {
    id: "youtube",
    name: "YouTube (videos)",
    rate: 0.00087,
    source: "contentId",
    note: "Content ID pays per video that uses your music, not per music stream.",
  },
  {
    id: "soundcloud",
    name: "SoundCloud",
    rate: 0.003,
    source: "soundcloud",
    note: "Fan-powered royalties: about $0.0025–$0.004 a stream.",
  },
  {
    id: "audiomack",
    name: "Audiomack",
    rate: 0.004,
    source: "audiomack",
    note: "Audiomack publishes only its 50% revenue share, no per-stream rate. The cited estimate runs $0.0010–$0.0050; this opens on $0.004, inside that range.",
  },
  {
    id: "tiktok",
    name: "TikTok",
    rate: 0,
    note: "No per-stream rate: paid per video that uses your music. Enter your own.",
  },
  {
    id: "meta",
    name: "Instagram / Facebook",
    rate: 0,
    note: "No per-stream rate: paid per video that uses your music. Enter your own.",
  },
];

/**
 * The platforms whose own cited pages publish a range rather than one average. A rate typed outside that range is far
 * more likely to be a decimal slip than a discovery, so the calculator says so beside the box.
 */
export const PUBLISHED_RANGES: Record<string, { low: number; high: number; label: string }> = {
  audiomack: { low: 0.001, high: 0.005, label: "$0.0010–$0.0050" },
  soundcloud: { low: 0.0025, high: 0.004, label: "$0.0025–$0.004" },
};

export type RateWarning = { message: string; fix?: number };

const usdRate = (n: number) => `$${n.toFixed(n < 0.01 ? 4 : 2)}`;

/**
 * A gentle guard on an edited rate, never a block: a figure outside the published range, or more than ten times the
 * published average, gets a sentence and (where the slip is obvious) the value that was probably meant. A rate of 0 is
 * silent, because the per-video platforms open there.
 */
export function rateWarning(platformId: string, rate: number): RateWarning | null {
  if (!Number.isFinite(rate) || rate <= 0) return null;
  const platform = PLATFORMS.find((p) => p.id === platformId);
  if (!platform) return null;
  const range = PUBLISHED_RANGES[platformId];
  if (range) {
    if (rate >= range.low && rate <= range.high) return null;
    return {
      message: `${platform.name}'s published estimate is ${range.label} a stream. Check the decimal, or keep your own figure if a statement gave it to you.`,
    };
  }
  if (platform.rate <= 0 || rate <= platform.rate * 10) return null;
  // Only offer a fix when the figure is a decimal slip away from the published rate; a genuinely different rate gets
  // the sentence and nothing else.
  const ratio = rate / platform.rate;
  const fix = ratio >= 9 && ratio <= 11 ? platform.rate : undefined;
  return {
    message: `That is more than 10× ${platform.name}'s published average of ${usdRate(platform.rate)} a stream. Check the decimal.`,
    ...(fix ? { fix } : {}),
  };
}

/**
 * How much of a platform's published rate a listener mix is worth, as a factor. The multipliers are a planning
 * assumption, not a published rate: advertising and subscriptions are worth more in some countries than others, which
 * is why a flat per-stream figure is only ever a starting point. Shares are normalized, so a mix that adds to 92% still
 * gives a sensible factor instead of quietly shrinking the estimate.
 */
export const TERRITORY_MULTIPLIERS = { us: 1, uk: 0.85, ng: 0.3, row: 0.55 } as const;
export const TERRITORY_ROWS: { id: keyof typeof TERRITORY_MULTIPLIERS; label: string }[] = [
  { id: "us", label: "United States" },
  { id: "uk", label: "United Kingdom" },
  { id: "ng", label: "Nigeria" },
  { id: "row", label: "Rest of world" },
];

/** The shares a mix is read from: the four regions, with whatever else the caller stores beside them. */
export type TerritoryShareInput = {
  [K in keyof typeof TERRITORY_MULTIPLIERS]?: string | number;
} & {
  on?: boolean;
};

export function territoryShares(shares: TerritoryShareInput): number {
  return TERRITORY_ROWS.reduce((n, row) => n + Math.max(0, Number(shares[row.id]) || 0), 0);
}

export function territoryBlend(shares: TerritoryShareInput): number {
  const total = TERRITORY_ROWS.reduce((n, row) => n + Math.max(0, Number(shares[row.id]) || 0), 0);
  if (total <= 0) return 1;
  const weighted = TERRITORY_ROWS.reduce(
    (n, row) => n + Math.max(0, Number(shares[row.id]) || 0) * TERRITORY_MULTIPLIERS[row.id],
    0,
  );
  return weighted / total;
}

/**
 * A typed count is kept as plain digits, so the maths never has to read a comma, and shown with its thousands
 * separated, so 1250000 reads as 1,250,000. Grouping is done on the string rather than through Number, so a long
 * paste keeps every digit instead of rounding.
 */
export const countDigits = (value: string) => value.replace(/\D/g, "");
export const groupCount = (value: string) => {
  const digits = countDigits(value).replace(/^0+(?=\d)/, "");
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
};

/**
 * A member's own average from two pasted totals: what a platform paid and the streams it paid for. Null until both
 * are positive, so an empty or half-filled statement can never become a rate of zero.
 */
export const rateFromTotals = (paid: number, streams: number): number | null => {
  if (!Number.isFinite(paid) || !Number.isFinite(streams) || paid <= 0 || streams <= 0) return null;
  return paid / streams;
};

/**
 * Roughly how a streaming payout splits between the recording and the song: about 80% to the master side, 20% to
 * the songwriting side (performance plus mechanical). A planning rule of thumb, shown to users as such.
 */
export const MASTER_PORTION = 0.8;

export type EarningsInput = {
  streams: Record<string, number>;
  rates: Record<string, number>;
  masterShare: number;
  songShare: number;
  radioPlays: number;
  perPlay: number;
};
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
  const mine = (half: ShareRow["half"]) =>
    rows
      .filter(
        (r) =>
          r.half === half && names.some((n) => r.label.toLowerCase().startsWith(n.toLowerCase())),
      )
      .reduce((n, r) => n + r.catalog, 0);
  return (mine("Writer") + mine("Publisher")) / 2;
}
