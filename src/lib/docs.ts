/**
 * Public product and learning pages linked from the homepage footer (/docs/$slug).
 * Keep every claim true to what the app does today; update a page whenever its feature changes.
 */
export type DocSection = { heading: string; paragraphs?: string[]; bullets?: string[] };
export type Doc = { slug: string; group: "Product" | "Learn"; title: string; description: string; intro: string; sections: DocSection[] };

export const DOCS: Doc[] = [
  {
    slug: "metadata-embedding",
    group: "Product",
    title: "Metadata Embedding",
    description: "Lock your credits, identifiers, lyrics and artwork inside your MP3 so your data travels with your music.",
    intro: "Embedding writes your song's details directly into the audio file. Wherever the file goes (a music supervisor's inbox, a DJ's crate, a radio submission), your credits go with it.",
    sections: [
      { heading: "What gets embedded", bullets: [
        "Title, artist, featured artists, album, track number (entered as \"1 of 12\" and saved as 1/12), genre, release date and label.",
        "Identifiers: ISRC, UPC and ISWC.",
        "Credits: writers by legal name, plus producers.",
        "Lyrics and cover art.",
        "Copyright and phonographic lines.",
      ] },
      { heading: "What stays private", paragraphs: ["PRO affiliations, IPI numbers and split percentages are never written into the file. They stay in your private catalog, where only you can see them, and in your agency exports."] },
      { heading: "How it works", bullets: [
        "Drop in your final MP3 in Embed Metadata.",
        "Fill in the details, or let your saved Embed Defaults fill them for you.",
        "Click Embed & Download. The tagged file is created in your browser and saved as \"Song Title.mp3\".",
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
      { heading: "Royalty Health Check (free)", bullets: [
        "The Royalty Inspector checks any song you type in, free and unlimited. Save it to your Song Health Checklist to track it.",
        "Every song gets a simple step-by-step checklist: fix the song details, register it, then confirm it shows up. Tick steps at your own pace until it's 100% healthy.",
        "Not showing up yet? Each step lists the common, harmless reasons (still processing, not matched or reconciled yet, spelled differently) and what to do.",
        "Organize songs into Needs attention, Saved for later (with a note and reminder date) and 100% Healthy.",
        "On paid plans, every song you embed or save to My Catalog is checked automatically, including streaming availability and composition data from open music databases.",
        "Lists the collection societies for your country, with direct links to search their public repertoires or log in to your member account.",
        "Lets you mark each society \"Found it\" or \"Not listed\" so your report stays up to date.",
        "Flags missing writer details that would block registration, with links to fix them.",
      ] },
      { heading: "Expert Assistance", paragraphs: ["Prefer help? Our team can handle registrations for you. Pricing is shown up front: a setup fee for a single, EP or album, plus a per-song, per-agency fee."] },
      { heading: "Royalty Utility Suite", paragraphs: ["Included with Catalog and Collaborate and up: the BMI/ASCAP Formula Converter (BMI reports shares on a 200% scale; ASCAP, SoundExchange and The MLC use 100%) and a Projected Royalty Earnings Calculator with editable rate estimates."] },
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
        "Checkout is handled by Paddle, so your card details never touch our servers.",
        "Paid access comes only from verified payment records. It can't be granted from inside the app.",
        "Staff access is role-based and limited to each person's department. Nobody can promote themselves.",
      ] },
    ],
  },
  {
    slug: "help-center",
    group: "Learn",
    title: "Help Center",
    description: "Quick answers for getting set up, embedding, cataloging, splits, contracts and billing.",
    intro: "Can't find your answer? Open a support ticket from the Contact page and our team will reply by email.",
    sections: [
      { heading: "Getting started", bullets: [
        "Sign up free. Royalty Health Checks and signing split sheets you're invited to are always free.",
        "Set up your catalog profile once: profile badge, release defaults, and your legal name for credits.",
        "Choose a plan from View Plans in your workspace whenever you're ready. Plans are billed annually.",
      ] },
      { heading: "Embedding and catalog", bullets: [
        "Embed Metadata is in your workspace. Drop in an MP3, fill in the details, and download your tagged master.",
        "Use Submit to catalog to save the song, master, art and lyrics to My Catalog.",
        "Already embedded a song elsewhere? In My Catalog, use Add song to upload the MP3 (we read its tags) or add a song without audio.",
        "Writers need a legal name and role (Author, Composer or Author/Composer) before registration. Splits (and publisher shares, if you list a publisher) should add up to exactly 100%; we warn you if they don't. You can embed without any of this.",
        "Mark a song Instrumental if it has no lyrics. It then doesn't need an author.",
      ] },
      { heading: "Split sheets", bullets: [
        "Generate a split sheet from any catalog song, sign as the owner and download the PDF (Catalog Plus and up).",
        "Request collaborators' e-signatures by email (Catalog and Collaborate and up).",
        "Collaborators get an email link, create a free account with that email, and sign.",
        "Collaborators can add their own PRO and IPI when they sign.",
        "Signed split sheets live in your Signed Split Sheet Vault.",
      ] },
      { heading: "Contracts", bullets: [
        "Contracts & Blueprints is in your workspace (Catalog Management).",
        "Pick a blueprint, fill in the deal, add each party's legal name and email, then lock and request signatures.",
        "Fully signed contracts move to your Signed Vault and download as a signed PDF.",
        "Blueprints are templates, not legal advice. Have an attorney review before you sign.",
      ] },
      { heading: "Billing", bullets: [
        "Plans renew yearly. See the Refund Policy for refund terms.",
        "Upgrade anytime from View Plans. Your current plan is highlighted.",
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

export const docBySlug = (slug: string) => DOCS.find((d) => d.slug === slug);
