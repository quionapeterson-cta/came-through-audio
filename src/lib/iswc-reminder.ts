/**
 * The reminder a member sets while their ISWC is waiting on their PRO (founder, 2026-11-12): the day to look in the PRO
 * account, offered as a Google Calendar link and as a calendar file for Apple and Outlook. Nothing here talks to a
 * calendar: the member adds the event themselves, so a wrong address or a blocked pop-up can never lose the date — it
 * stays on the song either way.
 */
const DAY = /^\d{4}-\d{2}-\d{2}$/;

export const ISWC_REMINDER_TITLE = "Check your PRO account for the ISWC";

/** The day after, so a whole-day event covers one day in every calendar. */
export function nextDay(day: string): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

export type IswcReminder = { day: string; google: string; ics: string };

/**
 * Both forms of the reminder for one day, or `null` when no real day was picked: a blank or half-typed date must not
 * become an event on the wrong day.
 */
export function iswcReminder(day: string, songTitle: string, origin = ""): IswcReminder | null {
  const picked = (day ?? "").trim();
  if (!DAY.test(picked)) return null;
  const compact = (d: string) => d.replace(/-/g, "");
  const song = songTitle.trim() || "your song";
  const link = (path: string) => (origin ? ` ${origin}${path}` : "");
  const details = `Look for the ISWC on "${song}" in your PRO account, then add it in My Catalog.${link("/workspace")}`;
  const google = `https://calendar.google.com/calendar/render?${new URLSearchParams({
    action: "TEMPLATE",
    text: ISWC_REMINDER_TITLE,
    dates: `${compact(picked)}/${compact(nextDay(picked))}`,
    details,
  })}`;
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Came Through Audio//ISWC reminder//EN",
    "BEGIN:VEVENT",
    `UID:iswc-${compact(picked)}@camethroughaudio.com`,
    `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").slice(0, 15)}Z`,
    `DTSTART;VALUE=DATE:${compact(picked)}`,
    `DTEND;VALUE=DATE:${compact(nextDay(picked))}`,
    `SUMMARY:${ISWC_REMINDER_TITLE}`,
    `DESCRIPTION:${details}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  return { day: picked, google, ics };
}
