import { createElement, Fragment, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

/** Admin → Legal: section wording that replaces the built-in text (src/lib/legal-docs.tsx). The intro's key is "intro". */
export type LegalDocId = "terms" | "privacy" | "refunds";
export type LegalOverride = { body: string; updatedAt: string };
export type LegalOverrides = Record<string, LegalOverride>;
export const INTRO_KEY = "intro";

/** The current wording for one page. Empty before migration 20261027200000 runs, so the built-in text shows. */
export async function loadLegalOverrides(doc: LegalDocId): Promise<LegalOverrides> {
  try {
    const { data, error } = await supabase.from("legal_overrides" as never).select("section, body, updated_at").eq("doc", doc);
    if (error) return {};
    return Object.fromEntries(((data ?? []) as { section: string; body: string; updated_at: string }[]).map((r) => [r.section, { body: r.body, updatedAt: r.updated_at }]));
  } catch { return {}; }
}

export async function saveLegalOverride(doc: LegalDocId, section: string, body: string) {
  const { error } = await supabase.from("legal_overrides" as never)
    .upsert({ doc, section, body: body.trim(), updated_at: new Date().toISOString() } as never, { onConflict: "doc,section" });
  if (error) throw new Error(error.message.includes("legal_overrides") ? "Run migration 20261027200000 first." : error.message);
}

/** Goes back to the built-in wording (the replaced text is kept in the history). */
export async function clearLegalOverride(doc: LegalDocId, section: string) {
  const { error } = await supabase.from("legal_overrides" as never).delete().eq("doc", doc).eq("section", section);
  if (error) throw new Error(error.message);
}

const LINK = /\[([^\]]+)\]\(((?:https?:\/\/|mailto:|\/)[^)\s]+)\)/g;

/** One line of text with [link text](address) links. */
function inline(text: string, key: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0, i = 0;
  for (const m of text.matchAll(LINK)) {
    if (m.index! > last) out.push(text.slice(last, m.index));
    out.push(createElement("a", { key: `${key}-${i++}`, href: m[2], className: "text-primary underline" }, m[1]));
    last = m.index! + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

/**
 * Plain text as the page shows it: a blank line starts a new paragraph, lines starting with "- " are a bulleted list,
 * and [text](https://…) or [text](mailto:…) makes a link. Nothing else is interpreted, so no code can be added.
 */
export function renderLegalText(body: string): ReactNode {
  const blocks = body.trim().split(/\n\s*\n/);
  return createElement(Fragment, null, ...blocks.map((block, b) => {
    const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length && lines.every((l) => l.startsWith("- "))) {
      return createElement("ul", { key: b, className: "list-disc space-y-1 pl-5" }, ...lines.map((l, i) => createElement("li", { key: i }, ...inline(l.slice(2), `${b}-${i}`))));
    }
    return createElement("p", { key: b }, ...inline(lines.join(" "), String(b)));
  }));
}

/** The built-in wording as editable text, in the same format renderLegalText reads (for Admin → Legal). */
export function htmlToLegalText(html: string): string {
  const decode = (s: string) => s.replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&");
  return decode(html
    .replace(/<a [^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/g, (_, href: string, text: string) => `[${text.replace(/<[^>]+>/g, "")}](${href})`)
    .replace(/<li[^>]*>/g, "- ").replace(/<\/li>/g, "\n")
    .replace(/<\/(p|ul|ol|div)>/g, "\n\n").replace(/<br\s*\/?>/g, "\n")
    .replace(/<[^>]+>/g, ""))
    .replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

/** "October 27, 2026": the page's date, or the newest edit if that's later. */
export function lastUpdated(builtIn: string, overrides: LegalOverrides): string {
  const newest = Object.values(overrides).map((o) => o.updatedAt).sort().pop();
  if (!newest || Date.parse(newest) <= Date.parse(builtIn)) return builtIn;
  return new Date(newest).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}
