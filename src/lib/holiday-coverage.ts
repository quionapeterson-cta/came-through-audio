import type { StaffAccess } from "./departments";

/**
 * Holiday coverage (founder, 2026-11-05): one or two department leads work each break so members are not met with a
 * silent inbox, and any employee who wants the extra earnings can put their name down. Pay is NOT decided: the rate,
 * the hours and whether it is overtime are the founder's call, so this plan carries no number at all until then.
 */
export const HOLIDAY_PAY_STATUS = "undecided" as const;

/** The breaks the team takes. Dates are set by the founder each year and are never written here. */
export const HOLIDAY_BREAKS = ["Christmas and New Year", "Thanksgiving", "Spring break"] as const;

export type CoverageSection = { title: string; points: string[]; undecided?: string };

export const COVERAGE_SECTIONS: CoverageSection[] = [
  {
    title: "Who covers a break",
    points: [
      "One or two department leads stay reachable for each break, so every open ticket has a person behind it.",
      "Super admins hold the founder-level calls: refunds, legal questions and anything about money.",
      "Cover is a rota, not a default. Nobody is assumed to be working because they answered once last year.",
    ],
  },
  {
    title: "Anyone can ask for the extra earnings",
    points: [
      "Employees who want to work through a break can put their name down; their department lead approves it.",
      "Approval is on a need basis: the queue and the coverage gaps decide, not a wish to bank hours.",
      "Same rule for overtime. It is offered where the work needs it and approved before it is worked, never assumed.",
      "A person who is not approved is on the break, and their messages wait. That is not a performance problem.",
    ],
  },
  {
    title: "Holiday pay",
    points: [
      "The pay rate, the minimum hours and whether a break counts as overtime are not set yet.",
      "Nothing here promises a rate, a bonus or a day rate. The founder sets it, and it then lives in one constant quoted everywhere.",
      "Until it is approved, agree the terms in writing with the person before they work the break.",
    ],
    undecided: "Pay rate, hours and overtime treatment are undecided.",
  },
  {
    title: "Before the break",
    points: [
      "Agree the rota: who is reachable, on which days, and who is the backup.",
      "Post the holiday script on every open ticket and switch on the mailbox auto-reply, naming the day we reopen.",
      "Hand anything urgent, money-related or legal to a super admin before the team closes.",
      "Tell each person on the rota who approved their hours, so nobody works a break on a verbal maybe.",
    ],
  },
  {
    title: "What members are told",
    points: [
      "The holiday scripts in Admin → Support Scripts say the team is away, name the day we reopen, and give a typical wait rather than a promise.",
      "Cover does not change what we tell members. A shorter queue is a better answer, not a promise of one.",
    ],
  },
];

/** Super admins and department leads see this plan; nobody else needs the rota. */
export function canSeeHolidayPlan(access: StaffAccess | null | undefined): boolean {
  return access?.role === "super_admin" || access?.role === "department_lead";
}
