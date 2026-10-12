import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, Mic, Guitar, Disc3, NotebookPen, Music, Quote, AlertTriangle, Upload, Download, FileSignature, ShieldCheck } from "lucide-react";
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
        <div className="mx-auto grid max-w-7xl gap-12 px-6 pb-20 pt-10 md:grid-cols-[1.15fr_1fr] md:items-center">
          <div className="space-y-6">
            <h1 className="uppercase leading-[0.95] tracking-tight">
              <span className="block text-3xl font-bold md:text-4xl lg:text-5xl">Embed your metadata &amp;</span>
              <span className="block text-4xl font-light text-transparent [-webkit-text-stroke:1px_var(--ink-foreground)] md:text-5xl lg:text-6xl">Organize your</span>
              <span className="block text-4xl font-extrabold text-primary [-webkit-text-stroke:1px_var(--ink-foreground)] md:text-5xl lg:text-6xl">Music business</span>
              <span className="block text-5xl font-black md:text-6xl lg:text-7xl">Like a pro</span>
            </h1>
            <p className="text-lg text-ink-foreground">
              Every unembedded song is lost income. Embed your metadata and ensure your music is properly tracked everywhere it's played — so you never miss a royalty you earned.
            </p>
            <div className="flex gap-3 border-l-4 border-primary pl-5 text-base text-ink-foreground">
              <AlertTriangle className="mt-0.5 h-6 w-6 shrink-0 fill-caution text-ink" />
              <p><span className="font-bold text-primary">70% of independent artists</span> lose royalties because credits aren’t embedded, catalogs are scattered, and accounts aren’t set up to collect Worldwide.</p>
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
                <Check className="h-5 w-5 text-primary" strokeWidth={3} /> Unlimited {i}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-ink py-24 text-ink-foreground">
        <div className="mx-auto max-w-7xl px-6">
          <h2 className="text-center text-4xl font-bold md:text-5xl lg:text-6xl">How It Works</h2>
          <p className="mt-3 text-center text-xl text-primary md:text-2xl">The Studio-to-Catalog Lifecycle</p>
          <ol className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {steps.map(({ icon: Icon, phase, title, text }, i) => (
              <li key={title} className="overflow-hidden rounded-2xl border border-ink-border">
                <div className="flex aspect-video items-center justify-center bg-primary/20">
                  <Icon className="h-14 w-14 text-primary" />
                </div>
                <div className="space-y-2 p-6">
                  <span className="text-xs font-bold uppercase tracking-widest text-primary">{phase}</span>
                  <h3 className="text-xl font-bold"><span className="text-primary">{i + 1}.</span> {title}</h3>
                  <p className="text-sm text-ink-muted">{text}</p>
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

      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="grid gap-10 rounded-3xl bg-ink p-10 text-ink-foreground md:grid-cols-[1.2fr_1fr] md:items-center md:p-14">
          <div>
            <h2 className="text-4xl font-bold md:text-5xl"><span className="text-primary">$24.99/yr</span> Gets you</h2>
            <ol className="mt-10 space-y-8">
              {values.map((v, i) => (
                <li key={i} className="flex gap-5">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary font-bold text-primary-foreground">{i + 1}</span>
                  <p className="text-ink-muted">{v}</p>
                </li>
              ))}
            </ol>
          </div>
          <div className="flex md:justify-end">
            <a href="#signup" className="inline-flex h-14 items-center rounded-md bg-primary px-10 text-lg font-semibold text-primary-foreground hover:bg-primary/90">Sign up free</a>
          </div>
        </div>
      </section>

      <footer className="bg-ink text-ink-muted">
        <div className="mx-auto grid max-w-7xl gap-10 px-6 py-14 sm:grid-cols-2 lg:grid-cols-4">
          {footerCols.map((c) => (
            <div key={c.title}>
              <h4 className="mb-4 font-bold text-ink-foreground">{c.title}</h4>
              <ul className="space-y-2 text-sm">
                {c.links.map((l) => <li key={l}><span className="hover:text-primary">{l}</span></li>)}
                {c.title === "Access" && <li className="font-semibold text-ink-foreground">🟢 System Status: Fully Operational</li>}
              </ul>
            </div>
          ))}
        </div>
        <div className="border-t border-ink-border py-6 text-center text-sm">© {new Date().getFullYear()} Came Through Audio</div>
      </footer>
    </div>
  );
}
