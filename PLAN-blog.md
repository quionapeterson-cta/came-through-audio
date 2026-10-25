# PLAN — The Came Through Blog: the top 100 questions independent artists ask · v1

Status: **queued (founder, 2026-10-25): start after today's phases are complete.**

## Goal
A public blog on camethroughaudio.com/blog that answers the 100 questions US independent artists search Google for most
(distribution, metadata, getting paid, registration, splits, contracts, AI and copyright), so they find Came Through Audio
and sign up. Each article answers the question fully first, then subtly shows how CTA does it, with a sign-up link that
fits the article (free account, or the tier that article's task needs).

## How we pick the 100
- Seed list by topic (about 12–15 per topic): Distribution · Metadata & credits · ISRC/UPC/ISWC · PROs (ASCAP/BMI/SESAC/GMR) ·
  The MLC & mechanicals · SoundExchange & neighbouring rights · Split sheets & publishing · Getting paid from streaming ·
  Contracts & business · Copyright & AI · Releasing (release plans, pitching).
- Rank by US search demand using keyword data (Google Keyword Planner / Search Console once live, plus "People also ask"),
  keep questions with clear intent, drop duplicates. Founder approves the final 100 before writing.

## Each article
- URL `/blog/<question-slug>`, title = the question, 1-sentence direct answer at the top (featured-snippet format),
  then steps, a short FAQ block, sources linked to the agency's own pages, "Last checked" date.
- SEO: unique title/description, FAQPage + Article structured data, internal links between related questions,
  sitemap.xml, Open Graph image (CTA style), fast static pages. Public at launch (blog pages pass the passcode gate
  only when the site opens; noindex comes off with launch).
- CTA guidance (subtle): one in-line "Do this in Came Through Audio" box tied to the task (e.g. ISRC article → Embed
  Metadata; MLC article → 1-click agency exports, Catalog & Collaborate), and an end card: Sign up free / the right tier.
- Design: white background, Poppins, black text, Cobalt accents, wordmark rules from BRANDING.md; reading width ~65ch;
  table of contents for long answers; related questions at the end.

## Build
`src/lib/blog/` (articles as data, same pattern as docs.ts), `/blog` index with topic filters and search,
`/blog/$slug` pages, sitemap route, Admin → Marketing can propose edits through the Task Bank. Written in batches of 20,
each batch fact-checked against agency sites, founder review per batch.

## Questions
1. Blog name: "The Came Through Blog" or something else?
2. Byline: "Came Through Audio" or the founder's name?
