import { useMemo, useState } from "react";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { AudioLines, ArrowRight, CheckCircle2, Coins, CreditCard, LifeBuoy, Search, Tags } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { SignupCard } from "@/components/SignupCard";
import { submitSupportTicket, ticketSchema } from "@/lib/support.functions";
import { categoryFor, TICKET_TOPICS } from "@/lib/support-topics";
import { deflectionFor, FORM_TIPS, HELP_CATEGORIES, helpArticles, type HelpCategory, type HelpIcon } from "@/lib/help-center";
import { searchHelp } from "@/lib/help-search";
import { SUPPORT_EMAIL } from "@/lib/email-layout";
import { useAuth } from "@/hooks/useAuth";

/**
 * The Help Center (founder, 2026-11-10): answers first, ticket second. Search over everything we publish, four topic
 * cards whose answers come from the FAQ and the support quick answers, and the ticket form below them — never on top of
 * them. A general inquiry is not a ticket and lives at `/contact-us`; old `?type=contact` links land there.
 */
type Search = { type?: "support" | "contact" | undefined };

export const Route = createFileRoute("/contact")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    type: s["type"] === "support" ? "support" : s["type"] === "contact" ? "contact" : undefined,
  }),
  beforeLoad: ({ search }) => {
    if (search.type === "contact") throw redirect({ to: "/contact-us" });
  },
  head: () => ({
    meta: [
      { title: "Help Center & Support — Came Through Audio" },
      { name: "description", content: "Search the answers first: files, metadata, billing, royalties and registration. If it isn't here, open a support ticket and our team replies by email." },
      { property: "og:title", content: "Help Center & Support — Came Through Audio" },
      { property: "og:description", content: "Answers for your masters, metadata, billing and royalties — then a support ticket if you still need one." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: HelpCenterPage,
});

const ICONS: Record<HelpIcon, typeof AudioLines> = {
  audio: AudioLines,
  metadata: Tags,
  billing: CreditCard,
  royalties: Coins,
};

const POPULAR = ["royalties", "metadata", "file uploads", "refund", "split sheet", "registration"];
const PLACEHOLDER = "Search for answers... (e.g., royalties, metadata, file uploads)";

function HelpCenterPage() {
  const send = useServerFn(submitSupportTicket);
  const { user, loading } = useAuth();
  const [query, setQuery] = useState("");
  const [chosen, setChosen] = useState<HelpCategory["id"] | undefined>(undefined);
  const [form, setForm] = useState<{ name: string; area: string; issue: string; subject: string; message: string; website: string }>({
    name: "",
    area: TICKET_TOPICS[0].area,
    issue: TICKET_TOPICS[0].issues[0],
    subject: "",
    message: "",
    website: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [failure, setFailure] = useState("");

  const term = query.trim();
  const results = useMemo(() => (term.length >= 2 ? searchHelp(term, 6) : []), [term]);
  const issues = TICKET_TOPICS.find((t) => t.area === form.area)?.issues ?? [];
  const deflections = deflectionFor(form.area);
  const needsLogin = !loading && !user;
  const selected = HELP_CATEGORIES.find((c) => c.id === chosen);

  function reveal(id: HelpCategory["id"] | undefined) {
    setChosen(id);
    // The answers sit under the cards, so picking a card takes you to them instead of leaving you to scroll.
    window.setTimeout(() => document.getElementById("answers")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  }

  function pickArea(e: React.ChangeEvent<HTMLSelectElement>) {
    const area = e.target.value;
    setForm({ ...form, area, issue: TICKET_TOPICS.find((t) => t.area === area)?.issues[0] ?? "" });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFailure("");
    const parsed = ticketSchema.safeParse({
      ...form,
      category: categoryFor(form.area, form.issue),
      kind: "support",
      email: user?.email ?? "",
    });
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])));
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      const { email: _email, ...rest } = parsed.data;
      await send({ data: rest });
      setDone(true);
    } catch (err) {
      setFailure(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="bg-ink text-ink-foreground">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <BrandLogo />
          <div className="flex items-center gap-5 text-sm font-semibold">
            <Link to="/faq" className="text-ink-muted hover:text-primary">Full FAQ</Link>
            <Link to="/" className="text-ink-muted hover:text-primary">Home</Link>
          </div>
        </div>
      </header>

      {/* Hero: one question, one search box. Everything else stays below it. */}
      <section className="relative overflow-hidden bg-ink text-ink-foreground">
        <div className="pointer-events-none absolute -top-32 left-1/2 h-72 w-[46rem] -translate-x-1/2 rounded-full bg-primary/25 blur-3xl" aria-hidden="true" />
        <div className="relative mx-auto max-w-3xl px-6 pb-16 pt-14 text-center sm:pb-20 sm:pt-20">
          <p className="text-xs font-bold uppercase tracking-[3px] text-primary">Help Center</p>
          <h1 className="mt-3 text-4xl font-bold leading-tight sm:text-5xl">How can we help?</h1>
          <p className="mx-auto mt-4 max-w-xl text-ink-muted">
            Most questions are answered right here. Search, or start with a topic — and only open a ticket if the answer
            isn't in front of you.
          </p>
          <form
            role="search"
            onSubmit={(e) => e.preventDefault()}
            className="mx-auto mt-8 max-w-2xl"
          >
            <label htmlFor="help-search" className="sr-only">Search for answers</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
              <input
                id="help-search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={PLACEHOLDER}
                maxLength={120}
                className="h-14 w-full rounded-full border border-ink-border bg-card pl-12 pr-4 text-sm text-card-foreground shadow-2xl outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring sm:pl-14 sm:pr-5 sm:text-base"
              />
            </div>
          </form>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-xs">
            <span className="text-ink-muted">Popular:</span>
            {POPULAR.map((p) => (
              <button key={p} type="button" onClick={() => setQuery(p)}
                className="rounded-full border border-ink-border px-3 py-1 font-semibold text-ink-muted transition hover:border-primary hover:text-primary">
                {p}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* What the search found, before the cards: the answer is the point, not the ticket. */}
      {term.length >= 2 && (
        <section className="border-b border-border bg-background">
          <div className="mx-auto max-w-3xl px-6 py-10">
            <h2 className="text-lg font-bold">
              {results.length ? `Answers for “${term}”` : `Nothing matched “${term}” yet`}
            </h2>
            {results.length ? (
              <div className="mt-4 space-y-3">
                {results.map((r) => (
                  <article key={r.id} className="rounded-2xl border border-border bg-card p-5">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{r.source}</p>
                    <h3 className="mt-1 font-bold">{r.title}</h3>
                    <p className="mt-1 line-clamp-3 text-sm leading-relaxed text-muted-foreground">{r.text}</p>
                    {r.link && <a href={r.link.to} className="mt-2 inline-block text-sm font-semibold text-primary underline">{r.link.label}</a>}
                  </article>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">
                Try fewer words, or pick a topic below. If it still isn't here, the ticket form is at the bottom of this
                page and a person will answer by email.
              </p>
            )}
            <button type="button" onClick={() => setQuery("")} className="mt-4 text-sm font-semibold text-primary underline">
              Clear the search
            </button>
          </div>
        </section>
      )}

      {/* The four cards. Each one is a filter for the answers below, and the count says what is waiting inside. */}
      <section className="mx-auto max-w-6xl px-6 py-14 sm:py-16">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-bold sm:text-3xl">Browse by topic</h2>
          <p className="mt-2 text-muted-foreground">Pick the part of the product your question is about. The answers open in place, no page change.</p>
        </div>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {HELP_CATEGORIES.map((c) => {
            const Icon = ICONS[c.icon];
            const count = helpArticles(c).length;
            const active = chosen === c.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => reveal(active ? undefined : c.id)}
                aria-pressed={active}
                className={`group flex h-full flex-col items-start rounded-2xl border p-6 text-left transition ${
                  active ? "border-primary bg-primary/5 shadow-lg" : "border-border bg-card hover:-translate-y-0.5 hover:border-primary/60 hover:shadow-lg"
                }`}
              >
                <span className={`flex h-12 w-12 items-center justify-center rounded-xl ${active ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary"}`}>
                  <Icon className="h-6 w-6" />
                </span>
                <span className="mt-4 text-lg font-bold leading-snug">{c.title}</span>
                <span className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{c.blurb}</span>
                <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-primary">
                  {count} answers <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                </span>
              </button>
            );
          })}
        </div>

        <div id="answers" className="mt-12 scroll-mt-6">
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => setChosen(undefined)}
              className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${chosen ? "text-muted-foreground hover:text-foreground" : "bg-primary text-primary-foreground"}`}>
              All topics
            </button>
            {HELP_CATEGORIES.map((c) => (
              <button key={c.id} type="button" onClick={() => setChosen(c.id)}
                className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${chosen === c.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                {c.title}
              </button>
            ))}
          </div>
          <AnswerGroups selected={selected} />
          <p className="mt-6 text-sm text-muted-foreground">
            Looking for something broader? The <Link to="/faq" className="font-semibold text-primary underline">full FAQ</Link>{" "}
            covers plans, exports, registration and branding.
          </p>
        </div>
      </section>

      {/* Still need help: the form, quiet and below the answers. */}
      <section id="ticket" className="scroll-mt-6 border-t border-border bg-muted/30">
        <div className="mx-auto grid max-w-6xl gap-8 px-6 py-14 sm:py-16 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><LifeBuoy className="h-5 w-5" /></span>
            <h2 className="mt-4 text-3xl font-bold">Still need help?</h2>
            <p className="mt-3 text-muted-foreground">
              Open a support ticket and a person answers by email. Most replies go out in about 48 hours; a high-volume
              week or a holiday break can take longer.
            </p>
            <ul className="mt-5 space-y-2 text-sm text-muted-foreground">
              <li>• Tell us the song, the step and what happened instead.</li>
              <li>• Your browser and a screenshot save a round trip.</li>
              <li>• The whole conversation lands in your workspace Support tab.</li>
              <li>• Billing questions go straight to Billing with Account &amp; billing.</li>
            </ul>
            {FORM_TIPS.length > 0 && (
              <details className="mt-5 rounded-xl border border-border bg-card px-4 py-3">
                <summary className="cursor-pointer text-sm font-semibold">Writing a ticket we can answer in one go</summary>
                <div className="mt-2 space-y-2">
                  {FORM_TIPS.map((f) => (
                    <p key={f.q} className="text-sm leading-relaxed text-muted-foreground">{f.a}</p>
                  ))}
                </div>
              </details>
            )}
            <p className="mt-2 text-sm text-muted-foreground">
              You can also write to <a className="font-semibold text-primary underline" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
            </p>
          </div>

          <div className="lg:col-span-3">
            {done ? (
              <div className="rounded-2xl border-2 border-primary bg-card p-8 text-center">
                <CheckCircle2 className="mx-auto h-10 w-10 text-primary" />
                <p className="mt-3 text-xl font-bold">Message received</p>
                <p className="mt-2 text-muted-foreground">
                  Thanks, {form.name.split(" ")[0] || "there"}. Our team will reply to {user?.email}. Follow it in your
                  workspace Support tab — the reply lands on the same ticket.
                </p>
                <div className="mt-6 flex flex-wrap justify-center gap-2">
                  <Button asChild><Link to="/workspace" search={{ tab: "support" }}>Open my Support tab</Link></Button>
                  <Button asChild variant="outline"><Link to="/">Back to home</Link></Button>
                </div>
              </div>
            ) : needsLogin ? (
              <div className="rounded-2xl border border-border bg-card p-6 sm:p-8">
                <h3 className="text-xl font-bold">Log in to open a ticket</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  A ticket needs an account so we can look at the right one and reply to the right email.
                </p>
                <SignupCard returnPath="/contact?type=support" />
              </div>
            ) : (
              <form onSubmit={onSubmit} className="space-y-5 rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8" noValidate>
                <Field label="Name" error={errors["name"]}>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={100} autoComplete="name" />
                </Field>
                <div className="rounded-lg border border-border bg-muted/40 px-3 py-2.5 text-sm text-muted-foreground">
                  We'll reply to your account email, <span className="font-semibold text-foreground">{user?.email}</span>.
                </div>
                <Field label="Where is it?" error={errors["category"]}>
                  <select value={form.area} onChange={pickArea} className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm">
                    {TICKET_TOPICS.map((t) => <option key={t.area}>{t.area}</option>)}
                  </select>
                </Field>
                <Field label="What's happening?" error={errors["issue"]}>
                  <select value={form.issue} onChange={(e) => setForm({ ...form, issue: e.target.value })}
                    className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm">
                    {issues.map((i) => <option key={i}>{i}</option>)}
                  </select>
                </Field>

                {/* Deflection: the same area's quick answers, offered once the person has told us where the trouble is. */}
                {deflections.length > 0 && (
                  <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
                    <p className="text-sm font-semibold">Did these articles help answer your question?</p>
                    <div className="mt-2 space-y-2">
                      {deflections.map((f) => (
                        <details key={f.q} className="rounded-lg bg-card/70 px-3 py-2">
                          <summary className="cursor-pointer text-sm font-semibold text-primary">{f.q}</summary>
                          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{f.a}</p>
                        </details>
                      ))}
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">Answered? No ticket needed. If not, we're right here.</p>
                  </div>
                )}

                <Field label="Subject" error={errors["subject"]}>
                  <Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} maxLength={150}
                    placeholder="One line: what should we look at?" />
                </Field>
                <Field label="Message" error={errors["message"]}>
                  <Textarea rows={6} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} maxLength={3000}
                    placeholder="What you clicked, what you expected and what happened instead." />
                </Field>
                <input type="text" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden"
                  value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} />
                {failure && <p className="text-sm text-destructive">{failure}</p>}
                <Button type="submit" disabled={busy} className="w-full rounded-full">{busy ? "Sending…" : "Submit Ticket"}</Button>
                <p className="text-center text-xs text-muted-foreground">
                  We never ask for a card number. The card on file is changed on Stripe's own page.
                </p>
              </form>
            )}
          </div>
        </div>
      </section>

      <footer className="bg-ink text-ink-muted">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-6 py-8 text-xs sm:flex-row">
          <p>Came Through Audio, LLC</p>
          <Link to="/" className="font-semibold text-ink-foreground hover:text-primary">Back to the site</Link>
        </div>
      </footer>
    </div>
  );
}

/** The answers under the cards: one group when a card is chosen, all four when it isn't. */
function AnswerGroups({ selected }: { selected?: HelpCategory | undefined }) {
  const groups = selected ? [selected] : HELP_CATEGORIES;
  return (
    <div className="mt-6 space-y-8">
      {groups.map((c) => {
        const articles = helpArticles(c);
        return (
          <div key={c.id}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-xl font-bold">{c.title}</h3>
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{articles.length} answers</span>
            </div>
            <Accordion type="multiple" className="mt-3 rounded-2xl border border-border bg-card px-5">
              {articles.map((a) => (
                <AccordionItem key={a.id} value={a.id}>
                  <AccordionTrigger className="py-4 text-left text-base font-semibold hover:no-underline">{a.q}</AccordionTrigger>
                  <AccordionContent className="pb-4 text-sm leading-relaxed text-muted-foreground">{a.a}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        );
      })}
    </div>
  );
}

function Field({ label, error, children }: { label: string; error?: string | undefined; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-semibold">{label}</span>
      {children}
      {error && <span className="block text-sm text-destructive">{error}</span>}
    </label>
  );
}
