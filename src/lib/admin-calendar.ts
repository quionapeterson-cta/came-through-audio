import type { Department, StaffAccess } from "@/lib/departments";
import { DEPARTMENT_LABEL } from "@/lib/departments";
import { escapeIcs, foldLine, icsDate } from "@/utils/calendarExport";

/**
 * Admin calendar views and the personal feed (founder spec, 2026-11-19). The visibility rules here mirror what the
 * database lets each staff member read — private entries are the owner's, department calendars are shared inside the
 * department, a department lead and a Project Manager read every team's — with one deliberate exception: `launch` names
 * hosting, secrets and vendors, so it stays the super admin's alone (founder, 2026-11-18), just as `in_department`
 * refuses it for everyone else.
 *
 * The feed route reads with the service role, so these rules, not RLS, are what keep another department's entries out of
 * a member's calendar. They live here, apart from the route, so they can be tested directly.
 */

export type AdminCalendarView = "month" | "week" | "day" | "agenda";

export const ADMIN_CALENDAR_VIEWS: readonly AdminCalendarView[] = ["month", "week", "day", "agenda"];

export const ADMIN_CALENDAR_VIEW_LABEL: Record<AdminCalendarView, string> = {
  month: "Month",
  week: "Week",
  day: "Day",
  agenda: "Agenda",
};

export interface AdminCalendarEvent {
  id: string;
  owner_id: string;
  department: string | null;
  title: string;
  notes: string;
  starts_at: string;
  ends_at: string | null;
  all_day: boolean;
  updated_at?: string | null;
}

export interface AdminCalendarDeadline {
  id: string;
  department: string;
  title: string;
  due_at: string;
  status?: string | null;
}

export interface AdminCalendarViewer {
  userId: string;
  departments: readonly string[];
  isSuperAdmin: boolean;
  isDepartmentLead: boolean;
  seesAllTeams: boolean;
}

export function calendarViewer(userId: string, access: StaffAccess): AdminCalendarViewer {
  return {
    userId,
    departments: access.departments,
    isSuperAdmin: access.role === "super_admin",
    isDepartmentLead: access.role === "department_lead",
    seesAllTeams: access.allTeams === true,
  };
}

export function canSeeCalendarEvent(event: AdminCalendarEvent, viewer: AdminCalendarViewer): boolean {
  // Your own entry is yours whatever calendar it sits on.
  if (event.owner_id === viewer.userId) return true;
  if (!event.department) return false;
  if (event.department === "launch") return viewer.isSuperAdmin;
  if (viewer.isSuperAdmin || viewer.seesAllTeams || viewer.isDepartmentLead) return true;
  return viewer.departments.includes(event.department);
}

export function canSeeTaskDeadline(task: AdminCalendarDeadline, viewer: AdminCalendarViewer): boolean {
  if (task.department === "launch") return viewer.isSuperAdmin;
  if (viewer.isSuperAdmin || viewer.seesAllTeams) return true;
  // A department lead works their own bank; another department's tasks are not theirs to read.
  return viewer.departments.includes(task.department);
}

export function visibleCalendarEvents(events: AdminCalendarEvent[], viewer: AdminCalendarViewer): AdminCalendarEvent[] {
  return events.filter((event) => canSeeCalendarEvent(event, viewer));
}

export function visibleTaskDeadlines(deadlines: AdminCalendarDeadline[], viewer: AdminCalendarViewer): AdminCalendarDeadline[] {
  return deadlines.filter((task) => canSeeTaskDeadline(task, viewer));
}

/** A subscription is a rolling window, not the month on screen: 30 days back and a year ahead. */
export const FEED_PAST_DAYS = 30;
export const FEED_FUTURE_DAYS = 365;

export function feedWindow(now = new Date()): { from: string; to: string } {
  return {
    from: new Date(now.getTime() - FEED_PAST_DAYS * 86_400_000).toISOString(),
    to: new Date(now.getTime() + FEED_FUTURE_DAYS * 86_400_000).toISOString(),
  };
}

const pad2 = (n: number) => String(n).padStart(2, "0");

/**
 * An all-day entry is a calendar date, not an instant, so it has to be read in the calendar's own time zone. `starts_at`
 * holds local midnight of the day that was picked, which is the previous day in UTC for anyone east of Greenwich (UTC+2
 * midnight is 22:00Z the day before). Reading UTC moved an all-day entry back a day in the feed for every positive
 * offset, so the date is formatted in the subscription's zone instead. No zone, or one Intl refuses, falls back to UTC
 * rather than failing the whole feed.
 */
function zoneParts(iso: string, timeZone?: string): { year: number; month: number; day: number } | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  if (timeZone) {
    try {
      const parts = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
      const part = (type: string) => Number(parts.find((one) => one.type === type)?.value);
      const year = part("year"), month = part("month"), day = part("day");
      if (Number.isFinite(year) && Number.isFinite(month) && Number.isFinite(day)) return { year, month, day };
    } catch {
      // An unknown zone never costs the entry; the UTC fallback below is what it gets.
    }
  }
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() };
}

function dateKey(iso: string, timeZone?: string): string {
  const parts = zoneParts(iso, timeZone);
  return parts ? `${parts.year}${pad2(parts.month)}${pad2(parts.day)}` : "";
}

/** The day after, stepped as a plain date so a daylight-saving change can never move an all-day entry. */
function nextDateKey(iso: string, timeZone?: string): string {
  const parts = zoneParts(iso, timeZone);
  if (!parts) return "";
  const next = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + 1));
  return `${next.getUTCFullYear()}${pad2(next.getUTCMonth() + 1)}${pad2(next.getUTCDate())}`;
}

function validTimeZone(timeZone?: string): string | undefined {
  if (!timeZone) return undefined;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format(new Date());
    return timeZone;
  } catch {
    return undefined;
  }
}

function validIso(value: string | null | undefined): string | null {
  return value && !Number.isNaN(Date.parse(value)) ? new Date(value).toISOString() : null;
}

function departmentName(department: string | null): string {
  if (!department) return "Private";
  return DEPARTMENT_LABEL[department as Department] ?? department;
}

/**
 * The personal feed as one RFC-5545 calendar: the entries the viewer can see plus their open Task Bank deadlines.
 * A finished task is left out — the feed is for what still needs doing — while a finished entry stays, because the
 * calendar itself keeps it on its day.
 */
export function buildCalendarFeedIcs({
  events,
  deadlines,
  now = new Date(),
  origin = "",
  calendarName = "Came Through Audio — Admin Calendar",
  timeZone,
}: {
  events: AdminCalendarEvent[];
  deadlines: AdminCalendarDeadline[];
  now?: Date;
  origin?: string;
  calendarName?: string;
  /** The subscriber's zone, used for every all-day date in the feed. Missing or unknown falls back to UTC. */
  timeZone?: string;
}): string {
  const stamp = icsDate(now);
  const zone = validTimeZone(timeZone);
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Came Through Audio//Admin Calendar Feed//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    ...(zone ? [`X-WR-TIMEZONE:${zone}`] : []),
    `X-WR-CALNAME:${escapeIcs(calendarName)}`,
    "X-WR-CALDESC:Your own entries, your department calendars and the Task Bank deadlines you can see.",
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
    "X-PUBLISHED-TTL:PT1H",
  ];

  for (const event of events) {
    const start = new Date(event.starts_at);
    if (Number.isNaN(start.getTime())) continue;
    const end =
      event.ends_at && !Number.isNaN(Date.parse(event.ends_at)) && Date.parse(event.ends_at) >= start.getTime()
        ? new Date(event.ends_at)
        : new Date(start.getTime() + 3_600_000);
    const details = [
      event.notes,
      `Calendar: ${departmentName(event.department)}`,
      origin ? `Open Admin: ${origin}/admin` : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    lines.push("BEGIN:VEVENT", `UID:calendar-${event.id}@camethroughaudio.com`, `DTSTAMP:${stamp}`);
    if (event.all_day) {
      lines.push(`DTSTART;VALUE=DATE:${dateKey(event.starts_at, zone)}`, `DTEND;VALUE=DATE:${nextDateKey(event.starts_at, zone)}`);
    } else {
      lines.push(`DTSTART:${icsDate(start)}`, `DTEND:${icsDate(end)}`);
    }
    lines.push(`SUMMARY:${escapeIcs(event.title)}`);
    if (details) lines.push(`DESCRIPTION:${escapeIcs(details)}`);
    const modified = validIso(event.updated_at);
    if (modified) lines.push(`LAST-MODIFIED:${icsDate(new Date(modified))}`);
    lines.push("STATUS:CONFIRMED", "TRANSP:OPAQUE", "END:VEVENT");
  }

  for (const task of deadlines) {
    if (task.status === "done") continue;
    if (Number.isNaN(Date.parse(task.due_at))) continue;
    const details = [
      `Task Bank deadline · ${departmentName(task.department)}`,
      origin ? `Open Admin: ${origin}/admin` : "",
    ]
      .filter(Boolean)
      .join("\n\n");
    lines.push(
      "BEGIN:VEVENT",
      `UID:task-${task.id}@camethroughaudio.com`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${dateKey(task.due_at, zone)}`,
      `DTEND;VALUE=DATE:${nextDateKey(task.due_at, zone)}`,
      `SUMMARY:${escapeIcs(`Due: ${task.title}`)}`,
      `DESCRIPTION:${escapeIcs(details)}`,
      "STATUS:CONFIRMED",
      "TRANSP:TRANSPARENT",
      "END:VEVENT",
    );
  }

  lines.push("END:VCALENDAR");
  return `${lines.map(foldLine).join("\r\n")}\r\n`;
}
