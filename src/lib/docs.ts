/**
 * Public product and learning pages linked from the homepage footer (/docs/$slug).
 * Keep every claim true to what the app does today; update a page whenever its feature changes.
 */
import { ACCESS_STEPS } from "@/lib/registration";

export type DocSection = { heading: string; paragraphs?: string[]; bullets?: string[] };
export type Doc = { slug: string; group: "Product" | "Learn"; title: string; description: string; intro: string; sections: DocSection[] };

export const DOCS: Doc[] = [
  {
    slug: "metadata-embedding",
    group: "Product",
    title: "MP3 Embedding",
    description: "Lock your credits, identifiers, lyrics and artwork inside your MP3, so your song stays traceable to you wherever it is sent.",
    intro: "Embedding writes your song's details into the audio file itself, not into a database on the side. Wherever that file goes (a music supervisor's inbox, a DJ's crate, a radio submission, a distributor's upload, a download someone passes along), its credits, identifiers, lyrics and artwork travel inside it. However and wherever you send your music, the song still says who made it and which song it is, so it can be found and credited instead of arriving as an anonymous file.",
    sections: [
      { heading: "What gets embedded", bullets: [
        "Title, artist, featured artists, album, track number (entered as \"1 of 12\" and saved as 1/12), genre, release date and label.",
        "Identifiers: ISRC, UPC and ISWC.",
        "Credits: writers by legal name, plus producers.",
        "Lyrics and cover art.",
        "The copyright line (the ℗ line and language stay in your catalog, never in the file).",
      ] },
      { heading: "What stays private", paragraphs: ["PRO affiliations, IPI numbers and split percentages are never written into the file. They stay in your private catalog, where only you can see them, and in your agency exports."] },
      { heading: "How it works", bullets: [
        "Drop in your final MP3 in Embed Metadata.",
        "Fill in the details, or let your saved Embed Defaults fill them for you.",
        "Click Embed Verified Metadata & Download Official Master. The tagged file is created in your browser and saved as \"Song Title.mp3\" (or \"Song Title.wav\" for a WAV).",
        "Submit it to My Catalog to keep the master, artwork and lyrics ready to download again anytime.",
      ] },
      { heading: "No ISRC or UPC yet?", paragraphs: ["Most distributors assign them free when you release. Embed now, then add your codes in My Catalog when they arrive, or drop your tagged MP3 back in to repopulate everything automatically."] },
    ],
  },
  {
    slug: "master-catalog",
    group: "Product",
    title: "Centralized Master Catalog",
    description: "Every song, credit, identifier, master, cover and lyric sheet in one organized place.",
    intro: "My Catalog is the home base for your music business. Stop digging through emails, texts and old hard drives.",
    sections: [
      { heading: "Organized the way you release", bullets: [
        "Songs are grouped into Albums, EPs and Singles, with filters to switch between them.",
        "Each song shows its release details, identifiers and credits side by side.",
        "A registration readiness badge tells you exactly what's missing before you register, with a direct link to fix it.",
      ] },
      { heading: "Download anything, anytime", bullets: [
        "Master MP3: the embedded file, named exactly as your track title.",
        "Album art: the original upload.",
        "Lyrics PDF: a branded lyric sheet with credits.",
        "Catalog PDF: your whole catalog, a filtered group, or selected songs as one branded document.",
      ] },
      { heading: "Built to connect", bullets: [
        "Generate split sheets straight from a song's writers and producers.",
        "Download registration-ready exports for The MLC, SoundExchange, ASCAP and BMI.",
        "Protect a track with the AI Protection Hub.",
      ] },
    ],
  },
  {
    slug: "royalty-health-suite",
    group: "Product",
    title: "Royalty Health Suite",
    description: "Find out if your songs are registered where royalties are collected, and fix what's missing.",
    intro: "Unregistered songs mean missed payouts. The Royalty Health Suite shows where each song stands and what to do next.",
    sections: [
      { heading: "Royalties and Registrations (free)", bullets: [
        "The Royalties and Registrations is home base for your songs' royalty health: your catalog at a glance, your Song Health Checklist and every report you've run.",
        "Run a Royalty Health Check on one song, a release or your whole catalog, from Royalties and Registrations or from My Catalog. A quick check-in asks what you've already registered, then your Royalty Health Report shows what's blocking your money and how to fix it. Every report is kept in My reports, so you can run it again and see what healed.",
        "Checking a song that isn't in your catalog, or on a free account? Type it into the Royalty Inspector and run its Royalty Health Check, free and unlimited.",
        "BMI writers with no publisher still get their writer share, and BMI pays them the publisher share too. Writers at other PROs need a publisher, or Self-published.",
        "Every song gets a simple step-by-step checklist: fix the song details, register it, then confirm it shows up. Tick steps at your own pace until it's 100% healthy.",
        "Not showing up yet? Each step lists the common, harmless reasons (still processing, not matched or reconciled yet, spelled differently) and what to do.",
        "Organize songs into Needs attention, Saved for later (with a note and reminder date) and 100% Healthy.",
        "On paid plans, every song you embed or save to My Catalog is checked automatically, including streaming availability and composition data from open music databases.",
        "Lists the collection societies for your country, with direct links to search their public repertoires or log in to your member account.",
        "Lets you mark each society \"Found it\" or \"Not listed\" so your report stays up to date.",
        "Flags missing writer details that would block registration, with links to fix them.",
      ] },
      { heading: "Expert Assistance", paragraphs: ["Prefer help? Our team can handle registrations for you. Pricing is shown up front: a setup fee for a single, EP or album, plus a per-song, per-agency fee."] },
      { heading: "Royalty Utility Suite", paragraphs: ["Included with Catalog & Collaborate and up: the BMI/ASCAP Formula Converter (BMI reports shares on a 200% scale; ASCAP, SoundExchange and The MLC use 100%) and a Projected Royalty Earnings Calculator with editable rate estimates."] },
    ],
  },
  {
    slug: "security",
    group: "Product",
    title: "System Security",
    description: "How Came Through Audio protects your catalog, your files, your signatures and your payments.",
    intro: "Your catalog is your business. Here's how we keep it private and tamper-evident.",
    sections: [
      { heading: "Your data is yours", bullets: [
        "Database rules mean only you can read or change your catalog, split sheets and contracts.",
        "Masters, artwork and proof videos are stored privately in your own account folder.",
        "Embedding happens in your browser. Private PRO, IPI and split details are never written into your MP3.",
      ] },
      { heading: "Tamper-evident signatures", bullets: [
        "Split sheet and contract signatures are time-stamped and secured with a SHA-256 verification hash.",
        "Contracts are locked before anyone signs, and the fingerprint of the exact text is stored with every signature.",
        "Signers must log in with the email the request was sent to.",
      ] },
      { heading: "Proof of creation", paragraphs: ["The AI Protection Hub fingerprints your session recordings with SHA-256 and timestamps them on the Bitcoin blockchain through OpenTimestamps. That proves a file existed at a point in time. It doesn't prove ownership by itself, which is why it's paired with your sworn human-authorship attestation."] },
      { heading: "Payments and staff access", bullets: [
        "Checkout is handled by Stripe, so your card details never touch our servers.",
        "Paid access comes only from verified payment records. It can't be granted from inside the app.",
        "Staff access is role-based and limited to each person's department. Nobody can promote themselves.",
      ] },
    ],
  },
  {
    slug: "help-center",
    group: "Learn",
    title: "Getting Started",
    description: "What each workspace tab does, the steps to work it, and the plan it comes with.",
    intro: "Your workspace holds eight tabs, numbered left to right in the order most people work them. This page walks each tab in that order: what it is for, the steps to work it, and the plan it comes with. Free covers the Royalties and Registrations, the Royalty Inspector and signing split sheets you are invited to; the other tools begin with a paid plan.",
    sections: [
      { heading: "Before your first song", bullets: [
        "Sign up free. Your profile badge, stage name and legal name are what credits and PDFs use.",
        "Fill in Embed Defaults and your Catalog Profile once. Every song you embed or catalog starts from those values, and you change only what is different.",
        "Choose a plan from View Plans in the workspace when you are ready. Plans are billed yearly, and an upgrade pays only the prorated difference for the rest of your year.",
        "If a paid plan ends, the catalog you built stays readable and downloadable; adding to it waits for a plan again.",
      ] },
      { heading: "1. Embed Metadata — Catalog Plus", bullets: [
        "Drop in your final master: an MP3 on any paid plan, and a WAV too on Catalog Management.",
        "Fill in the details, or let your Embed Defaults fill them. Set the Release type, and for another cut of the same recording set its Version: radio edit, clean, instrumental, acapella, sped up, chopped and screwed.",
        "Tick This song isn't released yet if it is staying with you for now. That answer only sorts the song in your catalog and is never written into the file.",
        "Click Embed Verified Metadata & Download Official Master. The tagged file is built in your browser and saved as Song Title.mp3, with the version written as the file's subtitle so the title itself stays clean.",
        "Press Submit to catalog to keep the master, artwork and lyrics together in My Catalog.",
      ] },
      { heading: "2. My Catalog — Catalog Plus", bullets: [
        "Songs sit under the release they name. An album title holds its songs together, so one album never scatters into a pile of singles, and a release reads as an EP or an album from its type and its size.",
        "Open a row to edit its credits, identifiers, lyrics and artwork. Each row shows its version and a readiness badge that names exactly what is still missing.",
        "Use Duplicate to make another version of the same song (radio edit, clean, instrumental, sped up and so on) inside the same release. It clears the ISRC, because each version is its own recording.",
        "Download a master, its cover art, its lyrics PDF, the catalog PDF, or one release or the whole catalog as a ZIP.",
        "Generate a split sheet from any catalog song (Catalog Plus). Agency exports for The MLC, SoundExchange, ASCAP and BMI need Catalog & Collaborate.",
        "Already embedded a song somewhere else? Use Add song to upload the MP3 (we read its tags) or add a song without audio.",
        "Writers need a legal name and a role (Author, Composer or Author/Composer) before registration, and splits, plus publisher shares if you list a publisher, must add up to exactly 100%. You can still embed and save without any of that. Mark a song Instrumental if it has no lyrics and it no longer needs an author.",
      ] },
      { heading: "3. Royalties and Registrations — free, on every plan", bullets: [
        "Run a Royalty Health Check on one song, a release or the whole catalog. A short check-in asks what you have already registered.",
        "The report names what is blocking the money and links each fix to the field that needs it.",
        "Check a song that is not in your catalog yet with the Royalty Inspector, free and unlimited.",
        "Tick the Song Health Checklist until a song is 100% healthy. Every report stays in My reports, so you can run it again and see what healed.",
        "On paid plans, every song you embed or save is checked automatically. The Royalty Utility Suite, with the share converters and the projected earnings calculator, needs Catalog & Collaborate.",
        "Expert Help, where our team registers the songs for you, starts here and is paid per order.",
      ] },
      { heading: "4. AI Protection Hub — every plan, bought per certificate", bullets: [
        "Choose the song you are protecting and add your session recordings. The hub fingerprints them with SHA-256 and timestamps them on the Bitcoin blockchain through OpenTimestamps.",
        "Complete the sworn human-authorship attestation, then download your Certificate of Human Origin.",
        "A certificate proves a file existed at a point in time. It does not prove ownership by itself, which is why the attestation travels with it.",
      ] },
      { heading: "5. Split Sheets — Catalog Plus to make one, Catalog & Collaborate to collect", bullets: [
        "Generate a sheet from any catalog song (Catalog Plus), set each writer's share, sign as the owner and download the PDF.",
        "Email collaborators a secure link to e-sign (Catalog & Collaborate). They create a free account with that address and sign.",
        "Collaborators can add their own PRO and IPI as they sign.",
        "Signed sheets move to your Signed Split Sheet Vault.",
        "A sheet someone sends you can always be signed free, whatever plan you are on.",
      ] },
      { heading: "6. Contracts & Blueprints — Catalog Management", bullets: [
        "Pick a contract, fill in the few fields marked *, and add each party's legal name and email. Everything else is pre-filled and stays editable.",
        "Read it over, sign at the bottom, then send it to email everyone else. The last signature closes it and moves it to the Signed Vault, where it downloads as a signed PDF.",
        "Blueprints are the guides behind the paperwork: work the numbered steps, tick the checklist, add a note or a due date to an item, and save one to Working On to come back to it another day.",
        "Download a blueprint as a PDF with real, tickable boxes.",
        "Contracts sent to you are always visible, and the guides show as a preview on every plan. Generating your own contracts, collecting signatures and the Signed Vault need Catalog Management.",
        "Blueprints are templates, not legal advice. Have an attorney review before you sign.",
      ] },
      { heading: "7. PDF Fill & Sign — Catalog Management", bullets: [
        "Open any PDF, type into its own fill-in boxes, and add text, a date and your signature.",
        "Download a clean copy at full quality. The file never leaves your browser.",
      ] },
      { heading: "8. Support — every plan", bullets: [
        "Open a ticket from the Support tab or the Help Center page, then follow the thread there when we reply.",
        "Most replies go out in about 48 hours; busy weeks and holidays take longer.",
      ] },
      { heading: "Which plan covers what", bullets: [
        "Free: Royalty Health Checks, the Royalty Inspector, signing split sheets you are invited to, and support.",
        "Catalog Plus: MP3 embedding, My Catalog with its downloads, and split sheet generation.",
        "Catalog & Collaborate: collaborator e-signatures, 1-Click Agency Exports, and the Royalty Utility Suite.",
        "Catalog Management: WAV embedding, PDF Fill & Sign, contracts and the Signed Vault, blueprints, and personal branding.",
        "Plans renew yearly and upgrades are prorated. See the Refund Policy for refund terms, and View Plans in the workspace for what you are on.",
      ] },
    ],
  },
  {
    slug: "industry-insights",
    group: "Learn",
    title: "Industry Insights",
    description: "Plain-language explainers on how music royalties, identifiers and splits actually work.",
    intro: "The music business runs on data. Here's what each piece means and why it matters to your money.",
    sections: [
      { heading: "The two copyrights in every song", paragraphs: ["Every recording has two copyrights: the composition (the words and music, owned by writers and publishers) and the sound recording, or master (owned by whoever paid for or made the recording, often the artist or label). They earn different royalties from different places."] },
      { heading: "Performance royalties (PROs)", paragraphs: ["When a song is played on radio, streamed, or performed in public, the composition earns performance royalties. Performing rights organizations like ASCAP, BMI, SESAC, PRS, SOCAN and GEMA collect them for writers and publishers. You can only belong to one PRO per territory as a writer."] },
      { heading: "Mechanical royalties (The MLC)", paragraphs: ["Every time a song is reproduced, including on-demand streams in the US, the composition earns a mechanical royalty. The MLC collects US streaming mechanicals. In MLC exports, writer roles are coded Author = A, Composer = C, and Author/Composer = CA."] },
      { heading: "Digital performance (SoundExchange)", paragraphs: ["Non-interactive digital radio (like satellite and internet radio) pays the master side through SoundExchange: the featured artist and the rights owner. Register your recordings there too."] },
      { heading: "ISRC, UPC and ISWC", bullets: [
        "ISRC identifies a recording. Each version of a song gets its own.",
        "UPC identifies a release (the single, EP or album).",
        "ISWC identifies a composition. It's assigned after the work is registered.",
      ] },
      { heading: "Why splits come first", paragraphs: ["Agree on who wrote what before release, and put it in writing on a split sheet. Disputes after a song takes off are expensive. A signed split sheet is the record every registration should match."] },
    ],
  },
  {
    slug: "studio-to-catalog-guide",
    group: "Learn",
    title: "The Studio-to-Catalog Guide",
    description: "Six steps from final mix to a protected, organized, registration-ready song.",
    intro: "Follow these steps for every release, before you send anything to your distributor.",
    sections: [
      { heading: "1. Lock the splits", paragraphs: ["Before the session ends, agree on writer shares and get them signed on a split sheet. Use legal names, and note each writer's role: Author, Composer or Author/Composer."] },
      { heading: "2. Export your final master", paragraphs: ["Bounce the final mix as a high-quality MP3 for embedding, and keep your WAV for distribution."] },
      { heading: "3. Embed your metadata", paragraphs: ["Drop the MP3 into Embed Metadata. Add credits, lyrics, artwork, and your ISRC and UPC if you have them. Download the tagged master. That file is your official copy for pitches, DJs and radio."] },
      { heading: "4. Save it to your catalog", paragraphs: ["Submit to My Catalog so the master, art, lyrics and credits are stored together. Fix anything the readiness badge flags."] },
      { heading: "5. Protect it", paragraphs: ["Use the AI Protection Hub to create a Certificate of Human Origin from your session recordings, timestamped on the Bitcoin blockchain."] },
      { heading: "6. Distribute and register", paragraphs: ["Release through your distributor, then add the ISRC and UPC they assign. Download agency exports for The MLC, SoundExchange and your PRO, or let Expert Assistance handle registration. Run a Royalty Health Check a few weeks later to confirm everything shows up."] },
    ],
  },
];

/**
 * How to add Came Through Audio as a representative at each agency, built from the same steps the Expert Help order
 * shows (ACCESS_STEPS), so the two never disagree. Public, so it leaves out the representative email: customers get
 * the details in their order.
 */
const DETAILS = "the representative details shown in your Expert Help order";
DOCS.push({
  slug: "add-representative",
  group: "Learn",
  title: "Add Came Through Audio as Your Representative",
  description: "Step-by-step: give Came Through Audio registration-only access at ASCAP, BMI, The MLC and SoundExchange, without sharing your password or payments.",
  intro: "When you buy Expert Help, our team registers your songs and recordings for you. To do that, you add us as a representative (an authorized user) in each of your accounts. You never share your password, and we never get access to your bank or payment details.",
  sections: [
    { heading: "Before you start", bullets: [
      `You'll need ${DETAILS}: an email address, a first name and a last name. They appear after you sign the Registration Authorization.`,
      "Have your own login for each organization ready. Only the account owner can add a representative.",
      "You can remove our access at any time, and we'll ask you to once your registrations are done.",
    ] },
    ...Object.entries(ACCESS_STEPS).map(([agency, a]) => ({
      heading: `${agency} (${a.where})`,
      bullets: [
        ...a.steps.map((st, i) => `${i + 1}. ${st.replace(/the details below/g, DETAILS)}`),
        `Permission to choose: ${a.permission}.`,
      ],
    })),
    { heading: "When you're done", paragraphs: ["Go back to your Expert Help order and click Done on each organization you've added us to. We'll take it from there and let you know if anything needs your attention. Menus at each organization change from time to time; if a step doesn't match what you see, open a support ticket from the Contact page and we'll help."] },
  ],
});

export const docBySlug = (slug: string) => DOCS.find((d) => d.slug === slug);
