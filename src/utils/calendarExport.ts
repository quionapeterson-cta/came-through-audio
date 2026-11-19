/**
 * Calendar export (founder spec, 2026-11-19): one client-side module builds both a real RFC-5545 file with two
 * VALARM reminders and a pre-filled Google Calendar link. No OAuth, no server, no stored calendar token.
 */

import type { CalendarTarget, WorkspaceReminder } from "@/lib/workspace-reminders";
import { reminderDueAt } from "@/lib/workspace-reminders";

export const CALENDAR_EVENT_PREFIX = "💎 Came Through Audio: ";
const EVENT_MINUTES = 30;

function absoluteUrl(reminder: WorkspaceReminder, origin: string): string {
  if (/^https?:\/\//i.test(reminder.href)) return reminder.href;
  const base = origin || (typeof window !== "undefined" ? window.location.origin : "");
  if (!base) return reminder.href;
  try {
    return new URL(reminder.href, base).toString();
  } catch {
    return reminder.href;
  }
}

export function calendarTitle(reminder: WorkspaceReminder): string {
  return `${CALENDAR_EVENT_PREFIX}${reminder.title}`;
}

export function calendarDetails(reminder: WorkspaceReminder, origin: string): string {
  return [
    reminder.note,
    `Open in your Came Through Audio workspace: ${absoluteUrl(reminder, origin)}`,
    "Scheduled from your CTA workspace. It sits in the workspace strip until you open, snooze or complete it.",
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function calendarWindow(reminder: WorkspaceReminder): { start: Date; end: Date } {
  const start = new Date(reminderDueAt(reminder));
  if (Number.isNaN(start.getTime())) return { start: new Date(), end: new Date(Date.now() + EVENT_MINUTES * 60_000) };
  return { start, end: new Date(start.getTime() + EVENT_MINUTES * 60_000) };
}

export function icsDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

/** RFC 5545 text escapes: backslash first, then the separators, and a newline becomes a literal \n. */
export function escapeIcs(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/** Fold at 73 UTF-8 octets, continuing on a line that starts with one space. */
export function foldLine(line: string): string {
  const chunks: string[] = [];
  let current = "";
  let bytes = 0;
  for (const char of Array.from(line)) {
    const size = new TextEncoder().encode(char).length;
    if (bytes + size > 73 && current) {
      chunks.push(current);
      current = " ";
      bytes = 1;
    }
    current += char;
    bytes += size;
  }
  chunks.push(current);
  return chunks.join("\r\n");
}

export function buildReminderIcs(reminder: WorkspaceReminder, origin: string, now = new Date()): string {
  const { start, end } = calendarWindow(reminder);
  const title = escapeIcs(calendarTitle(reminder));
  const description = escapeIcs(calendarDetails(reminder, origin));
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Came Through Audio//Workspace Reminders//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${escapeIcs(reminder.id)}@camethroughaudio.com`,
    `DTSTAMP:${icsDate(now)}`,
    `DTSTART:${icsDate(start)}`,
    `DTEND:${icsDate(end)}`,
    `SUMMARY:${title}`,
    `DESCRIPTION:${description}`,
    `URL:${escapeIcs(absoluteUrl(reminder, origin))}`,
    "STATUS:CONFIRMED",
    "BEGIN:VALARM",
    "TRIGGER:-PT15M",
    "ACTION:DISPLAY",
    `DESCRIPTION:${title}`,
    "END:VALARM",
    "BEGIN:VALARM",
    "TRIGGER:PT0M",
    "ACTION:DISPLAY",
    `DESCRIPTION:${title}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return `${lines.map(foldLine).join("\r\n")}\r\n`;
}

export function googleCalendarUrl(reminder: WorkspaceReminder, origin: string): string {
  const { start, end } = calendarWindow(reminder);
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: calendarTitle(reminder),
    dates: `${icsDate(start)}/${icsDate(end)}`,
    details: calendarDetails(reminder, origin),
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function safeFileName(title: string): string {
  return (title.trim() || "CTA reminder").replace(/[^\w\s-]/g, "").replace(/\s+/g, " ").slice(0, 60) || "CTA reminder";
}

export function downloadReminderIcs(reminder: WorkspaceReminder, origin: string): void {
  const blob = new Blob([buildReminderIcs(reminder, origin)], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = Object.assign(document.createElement("a"), {
    href: url,
    download: `${safeFileName(reminder.title)}.ics`,
  });
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function openGoogleCalendar(reminder: WorkspaceReminder, origin: string): void {
  window.open(googleCalendarUrl(reminder, origin), "_blank", "noopener,noreferrer");
}

/** The one call a component makes after scheduling or from the scheduled pill. */
export function exportReminderToCalendar(
  reminder: WorkspaceReminder,
  target: CalendarTarget,
  origin = typeof window !== "undefined" ? window.location.origin : "",
): void {
  if (target === "google") openGoogleCalendar(reminder, origin);
  else downloadReminderIcs(reminder, origin);
}
