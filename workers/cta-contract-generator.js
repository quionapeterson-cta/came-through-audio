/**
 * Came Through Audio Contract Generator — a standalone Cloudflare Worker.
 *
 * Its own name (`cta-contract-generator`), its own config (`workers/wrangler-contract.toml`) and its own `AI` binding.
 * It shares no binding, route or code with the Help Desk, the tax tables or the email workers, so deploying it changes
 * nothing that is already working.
 *
 * Deploy (from the repo root):
 *   npx wrangler deploy -c workers/wrangler-contract.toml
 * then put the printed URL in the app as VITE_CTA_CONTRACT_WORKER_URL (Sites/Cloudflare → Settings → Variables).
 * Without the variable the app falls back to the deployed URL in src/lib/contract-generator-api.ts.
 *
 * What protects it, in the order it happens:
 *   1. Origin lock   — only camethroughaudio.com (and our preview hosts / a loopback dev server) may call it.
 *   2. Method + size — POST only, one scenario of 20–4000 characters.
 *   3. Rate limit    — 25 contracts a day per visitor IP, counted in the Cache API; paid members are not counted.
 *   4. Workers AI    — @cf/meta/llama-3.3-70b-instruct-fp8-fast with the drafting rules in SYSTEM_PROMPT.
 *
 * The answer is the contract itself and nothing else: no introduction, no disclaimer, no closing note. Anything the
 * model adds around the document is stripped before the response leaves this Worker (cleanContract).
 *
 * Plain JS on purpose: it is the exact file Cloudflare runs, with nothing to transpile.
 */

/**
 * The model the contract is drafted with. The app's own Contract Generator already uses this Llama 3.3 70B build
 * (@cf/meta/llama-3.3-70b-instruct-fp8-fast), and it follows the 18-section checklist far more reliably than the 8B:
 * the 8B skipped section 1 and garbled the writer's-share clause in testing. Cloudflare retired
 * @cf/meta/llama-3.1-8b-instruct-fp8 on 2026-11-20. Change the model here only.
 */
export const CONTRACT_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

/** A scenario is a paragraph about one deal, not an essay. */
export const MIN_SCENARIO_CHARS = 20;
export const MAX_SCENARIO_CHARS = 4000;

/**
 * Contracts a visitor IP may generate in one UTC day, free of charge (founder, 2026-11-27: 25, because the generator is
 * mostly used by Catalog Management members and a real artist drafts a handful a month, never twenty-five a day).
 * A paid member is not counted at all: the page says so and the Worker skips the count for that request.
 */
export const RATE_LIMIT_PER_DAY = 25;

/**
 * The sites allowed to call the Worker: the live domain and its subdomains, the preview hosts our builds run on, and a
 * loopback dev server. Anything else is refused before Workers AI is invoked.
 */
const EXACT_ORIGINS = [
  "https://camethroughaudio.com",
  "https://www.camethroughaudio.com",
  "https://came-through-audio.vercel.app",
];
const PREVIEW_SUFFIXES = [".style.dev", ".lovable.app", ".camethroughaudio.com"];
/** Vercel's own hostnames for this project only; a stranger's `something.vercel.app` still falls through. */
const VERCEL_PROJECT_HOST = /^came-through-audio(-[a-z0-9-]+)?-camethroughfam\.vercel\.app$/;

/** @param {string | null | undefined} value */
function originOf(value) {
  const raw = (value ?? "").trim();
  if (!raw) return null;
  try {
    return new URL(raw).origin;
  } catch {
    return null;
  }
}

/**
 * True only for the origins above; a lookalike such as `camethroughaudio.com.evil.com` never matches.
 * @param {string | null | undefined} origin
 * @param {string | null | undefined} [referer]
 */
export function allowedOrigin(origin, referer) {
  const candidate = originOf(origin) ?? originOf(referer);
  if (!candidate) return false;
  let url;
  try {
    url = new URL(candidate);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return false;
  const host = url.hostname.toLowerCase();
  const loopback =
    host === "localhost" || host === "127.0.0.1" || host === "[::1]" || host === "::1";
  if (loopback) return url.protocol === "http:" || url.protocol === "https:";
  if (EXACT_ORIGINS.includes(candidate)) return true;
  if (VERCEL_PROJECT_HOST.test(host)) return true;
  return PREVIEW_SUFFIXES.some((suffix) => host.endsWith(suffix) && host.length > suffix.length);
}

/** The UTC day the count belongs to, so the allowance comes back at midnight UTC. @param {number} now */
export function rateLimitWindow(now) {
  return new Date(now).toISOString().slice(0, 10);
}

/**
 * @param {string} ip
 * @param {number} now
 */
export function rateLimitKey(ip, now) {
  const who = encodeURIComponent((ip || "unknown").trim().toLowerCase());
  return `https://cta-contract-generator.internal/rate/${who}/${rateLimitWindow(now)}`;
}

/** Seconds until midnight UTC, when a fresh day's contracts open. @param {number} now */
export function secondsUntilNextWindow(now) {
  const d = new Date(now);
  const end = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1);
  return Math.max(Math.ceil((end - now) / 1000), 1);
}

/** The scenario as it will be sent: trimmed, whitespace collapsed, or null when empty / outside the limits. */
export function normaliseScenario(raw) {
  if (typeof raw !== "string") return null;
  const text = raw
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (text.length < MIN_SCENARIO_CHARS || text.length > MAX_SCENARIO_CHARS) return null;
  return text;
}

/**
 * The drafting rules. The contract is written for an independent artist, on fair terms, and comes back as the document
 * alone: no greeting, no explanation, no legal-advice warning, no sign-off.
 */
export const SYSTEM_PROMPT = `You are a music-business contract drafting engine for independent artists and songwriters. You draft complete, formal, ready-to-sign contracts from a plain-English description of a deal.

OUTPUT RULES
- Return ONLY the contract document. No greeting, no introduction, no explanation before it, no summary after it.
- Never write an AI disclaimer, a "not legal advice" notice, a "consult an attorney" line, or any note about how the document was produced.
- Plain text only: no markdown, no asterisks, no # symbols, no code fences.
- The title must name the deal specifically, for example "EXCLUSIVE BEAT PURCHASE AND PRODUCER AGREEMENT" or "PRODUCER AGREEMENT FOR THREE MASTERS". Never a generic "AGREEMENT" or "PRODUCTION AGREEMENT" on its own.
- Then "This Agreement is made on [Effective Date] between ...".
- End with the signature blocks for every party (name, signature line, title if any, date). Nothing follows them.
- Do not invent names, amounts, percentages, dates, cities or states. Use a bracketed placeholder such as [ARTIST LEGAL NAME], [AMOUNT], [PERCENTAGE], [STATE] and keep drafting.
- One placeholder per party, written exactly the same way in the introduction, in every clause and in the signature block, and chosen for the role that party really has here: in a beat sale the seller is [PRODUCER LEGAL NAME] and the buyer is [ARTIST LEGAL NAME]. Never sign [SELLER LEGAL NAME] for the person introduced as [ARTIST LEGAL NAME].
- Use only the parties this deal defines: never call someone "Producer" in a deal that has no producer, or "Company" in a deal between two individuals.
- State a party's state only when the deal gives it; otherwise use [STATE]. Keep every state the deal does give, for that party only, and never copy one party's state onto the other.
- Every payment clause says when the money is due: [DATE], or "on delivery" once when that is what the deal says. Never both.
- Percentages and amounts are plain numbers that add up. Never write a placeholder percentage and then define it by arithmetic, and never describe two commissions that both fall on the same dollar.
- Every notices clause states [ARTIST ADDRESS] and [PRODUCER ADDRESS]. Never refer to details "set out below" without giving them.
- 1,000–2,000 words. Never omit or shorten a required section to stay brief.
- Never write "except as otherwise provided in this Agreement", "except as may be agreed in a separate agreement" or any similar deferral: state the rule itself. That includes "except as may be necessary to fulfil its obligations", "except as required to perform this Agreement" and "except as otherwise permitted". Never use a [PERCENTAGE] or [NUMBER] placeholder for a split, amount, period or cap the description already gives.

REQUIRED SECTIONS — number them 1 to 18, in this order, with no gaps:
1 Parties and Effective Date (always present, even though the introduction names them)
2 Recitals
3 Definitions
4 Scope of Work and Deliverables
5 Payment
6 Ownership of the Master
7 Publishing and the Writer's Share
8 Royalties, Recoupment and Statements
9 Credits
10 Term, Sunset and Reversion
11 Representations and Warranties
12 Termination
13 Limitation of Liability
14 Independent Contractor
15 Notices
16 Governing Law and Dispute Resolution
17 Entire Agreement, Amendment and Severability
18 Signatures

FAIRNESS RULES — the contract protects the artist and is never predatory:
- Section 7 must say, in substance: the Artist keeps one hundred percent (100%) of the writer's share; the Producer receives only the percentage of the publisher's share stated in the deal, for the named composition only; the Producer does not own the composition and has no claim to any other song.
- The artist owns the Master unless the description says it is sold outright, and then only the named recordings.
- NO CONTRADICTIONS. Section 10 sets the term of exclusivity and any option. It must NOT cancel, shorten or take back anything granted in Sections 6, 7 or 8: state there that the Artist's ownership of the Masters continues, and that the Producer's stated publisher's share and master royalty are unaffected by the sunset and continue for the life of the copyright in the named recordings. The sunset ends only exclusivity, options or administration rights, and reverts those to the Artist in writing. A share of income is not a grant and is never swept away. No perpetuity in any grant from the artist.
- No 360: no share of touring, merchandise, brand deals or unrelated income unless the description explicitly says so, and then only that one stream.
- Section 8: recoupment covers only costs this agreement names, is recouped only from the income stream this agreement covers, is never cross-collateralised and is never open-ended; the Producer receives statements at least twice a year and may audit on reasonable notice.
- Section 8 never contradicts itself: when the deal has no royalties (an outright sale or a flat fee), it says so once — no royalties are payable to the artist beyond the flat fee, no statements, no audit — and it never denies royalties while also requiring statements or an audit. Name the party who would otherwise be paid; never write that no royalties are payable "to the Company" when the Company is the one paying.
- Section 12: termination only for a material breach that is not cured, using ONE notice period and ONE cure period, never both. The Producer may never cancel a fully paid purchase for convenience, and the Artist's ownership of the Masters survives termination.
- Section 11: the Producer warrants the work is original, that all samples are cleared, and that no third-party rights encumber it.
- Section 13: liability limits never excuse fraud, wilful misconduct, a party's indemnity obligations, or direct damages, and they never exclude a party's obligation to pay the fee, a royalty or any sum that is due. Never write that neither party is liable for "any damages". The sentence "In no event shall either party be liable for any damages" is banned, and so is every version of it; write instead that each party is liable for the direct damages it causes, that no cap ever covers a fee or royalty that is due, and that the carve-outs are fraud, wilful misconduct and gross negligence. The limitation is written one way only: a party is always liable for its own fraud, wilful misconduct and gross negligence, and those are carved out of the cap. Never write that a party is not liable for its own fraud, wilful misconduct or gross negligence.
- No hidden fees, no unilateral amendment, no automatic renewal, no non-compete, no exclusivity beyond the described scope, no waiver of statutory royalties, no rights over the artist's name, likeness, voice or AI training.
- No open-ended work for either party: any approval or revision right is capped (for example [NUMBER] rounds of revision).
- If the description asks for something one-sided, draft the fair version and put any note in brackets inside that clause only.
- Never omit a term the deal states: every amount, percentage, period, party and right in the description appears somewhere in the contract.

DEAL-TYPE RULES
- Outright sale of a beat or master: the buyer owns the master and, when the deal says so, the publishing; the seller keeps only the credit the deal names and has no royalties, backend or statements. The transfer is permanent, for the life of the copyright, and Section 10 says so. Delivery is due on [DELIVERY DATE], never on the effective date. Section 12 must say, in terms, that the transfer takes effect only when the fee is paid and that if the buyer does not pay in full the seller may terminate and all rights in the master and publishing revert to the seller. Never write that the buyer's ownership survives termination, and never write that ownership is "not affected" by termination — Section 12 must agree with Section 6 about payment, and what happens on termination is set out in Section 12 alone, never in Section 10. The buyer may use the beat without restriction — an outright purchase is never limited to one song or one release.
- Sync or TV/film license: the Artist grants the license — never write that the Company "clears the publishing". Say the Artist licenses the composition and the master for the stated uses, and that the Company reports each use on its cue sheet. Quantities are quantities: "no more than thirty (30) seconds of the Song", never "for a period of thirty seconds". A flat fee buys only the stated uses; the license is non-exclusive and limited to the named production, territory and term, and every right reverts when the term ends.
- Management: Section 5 states the percentage of general music income and the separate, lower percentage of record royalties, and says the royalty commission replaces the general commission on that money so no dollar is commissioned twice. Commission is earned only on income from engagements the Manager procured during the Term; income from before the Term and from deals the Artist made without the Manager is excluded. Section 10 states the post-term tail the deal gives, in the length the deal gives, and applies it only to income from agreements entered into during the Term — never leave the tail out, and define "Tail" in Section 3 with that length so Section 10 can use the word without leaving it undefined. No expense recoupment, cost pass-through or expense deduction is created unless the deal states one. Section 8 runs one way: the Manager gives the Artist statements at least twice a year and the Artist may audit the Manager's records; the Artist never gives the Manager statements, and the Manager never audits the Artist's accounts. The Manager may not sign anything for the Artist or incur costs on the Artist's behalf without written approval, and Section 12 lets the Artist end the agreement on [NUMBER] days' written notice with or without cause, as well as for an uncured breach.
- Distribution: state the artist's share as one figure — "eighty-five percent (85%) of Net Receipts, being one hundred percent (100%) less the Distributor's fifteen percent (15%) commission" — never a [PERCENTAGE] placeholder explained by arithmetic. Exclusivity covers only distribution of the named recordings to digital platforms, and the Artist keeps the right to license sync, samples and other uses. Define Net Receipts before the commission — gross receipts less third-party platform or delivery charges only, never "other deductions" or an open-ended list — and then pay the artist eighty-five percent (85%) of it; never deduct the commission inside Net Receipts as well, or the artist is charged it twice. Where the Distributor collects income for the Artist, give it that limited authority to collect and account, and never say in the same agreement that it is not an agent.
- Collaboration or split agreement: a fifty-fifty split means each party owns an undivided fifty percent (50%) of the composition — both the writer's share and the publisher's share — and fifty percent (50%) of the master. Never give one party one hundred percent (100%) of one share and the other one hundred percent of another, and never let the shares add to more than one hundred percent. Ownership lasts for the life of the copyright, but the Agreement's own term is never described as the life of the copyright. Each party keeps its share if the collaboration ends. Section 5 says that no fee or advance is payable and points to Section 8 for the split of income; it never says that no payment of any kind is due while Section 8 divides royalties.
- Beat lease (non-exclusive): Section 4 states that the lease is non-exclusive and that the Producer may lease or license the Beat to any other artist; the Artist may use the Beat only for the stated number of copies or streams, and must stop selling when that number is reached. Section 7: the Producer keeps the writer's share of the Beat as its composer, the Artist keeps the writer's share of the lyrics and melody the Artist wrote, and neither claims the other's share — never write that the Producer receives no publisher's share "except as agreed in a separate agreement". Section 8: a lease pays no royalties in either direction — say once that the lease fee is the Producer's entire compensation and that no royalties, backend or statements are due from either party; never write that no royalties are payable "to the Artist" when the Artist is the one paying. Section 10: when the Term ends the Artist must take the Beat down from sale and stop distributing it, and any extension must be a signed writing.
- Record label deal with an advance: Section 5 states the split the deal gives as plain numbers — for a fifty-fifty deal, "fifty percent (50%) of Net Profits to the Artist and fifty percent (50%) to the Label" — never a [PERCENTAGE] placeholder for a split the description states, and states the advance once as the stated amount. Section 3 defines Net Profits as gross receipts less only the costs this Agreement names and the Label actually spends, never "all costs and expenses" and never an open-ended list — that means an itemised, closed list of costs the Label names and actually pays (recording, manufacturing, distribution), and the words "any other costs", "including but not limited to" and "all costs related to" are banned in that definition; the advance is recouped only from the Artist's royalties under this Agreement, never from publishing, touring or merchandise, and money recouped once is never recouped again — the advance and the cost deductions must never take the same money twice. Section 8 states the royalty once and points to Section 5 rather than naming a second, different rate, and it never restates the recoupment a second time. Section 4 and Section 10 state the option as an option: the Label must exercise it in writing within [NUMBER] days after the Artist delivers and the Label accepts an album, on the same terms and with an advance of at least [AMOUNT], and it lapses if not exercised — never an open-ended duty to deliver more albums. Section 10 never gives the Label a share or a right for the life of the copyright: the Label's rights end with the Term and the Artist regains the masters. Section 7: the Label takes no publishing, no publisher's share and no administration, with no exception clause, and Section 7 never contradicts Section 10.
- Featured artist or guest verse: name the two artists by role — the person singing the feature is [FEATURED ARTIST LEGAL NAME] ("Featured Artist") and the owner of the single is [ARTIST LEGAL NAME] ("Artist") — so the credit clause can never read "credit to the Artist as a featured artist". Section 4 states separately that delivery is due on [DELIVERY DATE] and that the work is capped at [NUMBER] takes or [NUMBER] rounds of revision — never "deliver within [NUMBER] takes". Section 4 and Section 6 limit the use to the one named single: no other song, no remix, no sync, no sample and no AI training without a new signed agreement. Section 9 states the credit in the form the release will carry, "featuring [FEATURED ARTIST LEGAL NAME]", in the metadata, on the artwork and in every listing. Section 5: the flat fee is the entire compensation, is due on delivery, and is never recoupable. Section 6: the Artist owns the Master; the Featured Artist assigns only the recorded performance on that single and keeps the right to perform the verse live. Section 7: each artist keeps the writer's share of what that artist wrote, neither takes the other's, and the Artist takes no share of the Featured Artist's writer's share — never write that one artist acquires no publishing in a song that artist wrote. Section 8: no royalties to either party beyond the fee, said once, with no statements and no audit. Section 10 never calls the Agreement's term the life of the copyright: ownership of the Master and of each writer's share continues, while the Agreement's own term is delivery and payment. Section 11: the Artist warrants the beat and any samples are cleared and the Master is its own to release.
- Never import a rule from another deal type: a label deal has no Tail and gives the producer no publisher's share, a beat lease has no recoupment and no tail, a featured-artist deal has no sunset tail, and a distribution deal has no publishing split. Define only the terms this deal actually uses.
- The title contains no bracketed placeholder and never uses a party description as if it were a name: "SYNC LICENSE AGREEMENT FOR [SONG]" or "BEAT SALE AND PRODUCER CREDIT AGREEMENT", never "TV PRODUCTION COMPANY SYNC LICENSE AGREEMENT".

HOUSE STYLE
- Define each party once ("Artist", "Producer", "Company") and use the term throughout.
- Use clause numbers (1., 1.1, 1.2) consistently.
- Governing law: the state the description gives. If the deal names two states and no governing law, use [STATE] rather than picking one party's home state; with no state at all, [STATE]. A Texas artist and a New York label is exactly this case: [STATE], never New York.

FINAL CHECK — before you answer, silently verify every point and fix anything that fails:
1. The title names the deal; it is never just "AGREEMENT" or "PRODUCTION AGREEMENT".
2. Section 10 does not take back the Artist's Masters or the Producer's stated publisher's share or royalty. It ends only exclusivity, options and administration rights.
3. Section 12 has one notice period and one cure period, and no termination for convenience.
4. Every fact the deal did not give is a bracketed placeholder, and no clause refers to a detail it never supplies.
5. There is no disclaimer, no introduction and no note after the signatures.
6. Each party has one placeholder, identical in the introduction and in the signature block, and it names that party's real role.
7. No section both denies royalties and requires statements, and quantities are stated as quantities, not as durations.
8. Governing law is a state the deal actually gave, or [STATE].
9. Only the parties this deal defines are named, and a buyer or licensee who has not paid keeps no rights; Section 12 says so in terms.
10. In an outright sale, Section 12 agrees with Section 6: the transfer takes effect only on payment, and termination never leaves an unpaid buyer owning the beat.
11. Section 13 never wipes out direct damages or the obligation to pay.
12. Every percentage is a plain number, the shares add up to one hundred percent (100%), and no dollar is commissioned twice.
13. A management, distribution or collaboration deal follows its own rule above, and no [PERCENTAGE] placeholder is left in the payment clause.
14. No clause says a party is not liable for its own fraud, wilful misconduct or gross negligence, and no cap covers sums due.
15. Net Receipts is defined before the commission, so the artist's percentage is never charged the commission twice.
16. Section 5 never contradicts Section 8 about whether money is owed.
17. In a management deal the Manager accounts to the Artist and the Artist audits the Manager, and the Artist can end the agreement on notice.
18. Every term the description states appears in the contract, including any post-term tail.
19. No [PERCENTAGE] or [NUMBER] placeholder stands where the description gave the figure, no royalty rate appears twice with two different bases, and no definition of Net Profits or Net Receipts says "any other costs" or "including but not limited to".
20. No clause defers to "a separate agreement" or to what is "otherwise provided", and no clause borrows a rule from another deal type.
21. A label deal never recoups the same money twice, and any option has a written exercise window and lapses.
22. No sentence anywhere says "neither party shall be liable for any damages" or the like, and the cap never covers sums due.`;

/**
 * A short nudge to keep the document focused on what the person actually described.
 * @param {string} scenario
 * @param {boolean} company
 */
export function userPrompt(scenario, company) {
  return `Draft the full contract for this deal. ${
    company
      ? "The hiring party is the company/Came Through Audio side; the counterparty is the artist or contributor. Keep every fairness rule."
      : "The artist is the person describing the deal."
  }

The deal, in the artist's own words:
"""
${scenario}
"""

Return the contract document only, starting with its title line.`;
}

/**
 * The model's answer with anything around the document removed: code fences, a leading "Here is the contract" line,
 * and any disclaimer or advice line the model still produced. The contract's own text is untouched.
 * @param {string | null | undefined} raw
 */
export function cleanContract(raw) {
  let text = (raw ?? "").replace(/\r\n/g, "\n").trim();
  if (!text) return "";
  // Fenced output: keep what is inside the fence.
  const fence = /^```[a-z]*\n([\s\S]*?)\n```$/i.exec(text);
  if (fence && fence[1]) text = fence[1].trim();

  const NOISE =
    /(disclaimer|not legal advice|does not constitute legal advice|for informational purposes only|consult (a|an|your) (qualified )?(attorney|lawyer)|i am an ai|as an ai|language model|this document was (generated|produced)|no attorney-client relationship)/i;
  const INTRO =
    /^(sure|certainly|of course|here('s| is)|below is|i.ve (drafted|prepared)|i have (drafted|prepared)|this (contract|agreement) (is|was) (drafted|prepared))/i;

  const lines = text.split("\n");
  // Anything before the document's own first line (title, or "This Agreement") is chatter.
  let start = 0;
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (!line) continue;
    const isTitle =
      /^[A-Z0-9][A-Z0-9 .,&'()\/-]{6,}$/.test(line) ||
      /agreement|contract|license|licence/i.test(line);
    if (isTitle && !INTRO.test(line) && !NOISE.test(line)) {
      start = i;
      break;
    }
  }
  // Then drop any stray disclaimer / intro line anywhere in the document.
  const kept = lines.slice(start).filter((line) => {
    const value = line.trim();
    if (!value) return true;
    if (NOISE.test(value) && !/^\d/.test(value)) return false;
    if (/^[-*_]{3,}$/.test(value)) return false;
    if (/^`{3,}/.test(value)) return false;
    return true;
  });
  return kept
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * The document's title, from its first line, with stray marks removed.
 * @param {string} contract
 */
export function contractTitle(contract) {
  const first = contract.split("\n").find((line) => line.trim()) ?? "";
  const title = first
    .replace(/^[#*\s]+/, "")
    .replace(/[*#\s]+$/, "")
    .trim();
  return title.length > 120 ? title.slice(0, 120) : title;
}

/** @param {string} origin */
const corsHeaders = (origin) => ({
  "Access-Control-Allow-Origin": origin,
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Max-Age": "86400",
  Vary: "Origin",
});

/**
 * @param {unknown} body
 * @param {number} status
 * @param {string | null} origin
 * @param {Record<string, string>} [extra]
 */
function reply(body, status, origin, extra = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...(origin ? corsHeaders(origin) : {}),
      ...extra,
    },
  });
}

export default {
  /**
   * @param {Request} request
   * @param {{ AI: { run: (model: string, input: unknown) => Promise<any> } }} env
   */
  async fetch(request, env) {
    const origin = request.headers.get("Origin");
    const referer = request.headers.get("Referer");
    const url = new URL(request.url);

    // 1. Origin lock, before anything is counted or any AI work is spent.
    if (!allowedOrigin(origin, referer)) return reply({ error: "Forbidden" }, 403, origin);
    const allowed = origin;

    if (request.method === "OPTIONS")
      return new Response(null, { status: 204, headers: corsHeaders(allowed) });
    if (request.method === "GET" && url.pathname === "/")
      return reply(
        {
          worker: "cta-contract-generator",
          model: CONTRACT_MODEL,
          usage: "POST / with { scenario, company? }",
        },
        200,
        allowed,
      );
    if (request.method !== "POST") return reply({ error: "Method not allowed" }, 405, allowed);

    // 2. One scenario, within the length cap.
    let body;
    try {
      body = await request.json();
    } catch {
      return reply({ error: "Send a JSON body with a scenario." }, 400, allowed);
    }
    const scenario = normaliseScenario(body && body.scenario);
    if (!scenario) {
      return reply(
        {
          error: `Describe the deal in ${MIN_SCENARIO_CHARS}–${MAX_SCENARIO_CHARS} characters.`,
        },
        400,
        allowed,
      );
    }
    const company = !!body && body.company === true;
    /**
     * The page sends this only for a member whose plan includes the generator. The Worker cannot verify a plan on its
     * own (it holds no session), so this is a courtesy flag: the origin lock keeps strangers out, and the worst a forged
     * true can cost is the price of the drafts it produces, about half a cent each.
     */
    const paid = !!body && body.paid === true;

    // 3. Per-IP, per-hour cap in the Cache API.
    const ip = request.headers.get("CF-Connecting-IP") || "unknown";
    const now = Date.now();
    const cache = caches.default;
    const key = new Request(rateLimitKey(ip, now), { method: "GET" });
    const hit = await cache.match(key);
    const used = hit ? Number.parseInt(await hit.text(), 10) || 0 : 0;
    if (!paid) {
      if (used >= RATE_LIMIT_PER_DAY) {
        return reply(
          {
            error: `You've reached today's ${RATE_LIMIT_PER_DAY} contracts. Try again tomorrow, or open one of our ready-made contracts.`,
            code: "daily_cap",
          },
          429,
          allowed,
          { "Retry-After": String(secondsUntilNextWindow(now)) },
        );
      }
      await cache.put(
        key,
        new Response(String(used + 1), {
          headers: { "cache-control": "max-age=86400", "content-type": "text/plain" },
        }),
      );
    }

    // 4. Workers AI with the drafting rules.
    try {
      const ai = await env.AI.run(CONTRACT_MODEL, {
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt(scenario, company) },
        ],
        max_tokens: 3200,
        temperature: 0.15,
      });
      const raw = typeof ai === "string" ? ai : ai && ai.response;
      const contract = cleanContract(raw);
      if (!contract || contract.split(/\s+/).length < 120) {
        return reply(
          {
            error: "The contract came back incomplete. Try again.",
            detail: String(raw ?? "").slice(0, 400),
          },
          502,
          allowed,
        );
      }
      return reply(
        { contract, title: contractTitle(contract), model: CONTRACT_MODEL },
        200,
        allowed,
      );
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      console.error("contract generator ai failed", detail);
      return reply(
        {
          error: "The contract generator is unavailable right now.",
          detail: detail.slice(0, 400),
        },
        503,
        allowed,
      );
    }
  },
};
