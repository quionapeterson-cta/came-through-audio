import { createFileRoute, Link } from "@tanstack/react-router";
import { HOME_FAQS } from "@/lib/faq";
import { Check, Music, Upload, Download, Infinity as InfinityIcon } from "lucide-react";
import { SignupCard } from "@/components/SignupCard";
import { BrandLogo } from "@/components/BrandLogo";
import { FitHeadline } from "@/components/FitHeadline";
import { EmbedBadge, ShieldBadge, SignBadge, SplitBadge, UploadBadge, VaultBadge } from "@/components/StepBadges";
import { ArtistBadge, ComposerBadge, MusicianBadge, ProducerBadge, SongwriterBadge } from "@/components/RoleBadges";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { PlanComparison, planAction } from "@/components/PlanComparison";
import { PLAN_FEATURES, PLAN_TIERS } from "@/lib/plans";
import { DEFAULT_TESTIMONIAL_FILTER, TESTIMONIALS } from "@/lib/testimonials";
import { getTestimonialFilter, getTestimonials } from "@/lib/testimonials.functions";
import { TestimonialCard } from "@/components/TestimonialCard";

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
  // The shared testimonial photo filter, loaded with the page so photos never flash with the wrong look.
  loader: async () => {
    const [filter, testimonials] = await Promise.all([getTestimonialFilter().catch(() => DEFAULT_TESTIMONIAL_FILTER), getTestimonials().catch(() => TESTIMONIALS)]);
    return { filter, testimonials };
  },
  component: Landing,
});

/** Catalog Plus, the first paid plan, from the pricing list so homepage copy never disagrees with the chart. */
const PLUS = PLAN_TIERS.find((t) => t.tier === "plus")!;
/** What Catalog Plus adds over Free, straight from the pricing chart so the two never disagree. */
const includes = PLAN_FEATURES.filter((f) => f.from === "plus").map((f) => f.title);

const steps = [
  { badge: UploadBadge, title: "Upload your master", text: "Drop your final mix straight in from your phone or studio laptop. No more loose links." },
  { badge: EmbedBadge, title: "Embed your metadata", text: "Lock song data, ISRC, UPC and credits inside the file. Update it any time." },
  { badge: VaultBadge, title: "Save to your catalog", text: "Your masters, art, lyrics and credits live in one vault you can download from anywhere." },
  { badge: SplitBadge, title: "Create a split sheet", text: "Splits pull from your catalog automatically. Sign as the owner in seconds." },
  { badge: SignBadge, title: "Collect signatures", text: "Collaborators get a link, sign up free and sign. Every signature is verified." },
  { badge: ShieldBadge, title: "AI Protection", text: "Lock in timestamped, independently verifiable proof of your creative process with a Certificate of Human Origin, anchored on the Bitcoin blockchain." },
];



type FooterLink = { label: string; to?: "/terms-of-service" | "/refund-policy" | "/privacy-policy" | "/contact" | "/faq"; search?: { type: "support" | "contact" }; doc?: string };
const footerCols: { title: string; links: FooterLink[] }[] = [
  { title: "Product", links: [{ label: "Metadata Embedding", doc: "metadata-embedding" }, { label: "Centralized Master Catalog", doc: "master-catalog" }, { label: "Royalty Health Hub", doc: "royalty-health-suite" }, { label: "System Security Metrics", doc: "security" }] },
  { title: "Learn", links: [{ label: "FAQ", to: "/faq" }, { label: "Help Center", doc: "help-center" }, { label: "Industry Insights", doc: "industry-insights" }, { label: "The Studio-to-Catalog Guide", doc: "studio-to-catalog-guide" }, { label: "Add Us as Your Representative", doc: "add-representative" }] },
  { title: "Legal", links: [{ label: "Terms of Service", to: "/terms-of-service" }, { label: "Refund Policy", to: "/refund-policy" }, { label: "Privacy Policy", to: "/privacy-policy" }] },
  { title: "Access", links: [{ label: "Support Tickets", to: "/contact", search: { type: "support" } }, { label: "Contact Us", to: "/contact", search: { type: "contact" } }] },
];

/** Who It's For photos: free Unsplash License photos, toned toward Cobalt (public/home/). Focus keeps each face in the crop. */
const roles = [
  { badge: ArtistBadge, photo: "/home/who-artist.webp", focus: "5% center", title: "Artists", question: "Final mix still ringing in your headphones?", text: "Lock your name, credits and codes inside that master before it leaves the room." },
  { badge: MusicianBadge, photo: "/home/who-musician.webp", focus: "center", title: "Musicians", question: "Felt that bass line shake the booth?", text: "Get your part credited on every release, so you get paid and hired again." },
  { badge: ProducerBadge, photo: "/home/who-producer.webp", focus: "center", title: "Producers", question: "Beat still warm on the laptop?", text: "Put your production credit and split on paper before the song takes off." },
  { badge: SongwriterBadge, photo: "/home/who-songwriter.webp", focus: "center 15%", title: "Songwriters", question: "Lyrics still in your notes app?", text: "Turn them into registered songs with your name and share on file." },
  { badge: ComposerBadge, photo: "/home/who-composer.webp", focus: "center", corner: "top", title: "Composers", question: "Score still filling the room?", text: "Anchor your compositions and publishing shares so every placement pays you." },
];

/** Every "start free" button on the page scrolls to the sign-up box in the hero. */
/** A music file's details as a player shows them: blank before embedding, filled in after. */
function FileCard({ name, rows, done }: { name: string; rows: [string, string][]; done?: boolean }) {
  return (
    <div className={`rounded-2xl border p-5 ${done ? "border-primary bg-ink-border/40" : "border-ink-border"}`}>
      <p className="flex items-center gap-2 font-semibold text-ink-foreground"><Music className={`h-5 w-5 ${done ? "text-electric" : "text-ink-muted"}`} />{name}</p>
      <dl className="mt-3 grid grid-cols-[7rem_1fr] gap-y-1.5 text-sm">
        {rows.map(([k, v]) => <div key={k} className="contents">
          <dt className="text-ink-muted">{k}</dt>
          <dd className={v && done ? "flex items-center gap-1.5 font-medium text-ink-foreground" : "text-ink-muted"}>{v && done && <Check className="h-4 w-4 text-electric" strokeWidth={3} />}{v || "—"}</dd>
        </div>)}
      </dl>
    </div>
  );
}

const goSignup = () => document.getElementById("signup")?.scrollIntoView({ behavior: "smooth", block: "center" });

function StartFree({ label = "Sign up free", variant = "primary" }: { label?: string; variant?: "primary" | "outline" | "link" }) {
  const go = goSignup;
  if (variant === "link") return <button type="button" onClick={go} className="text-sm font-semibold text-primary hover:underline">{label} →</button>;
  return <button type="button" onClick={go} className={`inline-flex h-12 items-center rounded-md px-6 font-semibold transition ${variant === "primary" ? "bg-primary text-primary-foreground hover:bg-primary/90" : "border border-current hover:bg-foreground/5"}`}>{label}</button>;
}

function Landing() {
  const { filter, testimonials } = Route.useLoaderData();
  const { siteLocked } = Route.useRouteContext();
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* A white header sets the black hero apart as its own block instead of one long stretch of black. */}
      <header className="border-b border-border bg-background text-foreground">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <BrandLogo tone="light" />
          <nav className="flex items-center gap-4 whitespace-nowrap sm:gap-6"><Link to="/plans" className="text-sm font-semibold text-muted-foreground hover:text-primary">Plans</Link><Link to="/workspace" search={{ tab: undefined }} className="text-sm font-semibold text-muted-foreground hover:text-primary">Log in</Link></nav>
        </div>
      </header>

      <section className="bg-ink text-ink-foreground">
        <div className="mx-auto grid max-w-7xl gap-12 px-6 py-16 md:grid-cols-[1.15fr_1fr] md:items-center">
          <div className="min-w-0">
            {/* The tagline: always uppercase with 2px letter spacing (BRANDING.md §1). The first line's negative margin
                trims the space above the capitals, so the headline block centers optically against the sign-up box. */}
            <FitHeadline className="uppercase leading-none tracking-[2px]" lines={[
              { text: <><span className="text-primary [-webkit-text-stroke:1px_var(--ink-foreground)]">Your</span> first</>, className: "-mt-[0.13em] text-5xl font-extrabold md:text-6xl lg:text-7xl" },
              // "Before" is filled with the background so overlapping inner strokes don't show; only the outline reads.
              { text: <>Stop <span className="font-bold text-ink [-webkit-text-stroke:1.5px_var(--ink-foreground)]">before</span></>, className: "text-5xl font-extrabold md:text-6xl lg:text-7xl" },
              { text: "Distribution", className: "text-5xl font-extrabold text-primary [-webkit-text-stroke:1px_var(--ink-foreground)] md:text-6xl lg:text-7xl" },
            ]} sub="From the last bounce in the studio to the first royalty in your account: embed your credits, organize your catalog and get your songs registered, all before you hit distribute." subClassName="text-xl font-semibold text-ink-foreground" />
          </div>
          <div id="signup">{siteLocked ? <LaunchingSoon /> : <SignupCard />}</div>
        </div>
      </section>

      {/* A white band right after the hero breaks up the black and makes the problem the first thing to read on. */}
      <section className="border-b border-border bg-background">
        <div className="mx-auto grid max-w-7xl gap-10 px-6 py-16 md:grid-cols-2 md:items-center md:gap-16">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
            <span className="shrink-0 text-6xl font-black leading-none tracking-tight text-primary md:text-7xl">$424M</span>
            <p className="border-l-4 border-primary pl-6 text-lg">That's how much in <span className="font-bold">unmatched streaming royalties</span> The MLC received from streaming services in February 2021: money that couldn't find its songwriters. <a href="https://www.themlc.com/news/billboard-mlc-receives-over-424m-unmatched-black-box-streaming-royalties" target="_blank" rel="noreferrer" className="text-sm text-primary underline">Source: The MLC</a></p>
          </div>
          <p className="text-lg text-muted-foreground">
            <span className="mb-2 block text-3xl font-extrabold tracking-tight text-foreground md:text-4xl">Every unembedded song is lost income.</span>
            Embed your credits and register every song, so the money you earned can find you.
          </p>
        </div>
      </section>

      {/* What embedding is, told as a story (founder approved, 2026-10-25), with the file before and after. */}
      <section className="bg-ink py-20 text-ink-foreground">
        <div className="mx-auto grid max-w-6xl gap-12 px-6 md:grid-cols-[1.15fr_1fr] md:items-center">
          <div className="space-y-4 text-lg leading-relaxed text-ink-muted">
            <h2 className="text-3xl font-bold text-ink-foreground md:text-4xl">What does embed mean?</h2>
            <p>Picture this. You finish your single at 2 AM and send it out that same night. A DJ, a blog, and a music supervisor looking for a song for a TV show.</p>
            <p>Three weeks later the show wants it. They open the file and all it says is Track 01. No artist. No writer. No codes. They can't clear a song they can't trace, so they move on to the next one that tells them who owns it.</p>
            <p className="font-semibold text-ink-foreground">Your song was good enough. It just couldn't speak up for you.</p>
            <p><span className="font-bold text-ink-foreground">Embedding fixes that.</span> It writes your name, credits, codes, lyrics and artwork inside the audio file itself, like a name tag sewn into a jacket. Wherever the file goes, your information goes with it, even after it's copied, renamed or shared a hundred times.</p>
            <p>Make sure every song can say who made it. Came Through Audio came through for every song in your catalog.</p>
            <div className="pt-2"><StartFree label="Embed your first master" /></div>
          </div>
          <div className="space-y-4">
            <FileCard name="Track 01.mp3" rows={[["Artist", "Unknown"], ["Written by", ""], ["ISRC", ""], ["Lyrics", ""], ["Artwork", ""]]} />
            <p className="text-center text-sm font-bold uppercase tracking-[2px] text-electric">After embedding</p>
            <FileCard name="Your Song.mp3" done rows={[["Artist", "Your artist name"], ["Written by", "Your legal name"], ["ISRC", "US-ABC-26-00001"], ["Lyrics", "Saved inside"], ["Artwork", "Saved inside"]]} />
          </div>
        </div>
      </section>

      <section className="border-y border-border bg-muted">
        <div className="mx-auto max-w-7xl px-6 py-14">
          <h2 className="text-center text-3xl font-extrabold uppercase tracking-wide text-primary md:text-4xl">Everything in the {PLUS.price}/yr plan</h2>
          <p className="mb-8 mt-2 text-center text-sm text-muted-foreground"><span className="font-semibold text-foreground">{PLUS.monthly.replace("Only ", "").replace(" / month", " a month")}, less than a single coffee.</span> Plus free Royalty Health Checks and split sheet signing. Billed annually, with a <span className="font-semibold text-foreground">30-day full refund</span> if it isn't for you.</p>
          <p className="mb-6 flex items-center justify-center gap-2 text-lg font-bold"><InfinityIcon className="h-6 w-6 shrink-0 text-primary" strokeWidth={3} />Every feature. Unlimited. No per-song fees.</p>
          <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
            {includes.map((i) => (
              <span key={i} className="flex items-center gap-2 text-lg font-semibold">
                <Check className="h-5 w-5 text-primary" strokeWidth={3} /> {i}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-ink py-24 text-ink-foreground">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="text-center text-4xl font-bold md:text-5xl lg:text-6xl">How It Works</h2>
          <p className="mx-auto mt-4 max-w-xl text-center text-lg text-ink-muted">From the studio to your vault in six simple steps.</p>
          <ol className="mt-14 grid gap-px overflow-hidden rounded-2xl border border-ink-border bg-ink-border md:grid-cols-2 lg:grid-cols-3">
            {steps.map(({ badge: Badge, title, text }, i) => (
              <li key={title} className="group flex flex-col gap-4 bg-ink p-8 transition hover:bg-ink-border/40">
                <div className="flex items-center justify-between">
                  <span className="text-5xl font-black leading-none text-ink-foreground/20 transition group-hover:text-ink-foreground/40">{String(i + 1).padStart(2, "0")}</span>
                  <Badge />
                </div>
                <h3 className="text-xl font-bold">{title}</h3>
                <p className="text-base leading-relaxed text-ink-muted">{text}</p>
              </li>
            ))}
          </ol>
          <div className="mt-10 flex flex-col items-center gap-2 text-center">
            <StartFree label="Start free: run your first Royalty Health Check" />
            <span className="text-sm text-ink-muted">Takes about two minutes.</span>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-20">
        <h2 className="text-center text-3xl font-bold md:text-4xl">Who It's For</h2>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
          {roles.map(({ badge: Badge, photo, focus, corner, title, question, text }) => (
            <div key={title} className="group flex flex-col">
              <h3 className="mb-3 text-center text-lg font-extrabold uppercase tracking-[2px] text-primary">{title}</h3>
              <div className="flex flex-1 flex-col overflow-hidden rounded-xl border border-border">
                <div className="relative overflow-hidden">
                  <img src={photo} alt="" loading="lazy" className="aspect-[16/10] w-full object-cover sm:aspect-square" style={{ objectPosition: focus }} />
                  {/* The badge sits in the photo's lower right corner (top right where a face is there) and is the card's way to sign up; the section has one Sign up free button below. */}
                  <button type="button" onClick={goSignup} aria-label={`Sign up free: ${title}`}
                    className={`absolute right-3 ${corner === "top" ? "top-3" : "bottom-3"} rounded-full transition hover:-translate-y-0.5 hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&>svg]:h-[3.25rem] [&>svg]:w-[3.25rem]`}>
                    <Badge />
                  </button>
                </div>
                <div className="flex-1 p-5 text-center">
                  <p className="text-lg font-bold">{question}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{text}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-10 flex justify-center"><StartFree /></div>
      </section>

      {testimonials.length > 0 && <section id="testimonials" className="scroll-mt-4 bg-muted/50 py-20">
        <div className="mx-auto max-w-7xl px-6">
          <h2 className="text-center text-3xl font-bold md:text-4xl">What musicians are saying</h2>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {testimonials.map((t) => <TestimonialCard key={t.name} t={t} filter={filter} />)}
          </div>
          <div className="mt-10 flex flex-col items-center gap-4 text-center">
            <p className="text-xl font-bold">Came Through Audio came through for them. Let's come through for you.</p>
            <StartFree />
          </div>
        </div>
      </section>}

      <section id="plans" className="scroll-mt-4 bg-background py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="text-center text-3xl font-bold md:text-5xl">More value at every step</h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-lg text-muted-foreground">Start free with Royalty Health Checks. Unlock embedding, your catalog and every download for {PLUS.price} a year, then grow into split sheets, agency exports and contracts.</p>
          <div className="mt-10">
            <PlanComparison action={(p) => planAction(p, { onBuy: () => {}, onSignup: () => document.getElementById("signup")?.scrollIntoView({ behavior: "smooth" }) })} />
          </div>
          <p className="mt-6 text-center text-sm font-semibold">30-day full refund on every plan · Upgrade anytime, pay only the difference · Founding offer: the first 100 members move up a tier (while spots last)</p>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-6 pb-20">
        <h2 className="text-center text-3xl font-bold md:text-4xl">Frequently Asked Questions</h2>
        <Accordion type="single" collapsible className="mt-10 rounded-2xl border-2 border-foreground">
          {HOME_FAQS.map((f, i) => (
            <AccordionItem key={f.q} value={`faq-${i}`} className="px-6 last:border-b-0">
              <AccordionTrigger className="text-left text-lg font-bold">{f.q}</AccordionTrigger>
              <AccordionContent className="text-base leading-relaxed text-foreground">{f.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
        <p className="mt-6 text-center"><Link to="/faq" className="font-semibold text-primary hover:underline">See all questions →</Link></p>
      </section>

      <section className="bg-ink text-ink-foreground">
        <div className="mx-auto flex max-w-4xl flex-col items-center gap-4 px-6 py-16 text-center">
          <h2 className="text-3xl font-extrabold md:text-4xl">Your songs already did the work. Make sure they get paid.</h2>
          <p className="text-sm font-bold uppercase tracking-[2px] text-brand-electric">Your first stop before distribution</p>
          <div className="mt-2 flex flex-wrap justify-center gap-3">
            <StartFree />
            <Link to="/plans" className="inline-flex h-12 items-center rounded-md border border-ink-border px-6 font-semibold hover:bg-ink-border">Compare plans</Link>
          </div>
        </div>
      </section>

      <footer className="bg-ink text-ink-muted">
        <div className="mx-auto grid max-w-7xl gap-10 px-6 py-14 sm:grid-cols-2 lg:grid-cols-4">
          {footerCols.map((c) => (
            <div key={c.title}>
              <h4 className="mb-4 font-bold text-ink-foreground">{c.title}</h4>
              <ul className="space-y-2 text-sm">
                {c.links.map((l) => (
                  <li key={l.label}>
                    {l.doc ? <Link to="/docs/$slug" params={{ slug: l.doc }} className="underline-offset-4 hover:text-ink-foreground hover:underline">{l.label}</Link>
                      : l.to ? <Link to={l.to} search={l.search as never} className="underline-offset-4 hover:text-ink-foreground hover:underline">{l.label}</Link> : <span>{l.label}</span>}
                  </li>
                ))}
                {c.title === "Access" && <li className="font-semibold text-ink-foreground">🟢 System Status: Fully Operational</li>}
              </ul>
            </div>
          ))}
        </div>
        <div className="border-t border-ink-border py-6 text-center text-sm">© {new Date().getFullYear()} Came Through Audio, LLC</div>
      </footer>
    </div>
  );
}

/** Shown instead of signup until launch: the site is open for review, but accounts open at launch. */
function LaunchingSoon() {
  return (
    <div className="rounded-2xl border border-ink-border bg-card p-8 text-center text-card-foreground shadow-xl">
      <p className="text-xs font-bold uppercase tracking-[2px] text-primary">Launching soon</p>
      <h2 className="mt-2 text-2xl font-bold">Accounts open at launch</h2>
      <p className="mt-2 text-sm text-muted-foreground">Came Through Audio is in private testing. Plans and pricing are below; questions are welcome any time.</p>
      <div className="mt-5 flex flex-wrap justify-center gap-3">
        <Link to="/contact" className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90">Contact us</Link>
        <Link to="/unlock" search={{ next: "/" }} className="inline-flex h-10 items-center rounded-md border border-border px-4 text-sm font-semibold hover:bg-accent">I have early access</Link>
      </div>
    </div>
  );
}
