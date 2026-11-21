/**
 * How a staff member is named in anything staff read (founder, 2026-11-19).
 *
 * The founder is one person and the dashboard should read that way: her role badge says "The Founder" and her name in a
 * timeline, an assignee label or a viewer badge is "Mrs. Peterson". The stored role stays `super_admin` — every query,
 * auth check and RLS policy keeps matching that value — this file only decides the words on the screen.
 *
 * Client-safe and pure, so a component, a PDF and a test all read the same rule.
 */
import { ROLE_LABEL, type StaffRole } from "./departments";

export const FOUNDER_ROLE = "super_admin" as const;
export const FOUNDER_ROLE_LABEL = "The Founder";
export const FOUNDER_DISPLAY_NAME = "Mrs. Peterson";

/** Minimal profile shape: the name is whatever the claims or the profile row carries. */
export type StaffNameSource =
  | {
      name?: string | null | undefined;
      full_name?: string | null | undefined;
      display_name?: string | null | undefined;
      email?: string | null | undefined;
    }
  | null
  | undefined;

export function isFounder(role: string | null | undefined): boolean {
  return role === FOUNDER_ROLE;
}

/**
 * The badge or tag for a role. `super_admin` never reaches staff-facing copy: it reads "The Founder".
 */
export function formatStaffRoleLabel(role: string | null | undefined): string {
  if (isFounder(role)) return FOUNDER_ROLE_LABEL;
  if (!role) return "Staff";
  const known = ROLE_LABEL[role as StaffRole];
  if (known) return known;
  // An unknown stored value reads as words rather than a database token.
  return role.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * The name shown for a person: "Mrs. Peterson" for the founder, otherwise their own name, then their address, then a
 * neutral word. A personal address is a last resort, never the first thing staff see.
 */
export function formatStaffDisplayName(
  role: string | null | undefined,
  profile?: StaffNameSource,
): string {
  if (isFounder(role)) return FOUNDER_DISPLAY_NAME;
  const named = (profile?.name ?? profile?.full_name ?? profile?.display_name ?? "").trim();
  if (named) return named.slice(0, 100);
  const email = (profile?.email ?? "").trim();
  if (email.includes("@")) return email.split("@")[0]!.slice(0, 100);
  return "Staff";
}

/** "Escalated to The Founder (Mrs. Peterson)" — the phrasing the timeline and the assignee labels use. */
export function founderHandoffLabel(): string {
  return `Escalated to ${FOUNDER_ROLE_LABEL} (${FOUNDER_DISPLAY_NAME})`;
}

/** "Approved by Mrs. Peterson" / "Approved by Dana" — one shape for every action line. */
export function staffActionLabel(
  verb: string,
  role: string | null | undefined,
  profile?: StaffNameSource,
): string {
  return `${verb} by ${formatStaffDisplayName(role, profile)}`;
}

/** "Viewing: Mrs. Peterson" for the active-viewer badge. */
export function viewerLabel(role: string | null | undefined, profile?: StaffNameSource): string {
  return `Viewing: ${formatStaffDisplayName(role, profile)}`;
}
