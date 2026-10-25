import type { Department } from "@/lib/departments";

/**
 * Staff badges, version 1 (PLAN-phase4-order item 6, approved 2026-10-25; PLAN-staff-recognition §2). Earned only from
 * real records, never granted by the person: department badges from Task Bank tasks they completed, Welcome and Tenure
 * from when they joined the team. The rest of the 33 pieces wait for the systems that earn them (training quizzes,
 * peer kudos, customer ratings, scorecards). Art is the code-drawn placeholder set until the final art arrives.
 */
const P = "/icons/playful";

export type StaffBadgeDef = { id: string; title: string; collection: string; src: string; how: string; later?: boolean };
export type StaffBadgeState = StaffBadgeDef & { earned: boolean; times: number; progress?: string | undefined };

/** Each department's own badge: the first task completed there, then again every 10. */
export const DEPARTMENT_BADGE: Partial<Record<Department, { id: string; title: string; file: string }>> = {
  registration: { id: "first_acceptance", title: "First Acceptance", file: "first_acceptance" },
  royalty_accounts: { id: "settled", title: "Settled", file: "settled" },
  finance: { id: "closed_by_the_5th", title: "Closed by the 5th", file: "closed_by_the_5th" },
  branding: { id: "on_brand", title: "On Brand", file: "on_brand" },
  marketing: { id: "campaign_came_through", title: "Campaign Came Through", file: "campaign_came_through" },
  marketing_sales: { id: "stayed_with_us", title: "Stayed With Us", file: "stayed_with_us" },
  support: { id: "fast_friend", title: "Fast Friend", file: "fast_friend" },
  ai: { id: "witnessed", title: "Witnessed", file: "witnessed" },
  software: { id: "clean_release", title: "Clean Release", file: "clean_release" },
  security: { id: "locked_down", title: "Locked Down", file: "locked_down" },
  hr: { id: "welcome_committee", title: "Welcome Committee", file: "welcome_committee" },
};
export const TASKS_PER_REPEAT = 10;

const WELCOME: [string, string, number, string][] = [
  ["first_day", "First Day", 0, "Welcome to the team."], ["first_week", "First Week", 7, "One week in."],
  ["days_30", "30 Days", 30, "A month with us."], ["days_60", "60 Days", 60, "Two months in."], ["days_90_strong", "90 Days Strong", 90, "Three months strong."],
];
const LATER: StaffBadgeDef[] = [
  { id: "company_core", title: "Certified: Company Core", collection: "Certified", src: `${P}/staff_certified/company_core.webp`, how: "Pass the Company Core training quiz.", later: true },
  { id: "department_track", title: "Certified: Department Track", collection: "Certified", src: `${P}/staff_certified/department_track.webp`, how: "Pass your department's training track.", later: true },
  { id: "region_certified", title: "Region Certified", collection: "Certified", src: `${P}/staff_certified/region_certified.webp`, how: "Pass a region's training.", later: true },
  { id: "clean_sheet", title: "Clean Sheet", collection: "Quality", src: `${P}/staff_quality/clean_sheet.webp`, how: "25 in a row with no rejection.", later: true },
  { id: "detective", title: "Detective", collection: "Quality", src: `${P}/staff_quality/detective.webp`, how: "Find and fix a conflict.", later: true },
  { id: "zero_variance", title: "Zero Variance", collection: "Quality", src: `${P}/staff_quality/zero_variance.webp`, how: "Books balanced to the cent.", later: true },
  { id: "patched", title: "Patched", collection: "Quality", src: `${P}/staff_quality/patched.webp`, how: "Close a critical finding within 24 hours.", later: true },
  { id: "team_came_through", title: "Team Came Through", collection: "Team", src: `${P}/staff_team/team_came_through.webp`, how: "Your department meets its quarterly scorecard.", later: true },
  { id: "came_through_for_me", title: "Came Through for Me", collection: "Kudos", src: `${P}/staff_kudos/came_through_for_me.webp`, how: "Every 5 kudos from teammates.", later: true },
  { id: "thank_you_note", title: "Thank-You Note", collection: "Customer Love", src: `${P}/staff_customer_love/thank_you_note.webp`, how: "A customer names you in a rating or review.", later: true },
  { id: "quarterly_award", title: "Quarterly Award", collection: "Awards", src: `${P}/staff_awards/quarterly_award.webp`, how: "Chosen each quarter.", later: true },
  { id: "founders_crown", title: "Founder's Crown", collection: "Awards", src: `${P}/staff_awards/founders_crown.webp`, how: "Given by the founder, with a written reason.", later: true },
];

const DAY = 86_400_000;

/** Every staff badge for one person, from their join date and the tasks they completed per department. */
export function staffBadges(o: { joinedAt: string; completed: Partial<Record<Department, number>>; departments: Department[]; now?: Date }): StaffBadgeState[] {
  const days = Math.floor(((o.now ?? new Date()).getTime() - Date.parse(o.joinedAt)) / DAY);
  const dept = (Object.entries(DEPARTMENT_BADGE) as [Department, { id: string; title: string; file: string }][])
    .filter(([d]) => o.departments.includes(d) || (o.completed[d] ?? 0) > 0)
    .map(([d, b]) => {
      const n = o.completed[d] ?? 0;
      const times = n ? 1 + Math.floor((n - 1) / TASKS_PER_REPEAT) : 0;
      const next = n ? TASKS_PER_REPEAT - ((n - 1) % TASKS_PER_REPEAT) - 1 : 1;
      return { id: b.id, title: b.title, collection: "Department", src: `${P}/staff_department/${b.file}.webp`,
        how: `Complete Task Bank tasks in your department: the first, then every ${TASKS_PER_REPEAT}.`, earned: n > 0, times,
        progress: n ? `${n} task${n === 1 ? "" : "s"} completed · ${next || TASKS_PER_REPEAT} more for the next` : undefined };
    });
  const welcome = WELCOME.map(([id, title, d, line]) => ({ id, title, collection: "Welcome", src: `${P}/staff_welcome/${id}.webp`, how: d ? `${d} days on the team. ${line}` : line, earned: days >= d, times: days >= d ? 1 : 0 }));
  const tenure = [1, 2, 3, 4, 5].map((y) => ({ id: `year_${y}`, title: `${y} Year${y === 1 ? "" : "s"}`, collection: "Tenure", src: `${P}/staff_tenure/year_${y}.webp`,
    how: `${y} year${y === 1 ? "" : "s"} on the team.`, earned: days >= y * 365, times: days >= y * 365 ? 1 : 0 }));
  return [...dept, ...welcome, ...tenure, ...LATER.map((b) => ({ ...b, earned: false, times: 0 }))];
}
