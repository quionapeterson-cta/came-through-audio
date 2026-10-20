import { Fragment, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ChevronDown } from "lucide-react";
import { listPlans, type CompanyPlan } from "@/lib/plans.functions";

/** **bold**, *italic* and `code` inside a line, as React elements (never raw HTML). */
function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*\s][^*]*\*)/g).filter(Boolean).map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("`") && part.endsWith("`")) return <code key={i} className="rounded bg-muted px-1 text-[0.9em]">{part.slice(1, -1)}</code>;
    if (part.startsWith("*") && part.endsWith("*") && part.length > 2) return <em key={i}>{part.slice(1, -1)}</em>;
    return <Fragment key={i}>{part}</Fragment>;
  });
}

const cells = (row: string) => row.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());

/** Renders the plan's Markdown: headings, lists, tables, quotes and paragraphs. */
function PlanBody({ body }: { body: string }) {
  const lines = body.split("\n");
  const out: ReactNode[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const key = `l${i}`;
    if (!line.trim() || line.trim() === "---") continue;
    if (line.startsWith("|")) {
      const rows: string[] = [];
      while (i < lines.length && lines[i]!.startsWith("|")) rows.push(lines[i++]!);
      i--;
      const [head, , ...rest] = rows;
      out.push(<div key={key} className="overflow-x-auto"><table className="my-3 w-full border-collapse text-sm">
        <thead><tr>{cells(head!).map((c, j) => <th key={j} className="border-b border-border px-2 py-1.5 text-left font-semibold">{inline(c)}</th>)}</tr></thead>
        <tbody>{rest.map((r, ri) => <tr key={ri}>{cells(r).map((c, j) => <td key={j} className="border-b border-border px-2 py-1.5 align-top">{inline(c)}</td>)}</tr>)}</tbody>
      </table></div>);
      continue;
    }
    const h = /^(#{1,4})\s+(.*)$/.exec(line);
    if (h) {
      const size = h[1]!.length <= 2 ? "mt-6 text-lg font-bold" : "mt-4 font-semibold";
      out.push(<p key={key} className={size}>{inline(h[2]!)}</p>);
      continue;
    }
    if (/^\s*([-*]|\d+\.)\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*([-*]|\d+\.)\s+/.test(lines[i]!)) items.push(lines[i++]!);
      i--;
      out.push(<ul key={key} className="my-2 list-disc space-y-1 pl-6 text-sm">{items.map((it, j) =>
        <li key={j} style={{ marginLeft: `${Math.floor((/^\s*/.exec(it)![0].length) / 2)}rem` }}>{inline(it.replace(/^\s*([-*]|\d+\.)\s+/, ""))}</li>)}</ul>);
      continue;
    }
    if (line.startsWith(">")) { out.push(<blockquote key={key} className="my-2 border-l-2 border-primary pl-3 text-sm text-muted-foreground">{inline(line.replace(/^>\s?/, ""))}</blockquote>); continue; }
    out.push(<p key={key} className="my-2 text-sm leading-relaxed">{inline(line)}</p>);
  }
  return <div className="max-w-4xl">{out}</div>;
}

/** Admin → Plans (super admins only): every planning document, newest status first in each card. */
export function PlansPanel() {
  const fetchPlans = useServerFn(listPlans);
  const q = useQuery({ queryKey: ["company-plans"], queryFn: () => fetchPlans() });
  const [open, setOpen] = useState<string>();
  if (q.isLoading) return <p className="mt-6 text-muted-foreground">Loading…</p>;
  if (q.isError) return <p className="mt-6 text-destructive">Couldn't load plans.</p>;
  const plans: CompanyPlan[] = q.data ?? [];
  if (!plans.length) return <p className="mt-6 max-w-2xl text-muted-foreground">No plans loaded yet. Paste plans-load.sql into the SQL editor to load them.</p>;
  return (
    <ul className="mt-6 space-y-3">
      {plans.map((p) => <li key={p.slug} className="rounded-2xl border border-border bg-card">
        <button type="button" onClick={() => setOpen(open === p.slug ? undefined : p.slug)} aria-expanded={open === p.slug}
          className="flex w-full items-start justify-between gap-4 p-5 text-left">
          <span className="min-w-0">
            <span className="block text-lg font-bold">{p.title}</span>
            <span className="mt-1 block text-sm text-muted-foreground">{p.status}</span>
          </span>
          <ChevronDown className={`mt-1 h-5 w-5 shrink-0 transition ${open === p.slug ? "rotate-180" : ""}`} />
        </button>
        {open === p.slug && <div className="border-t border-border px-5 pb-6 pt-2">
          <PlanBody body={p.body} />
          <p className="mt-6 text-xs text-muted-foreground">Updated {new Date(p.updated_at).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}</p>
        </div>}
      </li>)}
    </ul>
  );
}
