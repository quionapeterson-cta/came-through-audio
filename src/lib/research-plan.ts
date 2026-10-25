/**
 * Market Research team starter plan (PLAN-phase4-order item 7, approved 2026-10-25; PLAN-master-notes Phase 4): the
 * repeating tasks that keep Came Through Audio current with the agencies, the market and AI protection.
 */
export type ResearchTask = { title: string; body: string; importance: "top" | "high" | "normal" | "low"; repeat: "weekly" | "monthly" | "quarterly"; due_at: string };

export const RESEARCH_TITLES = ["Weekly industry news digest", "Monthly society policy review", "Quarterly competitor and pricing review", "Monthly AI protection research"] as const;

export function researchTasks(now = new Date()): ResearchTask[] {
  const inDays = (n: number) => new Date(now.getTime() + n * 86_400_000).toISOString();
  return [
    { title: RESEARCH_TITLES[0], importance: "normal", repeat: "weekly", due_at: inDays(7),
      body: "Royalty and rights news from the week: PROs, The MLC, SoundExchange, HFA, streaming payout changes, distributor policy, copyright and AI rulings. A short summary with links, and anything we should act on." },
    { title: RESEARCH_TITLES[1], importance: "high", repeat: "monthly", due_at: inDays(30),
      body: "Policy and form changes at ASCAP, BMI, SESAC, GMR, The MLC, SoundExchange, HFA and the main global PROs. For each change, a \"what changes for us\" note: export templates, registration rules, readiness checks, help text. Flag anything that needs an app update." },
    { title: RESEARCH_TITLES[2], importance: "normal", repeat: "quarterly", due_at: inDays(90),
      body: "Competitors' features and prices (catalog, metadata, split sheet, registration and AI protection tools), what artists say about them, and where Came Through Audio should respond." },
    { title: RESEARCH_TITLES[3], importance: "normal", repeat: "monthly", due_at: inDays(30),
      body: "New AI detection and provenance tools, possible partners, standards such as C2PA content credentials, and legal updates on AI training and voice cloning. What it means for the AI Protection Hub." },
  ];
}
