import { createFileRoute, Link } from "@tanstack/react-router";
import { HOME_FAQS } from "@/lib/faq";
import { Building2, Camera, Check, Cloud, Download, FileText, Folder, HardDrive, Image as ImageIcon, Infinity as InfinityIcon, Mail, MessageSquare, Mic, Music, Palette, Smartphone, StickyNote, Upload } from "lucide-react";
import { SignupCard } from "@/components/SignupCard";
import { BrandLogo } from "@/components/BrandLogo";
import { AppOrBrowserGate, DownloadApp } from "@/components/InstallApp";
import { FitHeadline } from "@/components/FitHeadline";
import { EmbedBadge, ShieldBadge, SignBadge, SplitBadge, UploadBadge, VaultBadge } from "@/components/StepBadges";
import { ArtistBadge, ComposerBadge, MusicianBadge, ProducerBadge, SongwriterBadge } from "@/components/RoleBadges";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { PlanComparison, planAction } from "@/components/PlanComparison";
import { PLAN_FEATURES, PLAN_TIERS } from "@/lib/plans";
import { DEFAULT_TESTIMONIAL_FILTER, TESTIMONIALS } from "@/lib/testimonials";
import { getTestimonialFilter, getTestimonials } from "@/lib/testimonials.functions";
import { getSiteSocials } from "@/lib/social.functions";
import { DEFAULT_SOCIALS } from "@/lib/social";
import { SocialLinks } from "@/components/SocialLinks";
import { BrandLockup } from "@/components/BrandLockup";
import { TestimonialCard } from "@/components/TestimonialCard";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Came Through Audio — Embed Metadata & Organize Your Music Business" },
      { name: "description", content: "Organize your catalog, embed permanent metadata in your audio and check your royalty health from one secure dashboard." },
      { property: "og:title", content: "Came Through Audio — Organize Your Music Business Like a Pro" },
      { property: "og:description", content: "Catalog, MP3 embedding and royalty health checks for independent musicians." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  // The shared testimonial photo filter, loaded with the page so photos never flash with the wrong look.
  loader: async () => {
    const [filter, testimonials, socials] = await Promise.all([getTestimonialFilter().catch(() => DEFAULT_TESTIMONIAL_FILTER), getTestimonials().catch(() => TESTIMONIALS), getSiteSocials().catch(() => DEFAULT_SOCIALS)]);
    return { filter, testimonials, socials };
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
  { title: "Product", links: [{ label: "MP3 Embedding", doc: "metadata-embedding" }, { label: "Centralized Master Catalog", doc: "master-catalog" }, { label: "Royalty Health Hub", doc: "royalty-health-suite" }, { label: "System Security Metrics", doc: "security" }] },
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
  { badge: ComposerBadge, photo: "/home/who-composer.webp", focus: "center", title: "Composers", question: "Score still filling the room?", text: "Anchor your compositions and publishing shares so every placement pays you." },
];

/** Every "start free" button on the page scrolls to the sign-up box in the hero. */
/**
 * "YOUR" and "DISTRIBUTION" in the hero: darker Platinum letterforms inside a same-colour ring, with a thin gap of hero
 * black between the two (founder, 2026-11-03). Two stacked copies of the word keep the ring aligned; see .hero-metal.
 */
function MetalWord({ children }: { children: string }) {
  return (
    <span className="hero-metal">
      <span aria-hidden className="hero-metal-ring select-none">{children}</span>
      <span className="hero-metal-face">{children}</span>
    </span>
  );
}

/**
 * A music file as a player shows it: the same 22 slots, empty before embedding and filled after, in collapsible groups
 * so the section stays short. Both cards open the first group, so the pair sits at the same height and every empty slot
 * lines up with the filled one beside it.
 */
function FileCard({ name, groups, done }: { name: string; groups: { heading: string; rows: [string, string][] }[]; done?: boolean }) {
  const [firstGroup] = groups;
  return (
    <div className={`flex h-full flex-col rounded-2xl border bg-ink p-5 text-ink-foreground ${done ? "border-primary" : "border-ink-border"}`}>
      <p className="flex items-center justify-center gap-2 font-semibold text-ink-foreground"><Music className={`h-5 w-5 ${done ? "text-electric" : "text-ink-muted"}`} />{name}</p>
      <Accordion type="multiple" defaultValue={firstGroup ? [firstGroup.heading] : []} className="mt-1">
        {groups.map((g, i) => (
          <AccordionItem key={g.heading} value={g.heading} className={`border-ink-border ${i === groups.length - 1 ? "border-b-0" : ""}`}>
            <AccordionTrigger className={`py-3 text-xs font-bold uppercase tracking-[1.5px] hover:no-underline [&>svg]:text-ink-muted ${done ? "text-electric" : "text-ink-muted"}`}>
              <span className="flex-1 text-left">{g.heading}<span className="ml-2 font-semibold normal-case tracking-normal text-ink-muted">{g.rows.length} fields</span></span>
            </AccordionTrigger>
            <AccordionContent className="pb-3 text-sm">
              <dl className="grid grid-cols-[7rem_1fr] gap-y-1.5">
                {g.rows.map(([k, v]) => <div key={k} className="contents">
                  <dt className="text-ink-muted">{k}</dt>
                  <dd className={v && done ? "flex items-center gap-1.5 font-medium text-ink-foreground" : "text-ink-muted"}>{v && done && <Check className="h-4 w-4 text-electric" strokeWidth={3} />}{v || "—"}</dd>
                </div>)}
              </dl>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}

/**
 * Every field embedMetadata() writes into the file (src/lib/metadata.ts), grouped under three mini headings so the
 * after-embedding card reads as a short list instead of one long scroll. If a field isn't here, it isn't embedded.
 */
const EMBEDDED_GROUPS: { heading: string; rows: [string, string][] }[] = [
  {
    heading: "Song & release",
    rows: [
      ["Title", "Your Song"],
      ["Artist", "Your artist name"],
      ["Featured artists", "Brother Tim The Ghetto Evangelist"],
      ["Album", "Came Through For You"],
      ["Track number", "1 of 12"],
      ["Genre", "Hip-Hop/Rap"],
      ["Release date", "2026-03-03"],
      ["Release type", "Single"],
      ["Label", "Your label"],
      ["Explicit", "No"],
    ],
  },
  {
    heading: "Identifiers and timing",
    rows: [
      ["ISRC", "US-ABC-26-00001"],
      ["UPC", "0123456789012"],
      ["ISWC", "T1234567890"],
      ["Duration", "03:12"],
    ],
  },
  {
    heading: "Credits & art",
    rows: [
      ["Writers", "Your legal name"],
      ["Composers", "Your legal name"],
      ["Producers", "Your producer"],
      ["Other credits", "Engineer, studio"],
      ["Copyright", "© 2026 Your Name"],
      ["Contact email", "bookings@yourname.com"],
      ["Lyrics", "Saved inside"],
      ["Artwork", "Saved inside"],
    ],
  },
];

/**
 * The catalog spread, shown rather than listed: one song's pieces scattered across apps, devices and rooms on the
 * left, the same song as one tidy catalog row on the right. Each scattered chip is tilted a little so the pile reads
 * as loose at a glance; the catalog row is a single card with every part ticked inside it.
 */
/**
 * `wide` marks the examples that only show from sm up: on a phone the pile wraps so many times that it would climb
 * into the card's label, so the phone keeps the nine originals and the wider cards get the fuller pile (founder,
 * 2026-11-05: fill the empty space in the before box).
 */
const CATALOG_SCATTER: { icon: typeof Mail; label: string; tilt: string; wide?: boolean }[] = [
  { icon: Mail, label: "Email thread", tilt: "-6deg" },
  { icon: HardDrive, label: "Old hard drive", tilt: "4deg" },
  { icon: Cloud, label: "Dropbox link", tilt: "-3deg" },
  { icon: Building2, label: "Studio computer", tilt: "5deg" },
  { icon: Palette, label: "Design file", tilt: "-5deg" },
  { icon: Camera, label: "Camera roll", tilt: "3deg" },
  { icon: StickyNote, label: "Notes app", tilt: "-4deg" },
  { icon: MessageSquare, label: "Writer group chat", tilt: "6deg" },
  { icon: Mic, label: "Voice memo", tilt: "-2deg" },
  { icon: Folder, label: "Downloads folder", tilt: "2deg", wide: true },
  { icon: Smartphone, label: "Producer's phone", tilt: "-6deg", wide: true },
  { icon: Cloud, label: "Google Drive", tilt: "-2deg", wide: true },
];

/**
 * Both card labels sit at the same height (founder, 2026-11-05): the after one lives inside the roof triangle, and 30%
 * down the card that triangle has opened wide enough to hold the words on a phone as well as a desktop.
 */
const CARD_LABEL = "absolute inset-x-0 top-[30%] text-center text-base font-bold uppercase tracking-[2px] sm:text-[17px] lg:text-[18px]";

/** The scattered side: a loose pile of chips, deliberately not lined up, dropped to the bottom to sit level with the rows. */
function CatalogScatter() {
  return (
    <div className="relative flex h-full min-h-[26rem] flex-col justify-end rounded-2xl border border-dashed border-ink-border bg-ink p-4 text-ink-foreground">
      <p className={`${CARD_LABEL} text-ink-muted`}>Before Cataloging</p>
      {/* Same minimum height as the three song rows on the right, so the two stacks start and end on the same lines. */}
      <div className="relative flex min-h-[9rem] flex-wrap content-center items-center justify-center gap-2">
        {CATALOG_SCATTER.map(({ icon: Icon, label, tilt, wide }) => (
          <span key={label} className={`${wide ? "hidden sm:inline-flex" : "inline-flex"} items-center gap-1.5 rounded-full border border-ink-border bg-ink px-2.5 py-1 text-[13px] text-ink-muted sm:text-sm`}
            style={{ transform: `rotate(${tilt})` }}>
            <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden /> {label}
          </span>
        ))}
      </div>
      <p className="relative mt-2.5 text-center text-sm leading-snug text-ink-muted">Every piece in a different place, and none of them know about each other.</p>
    </div>
  );
}

/** Every row carries the same three groups of embedded fields: no row is special, every song gets all of them. */
const EMBEDDED_FIELDS = ["Song info", "Credits", "Identifiers"];
/** Songs, not data: three ordinary titles and three covers, so the picture shows a catalog rather than one lucky song. */
const HOUSE_SONGS = [
  { title: "Your Song", cover: "from-electric to-primary" },
  { title: "Next Single", cover: "from-primary to-ink" },
  { title: "Album Cut", cover: "from-electric/60 via-primary to-ink" },
];

/**
 * The tidy side: three identical rows sitting inside a house drawn in cobalt — wide eaves, a peaked roof and two walls
 * that keep the rows under one roof (founder, 2026-11-05). The roof sits clear of the rows so no line crosses a song.
 */
function CatalogRow() {
  return (
    <div className="relative flex h-full min-h-[26rem] flex-col justify-end rounded-2xl border border-dashed border-ink-border bg-ink p-4 text-ink-foreground">
      <svg aria-hidden viewBox="0 0 100 100" preserveAspectRatio="none"
        className="pointer-events-none absolute inset-0 h-full w-full text-electric">
        {/* Eaves past the walls, a peaked roof, a ceiling line across the wall tops, then walls down both sides. */}
        <path d="M2 43.1 L50 6 L98 43.1" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        <path d="M6 40 H94 M6 40 V99 M94 40 V99" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      </svg>
      <p className={`${CARD_LABEL} text-electric`}>After Cataloging</p>
      {/* Percentage inset: the rows stay inside the walls on a wide card, not just on a phone. */}
      <div className="relative space-y-1.5 px-[6%]">
        {HOUSE_SONGS.map(({ title, cover }) => (
          <div key={title} className="flex items-center gap-2 rounded-lg border border-ink-border bg-ink-border/25 px-2 py-1.5">
            {/* The cover art is a gradient tile: the platform has no artwork for these example songs, and a tinted tile
                reads as a cover at this size without pretending to be someone's real release. */}
            <span aria-hidden className={`h-8 w-8 shrink-0 rounded-md bg-gradient-to-br ring-1 ring-inset ring-ink-border ${cover}`} />
            <p className="min-w-0 flex-1 truncate text-xs font-semibold text-ink-foreground">{title}</p>
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-x-1.5 gap-y-0.5">
              {EMBEDDED_FIELDS.map((f) => (
                <span key={f} className="inline-flex items-center gap-1 text-[11px] font-medium leading-none text-ink-muted sm:text-xs">
                  <Check className="h-2.5 w-2.5 text-electric" strokeWidth={4} aria-hidden />{f}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
      <p className="relative mt-2.5 text-center text-xs text-ink-muted">Each song gets a row. Every row lives in the same catalog.</p>
    </div>
  );
}

/** The same 22 slots with nothing in them: the before card, so the pair lines up field for field and height for height. */
const EMPTY_GROUPS: { heading: string; rows: [string, string][] }[] = EMBEDDED_GROUPS.map(({ heading, rows }) => ({
  heading,
  rows: rows.map(([k]) => [k, ""] as [string, string]),
}));

const goSignup = () => document.getElementById("signup")?.scrollIntoView({ behavior: "smooth", block: "center" });
function StartFree({ label = "Sign up free", variant = "primary" }: { label?: string; variant?: "primary" | "outline" | "link" }) {
  const go = goSignup;
  if (variant === "link") return <button type="button" onClick={go} className="text-sm font-semibold text-primary hover:underline">{label} →</button>;
  return <button type="button" onClick={go} className={`inline-flex h-12 items-center rounded-md px-6 font-semibold transition ${variant === "primary" ? "bg-primary text-primary-foreground hover:bg-primary/90" : "border border-current hover:bg-foreground/5"}`}>{label}</button>;
}

function Landing() {
  const { filter, testimonials, socials } = Route.useLoaderData();
  const { siteLocked } = Route.useRouteContext();
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* App or browser comes first, before the header, so it is the first screen anyone meets. */}
      <AppOrBrowserGate />
      {/* A white header sets the black hero apart as its own block instead of one long stretch of black. */}
      <header className="border-b border-border bg-background text-foreground">
        <div className="mx-auto max-w-7xl px-6 pb-2.5 pt-3">
          {/* The black signature sits centered above the name (founder, 2026-11-10), so the header reads as the logo over
              the banner rather than a logo beside it. The three columns keep that logo on the page's true center while
              the nav keeps its own corner, and the name lands centered underneath, at the foot of the white band. */}
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
            <img src="/cta-logo-dark.png" alt="Came Through Audio" className="col-start-2 h-4 w-auto justify-self-center object-contain" />
            <nav className="col-start-3 flex items-center justify-self-end gap-4 whitespace-nowrap sm:gap-6"><Link to="/plans" className="text-sm font-semibold text-muted-foreground hover:text-primary">Plans</Link><Link to="/login" className="text-sm font-semibold text-muted-foreground hover:text-primary">Log in</Link></nav>
          </div>
          <div className="mt-1.5 flex justify-center">
            <BrandLogo tone="light" showMark={false} />
          </div>
        </div>
      </header>

      <section className="bg-ink text-ink-foreground">
        {/* The CTA signature came down out of the white header (founder, 2026-11-10): the name leads the header and the
            script logo sits underneath it, left-aligned on the same page edge as the name, in the black hero at half
            its old height. It is the white copy because this corner of the page is Primary Black. */}
        <div className="mx-auto max-w-7xl px-6 pt-2.5">
          <img src="/cta-logo-white.png" alt="Came Through Audio" className="h-4 w-auto object-contain" />
        </div>
        <div className="mx-auto grid max-w-7xl gap-12 px-6 pb-16 pt-5 md:grid-cols-[1.15fr_1fr] md:items-center">
          <div className="min-w-0">
            {/* The tagline: always uppercase with 2px letter spacing (BRANDING.md §1). The first line's negative margin
                trims the space above the capitals, so the headline block centers optically against the sign-up box. */}
            <FitHeadline className="uppercase leading-none tracking-[2px]" lines={[
              // Platinum, not Cobalt: Cobalt on Primary Black measured 2.4:1 and the tagline was hard to read (founder, 2026-11-03).
              { text: <><MetalWord>Your</MetalWord> first</>, className: "-mt-[0.13em] text-5xl font-extrabold md:text-6xl lg:text-7xl" },
              // "Before" is filled with the background so overlapping inner strokes don't show; only the outline reads.
              { text: <>Stop <span className="font-bold text-ink [-webkit-text-stroke:1.5px_var(--ink-foreground)]">before</span></>, className: "text-5xl font-extrabold md:text-6xl lg:text-7xl" },
              { text: <MetalWord>Distribution</MetalWord>, className: "text-5xl font-extrabold md:text-6xl lg:text-7xl" },
            ]} sub="From the last bounce in the studio to the first royalty in your account: embed your credits, organize your catalog and get your songs registered, all before you hit distribute." subClassName="text-xl font-semibold text-ink-foreground" />
          </div>
          <div id="signup">
            {/* The lockup above the form: the name first, then the line it stands for (AGENTS.md, Brand Lockup). */}
            <BrandLockup className="mb-4 text-center" nameClassName="text-lg text-ink-foreground" sloganClassName="text-sm" />
            {siteLocked ? <LaunchingSoon /> : <SignupCard />}
          </div>
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
      <section className="bg-ink pb-14 pt-20 text-ink-foreground">
        <div className="mx-auto max-w-5xl px-6">
          <h2 className="text-center text-3xl font-bold md:text-4xl">What does embed mean?</h2>
          <p className="mt-2 text-center text-lg text-ink-muted">The same file, before and after.</p>

          {/* Side by side, matching slot for slot and height for height: the comparison is the argument. */}
          <div className="mt-8 grid items-stretch gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <p className="text-center text-sm font-bold uppercase tracking-[2px] text-ink-muted">Before embedding</p>
              <FileCard name="Track 01.mp3" groups={EMPTY_GROUPS} />
            </div>
            <div className="flex flex-col gap-2">
              <p className="text-center text-sm font-bold uppercase tracking-[2px] text-electric">After embedding</p>
              <FileCard name="Your Song.mp3" done groups={EMBEDDED_GROUPS} />
            </div>
          </div>
          <p className="mt-4 text-center text-xs leading-relaxed text-ink-muted">
            Never written into the file: publishers, the ℗ line, language, PRO affiliations, IPI numbers and splits.
            Those stay private in your catalog and go only to the societies you register with.
          </p>

          {/* The story underneath, set like a magazine feature: a drop-cap lead, then two columns of body running the same
              width as the cards above, so the block ends flush with them. */}
        </div>
      </section>

      {/* The copy, on white: its own band between the black pictures above and the black callout below. */}
      <section className="bg-background py-14 text-foreground">
        <div className="mx-auto max-w-5xl px-6">
          <div>
            <p className="text-xl leading-relaxed text-foreground first-letter:float-left first-letter:mr-3 first-letter:mt-1 first-letter:text-6xl first-letter:font-black first-letter:leading-[0.8]">
              Picture this. You finish your single at 2 AM and send it out that same night to a DJ, a blog, and a music supervisor looking for a song for a TV show.
            </p>
            {/* Two flowing columns, not a row grid: each paragraph sits under the one above it instead of being pushed
                down to match the height of the paragraph beside it. */}
            <div className="mt-6 grid gap-x-10 gap-y-5 text-lg leading-relaxed text-muted-foreground md:grid-cols-2">
              <div className="space-y-5">
                <p>Three weeks later the show wants it. They open the file and all it says is Track 01. No artist. No writer. No codes. They can't clear a song they can't trace, so they move on to the next one that tells them who owns it.</p>
                <p>Make sure every song can say who made it. Came Through Audio came through for every song in your catalog.</p>
              </div>
              <div className="space-y-5">
                <p className="text-xl font-bold leading-snug text-foreground md:text-2xl">Your song was good enough. It just couldn't speak up for you.</p>
                <p><span className="font-bold text-foreground">Embedding fixes that.</span> It writes your name, credits, codes, lyrics and artwork inside the audio file itself, like a name tag sewn into a jacket.</p>
              </div>
              <p className="md:col-span-2">Same file, same mix, nothing re-recorded. The only thing that changes is what the file says about itself, which is the difference between Track 01 and a song anyone can license.</p>
            </div>

          </div>
        </div>
      </section>

      <section className="bg-ink py-14 text-ink-foreground">
        <div className="mx-auto max-w-5xl px-6">
            <div className="border-l-4 border-electric bg-ink px-6 py-5 text-ink-foreground">
              <p className="text-xs font-bold uppercase tracking-[2px] text-electric">The part that matters</p>
              <p className="mt-2 text-2xl font-extrabold leading-snug md:text-3xl">Wherever the file goes, your information goes with it.</p>
              <p className="mt-2 leading-relaxed text-ink-muted">Copied, renamed or shared a hundred times: the credits, codes, lyrics and artwork are still inside.</p>
            </div>

            {/* Embedding is a paid feature, so this button belongs with the plans, not the free sign-up box. */}
            <div className="mt-8 flex justify-center">
              <Link to="/plans" className="inline-flex h-12 items-center rounded-md bg-primary px-6 font-semibold text-primary-foreground transition hover:bg-primary/90">Embed your first master</Link>
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

      <section className="mx-auto max-w-7xl px-6 py-20">
        <h2 className="text-center text-3xl font-bold md:text-4xl">Who It's For</h2>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
          {roles.map(({ badge: Badge, photo, focus, title, question, text }, i) => (
            <div key={title} className="group flex flex-col">
              <h3 className="mb-3 text-center text-lg font-extrabold uppercase tracking-[2px] text-primary">{title}</h3>
              <div className="flex flex-1 flex-col overflow-hidden rounded-xl border border-border">
                <div className="relative overflow-hidden">
                  <img src={photo} alt="" loading="lazy" className="aspect-[16/10] w-full object-cover sm:aspect-square" style={{ objectPosition: focus }} />
                  {/* The badge sits in the photo's lower right corner and is the card's way to sign up; the section has one Sign up free button below. */}
                  {/* Animated badges (founder, 2026-10-27): each floats on its own beat, bottom right of the photo. */}
                  <button type="button" onClick={goSignup} aria-label={`Sign up free: ${title}`}
                    className="cta-badge-float absolute bottom-3 right-3 rounded-full drop-shadow-lg transition hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&>svg]:h-[3.25rem] [&>svg]:w-[3.25rem]"
                    style={{ animationDelay: `${i * -0.8}s` }}>
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

      <DownloadApp />

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

      {/* What a catalog is, told the same way as embedding: the scattered parts before, one row after (founder, 2026-11-03). */}
      <section className="border-t border-ink-border bg-ink pb-14 pt-20 text-ink-foreground">
        <div className="mx-auto max-w-5xl px-6">
          <h2 className="text-center text-3xl font-bold md:text-4xl">What is a music catalog?</h2>
          <p className="mt-2 text-center text-lg text-ink-muted">Everything one song is made of, in one place.</p>

          <div className="mt-8 grid items-stretch gap-4 sm:grid-cols-2">
            <CatalogScatter />
            <CatalogRow />
          </div>

          {/* The story underneath, set like the embedding spread: a drop-cap lead, two flowing columns, one callout. */}
        </div>
      </section>

      {/* The banner line between the spread and the story (founder, 2026-11-06): the whole idea in one breath, in the
          brand's own voice, so the cards land as proof rather than the last word. It stands alone in its own white
          section as a cobalt panel, so it reads as a separate statement instead of flowing into the story underneath,
          and its copy runs the full width of the page's text column. The payoff phrase sits on ink like a marker
          stroke, which is what makes the panel land in a glance. */}
      <section className="bg-background py-16 md:py-20">
        <div className="mx-auto max-w-5xl px-6">
          <div className="rounded-2xl bg-primary px-6 py-12 text-primary-foreground ring-1 ring-inset ring-primary-foreground/20 md:px-12 md:py-14">
            {/* The panel is signed with the words, and the mark sits in its corner as a badge (founder, 2026-11-06): the
                mark standing in for the C read as a typo at this size, so the name is typed plainly and the logo is
                set apart from it. On cobalt the mark's own arrow would dissolve into the panel, so the badge is drawn
                as a single white silhouette here rather than on a plate of its own. */}
            <div className="flex items-start justify-between gap-4">
              <p className="text-sm font-bold uppercase tracking-[3px] sm:text-base">Came Through Audio</p>
              <img src="/cta-mark-white.png" alt="" aria-hidden width={48} height={48}
                className="-mt-1 h-11 w-11 shrink-0 object-contain brightness-0 invert md:h-12 md:w-12" />
            </div>
            <p className="mt-6 text-4xl font-extrabold leading-[1.1] md:text-5xl lg:text-6xl">Your music. One Home.</p>
            <p className="mt-3 text-3xl font-extrabold leading-[1.2] md:text-4xl lg:text-5xl">
              <span className="inline-block bg-ink px-3 py-1 text-ink-foreground">One asset you can count on.</span>
            </p>
            {/* The copy pops by getting shorter and harder (founder, 2026-11-06): one bold line that states the mechanism,
                a three-beat rhythm line under it, and a payoff sentence that keeps the practical promise. Same facts as
                before — nothing added, nothing claimed. */}
            <p className="mt-8 max-w-3xl text-xl font-semibold leading-snug md:text-2xl">
              Title, writers, credits, artwork and codes — written into the master itself, not filed beside it.
            </p>
            <p className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-bold uppercase tracking-[2.5px] text-primary-foreground/75 md:text-base">
              <span>One file</span>
              <span aria-hidden className="text-primary-foreground/40">·</span>
              <span>Every piece</span>
              <span aria-hidden className="text-primary-foreground/40">·</span>
              <span>Yours to hand over</span>
            </p>
            <p className="mt-6 max-w-3xl text-lg leading-relaxed text-primary-foreground/90 md:text-xl">
              So the whole catalog stays one asset you own. Download it whole, hand it to a distributor, or re-release
              it — without hunting through drives and inboxes for the pieces.
            </p>
          </div>
        </div>
      </section>

      {/* The copy sits on white again (founder, 2026-11-05), and the industry-deals standfirst gives way to the point
          that actually keeps an artist up at night: the backup that survives a distributor taking the release down. */}
      <section className="bg-background py-14 text-foreground">
        <div className="mx-auto max-w-5xl px-6">
          <div>
            <p className="text-xl leading-relaxed text-foreground first-letter:float-left first-letter:mr-3 first-letter:mt-1 first-letter:text-6xl first-letter:font-black first-letter:leading-[0.8]">
              A catalog is every piece of a song kept together: the master, the artwork, the lyrics, the credits and the codes, <span className="font-semibold text-primary">for every song you own</span>.
            </p>
            <div className="mt-6 grid gap-x-10 gap-y-5 text-lg leading-relaxed text-muted-foreground md:grid-cols-2">
              <div className="space-y-5">
                <p>Before cataloging, one song lives in a dozen places. The master is an attachment in an email thread, a copy on a hard drive and a link in a Dropbox folder; the session file is on the studio's computer. The cover art is in a design tool, the lyrics are in your notes app, and the splits are in a group chat with the writers.</p>
                <p>Cataloging stops the hunt. Search a title, a writer or an ISRC and the song comes back with its master, art, lyrics and credits attached.</p>
              </div>
              <div className="space-y-5">
                <p>None of those places is wrong. The problem is that not one of them knows about the others, so "where is it?" takes an afternoon and the answer changes with every release.</p>
                <p>One row per song means one place to download from, one place to hand a distributor, and one place to pull a registration from without opening an email from 2019.</p>
              </div>
            </div>

            {/* The word as the industry uses it, with reported deals as the proof — and an explicit "not an appraisal" so
                no one reads a member's catalog as priced by us (founder, 2026-11-05). Set across the spread like a
                standfirst: same width as the rest, two columns, paragraphs flowing together. */}
            {/* A distributor taking a release down is a fear an artist has actually lived through, so this block answers
                it instead of quoting deal figures (founder, 2026-11-05). It says what the member can do the morning
                after, in their words, with no number and no promise we do not keep. */}
            <div className="mt-8 rounded-xl bg-ink px-6 py-6 text-ink-foreground md:px-8">
              {/* The kicker is the invitation, not a label (founder, 2026-11-06): one line that names what the panel
                  offers and goes to the plans page where the backups are sold. */}
              <Link to="/plans" className="inline-block text-lg font-bold text-electric underline-offset-4 hover:underline sm:text-xl">Start Your True Sovereign Backups</Link>
              <p className="mt-3 text-xl leading-relaxed text-ink-foreground md:text-2xl">
                A distributor can take your catalog down: a rights claim, a disputed payout, an account closed over
                paperwork you never saw. The morning after, the only question that matters is whether your music still
                exists somewhere you can reach. Here it does — log in from any computer, download your masters with the
                metadata already embedded, and hand the next distributor a complete record: song, credits, artwork and
                codes, without retyping a field. That is what sovereign means:{" "}
                <span className="font-semibold text-electric">the catalog stays with you, not with whoever happens to be distributing it</span>.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* The word as the industry uses it, in its own blue band above the callout (founder, 2026-11-05): a catalog
          is an asset artists and companies trade, not only the folder a song lives in. No figure and no year — the
          example carries itself without us asserting a price. */}
      <section className="bg-primary py-14 text-primary-foreground">
        <div className="mx-auto max-w-5xl px-6">
          <h2 className="text-3xl font-extrabold md:text-4xl">What the industry means by a catalog</h2>
          <div className="mt-4 grid gap-6 text-lg leading-relaxed text-primary-foreground/90 md:grid-cols-2">
            <p>A catalog is not one song. In the music business the word means an artist's cumulative body of work, held as a single asset: every recording, every composition and every share of the writing, valued and traded together rather than a track at a time. A single song is a credit; a catalog is an estate, because the worth sits in the body of work and the income it already earns, not in any one release. That is why catalogs get bought, licensed and insured whole, and why an artist who owns one sits down to a very different conversation than an artist with a good song on a hard drive.</p>
            <p>Michael Jackson bought the Beatles' publishing catalog, and that purchase is still the example people reach for. He was not buying a hit; he was buying the body of work: the songs, the shares in them and the right to say yes or no when someone wants to use one. The songs never moved one at a time; the catalog moved whole, as a single asset on a single contract. That is the lesson worth carrying: owning the body of work is worth more than owning any part of it, because a catalog keeps earning long after any one release stops being new. That is what a buyer is paying for.</p>
          </div>
        </div>
      </section>

      <section className="bg-ink py-14 text-ink-foreground">
        <div className="mx-auto max-w-5xl px-6">
            {/* Black callout, straight after the story (founder, 2026-11-05): it was blue for one pass and goes back
                to the black band with the cobalt edge, matching the callout above. Three beats instead of a comma list,
                so the line lands like a magazine cover line. */}
            <div className="border-l-4 border-electric bg-ink px-6 py-5 text-ink-foreground">
              <p className="text-2xl font-extrabold leading-snug md:text-3xl">Every song, embedded. One Catalog. Organized.</p>
              <p className="mt-2 leading-relaxed text-ink-muted">Master, artwork, lyrics, credits and codes stay together, so every download comes back complete.</p>
            </div>

            <div className="mt-8 flex justify-center">
              <Link to="/plans" className="inline-flex h-12 items-center rounded-md bg-primary px-6 font-semibold text-primary-foreground transition hover:bg-primary/90">Start your catalog</Link>
            </div>
        </div>
      </section>

      <section id="plans" className="scroll-mt-4 bg-background py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="text-center text-3xl font-bold md:text-5xl">More value at every step</h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-lg text-muted-foreground">Start free with Royalty Health Checks. Unlock embedding, your catalog and every download for {PLUS.price} a year, then grow into split sheets, agency exports and contracts.</p>
          <div className="mt-10">
            <PlanComparison tone="dark" action={(p) => planAction(p, { onBuy: () => {}, onSignup: () => document.getElementById("signup")?.scrollIntoView({ behavior: "smooth" }) })} />
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
          {/* The same lockup as the hero, above the last sign up button (founder, 2026-11-04). */}
          <BrandLockup className="mt-2 text-center" nameClassName="text-lg text-ink-foreground" sloganClassName="text-sm" />
          <div className="mt-2 flex flex-wrap justify-center gap-3">
            <StartFree />
            <Link to="/plans" className="inline-flex h-12 items-center rounded-md border border-ink-border px-6 font-semibold hover:bg-ink-border">Compare plans</Link>
          </div>
        </div>
      </section>

      {/* A hairline between the last sign-up and the footer links, so the two black blocks don't run together. */}
      <div aria-hidden className="h-px w-full bg-ink-foreground/25" />

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
        {/* Social bottom left, the copyright bottom right: the footer's last line (founder, 2026-11-04). */}
        <div className="border-t border-ink-border px-6 py-6">
          <div className="mx-auto flex max-w-7xl flex-col-reverse items-center justify-between gap-4 sm:flex-row">
            <SocialLinks links={socials} />
            <p className="text-sm text-ink-muted">© {new Date().getFullYear()} Came Through Audio, LLC</p>
          </div>
        </div>
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
      </div>
    </div>
  );
}
