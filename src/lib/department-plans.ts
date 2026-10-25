import type { Department } from "@/lib/departments";

/**
 * Department plan generator (PLAN-phase4-order item 9, approved 2026-10-25): pick a department and a quarter and get a
 * plan with that department's scorecard (PLAN-staff-recognition §1: output, quality gate, customer result) as goals
 * and suggested milestones, which become Task Bank tasks. Targets are suggestions the founder sets with each lead.
 */
export type PlanGoal = { name: string; target: number; current: number; unit: string; lowerIsBetter?: boolean };
export type PlanMilestone = { title: string; due: string };

const g = (name: string, target: number, unit: string, lowerIsBetter = false): PlanGoal => ({ name, target, current: 0, unit, ...(lowerIsBetter && { lowerIsBetter }) });

export const SCORECARD: Record<Exclude<Department, "launch">, { goals: PlanGoal[]; milestones: string[] }> = {
  registration: { goals: [g("Accepted registrations", 100, "registrations"), g("Rejection rate", 5, "%", true), g("Days from Ready to registered", 7, "days", true)],
    milestones: ["Clear the registration backlog", "Rejection review: fix the top 3 causes", "Update agency checklists for any policy changes"] },
  royalty_accounts: { goals: [g("Split sheets completed and signed", 50, "split sheets"), g("Disputes reopened", 2, "%", true), g("Payout questions answered within 2 business days", 95, "%")],
    milestones: ["Follow up every unsigned split sheet over 14 days old", "Dispute review and fixes", "Payout FAQ refresh"] },
  finance: { goals: [g("Books closed by the 5th", 3, "months"), g("Reconciliation difference", 0, "$", true), g("Stripe payouts matched to bank within 7 days", 100, "%")],
    milestones: ["Month 1 close", "Month 2 close", "Quarter close and profit check"] },
  branding: { goals: [g("Assets delivered on time", 95, "%"), g("Brand-rule audit pass rate", 100, "%"), g("Badge drop progress", 50, "%")],
    milestones: ["Brand audit of the site, emails and PDFs", "Badge art for the next drop", "Asset library cleanup"] },
  marketing: { goals: [g("Signups from campaigns", 500, "signups"), g("Honest-claims check pass rate", 100, "%"), g("Trial to paid conversion", 10, "%")],
    milestones: ["Campaign plan and calendar", "Mid-quarter results review", "Testimonial and case study push"] },
  marketing_sales: { goals: [g("New paid plans", 100, "plans"), g("90-day retention of those customers", 85, "%"), g("Revenue from new plans", 5000, "$")],
    milestones: ["Partner and label outreach list", "Demo calls booked", "Retention check-ins for new customers"] },
  support: { goals: [g("Tickets solved", 300, "tickets"), g("Reopened tickets", 5, "%", true), g("First reply under 4 business hours", 90, "%")],
    milestones: ["Top 10 questions added to the FAQ and help chat", "Saved replies refresh", "Satisfaction survey review"] },
  ai: { goals: [g("AI Protection certificates processed", 100, "certificates"), g("Timestamp errors", 0, "errors", true), g("Hours from upload to certificate", 1, "hours", true)],
    milestones: ["Verify a sample of certificates at opentimestamps.org", "AI protection research notes", "Hub copy and FAQ review"] },
  software: { goals: [g("Releases shipped", 12, "releases"), g("Bugs that reached users per release", 0.5, "bugs", true), g("Uptime", 99.9, "%")],
    milestones: ["Test coverage for the main flows", "Performance pass on the slowest pages", "Dependency and security updates"] },
  security: { goals: [g("Findings closed within target time", 100, "%"), g("Critical findings open over 7 days", 0, "findings", true), g("Quarterly access review done", 1, "review")],
    milestones: ["Security scan and fixes", "Quarterly access review", "Backup restore test"] },
  hr: { goals: [g("Roles filled", 3, "roles"), g("New hires still here after 90 days", 90, "%"), g("Training and 30-60-90 completion", 100, "%")],
    milestones: ["Hiring plan and job posts", "Onboarding checklist and handbook update", "30-60-90 check-ins"] },
  research: { goals: [g("Weekly digests sent", 12, "digests"), g("Policy changes caught before they affected customers", 100, "%"), g("Reviews delivered on time", 4, "reviews")],
    milestones: ["Society policy review", "Competitor and pricing review", "AI protection research report"] },
};

/** The next quarters (calendar), starting with the current one. */
export function quarters(now = new Date(), count = 4): { label: string; start: string; end: string }[] {
  const out = [];
  let y = now.getFullYear(), q = Math.floor(now.getMonth() / 3);
  for (let i = 0; i < count; i++) {
    const start = new Date(Date.UTC(y, q * 3, 1)), end = new Date(Date.UTC(y, q * 3 + 3, 0));
    out.push({ label: `Q${q + 1} ${y}`, start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) });
    q++; if (q === 4) { q = 0; y++; }
  }
  return out;
}

/** A starter plan: the department's scorecard goals and its milestones spread across the quarter. */
export function generatePlan(dept: Exclude<Department, "launch">, quarter: { label: string; start: string; end: string }, deptLabel: string) {
  const s = SCORECARD[dept];
  const start = Date.parse(`${quarter.start}T17:00:00Z`), end = Date.parse(`${quarter.end}T17:00:00Z`);
  const milestones: PlanMilestone[] = s.milestones.map((title, i) => ({ title, due: new Date(start + ((i + 1) / s.milestones.length) * (end - start)).toISOString() }));
  return { title: `${deptLabel} plan · ${quarter.label}`, period_start: quarter.start, period_end: quarter.end, goals: s.goals.map((x) => ({ ...x })), milestones };
}

/** How far a goal is (0–100). Lower-is-better goals are met at or under the target. */
export function goalPct(x: PlanGoal): number {
  if (x.lowerIsBetter) return x.current <= x.target ? 100 : Math.max(0, Math.round((x.target / x.current) * 100));
  return x.target > 0 ? Math.min(100, Math.round((x.current / x.target) * 100)) : 0;
}
