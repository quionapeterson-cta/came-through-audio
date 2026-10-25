import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { Input } from "@/components/ui/input";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { FAQ_CATEGORIES, FAQS } from "@/lib/faq";

export const Route = createFileRoute("/faq")({
  head: () => ({
    meta: [
      { title: "Frequently Asked Questions — Came Through Audio" },
      { name: "description", content: "Everything about embedding, My Catalog, agency exports, royalty health, split sheets, contracts and the AI Protection Hub." },
      { property: "og:title", content: "Frequently Asked Questions — Came Through Audio" },
      { property: "og:type", content: "website" },
    ],
  }),
  component: FaqPage,
});

/** Lowercase words without punctuation, so "ISRC?" finds "isrc". */
const words = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter(Boolean);

/** Every FAQ, grouped by topic, with a search box that matches every word typed in the question or answer. */
function FaqPage() {
  const [query, setQuery] = useState("");
  const found = useMemo(() => {
    const terms = words(query);
    if (!terms.length) return FAQS;
    return FAQS.filter((f) => { const hay = words(`${f.q} ${f.a}`).join(" "); return terms.every((t) => hay.includes(t)); });
  }, [query]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-background">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-5 sm:px-6">
          <BrandLogo tone="light" />
          <nav className="flex items-center gap-4 whitespace-nowrap sm:gap-6">
            <Link to="/plans" className="text-sm font-semibold text-muted-foreground hover:text-primary">Plans</Link>
            <Link to="/workspace" search={{ tab: undefined }} className="text-sm font-semibold text-muted-foreground hover:text-primary">Log in</Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
        <h1 className="text-center text-4xl font-bold md:text-5xl">Frequently Asked Questions</h1>
        <div className="relative mx-auto mt-8 max-w-xl">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <Input type="search" aria-label="Search the FAQ" placeholder="Search: ISRC, refunds, The MLC, split sheets…" value={query} onChange={(e) => setQuery(e.target.value)} className="h-12 pl-10 text-base" />
        </div>
        {query && <p className="mt-3 text-center text-sm text-muted-foreground">{found.length} {found.length === 1 ? "answer" : "answers"}</p>}

        <div className="mt-10 space-y-10">
          {FAQ_CATEGORIES.map((c) => {
            const list = found.filter((f) => f.category === c);
            if (!list.length) return null;
            return (
              <section key={c}>
                <h2 className="mb-3 text-sm font-bold uppercase tracking-[2px] text-primary">{c}</h2>
                <Accordion type="multiple" className="rounded-2xl border-2 border-foreground">
                  {list.map((f) => (
                    <AccordionItem key={f.q} value={f.q} className="px-6 last:border-b-0">
                      <AccordionTrigger className="text-left text-lg font-bold">{f.q}</AccordionTrigger>
                      <AccordionContent className="text-base leading-relaxed text-foreground">{f.a}</AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </section>
            );
          })}
          {!found.length && <p className="text-center text-muted-foreground">No answers match that yet.</p>}
        </div>

        <div className="mt-14 rounded-2xl bg-ink p-8 text-center text-ink-foreground">
          <p className="text-xl font-bold">Still have a question?</p>
          <p className="mt-1 text-sm text-ink-muted">We answer every ticket.</p>
          <Link to="/contact" search={{ type: "support" }} className="mt-4 inline-flex h-11 items-center rounded-md bg-primary px-6 font-semibold text-primary-foreground hover:bg-primary/90">Open a support ticket</Link>
        </div>
      </main>
    </div>
  );
}
