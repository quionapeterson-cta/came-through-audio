/**
 * Support scripts (founder, 2026-11-05): the words to send, per department, so a ticket is answered the same way
 * whoever is on the desk. Support is its own department and owns the ticket queue; Billing answers its own billing
 * tickets (see `ticketOwnerDepartment`), and every other department owns the scripts for its own questions.
 *
 * These are replies, not policy. Where a script says what we pay or promise, the rule behind it lives in
 * BILLING-POLICY.md and the server; a change to a promise changes both. Scripts are code on purpose: no database table
 * to fall out of step, and a super admin ships a wording change the same way as any other change.
 *
 * Every script is readable by every staff member (Admin → Support Scripts). Only Support and Billing can *read* a
 * member's ticket, and a billing ticket is Billing's alone.
 */
import { DEPARTMENT_LABEL, type Department } from "./departments";
import { BILLING_AREA } from "./support-topics";

export type SupportScript = {
  id: string;
  /** The department whose questions this answers. Anyone may read it; this is who owns the wording. */
  department: Department;
  title: string;
  /** When to use it, in one line, so nobody has to guess between two similar scripts. */
  when: string;
  /** The reply. `{{placeholders}}` are filled in the panel before copying. */
  body: string;
  /** Staff-only wording: never sent to a member. */
  internal?: true;
};

/** The values the panel offers for filling a script. Anything else stays as a visible placeholder on purpose. */
export const SCRIPT_VARIABLES = ["first_name", "plan", "amount", "date", "detail"] as const;
export type ScriptVariable = (typeof SCRIPT_VARIABLES)[number];

const REFUND_DAYS = 30;

/**
 * The catalog itself is server-side (`support-scripts.server.ts`, read through `listSupportScripts`), so every helper here
 * takes the list it was given. Nothing in this module ships a script body to the browser.
 */

/** Scripts for one department, or all of them, in catalog order. */
export function scriptsFor(
  scripts: readonly SupportScript[],
  department: Department | "all",
): SupportScript[] {
  return scripts.filter((s) => department === "all" || s.department === department);
}

/** Search over the title, the "when" line, the body and the id, newest wording regardless of case. */
export function searchScripts(
  scripts: readonly SupportScript[],
  query: string,
  department: Department | "all" = "all",
): SupportScript[] {
  const q = query.trim().toLowerCase();
  const list = scriptsFor(scripts, department);
  if (!q) return list;
  return list.filter((s) => `${s.title} ${s.when} ${s.body} ${s.id}`.toLowerCase().includes(q));
}

/** Departments that have at least one script, in dashboard order, for the panel's filter chips. */
export function scriptDepartments(
  scripts: readonly SupportScript[],
): { department: Department; label: string; count: number }[] {
  const seen: Department[] = [];
  for (const s of scripts) if (!seen.includes(s.department)) seen.push(s.department);
  return seen.map((department) => ({
    department,
    label: DEPARTMENT_LABEL[department],
    count: scripts.filter((s) => s.department === department).length,
  }));
}

/** Every `{{placeholder}}` a body uses, once each, in the order it appears. */
export function scriptVariables(body: string): string[] {
  const found = body.match(/\{\{\s*[a-z_]+\s*\}\}/gi) ?? [];
  return [...new Set(found.map((m) => m.replace(/[{}]/g, "").trim()))];
}

/**
 * Fills the placeholders it was given and leaves the rest visible as `{{detail}}`, so an unfilled value is obvious in
 * the draft instead of silently becoming an empty gap the member reads.
 */
export function fillScript(body: string, values: Partial<Record<string, string>>): string {
  return body.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (whole, key: string) => {
    const value = values[key]?.trim();
    return value ? value : whole;
  });
}

/**
 * Which scripts usually answer which area (founder, 2026-11-08): the rail opens on the three most likely rows instead of
 * the whole catalog, and staff can still scroll or search everything. Ids only — the wording stays where it already is,
 * and a suggestion outside the ticket owner's department (or marked internal) is dropped rather than offered.
 */
const SUGGESTED_BY_AREA: Record<string, string[]> = {
  "Embed Metadata": ["support-received", "support-need-detail"],
  "My Catalog": ["support-received", "software-bug-received"],
  "Royalties and Registrations": ["support-need-detail", "support-received"],
  "AI Protection Hub": ["support-received", "support-need-detail"],
  "Split Sheets": ["support-need-detail", "support-received"],
  "Contracts & Blueprints": ["support-need-detail", "support-received"],
  "PDF Fill & Sign": ["support-need-detail", "support-received"],
  "Account & billing": [
    "billing-duplicate-is-a-hold",
    "billing-refund-approved",
    "billing-card-declined",
    "billing-pause-is-not-cancel",
  ],
  "Something else": ["support-received", "support-need-detail"],
};

/** The area half of a stored "Area · Issue" category. */
export function ticketArea(category: string): string {
  return category.split("·")[0]?.trim() ?? "";
}

/** The scripts worth putting first for this ticket's area, limited to the queue owner's member-facing wording. */
export function suggestedScripts(
  scripts: readonly SupportScript[],
  category: string,
): SupportScript[] {
  const owned = scriptsForTicket(scripts, category);
  const ids = SUGGESTED_BY_AREA[ticketArea(category)] ?? [];
  return ids
    .map((id) => owned.find((s) => s.id === id))
    .filter((s): s is SupportScript => !!s && !s.internal)
    .slice(0, 3);
}

/**
 * Who answers a ticket. Support owns the queue for everything; Billing answers its own billing tickets
 * (founder, 2026-11-05), which is why a billing ticket never appears in Support's pile by accident.
 */
export function ticketOwnerDepartment(category: string): "support" | "billing" {
  return category.trim().toLowerCase().startsWith(BILLING_AREA.toLowerCase())
    ? "billing"
    : "support";
}

/** True when this category is Billing's to answer. Mirrors the RLS policy and the inbox routing. */
export function isBillingTicket(category: string): boolean {
  return ticketOwnerDepartment(category) === "billing";
}

/**
 * The scripts to offer inside a ticket (founder, 2026-11-05): the queue owner's wording, one click from the message —
 * Billing's on a billing ticket, Support's otherwise. The whole catalog is still Admin → Support Scripts.
 */
export function scriptsForTicket(
  scripts: readonly SupportScript[],
  category: string,
): SupportScript[] {
  return scriptsFor(scripts, ticketOwnerDepartment(category));
}

/**
 * What a ticket fills in by itself: the member's first name, and the subject as the detail line. Everything else stays
 * a visible `{{placeholder}}`, so an unfilled amount is obvious before it is sent.
 */
export function ticketScriptValues(ticket: {
  name: string;
  subject: string;
}): Record<string, string> {
  const first = ticket.name.trim().split(/\s+/)[0] ?? "";
  const detail = ticket.subject.trim();
  return { ...(first ? { first_name: first } : {}), ...(detail ? { detail } : {}) };
}

/** The 30-day window the scripts quote, kept next to them so the wording and the rule cannot drift apart. */
export const SCRIPT_REFUND_WINDOW_DAYS = REFUND_DAYS;
