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
 *   3. Rate limit    — 8 contracts an hour per visitor IP, counted in the Cache API.
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

/** Contracts a single visitor IP may generate in one hour. */
export const RATE_LIMIT_PER_HOUR = 8;

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

/** @param {number} now */
export function rateLimitWindow(now) {
  return new Date(now).toISOString().slice(0, 13);
}

/**
 * @param {string} ip
 * @param {number} now
 */
export function rateLimitKey(ip, now) {
  const who = encodeURIComponent((ip || "unknown").trim().toLowerCase());
  return `https://cta-contract-generator.internal/rate/${who}/${rateLimitWindow(now)}`;
}

/** @param {number} now */
export function secondsUntilNextWindow(now) {
  const end = (Math.floor(now / 3_600_000) + 1) * 3_600_000;
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
- Every payment clause says when the money is due: [DATE] or "on delivery". Every notices clause states [ARTIST ADDRESS] and [PRODUCER ADDRESS]. Never refer to details "set out below" without giving them.
- 1,000–2,000 words. Never omit or shorten a required section to stay brief.

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
- Section 12: termination only for a material breach that is not cured, using ONE notice period and ONE cure period, never both. The Producer may never cancel a fully paid purchase for convenience, and the Artist's ownership of the Masters survives termination.
- Section 11: the Producer warrants the work is original, that all samples are cleared, and that no third-party rights encumber it.
- Section 13: liability limits never excuse fraud, wilful misconduct, or a party's indemnity obligations.
- No hidden fees, no unilateral amendment, no automatic renewal, no non-compete, no exclusivity beyond the described scope, no waiver of statutory royalties, no rights over the artist's name, likeness, voice or AI training.
- No open-ended work for either party: any approval or revision right is capped (for example [NUMBER] rounds of revision).
- If the description asks for something one-sided, draft the fair version and put any note in brackets inside that clause only.

HOUSE STYLE
- Define each party once ("Artist", "Producer", "Company") and use the term throughout.
- Use clause numbers (1., 1.1, 1.2) consistently.
- Governing law: the state the description gives, otherwise [STATE].

FINAL CHECK — before you answer, silently verify every point and fix anything that fails:
1. The title names the deal; it is never just "AGREEMENT" or "PRODUCTION AGREEMENT".
2. Section 10 does not take back the Artist's Masters or the Producer's stated publisher's share or royalty. It ends only exclusivity, options and administration rights.
3. Section 12 has one notice period and one cure period, and no termination for convenience.
4. Every fact the deal did not give is a bracketed placeholder, and no clause refers to a detail it never supplies.
5. There is no disclaimer, no introduction and no note after the signatures.`;

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
    /^(sure|certainly|of course|here('s| is)|below is|i'Ã¢â‚¬â„¢ve| have) (drafted|prepared)|this (contract|agreement) (is|was) (drafted|prepared))/i;

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

    // 3. Per-IP, per-hour cap in the Cache API.
    const ip = request.headers.get("CF-Connecting-IP") || "unknown";
    const now = Date.now();
    const cache = caches.default;
    const key = new Request(rateLimitKey(ip, now), { method: "GET" });
    const hit = await cache.match(key);
    const used = hit ? Number.parseInt(await hit.text(), 10) || 0 : 0;
    if (used >= RATE_LIMIT_PER_HOUR) {
      return reply({ error: "Too many contracts this hour. Try again shortly." }, 429, allowed, {
        "Retry-After": String(secondsUntilNextWindow(now)),
      });
    }
    await cache.put(
      key,
      new Response(String(used + 1), {
        headers: { "cache-control": "max-age=3600", "content-type": "text/plain" },
      }),
    );

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
