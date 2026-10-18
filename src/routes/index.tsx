import { createFileRoute, Link } from "@tanstack/react-router";
import { PRE_DIST_NOTE, PRO_TIP } from "@/lib/copy";
import { Check, Music, Quote, Upload, Download } from "lucide-react";
import { SignupCard } from "@/components/SignupCard";
import { BrandLogo } from "@/components/BrandLogo";
import { FitHeadline } from "@/components/FitHeadline";
import { EmbedBadge, ShieldBadge, SignBadge, SplitBadge, UploadBadge, VaultBadge } from "@/components/StepBadges";
import { ArtistBadge, ComposerBadge, MusicianBadge, ProducerBadge, SongwriterBadge } from "@/components/RoleBadges";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

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

const includes = ["Metadata Embedding", "Cataloging", "Royalty Audits", "Split Sheet Signatures", "Secure Catalog"];

const steps = [
  { badge: UploadBadge, title: "Upload your master", text: "Drop your final mix straight in from your phone or studio laptop. No more loose links." },
  { badge: EmbedBadge, title: "Embed your metadata", text: "Lock song data, ISRC, UPC and credits inside the file. Update it any time." },
  { badge: VaultBadge, title: "Save to your catalog", text: "Your masters, art, lyrics and credits live in one vault you can download from anywhere." },
  { badge: SplitBadge, title: "Create a split sheet", text: "Splits pull from your catalog automatically. Sign as the owner in seconds." },
  { badge: SignBadge, title: "Collect signatures", text: "Collaborators get a link, sign up free and sign. Every signature is verified." },
  { badge: ShieldBadge, title: "AI Protection", text: "Show you made it, and made it first, with a Certificate of Human Origin timestamped on the Bitcoin blockchain." },
];

const faqs = [
  { q: "What is a Catalog?", a: "In the music industry, your Catalog is the complete collection of musical works, masters, and intellectual property that you own or control. Inside Came Through Audio, the \"My Catalog\" tab acts as your private, institutional-grade digital vault. It organizes your master files, high-resolution cover art, precise tracking tags, splits, and credit data in one secure dashboard so you never lose track of an asset or miss out on a royalty payout." },
  { q: "What does it mean to \"embed\" metadata?", a: "Embedding means permanently injecting tracking blocks, legal credits, and identifiers (like your real legal name, ISRC, UPC, and lyrics) directly inside the structural code of your MP3 or audio file container. Instead of keeping credits separate in a text document, embedding locks the data directly into the audio file itself. Wherever that file travels, your data travels with it, protecting your ownership." },
  { q: "Can I download my songs and artwork later?", a: "Yes! Every song you submit is saved in your private catalog vault. Download your embedded master MP3, cover art and lyrics anytime from My Catalog — no re-embedding needed." },
  { q: "What if I don't have my ISRC or UPC yet?", a: `${PRE_DIST_NOTE} Pro Tip: ${PRO_TIP}` },
  { q: "How does the AI Protection Hub prove human origin?", a: "The hub issues a Certificate of Human Origin. Short screen recordings of your DAW session and draft history are fingerprinted (SHA-256), paired with a sworn human-authorship attestation, and timestamped on the Bitcoin blockchain — proving you made it, and that you made it first." },
];

type FooterLink = { label: string; to?: "/terms-of-service" | "/refund-policy" | "/privacy-policy" | "/contact"; search?: { type: "support" | "contact" } };
const footerCols: { title: string; links: FooterLink[] }[] = [
  { title: "Product", links: [{ label: "Metadata Embedding" }, { label: "Centralized Master Catalog" }, { label: "Royalty Health Suite" }, { label: "System Security Metrics" }] },
  { title: "Learn", links: [{ label: "Help Center" }, { label: "Industry Insights" }, { label: "The Studio-to-Vault Guide" }] },
  { title: "Legal", links: [{ label: "Terms of Service", to: "/terms-of-service" }, { label: "Refund Policy", to: "/refund-policy" }, { label: "Privacy Policy", to: "/privacy-policy" }] },
  { title: "Access", links: [{ label: "Support Tickets", to: "/contact", search: { type: "support" } }, { label: "Contact Us", to: "/contact", search: { type: "contact" } }, { label: "Admin Whitelist Verification" }] },
];

const roles = [
  { badge: ArtistBadge, title: "Artists", question: "Recording in the studio?", text: "Centralize your master files and preserve your recording legacy safely." },
  { badge: MusicianBadge, title: "Musicians", question: "Do you play music live?", text: "Ensure your performance tracking metadata is locked into every release." },
  { badge: ProducerBadge, title: "Producers", question: "Are you working on beats?", text: "Secure your production splits and protect your sample history upfront." },
  { badge: SongwriterBadge, title: "Songwriters", question: "Are you writing songs?", text: "Lock down your lyrical ownership and claim your mechanical collection stakes." },
  { badge: ComposerBadge, title: "Composers", question: "Do you score music?", text: "Anchor your cinematic compositions and publishing percentages flawlessly." },
];

const valueItems = [
  { title: "Unlimited Master Catalog", text: "Every song, album art and identifier in one permanent home base. No more digging through emails, texts and old hard drives." },
  { title: "Unlimited Metadata Embedding", text: "Your credits travel inside the file, so you get paid properly when a song lands a sync, brand deal or major venue play." },
  { title: "Unlimited Royalty Health Checks", text: "See if your songs show up in the major public repertoires and what's missing — unregistered songs mean missed payouts." },
];

function Landing() {
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
            ]} sub="Embed your metadata & organize your music business like a pro." subClassName="text-xl font-semibold text-ink-foreground" />
          </div>
          <div id="signup"><SignupCard /></div>
        </div>
      </section>

      {/* A white band right after the hero breaks up the black and makes the problem the first thing to read on. */}
      <section className="border-b border-border bg-background">
        <div className="mx-auto grid max-w-7xl gap-10 px-6 py-16 md:grid-cols-2 md:items-center md:gap-16">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
            <span className="shrink-0 text-7xl font-black leading-none tracking-tight text-primary md:text-8xl">70%</span>
            <p className="border-l-4 border-primary pl-6 text-lg"><span className="font-bold">of independent artists</span> lose royalties because credits aren’t embedded, catalogs are scattered, and accounts aren’t set up to collect Worldwide.</p>
          </div>
          <p className="text-lg text-muted-foreground">
            <span className="mb-2 block text-3xl font-extrabold tracking-tight text-foreground md:text-4xl">Every unembedded song is lost income.</span>
            Embed your metadata and ensure your music is properly tracked everywhere it's played — so you never miss a royalty you earned.
          </p>
        </div>
      </section>

      <section className="border-y border-border bg-muted">
        <div className="mx-auto max-w-7xl px-6 py-14">
          <h2 className="text-center text-3xl font-extrabold uppercase tracking-wide text-primary md:text-4xl">What all $25/yr plans include</h2>
          <p className="mb-8 mt-2 text-center text-sm text-muted-foreground">Free plans include unlimited royalty audits &amp; unlimited split sheet signatures.</p>
          <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
            {includes.map((i) => (
              <span key={i} className="flex items-center gap-2 text-lg font-semibold">
                <Check className="h-5 w-5 text-primary" strokeWidth={3} /> Unlimited {i}
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
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-20">
        <h2 className="text-center text-3xl font-bold md:text-4xl">Who It's For</h2>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
          {roles.map(({ badge: Badge, title, question, text }) => (
            <div key={title} className="group flex flex-col">
              <h3 className="mb-3 text-center text-lg font-extrabold uppercase tracking-[2px] text-primary">{title}</h3>
              <div className="flex-1 overflow-hidden rounded-xl border border-border">
                <div className="flex aspect-[16/10] items-center justify-center bg-ink sm:aspect-square"><Badge /></div>
                <div className="p-5">
                  <p className="text-lg font-bold">{question}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{text}</p>
                </div>
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

      <section id="plans" className="scroll-mt-4 bg-background py-20">
        <div className="mx-auto max-w-5xl px-6">
          <div className="overflow-hidden rounded-3xl border-2 border-primary bg-background shadow-xl">
            <div className="grid md:grid-cols-[1fr_1.6fr]">
              <div className="flex flex-col justify-center gap-3 bg-primary p-10 text-primary-foreground">
                <p className="text-6xl font-extrabold leading-none">$24.99<span className="text-3xl font-bold">/yr</span></p>
                <p className="text-3xl font-bold">Gets you</p>
                <a href="#signup" className="mt-4 inline-flex h-12 items-center justify-center rounded-md bg-background px-8 font-semibold text-primary hover:bg-muted">Sign up free</a>
              </div>
              <div className="p-10">
                <h2 className="text-3xl font-bold">What you get</h2>
                <ul className="mt-6 space-y-6">
                  {valueItems.map((v) => (
                    <li key={v.title} className="flex gap-4">
                      <Check className="mt-1 h-6 w-6 shrink-0 text-primary" strokeWidth={3} />
                      <div>
                        <h3 className="text-lg font-bold">{v.title}</h3>
                        <p className="mt-1 text-muted-foreground">{v.text}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-6 pb-20">
        <h2 className="text-center text-3xl font-bold md:text-4xl">Frequently Asked Questions</h2>
        <Accordion type="single" collapsible className="mt-10 rounded-2xl border-2 border-foreground">
          {faqs.map((f, i) => (
            <AccordionItem key={f.q} value={`faq-${i}`} className="px-6 last:border-b-0">
              <AccordionTrigger className="text-left text-lg font-bold">{f.q}</AccordionTrigger>
              <AccordionContent className="text-base leading-relaxed text-foreground">{f.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>

      <footer className="bg-ink text-ink-muted">
        <div className="mx-auto grid max-w-7xl gap-10 px-6 py-14 sm:grid-cols-2 lg:grid-cols-4">
          {footerCols.map((c) => (
            <div key={c.title}>
              <h4 className="mb-4 font-bold text-ink-foreground">{c.title}</h4>
              <ul className="space-y-2 text-sm">
                {c.links.map((l) => (
                  <li key={l.label}>
                    {l.to ? <Link to={l.to} search={l.search as never} className="underline-offset-4 hover:text-ink-foreground hover:underline">{l.label}</Link> : <span>{l.label}</span>}
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
