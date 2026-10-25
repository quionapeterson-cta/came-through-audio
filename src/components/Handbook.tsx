import { useState } from "react";
import { PlayCircle, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { HANDBOOK, searchHandbook, TUTORIALS } from "@/lib/handbook";
import { searchHelp } from "@/lib/help-search";

/**
 * Admin → Handbook (Phase 4 item 10): the team handbook, tutorial videos (coming soon until recorded) and one search
 * over the handbook and the customer answer library (FAQ, glossary, Help Center), for answering customers fast.
 */
export function Handbook() {
  const [q, setQ] = useState("");
  const inBook = q.trim() ? searchHandbook(q) : [];
  const answers = q.trim() ? searchHelp(q, 5) : [];
  return (
    <div className="mt-4 space-y-8">
      <label className="relative block max-w-xl">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search the handbook and the answer library" aria-label="Search the handbook and answer library" className="pl-9" />
      </label>
      {q.trim() && (
        <section className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-widest text-primary">Results</h3>
          {inBook.length + answers.length === 0 && <p className="text-sm text-muted-foreground">Nothing found. Ask your lead, then add the answer to the FAQ so the next person finds it.</p>}
          {inBook.map((s) => <article key={s.id} className="rounded-xl border border-primary/50 p-4"><p className="text-xs font-semibold text-primary">Handbook</p><h4 className="font-bold">{s.title}</h4>{s.body.map((b, i) => <p key={i} className="mt-1 text-sm">{b}</p>)}</article>)}
          {answers.map((a) => <article key={a.id} className="rounded-xl border border-border p-4"><p className="text-xs font-semibold text-muted-foreground">{a.source}</p><h4 className="font-bold">{a.title}</h4><p className="mt-1 text-sm">{a.text}</p>{a.link && <a href={a.link.to} className="mt-1 inline-block text-sm font-semibold text-primary underline">{a.link.label}</a>}</article>)}
        </section>
      )}
      <section className="grid gap-4 md:grid-cols-2">
        {HANDBOOK.map((s) => (
          <article key={s.id} className="rounded-xl border border-border p-4">
            <h3 className="font-bold">{s.title}</h3>
            {s.body.map((b, i) => <p key={i} className="mt-2 text-sm leading-relaxed text-muted-foreground">{b}</p>)}
          </article>
        ))}
      </section>
      <section>
        <h3 className="mb-3 text-xs font-bold uppercase tracking-widest text-primary">Tutorial videos</h3>
        <ul className="grid gap-2 sm:grid-cols-2">
          {TUTORIALS.map((t) => <li key={t.title} className="flex items-center gap-2 rounded-lg border border-border p-3 text-sm">
            <PlayCircle className="h-5 w-5 shrink-0 text-primary" />
            {t.url ? <a href={t.url} target="_blank" rel="noreferrer" className="font-semibold underline">{t.title}</a> : <span>{t.title} <span className="text-xs text-muted-foreground">· coming soon</span></span>}
          </li>)}
        </ul>
      </section>
    </div>
  );
}
