import { hasTier, type Tier } from "@/lib/plans";

/**
 * Beta testing (PLAN-phase4-order item 3, approved 2026-10-25): 3 weeks from Mon Nov 9, Mon–Thu 12–2 PM Eastern.
 * Each tester works through the items for their plan and every plan below it, and marks each one Worked or Didn't work
 * with a note. The tier-by-tier test plan proves each plan sees only its own features (the "locked" items).
 */
export const BETA_WINDOW = "November 9 to November 26, 2026 · Monday to Thursday, 12 PM to 2 PM Eastern";
export const BETA_AGREEMENT = "company-beta-agreement";
export const BETA_RESULTS = ["worked", "broken"] as const;
export type BetaResult = (typeof BETA_RESULTS)[number];

export type BetaItem = { id: string; tier: Tier; area: string; title: string; how: string };

export const BETA_ITEMS: BetaItem[] = [
  // Free
  { id: "signup", tier: "free", area: "Getting started", title: "Sign up and set up your profile", how: "Create an account, pick a profile picture, fill in Embed Defaults and your Catalog Profile." },
  { id: "health-check", tier: "free", area: "Royalty Health", title: "Run a Royalty Health Check", how: "Royalty Health Hub → Run a Royalty Health Check on a song, open the report, download the PDF." },
  { id: "free-locks", tier: "free", area: "Plans", title: "Paid features show as locked", how: "On a Free account, try Embed, My Catalog and Contracts: each should show the upgrade box, not an error." },
  { id: "sign-invite", tier: "free", area: "Split sheets", title: "Sign a split sheet you're invited to", how: "Open the invite email, sign, check it shows as signed." },
  { id: "contract-generator", tier: "free", area: "Contracts", title: "Contract Generator ($3.99)", how: "Contracts → describe a deal → check the match → pay with test card 4242 → open it in My Contracts." },
  { id: "branding-addon", tier: "free", area: "Branding", title: "Personal Branding add-on ($14.99)", how: "Profile → Brand kit → buy with test card 4242 → upload a logo, pick colors and a font." },
  { id: "ai-protection", tier: "free", area: "AI Protection", title: "AI Protection certificate", how: "Buy a Single, record the two proof videos, issue the certificate, scan its QR code." },
  // Catalog Plus
  { id: "embed", tier: "plus", area: "Embed", title: "Embed and download a master", how: "Embed Metadata → add an MP3, fill the form, Embed & Download, then open the file's details on your computer." },
  { id: "save-catalog", tier: "plus", area: "Embed", title: "Save to My Catalog", how: "After embedding, Save to My Catalog and read the checklist of what happened." },
  { id: "catalog-edit", tier: "plus", area: "My Catalog", title: "Edit a song and fix a ⚠️ item", how: "Open a song with a ⚠️, click the link, fix the field, save." },
  { id: "prerelease", tier: "plus", area: "My Catalog", title: "Pre-release checklist", how: "Give a song a future release date, open it in the Royalty Health Hub, work through the Release checklist." },
  { id: "downloads", tier: "plus", area: "My Catalog", title: "Downloads", how: "Download a master, the artwork, a lyrics PDF and the catalog PDF." },
  { id: "split-generate", tier: "plus", area: "Split sheets", title: "Make and sign a split sheet", how: "Split Sheets → pick a song → sign as the owner → download the PDF." },
  { id: "plus-locks", tier: "plus", area: "Plans", title: "Collaborate and Management features stay locked", how: "Try agency exports and Contracts on Catalog Plus: they should show the upgrade box." },
  // Catalog & Collaborate
  { id: "split-collect", tier: "collaborate", area: "Split sheets", title: "Collect collaborator signatures", how: "Send a split sheet to a second email, sign there, check both signatures and the final PDF." },
  { id: "agency-export", tier: "collaborate", area: "Exports", title: "1-Click Agency Exports", how: "My Catalog → Export → The MLC, SoundExchange and PRO files. Open each one." },
  { id: "utility-suite", tier: "collaborate", area: "Royalty Utility Suite", title: "Converter and earnings calculator", how: "Royalty Health Hub → Royalty Utility Suite: pick a song in the converter, try the calculator." },
  { id: "collab-locks", tier: "collaborate", area: "Plans", title: "Management features stay locked", how: "Try WAV embedding and Contracts on Catalog & Collaborate: they should show the upgrade box." },
  // Catalog Management
  { id: "wav", tier: "management", area: "Embed", title: "WAV embedding", how: "Embed a WAV file and check it in My Catalog." },
  { id: "contracts", tier: "management", area: "Contracts", title: "Make, sign and send a contract", how: "Contracts → use a blueprint → sign at the bottom → send to a second email → sign there." },
  { id: "branding-included", tier: "management", area: "Branding", title: "Personal Branding included", how: "Set up the brand kit and download a contract and a split sheet PDF with your header." },
  { id: "blueprints", tier: "management", area: "Contracts", title: "Blueprints and guides", how: "Read a guide and download a blank PDF." },
];

/** The items a tester on this plan works through: their plan and every plan below it. */
export const betaItemsFor = (tier: Tier) => BETA_ITEMS.filter((i) => hasTier(tier, i.tier));
