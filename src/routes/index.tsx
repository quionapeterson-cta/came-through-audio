import { createFileRoute, Link } from "@tanstack/react-router";
import { PRE_DIST_NOTE, PRO_TIP } from "@/lib/copy";
import { Check, Mic, Guitar, Disc3, NotebookPen, Music, Quote, AlertTriangle, Upload, Download, FileSignature, ShieldCheck, Mail } from "lucide-react";
import { SignupCard } from "@/components/SignupCard";
import { BrandLogo } from "@/components/BrandLogo";
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
  { icon: Upload, title: "Upload your master", text: "Drop your final mix straight in from your phone or studio laptop. No more loose links." },
  { icon: Download, title: "Embed your metadata", text: "Lock song data, ISRC, UPC and credits inside the file. Update it any time." },
  { icon: Disc3, title: "Save to your catalog", text: "Your masters, art, lyrics and credits live in one vault you can download from anywhere." },
  { icon: FileSignature, title: "Create a split sheet", text: "Splits pull from your catalog automatically. Sign as the owner in seconds." },
  { icon: Mail, title: "Collect signatures", text: "Collaborators get a link, sign up free and sign. Every signature is verified." },
  { icon: ShieldCheck, title: "AI Protection", text: "Show you made it, and made it first, with a Certificate of Human Origin timestamped on the Bitcoin blockchain." },
];

const faqs = [
  { q: "What is a Catalog?", a: "In the music industry, your Catalog is the complete collection of musical works, masters, and intellectual property that you own or control. Inside Came Through Audio, the \"My Catalog\" tab acts as your private, institutional-grade digital vault. It organizes your master files, high-resolution cover art, precise tracking tags, splits, and credit data in one secure dashboard so you never lose track of an asset or miss out on a royalty payout." },
  { q: "What does it mean to \"embed\" metadata?", a: "Embedding means permanently injecting tracking blocks, legal credits, and identifiers (like your real legal name, ISRC, UPC, and lyrics) directly inside the structural code of your MP3 or audio file container. Instead of keeping credits separate in a text document, embedding locks the data directly into the audio file itself. Wherever that file travels, your data travels with it, protecting your ownership." },
  { q: "Can I download my songs and artwork later?", a: "Yes! Every song you submit is saved in your private catalog vault. Download your embedded master MP3, cover art and lyrics anytime from My Catalog — no re-embedding needed." },
  { q: "What if I don't have my ISRC or UPC yet?", a: `${PRE_DIST_NOTE} Pro Tip: ${PRO_TIP}` },
  { q: "How does the AI Protection Hub prove human origin?", a: "The hub issues a Certificate of Human Origin. Short screen recordings of your DAW session and draft history are fingerprinted (SHA-256), paired with a sworn human-authorship attestation, and timestamped on the Bitcoin blockchain — proving you made it, and that you made it first." },
];

type FooterLink = { label: string; to?: "/terms-of-service" | "/refund-policy" | "/privacy-policy" };
const footerCols: { title: string; links: FooterLink[] }[] = [
  { title: "Product", links: [{ label: "Metadata Embedding" }, { label: "Centralized Master Catalog" }, { label: "Royalty Health Suite" }, { label: "System Security Metrics" }] },
  { title: "Learn", links: [{ label: "Help Center" }, { label: "Industry Insights" }, { label: "The Studio-to-Vault Guide" }] },
  { title: "Legal", links: [{ label: "Terms of Service", to: "/terms-of-service" }, { label: "Refund Policy", to: "/refund-policy" }, { label: "Privacy Policy", to: "/privacy-policy" }] },
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
          <BrandLogo />
          <nav className="flex items-center gap-6"><Link to="/plans" className="text-sm font-semibold text-ink-muted hover:text-primary">Plans</Link><Link to="/workspace" search={{ tab: undefined }} className="text-sm font-semibold text-ink-muted hover:text-primary">Log in</Link></nav>
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

      <section className="border-b border-border bg-background">
        <div className="mx-auto max-w-7xl px-6 py-14">
          <h2 className="text-center text-3xl font-extrabold uppercase tracking-wide text-primary md:text-4xl">What all plans include</h2>
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
            {steps.map(({ icon: Icon, title, text }, i) => (
              <li key={title} className="group flex flex-col gap-4 bg-ink p-8 transition hover:bg-ink-border/40">
                <div className="flex items-center justify-between">
                  <span className="text-5xl font-black leading-none text-ink-foreground/20 transition group-hover:text-ink-foreground/40">{String(i + 1).padStart(2, "0")}</span>
                  <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-background"><Icon className="h-6 w-6 text-primary" /></span>
                </div>
                <h3 className="text-xl font-bold">{title}</h3>
                <p className="text-base leading-relaxed text-ink-muted">{text}</p>
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
