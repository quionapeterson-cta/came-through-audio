# PLAN — AI Protection Hub: automatic grades, Bitcoin status explained, admin certificates organized · v1

Status: **awaiting approval.**
Source: founder testing notes, 2026-10-21.

---

## 1. "Grade pending": what it means today

- **No person grades proofs.** Grading is automatic (`gradeProof` in `src/lib/draft-chain.ts`):
  - **A+**: strong draft chain (drafts days apart) + a DAW session date read from the video.
  - **A**: strong chain, no DAW date.
  - **C**: weak chain.
  - **Pending**: the chain check hasn't finished, or couldn't read dates from the video.
- So "Pending" means the automatic date check couldn't finish, not that it's waiting on someone. The DAW date is a bonus (A → A+) and never makes it worse, **but** if the video's frames can't be read (unsupported format, very dark or blurry frames, dates not on screen), the chain stays Pending.

### Fix
- Never leave a proof stuck on Pending. After the check runs, it always ends in a grade:
  - Dates found and spread out → A / A+
  - Dates found but close together → C
  - **No dates found → "Ungraded: we couldn't read dates in this video"**, with tips (show the file list with dates, or the DAW's file info screen) and a **Try another video** button.
- If the check is still running, show a progress line ("Reading dates from your video… about 30 seconds") instead of "Pending."
- Add tests for each outcome.

## 2. "pending_bitcoin" in Admin

- Yes, this is waiting on the Bitcoin blockchain. OpenTimestamps sends the proof to Bitcoin, and it's confirmed in a block **usually within a few hours (up to about a day)**.
- Today nothing goes back to check, so it stays `pending_bitcoin` forever.

### Fix
- A daily job upgrades each pending receipt from the OpenTimestamps calendar; when confirmed, status → `confirmed` with the block time, and the .ots download is replaced with the complete one.
- **What users see** on each certificate:
  - ⏳ "Being sealed on the Bitcoin blockchain. This usually takes a few hours and can take up to a day. Your certificate is valid now; we'll add the Bitcoin seal automatically."
  - ✅ "Sealed on Bitcoin, block #…, on Oct 22, 2026."
- Admin shows the same plain labels instead of `pending_bitcoin`.
- The daily job runs with the trial-reminders cron (moves with hosting to Cloudflare).

## 3. Admin: certificates organized and consolidated

- One row per **user**, collapsed by default: name, number of certificates, packages bought.
- Expand → grouped by **song**, each song showing its certificates (newest first) with grade and Bitcoin status chips.
- Filters (specific ones first, All last): Sealed · Being sealed · Ungraded · All. Search by user or song.

Files: `src/lib/draft-chain.ts`, `src/components/AIProtectionHub.tsx`, `src/lib/ots.functions.ts` (upgrade call), new cron route, admin certificates view in `src/routes/admin.tsx`. Migration: `blockchain_confirmed_at`, `blockchain_block` columns (additive).
