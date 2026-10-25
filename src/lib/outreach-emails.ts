/**
 * Company outreach emails (PLAN-phase4-order item 5, approved 2026-10-25): cold, follow-up and demo-invite messages to
 * labels, music-tech and music-creation companies, sent from partnerships@ in Admin → Company Contracts. Each template
 * only pre-fills the subject and message; the super admin edits both before sending.
 */
export const OUTREACH_FROM = "Came Through Audio <partnerships@camethroughaudio.com>";
export const OUTREACH_DAILY_LIMIT = 50;

export type OutreachKind = "cold" | "followup" | "demo";
export type OutreachFields = { name: string; company: string; line: string; demo: string; sender: string };

export const OUTREACH_LABEL: Record<OutreachKind, string> = { cold: "First email", followup: "Follow-up", demo: "Demo invite" };

export function outreachDraft(kind: OutreachKind, f: OutreachFields): { subject: string; body: string } {
  const hi = `Hi ${f.name.trim() || "there"},`;
  const sign = `${f.sender.trim() || "Qui-Ona Peterson"}\nFounder & CEO, Came Through Audio, LLC\nYOUR FIRST STOP BEFORE DISTRIBUTION`;
  const personal = f.line.trim() ? `${f.line.trim()}\n\n` : "";
  if (kind === "cold") return {
    subject: `Came Through Audio x ${f.company.trim() || "your team"}`,
    body: `${hi}\n\n${personal}I'm the founder of Came Through Audio, the first stop for artists before distribution. Artists embed their credits into their masters, organize their catalog, settle splits and get every song registered, so the money they earn can find them.\n\nA lot of royalties never reach the people who earned them because the details were missing when the song went out. We fix that before release.\n\nI'd love to talk about how Came Through Audio could come through for ${f.company.trim() || "your artists"}. Do you have 20 minutes next week?\n\n${sign}`,
  };
  if (kind === "followup") return {
    subject: `Following up: Came Through Audio x ${f.company.trim() || "your team"}`,
    body: `${hi}\n\nFollowing up on my last note. ${personal}If now isn't the right time, no problem at all; just tell me who on your team handles artist tools or partnerships and I'll reach out to them instead.\n\nHappy to send a 2 minute walkthrough if that's easier than a call.\n\n${sign}`,
  };
  return {
    subject: `Your Came Through Audio demo`,
    body: `${hi}\n\nThanks for making time. ${personal}Here's your demo: ${f.demo.trim() || "[time and link]"}\n\nWe'll walk through embedding, the catalog, split sheets and the Royalty Health Report, then talk about what a partnership could look like for ${f.company.trim() || "your team"}. Before launch, everything we show stays between us.\n\n${sign}`,
  };
}
