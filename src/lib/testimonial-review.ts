import type { StaffAccess } from "./departments";
import type { EditableTestimonial, TestimonialFilter } from "./testimonials";

/**
 * The homepage testimonial review (founder, 2026-11-21): Marketing and Branding edit the section, a lead sends it to a
 * super admin, and nothing reaches the homepage until a super admin approves it. A super admin can approve, decline, or
 * send it back with a note for changes.
 *
 * The rules live here, once, with their test: the panel and every server function read this module rather than repeat
 * the check. `canEditTestimonials` is who may open and change the working copy, which is also who may see the drafts.
 */
export const TESTIMONIAL_REVIEW_STATUSES = [
  "draft",
  "pending_approval",
  "changes_requested",
  "denied",
  "approved",
] as const;

export type TestimonialReviewStatus = (typeof TESTIMONIAL_REVIEW_STATUSES)[number];
export type TestimonialDecision = "approve" | "deny" | "changes";

export type TestimonialReview = {
  status: TestimonialReviewStatus;
  /** Who sent this version for approval, and when. */
  submittedBy: string | null;
  submittedAt: string | null;
  /** The super admin who decided it, and when. */
  decidedBy: string | null;
  decidedAt: string | null;
  /** The reviewer's words: why it was sent back or declined. Empty on an approval. */
  note: string;
  updatedBy: string | null;
  updatedAt: string | null;
};

/** A section that has never been sent anywhere. */
export const STARTING_REVIEW: TestimonialReview = {
  status: "draft",
  submittedBy: null,
  submittedAt: null,
  decidedBy: null,
  decidedAt: null,
  note: "",
  updatedBy: null,
  updatedAt: null,
};

export const REVIEW_LABEL: Record<TestimonialReviewStatus, string> = {
  draft: "Draft",
  pending_approval: "Waiting for approval",
  changes_requested: "Sent back for updates",
  denied: "Declined",
  approved: "Approved",
};

/**
 * Quoting a card to describe the live section needs no permission; the drafts are what the review protects. The photo
 * filter travels with the cards (founder, 2026-11-21), so one approved version carries both and nothing in the section
 * can change on its own.
 */
export type TestimonialWorkspace = {
  items: EditableTestimonial[];
  review: TestimonialReview;
  filter: TestimonialFilter;
};

/**
 * Whether the editor holds unsaved work: the cards and the shared photo filter are one version, so a filter change is
 * enough to keep "Request approval" waiting for a save.
 */
export function testimonialsChanged(
  ws: TestimonialWorkspace,
  items: EditableTestimonial[],
  filter: TestimonialFilter,
): boolean {
  return (
    JSON.stringify(items) !== JSON.stringify(ws.items) ||
    JSON.stringify(filter) !== JSON.stringify(ws.filter)
  );
}

const isStatus = (v: unknown): v is TestimonialReviewStatus =>
  typeof v === "string" && (TESTIMONIAL_REVIEW_STATUSES as readonly string[]).includes(v);

const stamp = (v: unknown): string | null =>
  typeof v === "string" && !Number.isNaN(Date.parse(v)) ? v : null;

const text = (v: unknown, max = 500): string =>
  typeof v === "string" ? v.trim().slice(0, max) : "";

/** Any saved review, cleaned: an unknown status falls back to draft instead of unlocking the section. */
export function cleanReview(v: unknown): TestimonialReview {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  return {
    status: isStatus(o["status"]) ? o["status"] : "draft",
    submittedBy: typeof o["submittedBy"] === "string" ? o["submittedBy"] : null,
    submittedAt: stamp(o["submittedAt"]),
    decidedBy: typeof o["decidedBy"] === "string" ? o["decidedBy"] : null,
    decidedAt: stamp(o["decidedAt"]),
    note: text(o["note"]),
    updatedBy: typeof o["updatedBy"] === "string" ? o["updatedBy"] : null,
    updatedAt: stamp(o["updatedAt"]),
  };
}

const inHomepageDepartment = (access: StaffAccess | null | undefined) =>
  !!access && (access.departments.includes("marketing") || access.departments.includes("branding"));

/**
 * Who may see and edit the working copy: a super admin, or anyone in Marketing and Branding. This is the same rule the
 * Homepage tab uses, so a person can never edit what the menu hides from them.
 */
export function canEditTestimonials(access: StaffAccess | null | undefined): boolean {
  return !!access && (access.role === "super_admin" || inHomepageDepartment(access));
}

/**
 * Who may send the section for approval: a super admin, or the lead of Marketing or Branding (founder, 2026-11-21).
 * Employees in those departments keep editing; their lead is the one who submits.
 */
export function canSubmitTestimonials(access: StaffAccess | null | undefined): boolean {
  if (!access) return false;
  if (access.role === "super_admin") return true;
  return access.role === "department_lead" && inHomepageDepartment(access);
}

/** Only a super admin decides: approve, decline, or send back for changes. */
export function canDecideTestimonials(access: StaffAccess | null | undefined): boolean {
  return access?.role === "super_admin";
}

/**
 * While a version is with a super admin it cannot be edited, so what is being approved is what was sent. Approving,
 * declining or sending back frees it again.
 */
export function testimonialsEditable(status: TestimonialReviewStatus): boolean {
  return status !== "pending_approval";
}

/** Why this version cannot be submitted, or null. Only one version can wait for a decision at a time. */
export function submitTestimonialsError(review: TestimonialReview): string | null {
  if (review.status === "pending_approval")
    return "This version is already waiting for a super admin. Edits open again when they decide.";
  return null;
}

/** Why this decision cannot be made, or null. A decline or a send-back must say what needs to change. */
export function decideTestimonialsError(
  review: TestimonialReview,
  decision: TestimonialDecision,
  note: string,
): string | null {
  if (review.status !== "pending_approval") return "Nothing is waiting for approval.";
  if (decision !== "approve" && note.trim().length < 3)
    return "Add a note so they know what to change.";
  return null;
}

/** The cards that go on the homepage when a version is approved: the ones ticked "Show on homepage". */
export function publishableTestimonials(items: EditableTestimonial[]): EditableTestimonial[] {
  return items.filter((t) => t.published);
}
