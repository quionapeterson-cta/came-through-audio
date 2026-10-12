import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, Mic, Guitar, Disc3, NotebookPen, Music, Quote, AlertTriangle, Upload, Download, FileSignature, ShieldCheck } from "lucide-react";
import { SignupCard } from "@/components/SignupCard";
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

const includes = ["Metadata Embedding", "Cataloging", "Royalty Audits", "Blockchain Timestamp", "Secure Catalog"];

const steps = [
  { icon: Upload, phase: "Upload Your Tracks", title: "The Session Ends (Instant Upload)", text: "The engineer bounces the final mix. Instead of texting a compressed file or emailing a loose, un-tagged Google Drive link, you drop your high-resolution master track straight into Came Through Audio right from your phone or studio laptop." },
  { icon: Download, phase: "Embed Metadata", title: "Embed Permanent Metadata", text: "You immediately embed permanent tracking data (Song Data, ISRC, UPC, and creator credentials) directly into your audio file wrapper. If you need to tweak the mix or update the ISRC later, no worries—you can easily update the metadata and swap the audio file in your workspace at any time while preserving your cataloged entry perfectly." },
  { icon: Disc3, phase: "Submit to Your Catalog", title: "Secure Your Organized Catalog (Your Vault)", text: "Click \"Submit to Catalog\" to lock your track into your permanent music repository. Your high-res master files, album art, credits, PRO information and publishing registries are organized safely in one secure home base that you can access and download from anywhere in the world." },
  { icon: FileSignature, phase: "Generate and Sign Split Sheets", title: "Formalize Legal Ownership (The Split Sheet)", text: "Before anyone leaves the studio parking lot, you click \"Generate Split Sheet.\" The platform automatically pulls the track title and writer percentages directly from your catalog data to draft a legal agreement, instantly routing a signature link to your collaborators." },
  { icon: ShieldCheck, phase: "Follow Up After Session", title: "Secure the Ink", text: "Virtual collaborators and featured artists receive a secure invitation link. They sign up for a 100% Free Collaborator Account right on their mobile devices and execute their digital signatures—generating a permanent verification hash that secures your chain of ownership forever." },
];

const faqs = [
  { q: "What is a Catalog?", a: "In the music industry, your Catalog is the complete collection of musical works, masters, and intellectual property that you own or control. Inside Came Through Audio, the \"My Catalog\" tab acts as your private, institutional-grade digital vault. It organizes your master files, high-resolution cover art, precise tracking tags, splits, and credit data in one secure dashboard so you never lose track of an asset or miss out on a royalty payout." },
  { q: "What does it mean to \"embed\" metadata?", a: "Embedding means permanently injecting tracking blocks, legal credits, and identifiers (like your real legal name, ISRC, UPC, and lyrics) directly inside the structural code of your MP3 or audio file container. Instead of keeping credits separate in a text document, embedding locks the data directly into the audio file itself. Wherever that file travels, your data travels with it, protecting your ownership." },
  { q: "Can I download my songs or re-embed metadata later?", a: "Yes! You have unlimited, permanent access to download your embedded master MP3 files, 3000x3000px cover art layers, and lyric blocks at any time from your dashboard. If you don't have all your identifiers (like an ISRC or UPC code) right now, don't worry. You can fill out what you have, download the file, and return later to safely re-upload, modify, and append your updated metadata without breaking the file." },
  { q: "How does the AI Protection Hub prove I created my music?", a: "The hub uses a secure 3-layer proof engine to establish a definitive, unalterable timeline of your creative process. By linking short screen recordings of your DAW (Digital Audio Workstation) and tracking your version histories over time, our platform calculates a cryptographic hash and generates a downloadable PDF Proof Certificate with a unique validation QR code. This gives you institutional-grade legal security to shield your tracks from automated platform takedowns and corporate claims." },
];

type FooterLink = { label: string; to?: "/terms-and-conditions" | "/refund-policy" | "/privacy-notice" };
const footerCols: { title: string; links: FooterLink[] }[] = [
  { title: "Product", links: [{ label: "Metadata Embedding" }, { label: "Centralized Master Catalog" }, { label: "Royalty Health Suite" }, { label: "System Security Metrics" }] },
  { title: "Learn", links: [{ label: "Help Center" }, { label: "Industry Insights" }, { label: "The Studio-to-Vault Guide" }] },
  { title: "Legal", links: [{ label: "Terms and Conditions", to: "/terms-and-conditions" }, { label: "Refund Policy", to: "/refund-policy" }, { label: "Privacy Notice", to: "/privacy-notice" }] },
  { title: "Access", links: [{ label: "Support Tickets" }, { label: "Contact Us" }, { label: "Admin Whitelist Verification" }] },
];

const roles = [
  { icon: Mic, title: "Artist", scene: "Recording in studio", text: "Centralize your master files and preserve your recording legacy safely." },
  { icon: Guitar, title: "Musician", scene: "Playing an instrument live", text: "Ensure your performance tracking metadata is locked into every release." },
  { icon: Disc3, title: "Producer", scene: "Working on a beat machine", text: "Secure your production splits and protect your sample history upfront." },
  { icon: NotebookPen, title: "Songwriter", scene: "Writing with a notebook", text: "Lock down your lyrical ownership and claim your mechanical collection stakes." },
  { icon: Music, title: "Composer", scene: "Scoring on sheet music", text: "Anchor your cinematic compositions and publishing percentages flawlessly." },
];

const valueItems = [
  { title: "Unlimited Master Catalog", text: "Every song, album art and identifier in one permanent home base. No more digging through emails, texts and old hard drives." },
  { title: "Unlimited Metadata Embedding", text: "Your credits travel inside the file, so you get paid properly when a song lands a sync, brand deal or major venue play." },
  { title: "Unlimited Royalty Health Checks", text: "See if your songs show up in the major public repertoires and what's missing — unregistered songs mean missed payouts." },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="bg-ink text-ink-foreground">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <span className="text-lg font-bold tracking-tight">Came Through Audio</span>
          <Link to="/workspace" search={{ tab: undefined }} className="text-sm font-semibold text-ink-foreground hover:underline">Log in</Link>
        </div>
      </header>

      <section className="bg-ink text-ink-foreground">
        <div className="mx-auto grid max-w-7xl gap-12 px-6 pb-20 pt-10 md:grid-cols-[1.15fr_1fr] md:items-center">
          <div className="space-y-6">
            <h1 className="uppercase leading-[0.95] tracking-tight">
              <span className="block text-3xl font-bold md:text-4xl lg:text-5xl">Embed your metadata &amp;</span>
              <span className="block text-4xl font-light text-transparent [-webkit-text-stroke:1px_var(--ink-foreground)] md:text-5xl lg:text-6xl">Organize your</span>
              <span className="block text-4xl font-extrabold text-ink-foreground md:text-5xl lg:text-6xl">Music business</span>
              <span className="block text-5xl font-black md:text-6xl lg:text-7xl">Like a pro</span>
            </h1>
            <p className="text-lg text-ink-foreground">
              Every unembedded song is lost income. Embed your metadata and ensure your music is properly tracked everywhere it's played — so you never miss a royalty you earned.
            </p>
            <div className="flex gap-3 border-l-4 border-ink-foreground pl-5 text-base text-ink-foreground">
              <AlertTriangle className="mt-0.5 h-6 w-6 shrink-0 fill-caution text-ink" />
              <p><span className="font-bold underline decoration-caution decoration-2 underline-offset-4">70% of independent artists</span> lose royalties because credits aren’t embedded, catalogs are scattered, and accounts aren’t set up to collect Worldwide.</p>
            </div>
          </div>
          <div id="signup"><SignupCard /></div>
        </div>
      </section>

      <section className="border-b border-border bg-accent">
        <div className="mx-auto max-w-7xl px-6 py-14">
          <h2 className="mb-8 text-center text-3xl font-extrabold uppercase tracking-wide text-primary md:text-4xl">What all plans include</h2>
          <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
            {includes.map((i) => (
              <span key={i} className="flex items-center gap-2 text-lg font-semibold">
                <Check className="h-5 w-5 text-primary" strokeWidth={3} /> Unlimited {i}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-background py-24 text-foreground">
        <div className="mx-auto max-w-7xl px-6">
          <h2 className="text-center text-4xl font-bold md:text-5xl lg:text-6xl">How It Works</h2>
          <p className="mt-3 text-center"><span className="inline-block rounded-full bg-primary px-5 py-1.5 text-lg font-semibold text-primary-foreground md:text-xl">The Studio-to-Catalog Lifecycle</span></p>
          <ol className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-5">
            {steps.map(({ icon: Icon, phase, title, text }, i) => (
              <li key={title} className="overflow-hidden rounded-2xl border border-border bg-background shadow-sm transition hover:-translate-y-1 hover:border-primary hover:shadow-lg">
                <div className="flex aspect-video items-center justify-center bg-primary">
                  <Icon className="h-14 w-14 text-primary-foreground" />
                </div>
                <div className="space-y-2 p-6">
                  <span className="inline-block rounded-md bg-accent px-2 py-0.5 text-xs font-bold uppercase tracking-widest text-primary">{phase}</span>
                  <h3 className="text-xl font-bold">Step {i + 1}: {title}</h3>
                  <p className="text-sm text-muted-foreground">{text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-20">
        <h2 className="text-center text-3xl font-bold md:text-4xl">Who it's for</h2>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
          {roles.map(({ icon: Icon, title, scene, text }) => (
            <div key={title} className="overflow-hidden rounded-xl border border-border">
              <div className="flex aspect-square flex-col items-center justify-center gap-2 bg-ink text-ink-foreground">
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

      <section className="bg-accent py-20">
        <div className="mx-auto max-w-5xl px-6">
          <div className="overflow-hidden rounded-3xl border-2 border-primary bg-background shadow-xl">
            <div className="grid md:grid-cols-[1fr_1.6fr]">
              <div className="flex flex-col justify-center gap-3 bg-primary p-10 text-primary-foreground">
                <p className="text-sm font-semibold uppercase tracking-widest">One simple plan</p>
                <p className="text-6xl font-extrabold leading-none">$24.99</p>
                <p className="text-lg">per year · about $2.08/month</p>
                <a href="#signup" className="mt-4 inline-flex h-12 items-center justify-center rounded-md bg-background px-8 font-semibold text-primary hover:bg-accent">Sign up free</a>
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
                    {l.to ? <Link to={l.to} className="underline-offset-4 hover:text-ink-foreground hover:underline">{l.label}</Link> : <span>{l.label}</span>}
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
