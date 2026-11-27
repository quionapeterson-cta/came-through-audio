# Contract Generator — limits, costs and the engineer's sheet

Status: **live.** The worker `cta-contract-generator` drafts the full contract on Cloudflare Workers AI. Written 2026-11-27 after three rounds of real drafts (sale, sync, management, distribution, collaboration, beat lease, label deal, featured artist).

This is the sheet the Software lead needs before touching the generator: what Cloudflare allows, what each contract costs, how many we can expect, and the rules the prompt is built on.

## 1. Where it runs

| Piece | Where |
| --- | --- |
| Worker | `cta-contract-generator` (account `30954c45d89a84c4345bef619973ffee`), own config `workers/wrangler-contract.toml` |
| Worker URL | `https://cta-contract-generator.quionapeterson.workers.dev` |
| Prompt and rules | `SYSTEM_PROMPT` in `workers/cta-contract-generator.js` — the single place drafting behaviour is set |
| Model | `@cf/meta/llama-3.3-70b-instruct-fp8-fast`, `max_tokens` 3200, `temperature` 0.15 |
| Page | `src/components/ContractGenerator.tsx` + `src/lib/contract-generator-api.ts` |
| Deploy | `npx wrangler deploy -c workers/wrangler-contract.toml` |

The worker shares no binding, route or code with the Help Desk, the tax tables or the email workers. It only uses the account's `AI` binding.

## 2. Cloudflare limits that matter

| Limit | Free plan | Workers Paid |
| --- | --- | --- |
| Workers AI allowance | **10,000 neurons a day**, resets 00:00 UTC | Same 10,000 free, then **$0.011 per 1,000 neurons** |
| Model price | — | **$0.293 per M input tokens, $2.253 per M output tokens** (26,668 and 204,805 neurons per M) |
| Context window | 24,000 tokens | 24,000 tokens |
| Text generation requests | 300 a minute | 300 a minute |
| Minimum charge | none | **$5 a month per account** |
| Our own cap | **25 contracts a day per visitor IP** (Cache API), and **none at all for a paid member** | same |

Two things that surprise people:

- The allowance is **per account, not per worker.** The Help Desk and the app's own blueprint matcher draw from the same 10,000 neurons a day, so a busy Help Desk shortens the generator's day.
- Our own cap is 25 contracts a day per visitor IP, and a member whose plan includes the generator is not counted at all. The flag rides on the request, because the Worker holds no session; the origin lock keeps strangers out and a forged flag costs about half a cent a draft.

## 3. What one contract costs

Measured from real drafts on 2026-11-27:

| Part | Amount |
| --- | --- |
| Instructions sent in | 19,791 characters ≈ **5,350 tokens** |
| The deal description | ≈ 100 tokens |
| Contract written back | 4,500–5,800 characters ≈ **1,250–1,600 tokens** (cap 3,200) |
| Neurons per contract | 145 input + ≈ 300 output = **about 450 neurons** |
| Paid cost per contract | **about half a cent ($0.005)** |

So the free allowance drafts **about 22 contracts a day** with nothing else using the account, and **roughly 660 a month** if every day were used. In practice the account also serves the Help Desk, so budget 15–20 a day.

## 4. Projections

Cost per contract stays flat: 450 neurons × $0.011 per 1,000 neurons. The free 10,000 neurons a day are subtracted first.

| Contracts a day | Neurons a day | Free plan | Paid plan, per month (30 days) |
| --- | --- | --- | --- |
| 10 | 4,500 | covered | **$0** |
| 20 | 9,000 | covered | **$0** |
| 22 | 9,900 | just covered | **$0** |
| 50 | 22,500 | 4006 error after ~22 | about **$4** |
| 100 | 45,000 | no | about **$12** |
| 250 | 112,500 | no | about **$34** |
| 500 | 225,000 | no | about **$71** |
| 1,000 | 450,000 | no | about **$145** |

At 1,000 contracts a month, whether spread over 30 days or made in one day, the AI bill is **about $5** — five dollars for a thousand drafted agreements. The $5 monthly minimum on the paid plan is the only fixed cost.

The paid plan is worth it as soon as more than about 20 contracts a day are expected, or as soon as drafting must never stop: on the free plan the 23rd contract of a UTC day fails until midnight.

## 5. When the allowance runs out

Cloudflare answers error **4006** — "you have used up your daily free allocation of 10,000 neurons". The worker recognises that string and the page treats it as a busy day, not a fault:

- The panel says **"We're experiencing high volume right now. Try again tomorrow."**
- It hides the HTTP code, the raw quota text and the "send this to support" line.
- It automatically offers the **closest premade contracts**, chosen on the page itself from our own blueprints (`keywordPick` in `src/lib/contract-generator.ts`), so the offer still appears on a day when every AI call is spent and the server-side matcher cannot answer. Each one has a "Use this" button.
- Any other AI failure still reads "The contract generator is unavailable right now" and keeps the detail line, so real breakage stays diagnosable.

Anything else that changes the message must change `src/lib/contract-generator-api.ts` (the mapping) and, if the worker is touched, the same code in the worker.

## 6. The instruction sheet

The contract comes from one prompt, `SYSTEM_PROMPT` in `workers/cta-contract-generator.js`. Never patch the contract text in code — change the rule that produced it.

Its parts, in order:

1. **Output rules** — the document alone; no greeting, no disclaimer, no note after the signatures; plain text; a title that names the deal; `[BRACKETED PLACEHOLDERS]` instead of invented facts; one placeholder per party, matching that party's real role; payments dated once; percentages as plain numbers that add up; 1,000–2,000 words.
2. **Required sections 1–18** — Parties, Recitals, Definitions, Scope, Payment, Master ownership, Publishing and writer's share, Royalties and recoupment, Credits, Term and reversion, Warranties, Termination, Limitation of liability, Independent contractor, Notices, Governing law, Entire agreement, Signatures.
3. **Fairness rules** — the artist keeps 100% of the writer's share; no 360; recoupment only from the named income stream; no perpetuity in a grant from the artist; liability never excuses fraud or sums due; no unilateral amendment, no automatic renewal, no rights over name, likeness, voice or AI training; no open-ended work.
4. **Deal-type rules** — one block each for outright sale, sync licence, management, distribution, collaboration, beat lease, label deal with an advance and featured artist, each naming the contradictions those drafts produced (double commission, borrowed "Tail", phantom royalties, unpaid-buyer ownership, option without an exercise window, Net Profits with an open cost list).
5. **House style** — one term per party, clause numbering, the state the deal gives or `[STATE]`.
6. **FINAL CHECK 1–22** — a silent pass over the failures already seen in real drafts.

The model's answer is cleaned before it leaves the worker (`cleanContract`): code fences, "Here is the contract" openers and any disclaimer line are stripped, and a draft under 120 words is treated as a failure rather than sent.

## 7. Operating it

- **Origin lock**: only `camethroughaudio.com`, its preview hosts and a loopback dev server may call it. Anything else gets 403 before AI is touched.
- **Size gate**: 20–4,000 characters of scenario.
- **Rate limit**: 25 a day per IP, counted in the Cache API with a one-day TTL, reset at midnight UTC. A request that says `paid: true` (sent by the page only for a plan that unlocks Contracts) skips the count. The page sends that flag from `unlocked` in `ContractGenerator.tsx`.
- **Page timeout**: 90 seconds per draft.
- **Deploying**: deploy the worker first, then the app. The page falls back to the deployed URL when `VITE_CTA_CONTRACT_WORKER_URL` is unset.
- **Escalation**: a member who genuinely needs more than 25 drafts in a day is escalated to the Software department lead and a super admin together. Only a super admin approves raising the allowance, only for that member, and only for that day. The counter is keyed to the visitor IP, so engineering raises it by hand until it can be keyed to an account.
- **Verifying a change**: run one draft per affected deal type, and read section 5, 7, 8, 10, 12 and 13 specifically — every contradiction found so far lived in one of those.

## 8. Growth plan (super admin only)

What the generator costs and earns as it grows. AI cost is 450 neurons a contract at $0.011 per 1,000 neurons, less the 10,000 free neurons a day (300,000 a month). Revenue assumes $3.99 to open a drafted contract.

| Contracts a month | Members, at 10 a month each | AI cost | Revenue at $3.99 | AI as % of revenue |
| --- | --- | --- | --- | --- |
| 500 | about 50 | $0 (inside the free day) | $1,995 | 0% |
| 1,000 | about 100 | $1.65 | $3,990 | 0.04% |
| 2,500 | about 250 | $9.08 | $9,975 | 0.09% |
| 5,000 | about 500 | $21.45 | $19,950 | 0.11% |
| 10,000 | about 1,000 | $46.20 | $39,900 | 0.12% |
| 25,000 | about 2,500 | $120.45 | $99,750 | 0.12% |

Reading it:

- **$5 of AI buys about 1,000 contracts**, not 5,000 — 5,000 contracts is about $21 of AI once the free allowance is used. The $5 Workers Paid minimum is a fixed cost, not a per-5,000 price.
- **5,000 contracts a month is roughly 500 members** at ten drafts each, or 1,000 members at five.
- AI stays under **0.15% of revenue** at every volume above 1,000 contracts a month, so the generator is never the cost that makes the plan unprofitable.
- The daily 25-contract cap does not shape revenue: a member drafting 10 a month never meets it, and a paid member is not counted at all.
- The account's 10,000 free neurons are shared with the Help Desk, so the free column is optimistic on a busy support day.

## 9. Open items

- The daily-limit handling exists in both places on purpose: the page (`src/lib/contract-generator-api.ts` and `ContractGenerator.tsx`) treats a spent allowance as a busy day, and the worker answers our own 25-a-day cap with `429` and `code: "daily_cap"`. Both were deployed on 2026-11-27.
- The worker's `GET /` still reports the retired Llama 3.1 8B as its model; it is a stale string, not the model in use.
- A paid Workers plan removes the daily ceiling. Nothing else about the generator changes.
