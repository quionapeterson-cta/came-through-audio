import { PRE_DIST_NOTE, PRO_TIP } from "@/lib/copy";
import { ARTIST_SEAT_PRICES, TIER_LABEL } from "@/lib/plans";

/**
 * Every FAQ answer in one place: the homepage shows the `home` ones (same size as before), /faq shows all of them with
 * search (PLAN-master-notes 2.2). Facts here must match the Refund Policy, plans.ts and the agency export notes.
 */
export type Faq = { q: string; a: string; category: FaqCategory; home?: boolean };
export const FAQ_CATEGORIES = ["Getting started", "Plans & billing", "Embedding", "My Catalog", "Agency exports & registration", "Royalty Health Hub", "Split sheets & contracts", "AI Protection Hub", "Account & security"] as const;
export type FaqCategory = (typeof FAQ_CATEGORIES)[number];

/** How Royalty Health scores work: the info card in the Hub and the report, and the FAQ answer, say the same thing. */
export const SCORE_STEPS = [
  "Each agency gets its own score, counting only the details that agency needs. A missing UPC lowers SoundExchange, not BMI.",
  "Within each agency, what it matches your song by counts most (60%): the ISRC and ISWC, the exact title, and every writer with their IPI. Its other required details count 35%, and the duration 5% (PROs only: it helps tell apart songs with similar titles).",
  "Only agencies that apply count. SoundExchange waits until the release date, and Royalty Inspector songs only need the details the Inspector asks for.",
  "Your score is half details (the average of those agency scores) and half registration: registered and confirmed with each agency.",
  "100% means every applicable agency has everything it needs and has your song on file.",
];

export const FAQS: Faq[] = [
  // Getting started
  { category: "Getting started", home: true, q: "What is a Catalog?", a: "In the music industry, your Catalog is the complete collection of musical works, masters, and intellectual property that you own or control. Inside Came Through Audio, the \"My Catalog\" tab acts as your private, institutional-grade digital vault. It organizes your master files, high-resolution cover art, precise tracking tags, splits, and credit data in one secure dashboard so you never lose track of an asset or miss out on a royalty payout." },
  { category: "Getting started", q: "Who is Came Through Audio for?", a: "Independent artists, songwriters, producers, composers and session musicians who want their credits, splits and registrations right before (and after) they distribute. YOUR FIRST STOP BEFORE DISTRIBUTION." },
  { category: "Getting started", q: "What can I do for free?", a: "Run unlimited Royalty Health Checks, use the Royalty Inspector on songs that aren't in a catalog yet, and sign split sheets collaborators send you. If a paid plan ends, the account moves to Free automatically and the catalog you already built stays read-only: view and download, no adding or editing, until you start a paid plan again. Embedding, a new catalog and the other tools start with Catalog Plus." },
  { category: "Getting started", q: "Do I need a distributor first?", a: "No. Come here first: embed your credits, set your splits and get your codes in order, then deliver to your distributor with everything already correct." },

  // Plans & billing
  { category: "Plans & billing", home: true, q: "How do the plans and refunds work?", a: "Plans are yearly: Catalog Plus ($24.99), Catalog & Collaborate ($44.99) and Catalog Management ($89.99). You can ask for a full refund within 30 days of your order. Upgrading later charges only the prorated difference." },
  { category: "Plans & billing", q: "Can I upgrade or switch plans later?", a: "Yes, anytime from Profile → Upgrade plan. You pay only the prorated difference for the rest of your year." },
  { category: "Plans & billing", q: "What happens if my plan ends?", a: "Your account moves to the Free plan automatically and your catalog becomes read-only: nothing is emptied or deleted, and you can still view and download everything and start a paid plan whenever you're ready. A plan ending never removes them. Need more time or a pause? Both are offered before your renewal. An account is only affected after two years without signing in: its stored files (including AI Protection proof videos) and catalog entries are deleted unless it has upgraded, its split sheets, contracts and certificates stay with the account, and the account itself is deleted only if it never signs in." },
  { category: "Plans & billing", q: "Is there a free trial?", a: "When a paying member invites you to sign a split sheet, you get a free 30-day Catalog & Collaborate trial, and a co-writer request for your PRO and IPI details comes with a free 30-day Catalog Plus trial. No card is needed, and it's one trial per person." },
  { category: "Plans & billing", q: "Who do I contact about billing?", a: "Email billing@camethroughaudio.com, or open a support ticket and choose Billing." },
  { category: "Plans & billing", q: "Can I pause my plan or get more time?", a: "Yes, both once every 12 months. Need more time moves your renewal back 30 days at no charge, with full access. Pause gives you 1 to 3 months for a Vault fee of $1.99 a month, paid up front: no plan charge while you're paused, your catalog stays read-only and is not emptied, and your plan renews by itself when the pause ends. Pausing is never cancelling: cancel the plan itself if you mean to stop." },
  { category: "Plans & billing", q: "Can I add the artists I work with?", a: `Yes. With any paid plan you can add artists as seats, each on its own yearly subscription: ${ARTIST_SEAT_PRICES.map((s) => `${s.price} ${TIER_LABEL[s.tier]}`).join(", ")} per artist per year. You name the artist and send the seat to their email; they sign up with that address and accept it, the same way an invited signature works. Their own catalog and tools open at the seat's tier, and you can switch between your account and each artist to work as them.` },
  { category: "Plans & billing", q: "Can the artist take over the plan I pay for?", a: "Yes, at any time. They enter a card in their Profile and nothing is charged then: their first charge is at the seat's renewal, and from that date they pay for the plan themselves. Your access to their catalog, split sheets and contracts ends at the handoff, and your seat stops renewing from that date. Time you already paid for isn't refunded or credited, and nothing else on your plan changes. They need no paid plan of their own when they take it over." },
  { category: "Plans & billing", q: "What happens if an artist seat ends?", a: "A seat you cancel keeps running until the paid year ends, so the artist keeps working at its tier until then. You can offer them the plan to take over; the offer changes nothing in billing until they accept it. If nobody takes it over, the seat ends and the artist's own account goes back to Free, which is read-only: their catalog stays where it is and they can start a paid plan whenever they're ready." },

  // Embedding
  { category: "Embedding", home: true, q: "What does it mean to \"embed\" metadata?", a: "Embedding means permanently injecting tracking blocks, legal credits, and identifiers (like your real legal name, ISRC, UPC, and lyrics) directly inside the structural code of your MP3 or audio file container. Instead of keeping credits separate in a text document, embedding locks the data directly into the audio file itself. Wherever that file travels, your data travels with it, protecting your ownership." },
  { category: "Embedding", home: true, q: "What if I don't have my ISRC or UPC yet?", a: `${PRE_DIST_NOTE} Pro Tip: ${PRO_TIP}` },
  { category: "Embedding", q: "Which file types can I embed?", a: "MP3 on every paid plan. WAV embedding is included with Catalog Management. FLAC isn't available yet." },
  { category: "Embedding", q: "Is my private information put in the file?", a: "No. PRO affiliations, IPI numbers, split percentages, publishers, the ℗ line and language stay in your catalog for registration. The file carries public release credits only." },
  { category: "Embedding", q: "Can I embed a whole EP or album at once?", a: "Yes. Drop all the tracks in: they wait in your session and the details you choose (artist, release, people, genre) carry over to the next song." },

  // My Catalog
  { category: "My Catalog", home: true, q: "Can I download my songs and artwork later?", a: "Yes! Every song you submit is saved in your private catalog vault. Download your embedded master MP3, cover art and lyrics anytime from My Catalog — no re-embedding needed. Nothing is emptied when a plan ends: the catalog stays read-only on Free, so your downloads are still there. Only an account left unused for two years without an upgrade loses its stored files and catalog entries; its paperwork stays with the account." },
  { category: "My Catalog", q: "Can I add songs I already released?", a: "Yes. Use Add song in My Catalog: upload an MP3 you already embedded (we read its tags) or type the details in without audio." },
  { category: "My Catalog", q: "Can I download my whole catalog?", a: "Yes: a ZIP with every master, its artwork and lyrics, plus a branded catalog PDF." },

  // Agency exports & registration
  { category: "Agency exports & registration", home: true, q: "What are 1-click agency exports?", a: "With Catalog & Collaborate, export your whole catalog, one release or chosen songs into The MLC's and SoundExchange's own bulk templates, plus a BMI/ASCAP cheat sheet. Upload one file instead of typing every song. Step-by-step upload instructions come with each file." },
  { category: "Agency exports & registration", q: "Which agencies do I need?", a: "Usually three: your PRO (ASCAP, BMI, SESAC or GMR in the US) for performance royalties, The MLC for US streaming mechanicals, and SoundExchange for digital radio royalties on the recording. Outside the US, your country's societies do the same jobs." },
  { category: "Agency exports & registration", q: "Why was a song held back from my export?", a: "It's missing something the agency requires, usually a writer's legal name or role. The export tells you exactly what, with a link straight to the field." },
  { category: "Agency exports & registration", q: "I don't have a publisher IPI. Can I use The MLC's bulk upload?", a: "Yes. The file uses the placeholder IPI 123456789 so The MLC accepts it; after the upload, remove it in The MLC Portal. The export tells you which songs used it." },
  { category: "Agency exports & registration", q: "Can you register my songs for me?", a: "Yes, with Expert Registration Assistance: our agents register your songs with your PRO, The MLC and SoundExchange. After you buy, you complete a short checklist and add Came Through Audio as your representative (your agent sends you the email to use)." },

  // Royalty Health Hub
  { category: "Royalty Health Hub", q: "What is a Royalty Health Check?", a: "A check of each song against what every agency needs to find and pay it, with a score, what's missing and how to fix it. Free and unlimited." },
  { category: "Royalty Health Hub", q: "How is my Royalty Health score worked out?", a: SCORE_STEPS.join(" ") },
  { category: "Royalty Health Hub", q: "What is the Royalty Inspector?", a: "Check a song that isn't in your catalog: enter its details and get the same health check and report." },
  { category: "Royalty Health Hub", q: "Are the royalty calculators exact?", a: "No. They're estimates to help you understand and register your splits. Agencies decide the final numbers." },

  // Split sheets & contracts
  { category: "Split sheets & contracts", q: "How do split sheets work?", a: "Generate a split sheet from a catalog song (Catalog Plus), sign as the owner, and with Catalog & Collaborate email collaborators a secure link to e-sign. Signing is free for them." },
  { category: "Split sheets & contracts", q: "Are e-signatures legally binding?", a: "Each signature is time-stamped and the document is locked with a fingerprint, the same kind of record e-signature services keep. Have a lawyer review important agreements." },
  { category: "Split sheets & contracts", q: "What are Blueprints?", a: "With Catalog Management: 75+ ready-to-fill contracts with plain-language guides, step-by-step business blueprints and home recording cheat sheets, each downloadable as a PDF." },

  // AI Protection Hub
  { category: "AI Protection Hub", home: true, q: "How does the AI Protection Hub document human origin?", a: "The hub issues a Certificate of Human Origin. Short screen recordings of your DAW session and draft history are fingerprinted (SHA-256), paired with a sworn human-authorship attestation, and timestamped on the Bitcoin blockchain. Together they're strong, independently verifiable evidence that your session and drafts existed by that date. For the strongest protection, also register important songs with the U.S. Copyright Office." },
  { category: "AI Protection Hub", q: "Is a certificate proof that I own my song?", a: "It's evidence, not a court ruling: it shows your files existed in that exact form by that date, and anyone can check the Bitcoin timestamp. Courts decide how much weight evidence gets. Keep your original files." },

  // Account & security
  { category: "Account & security", q: "Who can see my catalog?", a: "Your catalog is private to your account, with one exception: while you're on an artist seat another account pays for, that account can see your catalog, split sheets and contracts and can fill in your embed and catalog defaults, because it's paying for your plan. Only you can send a contract under your name. Private details like PRO, IPI numbers and splits stay in your catalog and never go into your audio files." },
  { category: "Account & security", q: "Will my account be deleted if I stop using it?", a: "After two years with no sign-in we email you four times, then remove what the account has not kept. Signing in during that notice keeps the account on Free; upgrading keeps the stored files and catalog too. Without an upgrade the files stored for the account (masters, artwork and anything else in storage) and the catalog entries are deleted on the date. Your split sheets, contracts, certificates, blueprints and Working On stay with the account on Free, and go only if the account itself is deleted. An account that never signs in is deleted with its files. A plan ending never does this: it just leaves the catalog read-only on Free." },
  { category: "Account & security", q: "How do I get help?", a: "Open a support ticket from the Contact page, or email support@camethroughaudio.com." },
];

export const HOME_FAQS = FAQS.filter((f) => f.home);
