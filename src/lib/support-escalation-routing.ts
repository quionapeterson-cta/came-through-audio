import { DEPARTMENT_LABEL, type Department, type StaffAccess } from "./departments";
import { ESCALATION_TAG_DEPARTMENT } from "./escalation-departments";

/**
 * Where a handoff goes (founder, 2026-11-19). Support escalates a public inquiry to Marketing, The Founder, or both; the
 * department behind a tag also has a lead, and the thread is routed to that lead alone — the department's employees never
 * read an escalated thread, and a super admin keeps her own view. It is the same escalation row the lead reads, not a
 * second copy.
 *
 * Pure rules only, so the routing is testable without a database or a component.
 */

export const ESCALATION_TAGS = ["marketing", "founder"] as const;
export type EscalationTag = (typeof ESCALATION_TAGS)[number];

export const TAG_LABEL: Record<EscalationTag, string> = {
  marketing: "Marketing",
  founder: "The Founder",
};

/**
 * The department a tag belongs to, whose lead receives the handoff beside the team. The founder is the top of her own
 * line and leads no department, so her tag names none. The mapping itself lives in escalation-departments.ts.
 */
export const ESCALATION_DEPARTMENT: Record<EscalationTag, Department | null> =
  ESCALATION_TAG_DEPARTMENT;

/** The departments a handoff reaches, deduplicated, in the order the tags were chosen. */
export function escalationDepartments(tags: readonly EscalationTag[]): Department[] {
  const out: Department[] = [];
  for (const tag of tags) {
    const department = ESCALATION_DEPARTMENT[tag];
    if (department && !out.includes(department)) out.push(department);
  }
  return out;
}

/** How the timeline line names who was told, e.g. "Marketing & Social Media lead". */
export function escalationLeadLabels(tags: readonly EscalationTag[]): string[] {
  return escalationDepartments(tags).map((department) => `${DEPARTMENT_LABEL[department]} lead`);
}

/**
 * The tags this person receives because they lead the department behind them. Only a department lead gets a lead's
 * notice: a super admin already reads every ticket and has the founder's own list, and an employee gets nothing here —
 * the escalated thread is the lead's, so the server and the policies refuse it to the rest of the department.
 */
export function leadTagsFor(access: StaffAccess | null | undefined): EscalationTag[] {
  if (!access || access.role !== "department_lead") return [];
  return ESCALATION_TAGS.filter((tag) => {
    const department = ESCALATION_DEPARTMENT[tag];
    return !!department && access.departments.includes(department);
  });
}
