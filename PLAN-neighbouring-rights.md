# PLAN — Neighbouring rights (international airplay for recordings) · v1

Status: **awaiting approval. No code written yet.**
Source: founder decisions, 2026-10-20: yes to A and B, ask during embed, export on Catalog & Collaborate and up, assume US-based users for now.

---

## Background (plain language)

Neighbouring rights pay the **recording** (not the song) when it's played on radio, TV or in venues outside the US.
They go to the **performers** (featured artist and session players) and the **master owner**.
US AM/FM radio doesn't pay recordings, so most US independents never collect this, even when a song gets
played on the BBC or in a club in Berlin.

A US artist collects it one of two ways:
1. **SoundExchange international mandate.** Tick a box in your SoundExchange account to let them collect from
   foreign societies for you. Easiest, since you're already registering there.
2. **Join PPL directly** (the UK society, open to non-UK members). It collects from about 100 countries and often pays faster.

---

## A. Health Check step: "Collect international airplay" (US users)

The **Register it** stage gets one more step:

```
☐ Collect international airplay (neighbouring rights)  ⓘ
   When your recording plays on radio, TV or in venues outside the US, its performers
   and master owner are owed royalties. US radio doesn't pay these, so most artists miss them.

   Pick one:
   ① Turn on SoundExchange's international mandate (easiest)
      In your SoundExchange account, authorize them to collect internationally for you.
      (Exact wording and menu path to be checked against SoundExchange's current site before building.)
   ② Join PPL directly (UK, accepts US members, collects from ~100 countries)

   [Open SoundExchange ↗]  [Open PPL ↗]  [I've set this up]
```
- Done once per account, not per song: ticking it on one song ticks it on all of them, because it's an account
  setting at SoundExchange or PPL.
- Shown only when the Health Check country is the United States. Other countries already have their own
  "Recording airplay pay" step (PPL, GVL, SCPP and others).

## B. Performers on the recording (asked during embed)

A new **Performers** section in Embed Metadata (and Add song), right after Producer:

```
PERFORMERS ON THIS RECORDING  ⓘ
Karma Came · Featured artist · Vocals                    (from Artist name)
OG PI     · Featured artist · Vocals                    (from Featured artist)
┌──────────────────────────────────────────────────────────────┐
│ Name [Jane Doe       ]  Role [Session musician ▾]  Instrument [Guitar ] │
│ Name [               ]  Role [Backup vocalist ▾]  Instrument [Vocals ] │
└──────────────────────────────────────────────────────────────┘
[+ Add performer]
Recorded in [United States ▾]   Year recorded [2026]
```
- **No duplicate entry:** the main and featured artists come straight from Artist name and Featured artist,
  marked as featured. Only extra performers are typed here.
- **Merges with "Add Credits":** today's credit rows (Session musician, Backup vocalist, engineers…) gain an
  optional **Instrument** box, so there's one list of people rather than two. Engineers stay credits but don't count
  as performers, because societies don't pay them.
- **Recorded in** defaults to United States, and **Year recorded** to the release year. Both can be saved in Embed Defaults.
- **The master owner** comes from the existing ℗ line (or Label), so there's no new owner field.
- **Optional, like PRO/IPI:** never required to save or embed. The Health Check step from A notes when performers
  are missing ("Add who played on it so every performer gets paid").
- **What's embedded:** credits are already written into the MP3 (name and role). The instrument is added to that
  text ("Session musician (Guitar)"). Recording country and year stay in the catalog only.

## C. "Neighbouring Rights Pack" export: Catalog & Collaborate and up

A new item in the existing export menu, next to MLC, SoundExchange and BMI/ASCAP:

- One spreadsheet row per performer per song, with ISRC, title, main artist, performer name,
  Featured/Non-featured, instrument or role, recorded in, year recorded, master owner (℗), label, release date,
  UPC and duration.
- Matches the fields PPL and SoundExchange ask for, so it can be copied straight into either.
- Locked below Catalog & Collaborate (same lock and upgrade prompt as other gated features). The tier is
  checked on the server, like the other paid exports.
- Songs with no ISRC are left out with a warning (societies match recordings by ISRC). Missing performers only warn.

## Deferred
- **D. Registration assistance add-on** for neighbouring rights: revisit after launch, based on demand.
- **E. Administrator partnership:** see the founder Q&A. Undecided.

---

## Glossary additions (need your approval)
- **Neighbouring rights**: "Royalties for your recording when it's played on radio, TV or in venues outside the US. They pay the performers and the master owner. Collect them through SoundExchange's international mandate or by joining PPL."
- **Featured / non-featured performer**: "Featured performers are the artists named on the release. Non-featured performers are session players and backup singers. Both can be paid for airplay outside the US."
- **PPL**: "The UK society that collects neighbouring rights for performers and master owners, from about 100 countries. Artists from outside the UK can join."

## Rules check
- No writer fields, roles, readiness or split logic change. Performers aren't writers.
- No database migration: songs already store all their details in the catalog's `details` field.
- Private data stays private: PRO, IPI and splits are still never embedded.

## Files
`src/lib/metadata.ts` (performer fields: `instrument` on credits, `recordedIn`, `recordedYear`; defaults),
`src/components/MetadataUploader.tsx` (Performers section), `src/components/ArtistOnboarding.tsx` (Embed Defaults:
recorded in and year), `src/lib/id3` embed code (instrument in credit text),
`src/lib/repertoires.ts` + `src/lib/health-checklist.ts` + `src/components/HealthChecklist.tsx` (step A),
`src/lib/agency-export.ts` + export menu (pack C, with tests), `src/lib/glossary.ts` (3 entries).

## Order of work (each its own commit)
1. A: Health Check step (small; useful right away)
2. B: Performers section and embed
3. C: Neighbouring Rights Pack export
