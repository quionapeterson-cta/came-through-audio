import { planPrice } from "@/components/UpgradeLock";
import { Disclaimer } from "@/components/Disclaimer";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { DOCS, docBySlug } from "@/lib/docs";

export const Route = createFileRoute("/docs/$slug")({
  loader: ({ params }) => {
    const doc = docBySlug(params.slug);
    if (!doc) throw notFound();
    return doc;
  },
  head: ({ loaderData }) => ({
    meta: loaderData ? [
      { title: `${loaderData.title} — Came Through Audio` },
      { name: "description", content: loaderData.description },
      { property: "og:title", content: `${loaderData.title} — Came Through Audio` },
      { property: "og:description", content: loaderData.description },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ] : [],
  }),
  component: DocPage,
});

function DocPage() {
  const doc = Route.useLoaderData();
  const related = DOCS.filter((d) => d.group === doc.group && d.slug !== doc.slug);

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

      <main className="mx-auto max-w-5xl px-4 py-14 sm:px-6">
        <div className="grid gap-12 lg:grid-cols-[1fr_14rem]">
          <article className="min-w-0">
            <p className="text-sm font-bold uppercase tracking-[2px] text-primary">{doc.group}</p>
            <h1 className="mt-2 text-4xl font-bold md:text-5xl">{doc.title}</h1>
            <p className="mt-4 text-lg text-muted-foreground">{doc.intro}</p>
            <div className="mt-10 space-y-10">
              {doc.sections.map((s) => (
                <section key={s.heading}>
                  <h2 className="mb-3 text-2xl font-bold">{s.heading}</h2>
                  {s.paragraphs?.map((p) => <p key={p} className="mb-3 leading-relaxed text-muted-foreground">{p}</p>)}
                  {s.bullets && (
                    <ul className="space-y-2">
                      {s.bullets.map((b) => <li key={b} className="flex gap-3 leading-relaxed"><Check className="mt-1 h-4 w-4 shrink-0 text-primary" strokeWidth={3} /><span>{b}</span></li>)}
                    </ul>
                  )}
                </section>
              ))}
            </div>
            <div className="mt-14 flex flex-col items-start gap-4 rounded-2xl bg-ink p-8 text-ink-foreground sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xl font-bold">Ready to organize your music business?</p>
                <p className="text-sm text-ink-muted">Start free. Unlock embedding and your catalog for {planPrice("plus")}, billed annually.</p>
              </div>
              <div className="flex shrink-0 gap-3">
                <Link to="/plans" className="inline-flex h-11 items-center rounded-md border border-ink-border px-5 font-semibold hover:bg-ink-border">Compare plans</Link>
                <Link to="/" hash="signup" className="inline-flex h-11 items-center rounded-md bg-primary px-5 font-semibold text-primary-foreground hover:bg-primary/90">Sign up free</Link>
              </div>
            </div>
          </article>

          <aside className="lg:sticky lg:top-8 lg:self-start">
            <p className="mb-3 text-xs font-bold uppercase tracking-[2px] text-muted-foreground">More in {doc.group}</p>
            <ul className="space-y-2">
              {related.map((d) => <li key={d.slug}><Link to="/docs/$slug" params={{ slug: d.slug }} className="font-semibold hover:text-primary">{d.title}</Link></li>)}
            </ul>
          </aside>
        </div>
      </main>

      <footer className="bg-ink text-ink-muted">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-6 px-6 py-8 text-sm">
          <Link to="/terms-of-service" className="hover:text-ink-foreground">Terms of Service</Link>
          <Link to="/refund-policy" className="hover:text-ink-foreground">Refund Policy</Link>
          <Link to="/privacy-policy" className="hover:text-ink-foreground">Privacy Policy</Link>
        </div>
        <div className="border-t border-ink-border py-6 text-center text-sm">© {new Date().getFullYear()} Came Through Audio, LLC</div>
        <Disclaimer k="site" tone="ink" className="mx-auto max-w-4xl justify-center px-6 pb-8 text-center" />
      </footer>
    </div>
  );
}
