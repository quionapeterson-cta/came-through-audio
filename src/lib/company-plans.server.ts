import { planFromDoc, type CompanyPlan } from "@/lib/company-plans";

/**
 * Every `PLAN-*.md` at the repository root, read into the server bundle so Admin → Plans shows the plans main holds
 * without a plans-load.sql paste (founder, 2026-11-25). A `.server` module: the text must never reach the browser
 * bundle, because a plan carries pricing, staffing and unreleased work. Only `listPlans` imports this, behind the
 * super-admin check.
 */
const docs = import.meta.glob("../../PLAN*.md", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

export const REPO_PLANS: CompanyPlan[] = Object.entries(docs).map(([path, body]) =>
  planFromDoc(path, body),
);
