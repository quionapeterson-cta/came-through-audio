import { CLAUSE, DATE, doc, field, need, type Blueprint, type BlueprintField } from "./common";

/**
 * Company outreach kit (PLAN-phase4-order item 5, approved 2026-10-25): Came Through Audio, LLC's agreements with
 * labels, music-tech and music-creation companies. Sent from Admin → Company Contracts and signed with the company
 * block (3.9); contract-blueprints.ts makes the LLC the party and fixes Georgia law. Lawyer review before first use.
 */
const R: [string, string] = ["Company", "Partner"];
const PARTNER_CO = need("partnerCompany", "Partner's company name", "The partner's legal business name, as it should read in the agreement.", { placeholder: "Example Records, LLC" });
const TERM = (value = "12 months") => field("term", "How long it lasts", "How long the agreement runs before it ends or renews.", { value });
const PURPOSE = (value: string) => need("purpose", "What it's for", "The project or conversation this covers, in a sentence.", { value, multiline: true });

const PARTNER_LINE = `{{party:Partner}}, on behalf of {{partnerCompany}} ("Partner")`;
const opening = (title: string) => `This ${title} is made on {{effectiveDate}} between {{party:Company}} ("Company") and ${PARTNER_LINE}.`;
const make = (title: string, clauses: [string, string][]) => doc(title, R, clauses, opening(title));

type Raw = Omit<Blueprint, "category" | "roles" | "body"> & { title: string; clauses: [string, string][] };

const RAW: Raw[] = [
  {
    id: "company-mutual-nda", name: "Mutual NDA", title: "Mutual Nondisclosure Agreement",
    summary: "Both sides keep each other's private business information confidential while they explore working together.",
    whenToUse: "Before a first real conversation with a label, music-tech or music-creation company about a partnership.",
    keyTerms: ["Both sides protect what the other shares.", "Only used to evaluate the partnership.", "Lasts for the term, and confidentiality continues after."],
    fields: [PARTNER_CO, PURPOSE("Exploring a possible partnership between the parties."), TERM("2 years")],
    clauses: [
      ["PURPOSE", "The parties want to share information for this purpose: {{purpose}}"],
      ["CONFIDENTIAL INFORMATION", "Confidential information is anything either party shares that is marked confidential or that a reasonable person would understand to be private, such as unreleased features, customer data, pricing, plans and code. It doesn't include information that is already public, already known to the receiving party, independently developed, or received lawfully from someone else."],
      ["USE AND CARE", "Each party will use the other's confidential information only for the purpose above, share it only with people who need it and are bound to keep it confidential, and protect it at least as carefully as its own."],
      ["TERM", "This agreement lasts {{term}}. Confidentiality continues for 3 years after it ends, and for trade secrets as long as they stay secret."],
      ["RETURN", "When asked, each party will return or delete the other's confidential information."],
      ["NO OBLIGATION", "Nothing here requires either party to enter into any further agreement or gives any license to the other's intellectual property."],
    ],
  },
  {
    id: "company-referral", name: "Partnership and Referral Agreement", title: "Partnership and Referral Agreement",
    summary: "The partner refers artists to Came Through Audio and earns a share of the first-year plan revenue from each one.",
    whenToUse: "For labels, studios, schools or music-tech companies that send their artists to Came Through Audio.",
    keyTerms: ["Referral fee: a share of first-year plan payments.", "Paid monthly once the customer's refund window ends.", "Either side can end it with 30 days' notice."],
    fields: [PARTNER_CO, field("referralShare", "Referral share", "The partner's share of each referred customer's first-year plan payments.", { value: "20%" }), field("referralCode", "Referral link or code", "How referred customers are tracked.", { placeholder: "LABELNAME20" }), TERM()],
    clauses: [
      ["REFERRALS", "Partner may refer artists and music businesses to Came Through Audio using the link or code {{referralCode}}. A referral counts when the customer signs up through it."],
      ["REFERRAL FEE", "Company will pay Partner {{referralShare}} of the plan payments each referred customer makes in their first year, after refunds. Fees are paid monthly for payments whose 30-day refund window has ended."],
      ["HOW PARTNER PROMOTES", "Partner will describe Came Through Audio accurately, follow Company's brand guidelines, never promise results or royalties, and label any paid or sponsored posts as advertising."],
      ["NO AUTHORITY", "Partner can't make promises, sign anything or collect payments for Company."],
      ["TERM AND ENDING", "This agreement lasts {{term}} and renews for the same period unless either party ends it with 30 days' written notice. Fees earned before the end are still paid."],
      CLAUSE.confidential,
    ],
  },
  {
    id: "company-co-marketing", name: "Co-Marketing Agreement", title: "Co-Marketing Agreement",
    summary: "Came Through Audio and the partner promote each other in a joint campaign, each using the other's name and logo only as agreed.",
    whenToUse: "For a joint campaign, giveaway, webinar or content series with a partner.",
    keyTerms: ["What each side does in the campaign.", "Each side approves how its name and logo are used.", "Each side pays its own costs unless agreed otherwise."],
    fields: [PARTNER_CO, need("campaign", "The campaign", "What the joint campaign is and when it runs.", { multiline: true, placeholder: "A 4-week \"First stop before distribution\" series on both Instagram accounts, starting March 1." }),
      field("companyDuties", "What Came Through Audio does", "Company's part of the campaign.", { multiline: true }), field("partnerDuties", "What the partner does", "The partner's part.", { multiline: true }), TERM("the length of the campaign")],
    clauses: [
      ["CAMPAIGN", "The parties will run this campaign together: {{campaign}}"],
      ["WHAT EACH PARTY DOES", "Company will: {{companyDuties}}\nPartner will: {{partnerDuties}}"],
      ["NAMES AND LOGOS", "Each party lets the other use its name and logo only for this campaign, as shown in its brand guidelines, and approves each use in writing before it goes out. Each party keeps all rights to its own name, logo and content."],
      ["COSTS", "Each party pays its own costs unless the parties agree otherwise in writing."],
      CLAUSE.disclosure,
      ["TERM", "This agreement lasts for {{term}}. Either party may end it early with 14 days' written notice; approved content already published can stay up."],
    ],
  },
  {
    id: "company-data-sharing", name: "Data-Sharing Addendum", title: "Data-Sharing Addendum",
    summary: "Sets how Came Through Audio and the partner share and protect any customer or catalog data under their main agreement.",
    whenToUse: "Add it to a partnership, pilot or integration agreement whenever personal or catalog data moves between the companies.",
    keyTerms: ["Only the data needed, only for the stated purpose.", "Security, breach notice within 72 hours, deletion when done.", "No selling the data or training AI on it."],
    fields: [PARTNER_CO, need("mainAgreement", "The main agreement", "The agreement this addendum belongs to.", { placeholder: "Pilot Agreement dated March 1, 2027" }),
      need("dataShared", "What data is shared", "The kinds of data, as narrowly as possible.", { multiline: true, placeholder: "Song titles, ISRCs and writer names for customers who opted in." }), PURPOSE("Running the services in the main agreement.")],
    clauses: [
      ["SCOPE", "This addendum is part of the {{mainAgreement}}. It covers this data: {{dataShared}}"],
      ["PURPOSE", "Each party will use shared data only for: {{purpose}}, and only as the customer's permissions and the law allow."],
      ["SECURITY", "Each party will protect shared data with reasonable security, limit access to people who need it, and tell the other party within 72 hours of learning of any breach."],
      ["NO SELLING OR AI TRAINING", "Neither party will sell shared data, share it with anyone else except service providers bound by the same terms, or use it to train artificial intelligence."],
      ["DELETION", "When the main agreement ends, or when asked, each party will delete or return the other's shared data, unless the law requires keeping it."],
      ["PRIVACY LAWS", "Each party will follow the privacy laws that apply to it and help the other answer customer privacy requests about shared data."],
    ],
  },
  {
    id: "company-sponsored-badge", name: "Sponsored Badge Licence", title: "Sponsored Badge License",
    summary: "A brand sponsors a Came Through Audio badge (its name or art on an award artists can earn) for a set time and fee.",
    whenToUse: "When a company pays to sponsor a badge or a badge collection.",
    keyTerms: ["Which badge, for how long, for what fee.", "Company keeps control of how badges are awarded.", "Sponsor approves the art; Company owns the badge."],
    fields: [PARTNER_CO, need("badge", "The sponsored badge", "The badge or collection and how the sponsor appears on it.", { placeholder: "\"Studio Ready\" badge, \"presented by Example Audio\" under the art" }),
      need("fee", "Sponsorship fee", "The amount and when it's paid.", { placeholder: "$2,500, paid before launch" }), TERM("6 months")],
    clauses: [
      ["SPONSORSHIP", "Partner sponsors this badge: {{badge}}, for {{term}}."],
      ["FEE", "Partner will pay {{fee}}. The fee isn't refundable once the badge goes live, unless Company removes it early for a reason other than Partner's breach."],
      ["HOW BADGES WORK", "Company alone decides how and when badges are awarded. Sponsorship doesn't change who earns a badge, and badges have no cash value."],
      ["ART AND NAMES", "Partner lets Company show its name and logo on the badge and in related announcements, and approves the final art before it goes live. Company owns the badge and its art."],
      ["ENDING EARLY", "Company may remove the sponsorship if Partner's brand would harm Company's reputation, and refunds the unused part of the fee in that case."],
    ],
  },
  {
    id: "company-pilot", name: "Pilot Agreement", title: "Pilot Agreement",
    summary: "The partner tries Came Through Audio with a group of its artists for a limited time, with goals agreed up front.",
    whenToUse: "Before a label, distributor or school rolls Came Through Audio out to its roster for a trial period.",
    keyTerms: ["How many artists, which plan, for how long.", "Success goals agreed in advance.", "No obligation to continue after the pilot."],
    fields: [PARTNER_CO, need("pilotScope", "The pilot", "Number of artists, the plan and the features used.", { multiline: true, placeholder: "Up to 25 artists on Catalog & Collaborate." }),
      field("pilotFee", "Pilot fee", "What the partner pays for the pilot, if anything.", { value: "No fee" }), field("goals", "Success goals", "How both sides will judge the pilot.", { multiline: true }), TERM("90 days")],
    clauses: [
      ["PILOT", "Company will give Partner this pilot: {{pilotScope}}, for {{term}}."],
      ["FEE", "Pilot fee: {{pilotFee}}."],
      ["GOALS", "The parties will review the pilot against these goals: {{goals}}"],
      ["ARTISTS' ACCOUNTS", "Each artist has their own account and accepts Company's Terms of Service and Privacy Policy. Artists own their music and data, and keep their accounts after the pilot under Company's normal plans."],
      ["NO WARRANTY", "The pilot is provided as is. Company doesn't guarantee any registration, payment or royalty result."],
      ["AFTER THE PILOT", "Neither party has to continue after the pilot. Any longer agreement must be in writing."],
      CLAUSE.confidential,
    ],
  },
  {
    id: "company-api-integration", name: "API and Integration Agreement", title: "API and Integration Agreement",
    summary: "The partner connects its product to Came Through Audio (or the other way round), with access, security and support rules.",
    whenToUse: "For a technical integration: a distributor, DAW, publishing admin or label system exchanging data with Came Through Audio.",
    keyTerms: ["What the integration does and who builds what.", "Access keys stay secret; usage limits apply.", "Each side can turn the integration off for security reasons."],
    fields: [PARTNER_CO, need("integration", "The integration", "What connects, what data moves and who builds which part.", { multiline: true }),
      field("limits", "Usage limits", "Requests or data limits.", { value: "Reasonable use, as set out in the technical documentation" }), TERM()],
    clauses: [
      ["INTEGRATION", "The parties will build and run this integration: {{integration}}"],
      ["ACCESS", "Each party gives the other the access keys needed for the integration. Keys stay secret, are used only for the integration and can be changed at any time. Usage limits: {{limits}}."],
      ["SECURITY", "Each party will keep the integration secure, fix serious security problems quickly, and may pause the integration at once to protect customers or systems, telling the other party as soon as it can."],
      ["CUSTOMER PERMISSION", "Customer data moves only when the customer has turned the integration on and agreed to it. The Data-Sharing Addendum applies to that data."],
      ["OWNERSHIP", "Each party keeps ownership of its own software, systems and data. Neither may copy or reverse engineer the other's software."],
      ["NO WARRANTY", "Each party provides its side as is and isn't responsible for the other's systems or for outages outside its control."],
      ["TERM", "This agreement lasts {{term}} and renews for the same period unless either party ends it with 60 days' written notice."],
      CLAUSE.confidential,
    ],
  },
  {
    id: "company-loi", name: "Letter of Intent", title: "Letter of Intent",
    summary: "Writes down the main points of a deal both sides intend to make, before the full agreement. Mostly not binding.",
    whenToUse: "When a partner wants something in writing before the lawyers draft the full agreement.",
    keyTerms: ["The main points of the planned deal.", "Not binding, except confidentiality and the exclusivity period if any.", "A target date for the final agreement."],
    fields: [PARTNER_CO, need("dealTerms", "Main points of the deal", "What each side intends to do, in plain language.", { multiline: true }),
      field("targetDate", "Target date for the final agreement", "When both sides aim to sign the full agreement.", { date: "one", placeholder: "June 1, 2027" })],
    clauses: [
      ["INTENT", "The parties intend to enter into an agreement on these main points: {{dealTerms}}"],
      ["FINAL AGREEMENT", "The parties will try in good faith to sign a full agreement by {{targetDate}}."],
      ["NOT BINDING", "This letter is a statement of intent only. Except for the Confidentiality section and the General Terms, it doesn't create any legal obligation, and either party may stop negotiating at any time."],
      CLAUSE.confidential,
    ],
  },
];

/** The outreach templates with the company signer field first, ready for contract-blueprints.ts to make company agreements. */
export function outreachBlueprints(signer: BlueprintField, asCompany: (body: string) => string): Blueprint[] {
  return RAW.map(({ title, clauses, fields, ...b }) => ({
    ...b, category: "Company", roles: R,
    fields: [signer, DATE, ...fields],
    body: asCompany(make(title, clauses)),
  }));
}
