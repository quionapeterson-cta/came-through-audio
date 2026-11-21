import { describe, expect, it } from "vitest";
import {
  canDecideTestimonials,
  canEditTestimonials,
  canSubmitTestimonials,
  cleanReview,
  decideTestimonialsError,
  publishableTestimonials,
  STARTING_REVIEW,
  submitTestimonialsError,
  testimonialsChanged,
  testimonialsEditable,
  type TestimonialReview,
  type TestimonialWorkspace,
} from "./testimonial-review";
import type { StaffAccess } from "./departments";
import { DEFAULT_TESTIMONIAL_FILTER, type EditableTestimonial } from "./testimonials";

const access = (
  role: StaffAccess["role"],
  departments: StaffAccess["departments"] = [],
): StaffAccess => ({ role, departments, canManageStaff: role === "hr_admin" || role === "super_admin" });

const review = (patch: Partial<TestimonialReview> = {}): TestimonialReview => ({ ...STARTING_REVIEW, ...patch });

const card = (id: string, published: boolean): EditableTestimonial => ({
  id,
  name: "Name",
  title: "",
  location: "",
  service: "Service",
  quote: "Quote",
  photo: "/testimonials/x.jpg",
  focus: "50% 30%",
  zoom: 1,
  releaseSignedOn: "2026-10-20",
  published,
});

describe("testimonial review rules", () => {
  it("lets Marketing, Branding and super admins edit and see the working copy", () => {
    expect(canEditTestimonials(access("super_admin"))).toBe(true);
    expect(canEditTestimonials(access("employee", ["marketing"]))).toBe(true);
    expect(canEditTestimonials(access("department_lead", ["branding"]))).toBe(true);
    expect(canEditTestimonials(access("employee", ["support"]))).toBe(false);
    expect(canEditTestimonials(access("hr_admin", ["hr"]))).toBe(false);
    expect(canEditTestimonials(null)).toBe(false);
  });

  it("lets only a Marketing or Branding lead submit the section", () => {
    expect(canSubmitTestimonials(access("super_admin"))).toBe(true);
    expect(canSubmitTestimonials(access("department_lead", ["marketing"]))).toBe(true);
    expect(canSubmitTestimonials(access("department_lead", ["branding"]))).toBe(true);
    // An employee still edits, but the lead sends it.
    expect(canSubmitTestimonials(access("employee", ["marketing"]))).toBe(false);
    expect(canSubmitTestimonials(access("department_lead", ["support"]))).toBe(false);
  });

  it("keeps the decision to a super admin alone", () => {
    expect(canDecideTestimonials(access("super_admin"))).toBe(true);
    expect(canDecideTestimonials(access("department_lead", ["marketing"]))).toBe(false);
    expect(canDecideTestimonials(access("hr_admin", ["hr"]))).toBe(false);
    expect(canDecideTestimonials(null)).toBe(false);
  });

  it("locks the section while a version is waiting for a decision", () => {
    expect(testimonialsEditable("pending_approval")).toBe(false);
    for (const status of ["draft", "changes_requested", "denied", "approved"] as const) {
      expect(testimonialsEditable(status)).toBe(true);
    }
  });

  it("submits one version at a time", () => {
    expect(submitTestimonialsError(review({ status: "pending_approval" }))).toMatch(/already waiting/i);
    expect(submitTestimonialsError(review({ status: "draft" }))).toBeNull();
    expect(submitTestimonialsError(review({ status: "changes_requested" }))).toBeNull();
    expect(submitTestimonialsError(review({ status: "denied" }))).toBeNull();
  });

  it("decides only what is waiting, and a decline or send-back says why", () => {
    expect(decideTestimonialsError(review({ status: "draft" }), "approve", "")).toMatch(/nothing is waiting/i);
    expect(decideTestimonialsError(review({ status: "pending_approval" }), "approve", "")).toBeNull();
    expect(decideTestimonialsError(review({ status: "pending_approval" }), "changes", "")).toMatch(/note/i);
    expect(decideTestimonialsError(review({ status: "pending_approval" }), "deny", "  ")).toMatch(/note/i);
    expect(decideTestimonialsError(review({ status: "pending_approval" }), "changes", "Add the signed release.")).toBeNull();
    expect(decideTestimonialsError(review({ status: "pending_approval" }), "deny", "This quote was edited.")).toBeNull();
  });

  it("cleans a saved review without unlocking the section on junk", () => {
    expect(cleanReview(null)).toEqual(STARTING_REVIEW);
    expect(cleanReview({ status: "made_up" }).status).toBe("draft");
    expect(cleanReview({ status: "pending_approval", submittedAt: "not a date" }).submittedAt).toBeNull();
    expect(cleanReview({ note: "  too   long  ".repeat(200) }).note.length).toBeLessThanOrEqual(500);
    expect(cleanReview({ status: "approved", note: " okay " }).note).toBe("okay");
  });

  it("publishes only the cards ticked for the homepage", () => {
    expect(publishableTestimonials([card("a", true), card("b", false)]).map((t) => t.id)).toEqual(["a"]);
  });

  it("counts a photo-filter change as an unsaved version", () => {
    const ws: TestimonialWorkspace = {
      items: [card("a", true)],
      review: STARTING_REVIEW,
      filter: DEFAULT_TESTIMONIAL_FILTER,
    };
    expect(testimonialsChanged(ws, ws.items, DEFAULT_TESTIMONIAL_FILTER)).toBe(false);
    expect(testimonialsChanged(ws, ws.items, { ...DEFAULT_TESTIMONIAL_FILTER, tint: 20 })).toBe(true);
    expect(testimonialsChanged(ws, [card("a", false)], DEFAULT_TESTIMONIAL_FILTER)).toBe(true);
  });
});
