/**
 * The one place an escalated thread's department is named (founder, 2026-11-19).
 *
 * Pure data with no imports, so every layer reads the same value: `departments.ts` decides who gets the Support Tickets
 * tab, `support-escalation-routing.ts` maps the escalation tags onto it, and `support.functions.ts` scopes what that
 * lead's server call may read. Adding a department here is the whole code change; there is no second list to keep in step.
 *
 * The SQL policies are the only other place that names it, in `20261119180000_escalations-lead-only.sql`, and the test
 * beside this module is what stops the two from drifting apart.
 */
export const ESCALATION_DEPARTMENTS = ["marketing"] as const;
export type EscalationDepartment = (typeof ESCALATION_DEPARTMENTS)[number];

/**
 * The department each escalation tag belongs to, whose lead receives the handoff. The founder is the top of her own line
 * and leads no department, so her tag names none.
 */
export const ESCALATION_TAG_DEPARTMENT = {
  marketing: "marketing",
  founder: null,
} as const satisfies Record<string, EscalationDepartment | null>;
