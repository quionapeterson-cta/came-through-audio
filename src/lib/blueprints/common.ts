/**
 * Shared pieces for contract blueprints: the types, common fields, the shared clauses and the doc() builder that numbers
 * clauses and adds the General Terms. Bodies use {{field}} for blueprint fields and {{party:Role}} for a party's legal
 * name; renderContract in contract-blueprints.ts fills them.
 */

/**
 * `date` adds a calendar: "one" fills the field with the picked date, "many" adds each pick to a list.
 * Only `required` fields (shown with *) hold back signing. `value` pre-fills the box with a common default the user can
 * change; a blank optional field reads as `fallback` (or `value`), so it never leaves a gap in the text.
 */
export type BlueprintField = { key: string; label: string; placeholder?: string; tip: string; multiline?: boolean; date?: "one" | "many"; required?: boolean; value?: string; fallback?: string };

export const CATEGORIES = ["Music Production", "Management", "Rights & Distribution", "Visual Production", "Fashion & Beauty", "Influencers & Brands", "Podcasting", "Live Performance", "Business", "Events"] as const;
export type Category = (typeof CATEGORIES)[number] | "Company";

export type Blueprint = {
  id: string;
  name: string;
  category: Category;
  summary: string;
  whenToUse: string;
  keyTerms: string[];
  roles: [string, string];
  fields: BlueprintField[];
  body: string;
};

/** An optional field. */
export const field = (key: string, label: string, tip: string, o: Partial<BlueprintField> = {}): BlueprintField => ({ key, label, tip, ...o });
/** A required field: marked * and checked when signing. */
export const need = (key: string, label: string, tip: string, o: Partial<BlueprintField> = {}): BlueprintField => ({ key, label, tip, required: true, ...o });

/** Starts as today's date (see initialFields). */
export const DATE: BlueprintField = { key: "effectiveDate", label: "Effective date", placeholder: "January 1, 2027", tip: "The date the agreement starts. It starts as today; pick another date if you need to.", date: "one", fallback: "the date the last party signs" };
export const STATE: BlueprintField = { key: "governingLaw", label: "Governing law (state or country)", placeholder: "Georgia", tip: "Whose laws apply if there's ever a dispute. Usually where you live or do business. We remember your last choice.", fallback: "the state or country where the first party named above lives" };
export const SONG: BlueprintField = need("songTitle", "Song title", "The song this agreement covers. Pick a catalog song to fill it in.", { placeholder: "Song Title" });
export const FEE = (label = "Fee", placeholder = "$500", tip = "The amount paid, in your currency.") => need("fee", label, tip, { placeholder });
export const PAY_WHEN = (value = "50% on signing and 50% on delivery") => field("paySchedule", "When it's paid", "Payment timing. Half up front and half on delivery is common.", { value });
export const EVENT_DATE = (label = "Date", tip = "The day this happens.") => need("eventDate", label, tip, { placeholder: "June 12, 2027", date: "one" });

const GENERAL = `GENERAL TERMS
{{n}}.1 Entire agreement. This agreement is the complete understanding between the parties about its subject and replaces any earlier discussions. Changes must be in writing and signed by both parties.
{{n}}.2 Independent parties. Nothing here creates a partnership, joint venture or employment relationship, unless this agreement says so.
{{n}}.3 Governing law. This agreement is governed by the laws of {{governingLaw}}. Before going to court, the parties will try to settle any dispute by talking in good faith for 30 days.
{{n}}.4 Severability. If any part is found unenforceable, the rest stays in effect.
{{n}}.5 Electronic signatures. The parties agree that electronic signatures, including typed signatures recorded by Came Through Audio with a time stamp and verification hash, are binding and have the same effect as handwritten signatures.`;

export const general = (n: number) => GENERAL.replaceAll("{{n}}", String(n));

/** Clauses many deals share, written once so they read the same everywhere. */
export const CLAUSE = {
  confidential: ["CONFIDENTIALITY", "Both parties will keep unreleased music, private details and business information shared for this project confidential, unless it's already public or the other party agrees in writing."],
  noAI: ["NO AI TRAINING", "Neither party will use the other's recordings, voice, likeness, artwork or confidential material to train artificial intelligence or to make AI imitations without separate written consent."],
  contractor: ["INDEPENDENT CONTRACTOR", "{{B}} works as an independent contractor, not an employee, and is responsible for their own taxes, tools and insurance."],
  samples: ["NO UNCLEARED MATERIAL", "Each party confirms that what they provide is their own original work or properly licensed, and contains no uncleared samples, loops, footage, fonts or images unless disclosed in writing before delivery."],
  endEarly: ["ENDING EARLY", "Either party may end this agreement if the other breaks it and doesn't fix the problem within 14 days of written notice. Work already done and paid for stays with the party who paid for it."],
  cancel48: ["CANCELLATION", "If {{A}} cancels less than 48 hours before the booked time, 50% of the fee is still owed. If {{B}} cancels, any deposit is refunded in full. Neither party is responsible for cancellations caused by illness, severe weather or other events outside their control."],
  disclosure: ["AD DISCLOSURE", "Every sponsored post will be clearly labeled as an ad (for example #ad or the platform's paid-partnership label), as advertising law requires."],
} satisfies Record<string, [string, string]>;
type Clause = [string, string];

/**
 * Builds a contract body: a title, an opening line naming the two parties, numbered clauses and the General Terms.
 * In shared clause text, {{A}} and {{B}} stand for the first and second roles (their defined names, not legal names).
 */
export function doc(title: string, roles: [string, string], clauses: Clause[], opening = `This ${title} is made on {{effectiveDate}} between {{party:${roles[0]}}} ("${roles[0]}") and {{party:${roles[1]}}} ("${roles[1]}").`) {
  const body = clauses.map(([h, t], i) => `${i + 1}. ${h}\n${t}`).join("\n\n");
  return `${title.toUpperCase()}\n\n${opening}\n\n${body}\n\n${general(clauses.length + 1)}`
    .replaceAll("{{A}}", roles[0]).replaceAll("{{B}}", roles[1]);
}
