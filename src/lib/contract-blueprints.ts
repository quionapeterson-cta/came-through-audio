/**
 * Music industry contract blueprints. Each one is a fill-in template plus a plain-language guide. The customer library
 * lives in src/lib/blueprints/<category>.ts; Came Through Audio, LLC's own templates are below.
 * Bodies use {{field}} for blueprint fields and {{party:Role}} for a party's legal name; renderContract fills them.
 * These are general templates, not legal advice, and the Contracts & Blueprints section says so (CONTRACT_DISCLAIMER).
 */
import { BUSINESS } from "./blueprints/business";
import { DATE, general, type Blueprint, type BlueprintField } from "./blueprints/common";
import { EVENTS } from "./blueprints/events";
import { FASHION } from "./blueprints/fashion";
import { INFLUENCERS } from "./blueprints/influencers";
import { LIVE } from "./blueprints/live";
import { MANAGEMENT } from "./blueprints/management";
import { MUSIC_PRODUCTION } from "./blueprints/music-production";
import { PODCASTING } from "./blueprints/podcasting";
import { RIGHTS } from "./blueprints/rights";
import { RELEASE_TERMS, VISUAL } from "./blueprints/visual";

export { CATEGORIES, type Blueprint, type BlueprintField, type Category } from "./blueprints/common";

export const CONTRACT_DISCLAIMER =
  "Blueprints are general templates to help you organize a deal. They are not legal advice. Have a qualified music attorney review any contract before you sign it.";

/** The customer blueprint library, in category order. */
export const BLUEPRINTS: Blueprint[] = [...MUSIC_PRODUCTION, ...MANAGEMENT, ...RIGHTS, ...VISUAL, ...FASHION, ...INFLUENCERS, ...PODCASTING, ...LIVE, ...BUSINESS, ...EVENTS];

export const COMPANY_LEGAL_NAME = "Came Through Audio, LLC";

/** Company agreements name the LLC as the party; the founder signs as its authorized representative. */
const SIGNER: BlueprintField = { key: "signerTitle", label: "Your title", value: "Founder & CEO", tip: "Your title at Came Through Audio, LLC. You sign with your own legal name on the company's behalf. We remember your last one." };

/** Every company agreement is governed by Georgia law, so it has no governing-law field. Also applied to saved wording. */
export const georgiaLaw = (body: string) => body.replaceAll("{{governingLaw}}", "the State of Georgia");
const asCompany = (body: string) => georgiaLaw(body.replace(`{{party:Company}} ("Company")`, `${COMPANY_LEGAL_NAME} ("Company"), signed by its authorized representative {{party:Company}}, {{signerTitle}},`));
const RELEASE = BLUEPRINTS.find((b) => b.id === "photo-video-release")!;

const LAUNCH_GIFT = (n: number) => `${n}. LAUNCH GIFT
At launch, Company will give Participant a free 3-month Catalog Plus account, starting on the day Company announces launch.

`;

const PRELAUNCH = (n: number) => `${n}. PRE-LAUNCH CONFIDENTIALITY
Until Company publicly announces the launch of its service (or gives written permission first), Participant will not post, share, screenshot, record or describe the Came Through Audio app or its features. Company will hold the Materials and will not publish them before launch.

`;

/**
 * Came Through Audio, LLC's own agreements, sent from Admin → Company Contracts (super admins only). Never shown in
 * the customer blueprint list. Super admins can change a template's wording there (stored in site_settings).
 */
export const COMPANY_BLUEPRINTS: Blueprint[] = [
  {
    ...RELEASE,
    id: "company-testimonial-release",
    category: "Company",
    summary: "A homepage or marketing testimonial giver lets Came Through Audio use their photo, video, name and words, and keeps the app private until launch.",
    whenToUse: "Send it to everyone whose testimonial, photo or video appears on the site or in marketing, including people already on the homepage.",
    fields: [SIGNER, ...RELEASE.fields.filter((f) => f.key !== "governingLaw").map((f) => f.key === "consideration" ? { ...f, value: "the launch gift in section 11" } : f.key === "uses" ? { ...f, value: "Came Through Audio's website, social media, ads, email, presentations and press" } : f)],
    body: asCompany(`${RELEASE_TERMS}${LAUNCH_GIFT(11)}${PRELAUNCH(12)}${general(13)}`),
  },
  {
    id: "company-blank",
    name: "Blank company agreement",
    category: "Company",
    summary: "Your own wording, signed through the same secure flow.",
    whenToUse: "Any company agreement that doesn't have a template yet.",
    keyTerms: ["Write the terms in your own words, then sign at the bottom and send."],
    roles: ["Company", "Participant"],
    fields: [SIGNER, DATE, { key: "terms", label: "Terms", placeholder: "What each side agrees to", tip: "The agreement in plain language.", multiline: true, required: true }],
    body: asCompany(`AGREEMENT

This agreement is made on {{effectiveDate}} between {{party:Company}} ("Company") and {{party:Participant}} ("Participant").

1. TERMS
{{terms}}

${general(2)}`),
  },
];

export type AuthorizationSchedule = { songs: { title: string; isrc: string }[]; agencies: string[]; purchasedOn: string; amount: string };

/**
 * The Registration Authorization a customer signs at intake step 4 (PLAN-registration-intake §6). Came Through Audio,
 * LLC is the party; Schedule A is filled from the order. Built on the server when signing, so the text and its hash
 * can't be changed by the browser. Have a lawyer review before launch.
 */
export function registrationAuthorization(o: { effectiveDate: string; client: string; prelaunch: boolean } & AuthorizationSchedule): string {
  const agencies = o.agencies.join(", ");
  const n = o.prelaunch ? 10 : 9;
  return `REGISTRATION AUTHORIZATION

This agreement is made on ${o.effectiveDate} between ${COMPANY_LEGAL_NAME} ("Came Through Audio") and ${o.client} ("Client").

1. WHAT CLIENT AUTHORIZES
Client authorizes Came Through Audio to register the songs and recordings listed in Schedule A with the organizations listed there (${agencies}), acting as Client's authorized user or representative in Client's own accounts. This includes entering, checking and submitting registration details, and reading Client's registration status.

2. WHAT CAME THROUGH AUDIO WILL NOT DO
Came Through Audio will not: (a) take or claim any ownership, copyright, writer share or publisher share in Client's music; (b) collect, receive or hold royalties for Client; (c) change Client's payment, bank or tax details, contact email, password or membership; (d) sign up for new memberships or agreements on Client's behalf; or (e) register anything not listed in Schedule A.

3. CLIENT'S INFORMATION
Client confirms that the details submitted for each song (titles, writers, roles, shares, publishers, IPI numbers, recordings and ownership) are true and complete, that every co-writer and co-owner has agreed to the shares submitted, and that Client has the right to register them. Came Through Audio registers exactly what Client submitted and is not responsible for errors in it. If an organization reports a conflict or asks for proof, Came Through Audio will tell Client, and Client will provide what's needed.

4. ACCOUNT ACCESS
Client will add Came Through Audio as an authorized user or representative in each account, as the organization allows, and will not share passwords. Client may remove that access at any time. Came Through Audio will stop using an account once its work for that account is done, and asks Client to remove its access then.

5. NO GUARANTEE OF RESULTS
Each organization decides on its own whether and when to accept a registration and pay royalties. Came Through Audio does not guarantee acceptance, timing or any amount of royalties.

6. FEES AND REFUNDS
Fees are listed in Schedule A. Refunds follow Came Through Audio's Refund Policy: a full refund within 30 days of purchase, as long as work on Client's registrations hasn't started. Work starts once Client has submitted every song in Schedule A and signed this agreement.

7. PRIVACY
Came Through Audio uses Client's information only to complete these registrations, as described in its Privacy Policy, and keeps PRO, IPI and share details private.

8. ENDING THIS AUTHORIZATION
This authorization ends when every registration in Schedule A is complete, or earlier if either side ends it in writing. Registrations already submitted stay in place.

${o.prelaunch ? `9. PRE-LAUNCH CONFIDENTIALITY
Until Came Through Audio publicly announces the launch of its service (or gives written permission first), Client will not post, share, screenshot, record or describe the Came Through Audio app or its features.

` : ""}${general(n).replace("{{governingLaw}}", "the State of Georgia")}

SCHEDULE A
Organizations: ${agencies}
Purchased: ${o.purchasedOn} · Amount paid: ${o.amount}
${o.songs.map((s, i) => `${i + 1}. ${s.title}${s.isrc ? ` (ISRC ${s.isrc})` : ""}`).join("\n")}`;
}

export const blueprintById = (id: string) => BLUEPRINTS.find((b) => b.id === id) ?? COMPANY_BLUEPRINTS.find((b) => b.id === id);

/** A new contract's starting details: each field's pre-filled default, and today as the effective date. */
export function initialFields(bp: Blueprint, today = new Date()): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of bp.fields) {
    if (f.value) out[f.key] = f.value;
    if (f.key === "effectiveDate") out[f.key] = today.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  }
  return out;
}

/** The required details still blank, in form order. Only these (plus party names and emails) hold back signing. */
export const missingFields = (bp: Blueprint, fields: Record<string, string>) => bp.fields.filter((f) => f.required && !fields[f.key]?.trim());

/**
 * Fills {{field}} and {{party:Role}} tokens. A blank required field or party stays visible as a [Label] blank to fill
 * in; a blank optional field reads as its fallback wording, so optional details never leave a gap.
 */
/**
 * Customized wording is free text, so it doesn't re-render as details change. This fills any [Label] or
 * [Role legal name] gaps still in it from the details and parties, so filling a field always clears its gap.
 */
export function fillBlanks(bp: Blueprint, text: string, fields: Record<string, string>, parties: { role: string; legalName: string }[]) {
  let out = text;
  for (const f of bp.fields) if (fields[f.key]?.trim()) out = out.replaceAll(`[${f.label}]`, fields[f.key]!.trim());
  for (const p of parties) if (p.legalName.trim()) out = out.replaceAll(`[${p.role} legal name]`, p.legalName.trim());
  return out;
}

export function renderContract(bp: Blueprint, fields: Record<string, string>, parties: { role: string; legalName: string }[]) {
  return bp.body
    .replace(/\{\{party:([^}]+)\}\}/g, (_, role: string) => parties.find((p) => p.role === role)?.legalName.trim() || `[${role} legal name]`)
    .replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
      const f = bp.fields.find((x) => x.key === key);
      return fields[key]?.trim() || (f && !f.required ? f.fallback ?? f.value ?? "" : `[${f?.label ?? key}]`);
    });
}
