import type { LucideIcon } from "lucide-react";
import { Award, BookOpen, Building, Building2, CalendarDays, CreditCard, Dot, FileSignature, FileText, Home, Layers, LayoutList, LifeBuoy, Lightbulb, ListChecks, Mail, MessagesSquare, Receipt, Scale, ShieldCheck, Repeat2, Sparkles, Sun, Tags, Trophy, UserCog, Users2 } from "lucide-react";

/**
 * The Admin dashboard's navigation (founder, 2026-11-05): the flat list of tabs became four groups a person can scan.
 * This file is the map only — `visibleTabs` in departments.ts still decides what each person may see, so a group never
 * shows a tab the database would refuse.
 */
export type NavTab = { value: string; label: string };

export type NavGroup = { key: string; label: string; hint: string; tabs: NavTab[] };

const GROUPS: { key: string; label: string; hint: string; values: string[] }[] = [
  { key: "operations", label: "Operations", hint: "Today's work, and who is on it", values: ["queue", "team", "tasks", "calendar", "support", "scripts", "accounts", "retired"] },
  { key: "roster", label: "Roster & Revenue", hint: "Members, money and artwork", values: ["reg", "splits", "purchases", "billing", "badges"] },
  { key: "legal", label: "Legal & Intellectual Property", hint: "Contracts, rights and paperwork", values: ["legal", "company", "ai", "pdf"] },
  { key: "hr", label: "HR & Internal Knowledge", hint: "The team, the plans and the handbook", values: ["staff-plan", "handbook", "prices", "recognition", "holiday", "plans", "email", "homepage", "submissions"] },
];

/**
 * Groups the caller's tabs, dropping empty groups and any tab this map doesn't know yet into a final "More" group, so a
 * new tab is reachable the day it ships instead of silently disappearing.
 */
export function groupTabs(tabs: NavTab[]): NavGroup[] {
  const byValue = new Map(tabs.map((t) => [t.value, t]));
  const groups: NavGroup[] = [];
  for (const g of GROUPS) {
    const found = g.values.map((v) => byValue.get(v)).filter((t): t is NavTab => !!t);
    if (found.length) groups.push({ key: g.key, label: g.label, hint: g.hint, tabs: found });
    for (const t of found) byValue.delete(t.value);
  }
  const rest = tabs.filter((t) => byValue.has(t.value));
  if (rest.length) groups.push({ key: "more", label: "More", hint: "Everything else you can open", tabs: rest });
  return groups;
}

/** The tab's own label, for the page heading. */
export function tabLabel(tabs: NavTab[], value: string): string {
  return tabs.find((t) => t.value === value)?.label ?? "Dashboard";
}

const ICONS: Record<string, LucideIcon> = {
  queue: ListChecks, team: Users2, tasks: LayoutList, calendar: CalendarDays, support: LifeBuoy, scripts: MessagesSquare, accounts: UserCog,
  reg: Building2, splits: FileSignature, purchases: Receipt, billing: CreditCard, badges: Award,
  legal: Scale, company: Building, ai: ShieldCheck, pdf: FileText,
  retired: Repeat2, "staff-plan": Sparkles, handbook: BookOpen, prices: Tags, recognition: Trophy, holiday: Sun, plans: Layers, email: Mail, homepage: Home, submissions: Lightbulb,
};

export const tabIcon = (value: string): LucideIcon => ICONS[value] ?? Dot;
