import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, Mic, Guitar, Disc3, NotebookPen, Music, Quote } from "lucide-react";
import { SignupCard } from "@/components/SignupCard";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Came Through Audio — Embed Metadata & Organize Your Music Business" },
      { name: "description", content: "Organize your catalog, embed permanent metadata in your audio and check your royalty health from one secure dashboard." },
      { property: "og:title", content: "Came Through Audio — Organize Your Music Business Like a Pro" },
      { property: "og:description", content: "Catalog, metadata embedding and royalty health checks for independent musicians." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const includes = ["Metadata Embedding", "Cataloging", "Royalty Audit", "Blockchain Timestamp", "Secure Vault"];

const roles = [
  { icon: Mic, title: "Artist", scene: "Recording in studio", text: "Centralize your master files and preserve your recording legacy safely." },
  { icon: Guitar, title: "Musician", scene: "Playing an instrument live", text: "Ensure your performance tracking metadata is locked into every release." },
  { icon: Disc3, title: "Producer", scene: "Working on a beat machine", text: "Secure your production splits and protect your sample history upfront." },
  { icon: NotebookPen, title: "Songwriter", scene: "Writing with a notebook", text: "Lock down your lyrical ownership and claim your mechanical collection stakes." },
  { icon: Music, title: "Composer", scene: "Scoring on sheet music", text: "Anchor your cinematic compositions and publishing percentages flawlessly." },
];

const values = [
  "Unlimited Master Catalog entries and downloads. Your music and data locked securely in one permanent home base. No more searching for scattered songs and album art in emails, text and random hard drives.",
  "Unlimited Real Metadata Embedding: Don’t question, rather you’ll get paid properly when your song lands a sync licensing or brand deal and is played in a major venue! Sign up now and start embedding.",
  "Unlimited Royalty Health Checks: Run Health checks on the major public repertoires to see if your song shows up and if there is missing important Metadata in those systems; all from one place. If your song is not properly registered you could be missing out on your royalty payouts! Sign up now and get a free Royalty Health Check.",
];

function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="bg-ink text-ink-foreground">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <span className="text-lg font-bold tracking-tight">Came Through <span className="text-primary">Audio</span></span>
          <Link to="/workspace" search={{ tab: undefined }} className="text-sm font-semibold text-ink-muted hover:text-primary">Log in</Link>
        </div>
      </header>

      <section className="bg-ink text-ink-foreground">
        <div className="mx-auto grid max-w-7xl gap-12 px-6 pb-20 pt-10 lg:grid-cols-[1.15fr_1fr] lg:items-center">
          <div className="space-y-6">
            <h1 className="text-4xl font-bold leading-tight md:text-5xl lg:text-6xl">
              Embed Your Metadata. <span className="text-primary">Organize your music business like a pro.</span>
            </h1>
            <p className="text-lg text-ink-muted">
              Came Through Audio organizes your entire catalog, injects permanent tracking blocks into your audio, and checks the health of your royalties from one secure dashboard. Never search for a Master again.
            </p>
            <div className="border-l-4 border-primary pl-5 text-base text-ink-foreground">
              Did you know <span className="font-bold text-primary">70% of independent artists</span> never collect their full royalties because their files aren't properly tagged? Your hit could be earning in 100+ countries right now—but without embedded metadata and proper registration, it's invisible.
            </div>
          </div>
          <div id="signup"><SignupCard /></div>
        </div>
      </section>

      <section className="border-b border-border">
        <div className="mx-auto max-w-7xl px-6 py-10">
          <p className="mb-5 text-center text-sm font-semibold uppercase tracking-widest text-muted-foreground">What all plans include</p>
          <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
            {includes.map((i) => (
              <span key={i} className="flex items-center gap-2 font-semibold">
                <Check className="h-5 w-5 text-primary" strokeWidth={3} /> {i}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-20">
        <h2 className="text-center text-3xl font-bold md:text-4xl">Who it's for</h2>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
          {roles.map(({ icon: Icon, title, scene, text }) => (
            <div key={title} className="overflow-hidden rounded-xl border border-border">
              <div className="flex aspect-square flex-col items-center justify-center gap-2 bg-ink text-primary">
                <Icon className="h-12 w-12" />
                <span className="text-xs text-ink-muted">{scene}</span>
              </div>
              <div className="p-5">
                <h3 className="text-lg font-bold">{title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-muted/50 py-20">
        <div className="mx-auto max-w-7xl px-6">
          <h2 className="text-center text-3xl font-bold md:text-4xl">What musicians are saying</h2>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {[1, 2, 3].map((n) => (
              <div key={n} className="rounded-xl border border-border bg-background p-6">
                <Quote className="h-6 w-6 text-primary" />
                <p className="mt-4 text-muted-foreground">Testimonial coming soon.</p>
                <div className="mt-6 flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-ink" />
                  <div>
                    <div className="font-semibold">Artist name</div>
                    <div className="text-xs text-muted-foreground">Role</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-20">
        <div className="rounded-3xl bg-ink p-10 text-ink-foreground md:p-14">
          <h2 className="text-4xl font-bold md:text-5xl"><span className="text-primary">$24.99/yr</span> Gets you</h2>
          <ol className="mt-10 space-y-8">
            {values.map((v, i) => (
              <li key={i} className="flex gap-5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary font-bold text-primary-foreground">{i + 1}</span>
                <p className="text-ink-muted"><span className="font-semibold text-ink-foreground">{v.split(/[.:]/)[0] ?? ""}.</span>{v.slice((v.split(/[.:]/)[0] ?? "").length + 1)}</p>
              </li>
            ))}
          </ol>
          <a href="#signup" className="mt-10 inline-flex h-12 items-center rounded-md bg-primary px-8 font-semibold text-primary-foreground hover:bg-primary/90">Sign up free</a>
        </div>
      </section>

      <footer className="bg-ink py-8 text-center text-sm text-ink-muted">© {new Date().getFullYear()} Came Through Audio</footer>
    </div>
  );
}
