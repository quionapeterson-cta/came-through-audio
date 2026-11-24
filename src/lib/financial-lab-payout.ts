import { MASTER_PORTION } from "@/lib/royalty-calc";

/**
 * When the money for this month's streams lands, by route. Every hold period here is the payer's normal one, not a
 * promise: a distributor pays monthly after its own net-60-to-90 hold, AMP pays on a quarterly-ish cycle after the
 * month closes, and the PROs and SoundExchange pay on their own quarterly calendars. The card says "as early as" for
 * that reason.
 *
 * Amounts are the Lab's own projection split by the bucket that pays it:
 * - the distributor pays the master side of the stream pool, after the member's distributor cut,
 * - the PRO pays the performance half of the song side,
 * - SoundExchange pays the non-interactive plays the member entered.
 */
export type PayoutEntry = {
  id: "distributor" | "audiomack" | "pro" | "soundexchange";
  label: string;
  /** e.g. "as early as Feb 2027". */
  when: string;
  amount: number;
  note: string;
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const label = (month: number, year: number) => `${MONTHS[month]} ${year}`;

/** The month `count` months after `now`, as a label. */
function monthsAfter(now: Date, count: number): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + count, 1));
  return label(d.getUTCMonth(), d.getUTCFullYear());
}

/** The first month of the next PRO quarter: Jan, Apr, Jul or Oct. */
function nextQuarter(now: Date): string {
  const month = now.getUTCMonth();
  const start = Math.floor(month / 3) * 3 + 3;
  const d = new Date(Date.UTC(now.getUTCFullYear(), start, 1));
  return label(d.getUTCMonth(), d.getUTCFullYear());
}

export function payoutTimeline(input: {
  /** The whole stream pool, before the member's cut. */
  pool: number;
  masterShare: number;
  songShare: number;
  /** Distributor cut in percent. */
  distributor: number;
  /** What the member's non-interactive plays are worth. */
  radio: number;
  /** What Audiomack alone is worth to the member, or 0 when they entered nothing there. */
  audiomack: number;
  now?: Date;
}): PayoutEntry[] {
  const now = input.now ?? new Date();
  const pool = Math.max(0, Number.isFinite(input.pool) ? input.pool : 0);
  const master = Math.min(100, Math.max(0, input.masterShare)) / 100;
  const song = Math.min(100, Math.max(0, input.songShare)) / 100;
  const cut = Math.min(100, Math.max(0, input.distributor)) / 100;
  const masterSide = pool * MASTER_PORTION * master * (1 - cut);
  const songSide = pool * (1 - MASTER_PORTION) * song;
  const entries: PayoutEntry[] = [
    {
      id: "distributor",
      label: "Your distributor",
      when: `as early as ${monthsAfter(now, 3)}`,
      amount: masterSide,
      note: "Monthly, after a 60–90 day hold. Spotify, Apple, TIDAL and the rest arrive here.",
    },
  ];
  if (input.audiomack > 0) {
    entries.push({
      id: "audiomack",
      label: "Audiomack AMP",
      when: `as early as ${monthsAfter(now, 4)}`,
      amount: input.audiomack,
      note: "Paid by AMP after the month closes, on a net-90 cycle.",
    });
  }
  entries.push(
    {
      id: "pro",
      label: "Your PRO",
      when: `from ${nextQuarter(now)}`,
      amount: (songSide / 2) * (1 - cut),
      note: "Quarterly, on the PRO's own calendar. Register the work first or the money is black box.",
    },
    {
      id: "soundexchange",
      label: "SoundExchange",
      when: `from ${nextQuarter(now)}`,
      amount: Math.max(0, Number.isFinite(input.radio) ? input.radio : 0),
      note: "Quarterly, for digital radio and non-interactive plays. Needs the recording registered.",
    },
  );
  return entries;
}
