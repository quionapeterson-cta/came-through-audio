# PLAN — Stay on Lovable or move to Cloudflare: comparison · v1

Status: **for your decision (Level 2, 2026-10-27).** Lovable Pro ends 2026-11-11. The move itself is already written
up step by step in PLAN-cloudflare-hosting.md (code ready since 2026-10-23).
Sources: Lovable and Cloudflare pricing information as of October 2026; confirm on lovable.dev/pricing and
developers.cloudflare.com/workers/platform/pricing before deciding, since plans change.

---

## Short answer

**Does Lovable limit how many people can use the site?** Not by itself: user accounts, sign-ins and data live in
**Supabase**, on both options. What the Lovable **free** plan takes away is the custom domain. A free Lovable site can
only live at a `…lovable.app` address, carries the Lovable badge, and the project is public (anyone can view and
remix the code). Keeping **camethroughaudio.com** on Lovable means staying on Pro (about $25/month).

**Recommendation: move to Cloudflare on the $5/month Workers Paid plan**, keep Lovable Free as the editor if you like
building there, and keep camethroughaudio.com pointed at Cloudflare.

## Side by side

| | Lovable Free | Lovable Pro (~$25/mo) | Cloudflare Workers Free | Cloudflare Workers Paid ($5/mo) |
| --- | --- | --- | --- | --- |
| camethroughaudio.com | ❌ lovable.app address only | ✅ | ✅ | ✅ |
| Lovable badge on the site | Shown | Removable | None | None |
| Code private | ❌ public, remixable | ✅ | ✅ (your GitHub stays private) | ✅ |
| User limit | None from hosting (Supabase sets it) | Same | Same | Same |
| Traffic limit | Not published | Not published | 100,000 page requests a day | 10 million a month included, then $0.30 per extra million |
| Computing per page | Not published | Not published | **10 ms** per request: likely too little for this site's pages | Up to 30 seconds (default) |
| Edit by chatting with AI | ✅ 5 credits a day | ✅ more credits | — (Lovable editor still works on any plan) | — |
| Stripe | Lovable connector | Lovable connector | Your own Stripe keys (already supported in the code) | Same |
| Cost per year | $0 | ~$300 | $0 | **$60** |

## Pros and cons

**Stay on Lovable Pro**
- ✅ Nothing to move; payments keep going through Lovable's connector.
- ❌ About $300 a year, and a monthly bill you planned to stop on Nov 11.

**Lovable Free**
- ✅ $0.
- ❌ No camethroughaudio.com, Lovable badge on every page, public code. Not suitable for launch.

**Cloudflare Workers Free**
- ✅ $0, your domain, private code.
- ❌ The 10 ms computing limit per page is likely to make pages fail under normal use. Fine for testing only.

**Cloudflare Workers Paid ($5/month)**
- ✅ Your domain, no badge, private code, room for far more traffic than launch needs, cheapest real option.
- ❌ A one-time move (about an hour following PLAN-cloudflare-hosting.md), and your own Stripe keys to manage.

## The other limit to watch: Supabase

Users, sign-ins, catalogs and files are in Supabase whichever host you pick. Supabase's free plan is generous for a
launch (tens of thousands of monthly active users) but pauses a project after a week with no activity and has small
database and file storage caps. Check Supabase → Settings → Usage monthly; the Pro plan is $25/month when you need it.

## Decide

- [ ] Pick one: Cloudflare Paid ($5/mo) · Lovable Pro · other.
- [ ] If Cloudflare: follow PLAN-cloudflare-hosting.md the week of Nov 3, while Lovable still works as a backup.
