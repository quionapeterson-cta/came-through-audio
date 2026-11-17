/**
 * The company's clock (founder, 2026-11-17): Came Through Audio keeps Eastern time. A document printed on the server was
 * reading the day in UTC, so a signature given at 7:28 pm on the 16th printed as "17 November 2026". Anything a document
 * or an audit line stamps keeps Eastern time; screens still convert to the reader's own zone.
 *
 * The zone is named, never assumed from the machine: the browser a member prints from may sit anywhere, and a Worker
 * always sits in UTC, but the paper we issue should read the same wherever it is printed.
 */
export const EASTERN_TIME_ZONE = "America/New_York";

/** "16 November 2026" — the Eastern day, in the long form our signed documents print. */
export function easternDay(iso: string | Date): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: EASTERN_TIME_ZONE,
  });
}

/**
 * "16 November 2026 at 19:28 ET" — the Eastern moment, for a certificate that names exactly when something happened.
 * The zone is written as ET rather than by the platform: the same instant prints as "EST" in one JavaScript engine and
 * "GMT-5" in another, and an executed certificate should read the same wherever it is printed.
 */
export function easternMoment(iso: string | Date): string {
  const moment = new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: EASTERN_TIME_ZONE,
  });
  return `${moment} ET`;
}
