/**
 * Workspace reminders (founder spec, 2026-11-19): the quiet "Remind Me" pills, the custom reminder form, and the
 * full-width strip all read and write this one shape. Nothing here talks to React, so the scheduling rules, the
 * deep-link builder and the smart presets can be tested on their own.
 *
 * Reminders are not a payment or a legal record, so they live with the member's own browser data and are mirrored to
 * the account's auth metadata when the browser allows it. A new device adopts the metadata copy on its first visit.
 */

export type ReminderPriority = "standard" | "gold" | "urgent";
export type ReminderDestination = "general" | "catalog" | "health" | "splits" | "contracts" | "blueprints" | "pdf";
export type ReminderContextType = "custom" | "catalog" | "health_check" | "split_sheet" | "contract" | "blueprint";
export type ReminderState = "completed" | "snoozed" | "due" | "upcoming";
export type CalendarTarget = "ics" | "google";

export interface WorkspaceReminder {
  id: string;
  title: string;
  note: string;
  dueAt: string;
  priority: ReminderPriority;
  destination: ReminderDestination;
  contextType: ReminderContextType;
  contextId: string;
  contextKey: string;
  href: string;
  createdAt: string;
  updatedAt: string;
  snoozedUntil: string | null;
  completedAt: string | null;
  calendarExported: CalendarTarget | null;
}

/** What a caller must supply to create one; the store fills the bookkeeping fields. */
export interface NewReminder {
  title: string;
  note?: string | undefined;
  dueAt: string;
  priority?: ReminderPriority | undefined;
  destination?: ReminderDestination | undefined;
  contextType?: ReminderContextType | undefined;
  contextId?: string | undefined;
  contextKey?: string | undefined;
  href?: string | undefined;
}

/** The optional record a deep link can name. Missing ids are simply left out of the URL. */
export interface ReminderLink {
  songId?: string | undefined;
  sheetId?: string | undefined;
  contractId?: string | undefined;
  blueprintId?: string | undefined;
  stepId?: string | undefined;
  focusField?: string | undefined;
}

export interface ReminderPreset {
  key: string;
  label: string;
  title: string;
  days: number;
  destination: ReminderDestination;
  priority: ReminderPriority;
  focusField?: string | undefined;
}

export const PRIORITY_LABEL: Record<ReminderPriority, string> = {
  standard: "Standard Platinum",
  gold: "VIP Gold",
  urgent: "Urgent Red",
};

export const PRIORITY_SHORT: Record<ReminderPriority, string> = {
  standard: "Standard",
  gold: "VIP",
  urgent: "Urgent",
};

export const DESTINATION_LABEL: Record<ReminderDestination, string> = {
  general: "General Workspace",
  catalog: "My Catalog",
  health: "Royalty Health Check",
  splits: "Split Sheets",
  contracts: "Contracts",
  blueprints: "Blueprints",
  pdf: "PDF Tools",
};

export const CONTEXT_LABEL: Record<ReminderContextType, string> = {
  custom: "Workspace reminder",
  catalog: "Catalog follow-up",
  health_check: "Royalty health follow-up",
  split_sheet: "Split sheet follow-up",
  contract: "Contract follow-up",
  blueprint: "Blueprint follow-up",
};

export const DESTINATIONS = (Object.keys(DESTINATION_LABEL) as ReminderDestination[]).map((id) => ({
  id,
  label: DESTINATION_LABEL[id],
}));

const DESTINATION_TAB: Record<ReminderDestination, string> = {
  general: "",
  catalog: "catalog",
  health: "health",
  splits: "splits",
  contracts: "learn",
  blueprints: "learn",
  pdf: "pdf",
};

export const CONTEXT_DESTINATION: Record<ReminderContextType, ReminderDestination> = {
  custom: "general",
  catalog: "catalog",
  health_check: "health",
  split_sheet: "splits",
  contract: "contracts",
  blueprint: "blueprints",
};

export function makeId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `rem-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/** A local morning, so "In 3 Days" lands at 10:00 in the member's own time zone. */
export function atDaysFromNow(days: number, hour = 10): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

export function contextKeyFor(contextType: ReminderContextType, contextId: string, key: string): string {
  return `${contextType}:${contextId}:${key}`;
}

/** The in-app URL a reminder opens, including the deep-link parameters the workspace already understands. */
export function buildHref(destination: ReminderDestination, link: ReminderLink = {}): string {
  const params = new URLSearchParams();
  const tab = DESTINATION_TAB[destination];
  if (tab) params.set("tab", tab);
  if (destination === "catalog" && link.songId) params.set("songId", link.songId);
  if (destination === "health" && link.songId) params.set("song", link.songId);
  if (destination === "splits" && link.sheetId) params.set("sheetId", link.sheetId);
  if (destination === "contracts" && link.contractId) params.set("contractId", link.contractId);
  if (destination === "blueprints" && link.blueprintId) params.set("blueprintId", link.blueprintId);
  if (destination === "blueprints" && link.stepId) params.set("stepId", link.stepId);
  if (link.focusField) params.set("focusField", link.focusField);
  return params.size ? `/workspace?${params.toString()}` : "/workspace";
}

/** The six smart presets that sit beside a module's own cards, tailored to what that module is for. */
export function presetsFor(contextType: ReminderContextType, opts: { stepTitle?: string | undefined } = {}): ReminderPreset[] {
  switch (contextType) {
    case "catalog":
      return [
        { key: "in-14-days", label: "In 14 Days", title: "Check PRO registration approval & add ISWC to catalog", days: 14, destination: "catalog", priority: "standard", focusField: "iswc" },
        { key: "in-30-days", label: "In 30 Days", title: "Audit MLC / SoundExchange / agency registration & distributor metadata sync", days: 30, destination: "catalog", priority: "gold", focusField: "metadata" },
      ];
    case "health_check":
      return [
        { key: "in-7-days", label: "In 7 Days", title: "Re-run Royalty Health Check after updating writer/publisher splits", days: 7, destination: "health", priority: "standard" },
        { key: "in-21-days", label: "In 21 Days", title: "Verify missing repertoire matches across BMI, ASCAP, MLC & SoundExchange", days: 21, destination: "health", priority: "gold" },
      ];
    case "split_sheet":
      return [
        { key: "in-3-days", label: "In 3 Days", title: "Resend pending split sheet signature email", days: 3, destination: "splits", priority: "standard", focusField: "collaborators" },
        { key: "in-7-days", label: "In 7 Days", title: "Final follow-up before locking royalty splits", days: 7, destination: "splits", priority: "gold" },
      ];
    case "contract":
      return [
        { key: "in-3-days", label: "In 3 Days", title: "Resend pending contract signature request", days: 3, destination: "contracts", priority: "standard" },
        { key: "in-30-days", label: "In 30 Days", title: "Review contract renewal / reversion window", days: 30, destination: "contracts", priority: "gold" },
      ];
    case "blueprint": {
      const step = opts.stepTitle?.trim() || "next Blueprint step";
      return [
        { key: "tomorrow", label: "Tomorrow", title: `Complete next Blueprint step: ${step}`, days: 1, destination: "blueprints", priority: "standard" },
        { key: "in-3-days", label: "In 3 Days", title: `Complete next Blueprint step: ${step}`, days: 3, destination: "blueprints", priority: "gold" },
      ];
    }
    default:
      return [
        { key: "tomorrow", label: "Tomorrow", title: "Follow up in the workspace", days: 1, destination: "general", priority: "standard" },
        { key: "in-3-days", label: "In 3 Days", title: "Follow up in the workspace", days: 3, destination: "general", priority: "standard" },
        { key: "in-7-days", label: "Next Week", title: "Follow up in the workspace", days: 7, destination: "general", priority: "gold" },
      ];
  }
}

export function reminderDueAt(reminder: WorkspaceReminder): string {
  return reminder.snoozedUntil ?? reminder.dueAt;
}

export function reminderState(reminder: WorkspaceReminder, now = Date.now()): ReminderState {
  if (reminder.completedAt) return "completed";
  if (reminder.snoozedUntil && new Date(reminder.snoozedUntil).getTime() > now) return "snoozed";
  return new Date(reminder.dueAt).getTime() <= now ? "due" : "upcoming";
}

/** True while the strip should hold it: due now, overdue, or a snooze that has come back around. */
export function isReminderDue(reminder: WorkspaceReminder, now = Date.now()): boolean {
  return reminderState(reminder, now) === "due";
}

export function isReminderOverdue(reminder: WorkspaceReminder, now = Date.now()): boolean {
  // A snooze moves the reminder's effective due time: when it comes back after a day away it is due now, not
  // instantly a day overdue because the original date is older than the snooze.
  return !reminder.completedAt && new Date(reminderDueAt(reminder)).getTime() < now - 86_400_000;
}

const PRIORITY_RANK: Record<ReminderPriority, number> = { urgent: 0, gold: 1, standard: 2 };

/** Due reminders, hottest first: priority, then the one that has waited longest. */
export function dueReminders(reminders: WorkspaceReminder[], now = Date.now()): WorkspaceReminder[] {
  return reminders
    .filter((r) => isReminderDue(r, now))
    .sort((a, b) => {
      const priority = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
      if (priority !== 0) return priority;
      return new Date(reminderDueAt(a)).getTime() - new Date(reminderDueAt(b)).getTime();
    });
}

export function activeReminders(reminders: WorkspaceReminder[]): WorkspaceReminder[] {
  return reminders.filter((r) => !r.completedAt);
}

export function formatReminderDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function formatReminderTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export function dueText(reminder: WorkspaceReminder, now = Date.now()): string {
  if (isReminderOverdue(reminder, now)) return `Overdue · ${formatReminderDate(reminderDueAt(reminder))}`;
  if (isReminderDue(reminder, now)) return `Due now · ${formatReminderTime(reminderDueAt(reminder))}`;
  return `${formatReminderDate(reminderDueAt(reminder))} · ${formatReminderTime(reminderDueAt(reminder))}`;
}

export function makeReminder(input: NewReminder): WorkspaceReminder {
  const now = new Date().toISOString();
  const destination = input.destination ?? "general";
  const contextType = input.contextType ?? "custom";
  const contextId = input.contextId ?? "";
  return {
    id: makeId(),
    title: input.title.trim(),
    note: input.note?.trim() ?? "",
    dueAt: input.dueAt,
    priority: input.priority ?? "standard",
    destination,
    contextType,
    contextId,
    contextKey: input.contextKey ?? contextKeyFor(contextType, contextId, "custom"),
    href: input.href ?? buildHref(destination),
    createdAt: now,
    updatedAt: now,
    snoozedUntil: null,
    completedAt: null,
    calendarExported: null,
  };
}

const DESTINATION_SET = new Set<ReminderDestination>(["general", "catalog", "health", "splits", "contracts", "blueprints", "pdf"]);
const CONTEXT_SET = new Set<ReminderContextType>(["custom", "catalog", "health_check", "split_sheet", "contract", "blueprint"]);
const PRIORITY_SET = new Set<ReminderPriority>(["standard", "gold", "urgent"]);

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function validIso(value: unknown): string {
  return typeof value === "string" && !Number.isNaN(Date.parse(value)) ? value : "";
}

/** Anything read back from storage or auth metadata goes through here, so one bad row cannot break the strip. */
export function normalizeReminders(value: unknown): WorkspaceReminder[] {
  if (!Array.isArray(value)) return [];
  const out: WorkspaceReminder[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const title = str(row["title"]).trim();
    const dueAt = validIso(row["dueAt"]);
    if (!title || !dueAt) continue;
    const destination = DESTINATION_SET.has(row["destination"] as ReminderDestination) ? (row["destination"] as ReminderDestination) : "general";
    const contextType = CONTEXT_SET.has(row["contextType"] as ReminderContextType) ? (row["contextType"] as ReminderContextType) : "custom";
    const priority = PRIORITY_SET.has(row["priority"] as ReminderPriority) ? (row["priority"] as ReminderPriority) : "standard";
    const contextId = str(row["contextId"]);
    const created = validIso(row["createdAt"]) || dueAt;
    out.push({
      id: str(row["id"]) || makeId(),
      title,
      note: str(row["note"]),
      dueAt,
      priority,
      destination,
      contextType,
      contextId,
      contextKey: str(row["contextKey"]) || contextKeyFor(contextType, contextId, "custom"),
      href: str(row["href"]) || buildHref(destination),
      createdAt: created,
      updatedAt: validIso(row["updatedAt"]) || created,
      snoozedUntil: validIso(row["snoozedUntil"]) || null,
      completedAt: validIso(row["completedAt"]) || null,
      calendarExported: row["calendarExported"] === "ics" || row["calendarExported"] === "google" ? (row["calendarExported"] as CalendarTarget) : null,
    });
  }
  return out;
}

export function reminderStorageKey(userId: string): string {
  return `cta.workspace-reminders:${userId}`;
}

export function loadReminders(userId: string): WorkspaceReminder[] {
  if (!userId || typeof localStorage === "undefined") return [];
  try {
    return normalizeReminders(JSON.parse(localStorage.getItem(reminderStorageKey(userId)) ?? "[]"));
  } catch {
    return [];
  }
}

export function saveReminders(userId: string, reminders: WorkspaceReminder[]): void {
  if (!userId || typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(reminderStorageKey(userId), JSON.stringify(reminders));
  } catch {
    // A browser with storage blocked still gets the in-memory list for this visit.
  }
}

/** Keep every open reminder and the last 20 finished ones, so the metadata copy never grows without limit. */
export function trimReminders(reminders: WorkspaceReminder[]): WorkspaceReminder[] {
  const open = reminders.filter((r) => !r.completedAt);
  const done = reminders
    .filter((r) => r.completedAt)
    .sort((a, b) => new Date(b.completedAt ?? 0).getTime() - new Date(a.completedAt ?? 0).getTime())
    .slice(0, 20);
  return [...open, ...done];
}
