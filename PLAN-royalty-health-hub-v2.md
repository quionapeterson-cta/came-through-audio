# PLAN — Royalty Health Hub v2: Royalty Health Doctor, Streaming Fast-Track & Upgrade Cards · v1

Status: **LOCKED by founder 2026-11-01. Not built yet.** No shortcuts or workarounds: every step below is built as written.
Source: founder decisions in chat, 2026-10-30 → 2026-11-01. Replaces the partial flow in `src/components/DoctorsOffice.tsx` and supersedes the dropdown layout in PLAN-health-hub-feedback.md / PLAN-royalty-health-report.md where they conflict.
Already built toward this plan: BMI CSV parser fix (81/81 works from `CatalogExport_550222351.csv`, `src/lib/agency-lists.test.ts`), "Patient Intake Form" rename + instruction, report scopes renamed "Single Track Checkup" / "Catalog Examination", first draft of patient file + four scan vitals.

---

## 0. Global naming (use everywhere, exactly)

| Use | Never use |
|---|---|
| Royalty Health Hub | Royalty Health Check page, Health Center |
| Royalty Health Doctor | Music Business Medical Center, Doctor's Office (as a title) |
| Royalty Health Report / **Past Royalty Health Reports** | My Reports, Saved Reports |
| **Front Desk** | Reception, Patient Chart |
| **Waiting Area** | Why This Matters (as a section title) |
| **Royalty Care Plan** | Patient Care Plan, Treatment Plan |
| Single Track Checkup / Catalog Examination | Outside song, external song |
| Patient Intake Form | Royalty Inspector |
| Agency Examination | Agency Upload |
| Official Master (button) / Sovereign Backup (subtext) | Sovereign Master (button) |

"Patient chart" is **not** a concept in this product. Do not add it.

---

## 1. Hub layout

Only **three** things live on the Hub:

```text
              +--------------------------------------+
              |        Royalty Health Doctor         |   (centered)
              |  <existing subheading, unchanged>    |
              |             [ Check In ]             |
              +--------------------------------------+

+----------------------------+   +----------------------------+
| Front Desk                 |   | Waiting Area               |
|  • Past Royalty Health     |   |  Pamphlet rack (5 organs)  |
|    Reports (view / PDF)    |   |                            |
|  • Continue Song Checklist |   |                            |
+----------------------------+   +----------------------------+
```

- Doctor check-in card is **centered**. Primary action: **Check In** (they showed up to their appointment).
- Empty state (no reports yet): **"See the Royalty Health Doctor to file your first diagnostic report."**
- **Removed** from the Hub: standalone Royalty Inspector dropdown, "Confirm with your agency" dropdown, standalone Song Checklist accordion. Their work moves *inside* the visit (§2).
- **Front Desk** = Past Royalty Health Reports (open, download PDF) + **Continue Song Checklist** (the existing `HealthChecklist.tsx`, kept as is: Attention / Later / Healthy groups, agency-specific steps).
- **Waiting Area** = doctor's-office style rack cards (pamphlets), one per organ:

| Pamphlet | Organ | Healthy reading | Unhealthy reading | Royalty meaning |
|---|---|---|---|---|
| Heart | Performance (PRO) | Registered with PRO, writers + splits on file | Not registered / missing writers | Performance royalties uncollected |
| Lungs | Publishing | Publisher (or Self-published) on file, publisher shares = 100% | No publisher, shares off | Publisher share unclaimed |
| Kidneys | Mechanicals (The MLC) | Work + ISRC matched at The MLC | Unmatched / missing ISRC | Mechanical royalties held / unmatched |
| Brain / Nervous System | Metadata & identifiers | ISRC, UPC, IPI, legal names complete | Missing / mismatched IDs | Payments can't find the right person |
| Spine | Neighbouring rights (SoundExchange) | Recording registered, master share set | Not registered | Digital performance (recording) royalties uncollected |

Each pamphlet: title, "What a healthy reading looks like", "What a bad reading looks like", "What it means in your Royalty Health Report".

---

## 2. The visit — one guided sequence (4 steps, in order)

A step tracker shows: **1 Patient Check-in → 2 Intake & Records → 3 Clinical Scan → 4 Diagnosis & Treatment.** A step unlocks only after the previous one is complete.

### Step 1 — Patient Check-in
- First visit: **patient file** with default legal name, PRO, IPI, publisher status (publisher name or Self-published).
- Saved in **local intake storage** (browser) so Free users never retype it; paid users also fill blanks from their profile via `withProfileFilled` (never overwriting song values).
- Each field has a plain-language tooltip. PRO list = worldwide list. IPI note: "Your PRO gives you an IPI when you register."
- Returning visit: "Welcome back" + file summary + Edit.

### Step 2 — Intake & Records
At the top, the locked **Doctor's Recommendation**:

> **Doctor's Recommendation:**
> *For our strongest diagnosis, provide both your streaming profile and your official agency exports. Streaming verifies what is actively released and generating plays, while agency records verify what your collection societies actually have on file—cross-referencing both catches every uncollected dollar.*

Three intake options (any combination allowed):

`[ 🌐 Streaming Profile ]   [ 📑 Agency Examination ]   [ 🎵 Single Track Checkup ]`

**A. Streaming Profile (Streaming Fast-Track)** — see §4.

**B. Agency Examination** — subheading **Full Registered Catalog Examination**.
Copy: *"For songwriters and composers whose registered works may not be on streaming. Upload your official exports from BMI, ASCAP, SESAC, The MLC or SoundExchange to examine your full registered body of work."*
- Five uploaders, each accepts **CSV, XLSX, PDF**, each with a short "How to get this file" instruction under it.
- **All works import** into the Health Checklist — including Free accounts — and every song is diagnosed. No "add them in My Catalog first" requirement (this was the 81-song bug).

**C. Single Track Checkup** — the **Patient Intake Form**. Instruction (exact):
*"If previously registered, enter exactly as filed with your agency; otherwise, fill in as much as known for an accurate diagnosis."*

**Combining sources:** streaming + several agency files merge into **one entry per song** (matched by ISRC, then title + writers). Mismatches become findings, e.g. a released recording with no PRO registration, or a registered work with no public recording.

### Step 3 — Clinical Scan (active, sequential vitals)
Each line animates in order, then checks off. The scan genuinely runs the checks (not a fake timer):

1. 🫀 Checking pulse and song vitals…
2. 📋 Cross-referencing PRO performance splits…
3. 💿 Verifying streaming distribution & SoundExchange…
4. 🩺 Formulating diagnosis…

### Step 4 — Diagnosis & Treatment
- Headline format (locked): **`Diagnosis: [Organ Condition] : [Royalty Impact]`**
  e.g. *Diagnosis: Blockage in the left heart artery : Performance royalties uncollected.*
- Clickable organ report (existing Royalty Health Report body).
- **Royalty Care Plan**: issue-specific self-fix prescriptions, links to the field/agency, completion tracking.
- **Song Checklist** integrated here (same `HealthChecklist.tsx`), and continuable later from Front Desk.
- **Book expert registration assistance** action (uses `registrationCheck`, never the export gate).
- Report saved to **Past Royalty Health Reports**.
- Then the upgrade cards (Free) or catalog prefill (paid) — §3 / §4.

All readiness/split logic comes from the one shared readiness module. Never re-implement it here.

---

## 3. Post-diagnosis upgrade cards (Free accounts)

Free accounts get the full Doctor, full report and full Royalty Care Plan. Cataloging starts at Catalog Plus, so after diagnosis they see **three cards side by side, prices ascending left → right**. Wording is locked:

| Catalog Plus — $24.99/yr | Catalog & Collaborate — $44.99/yr | Catalog Management — $89.99/yr |
|---|---|---|
| **Don't Leave Your Music Unprotected** | **Settle Your Splits & Bulk Register Your Catalog with 1-Click Exports** | **Customize Contracts, Collect E-Signatures & Unlock Business Blueprints** |
| *Streaming links can be taken down, but your own master vault stays yours. Lock in your verified credits and download official tagged masters anytime.* | *Don't let uncollected royalties slip through the cracks. Collect legally binding split sheets and bulk register your catalog with 1-click agency exports.* | *Don't risk your ownership on handshakes. Customize official contract templates for your exact deal points, send for legally binding e-signatures, and unlock step-by-step business blueprints and artist cheat sheets.* |
| `[ Save to My Catalog & Embed Masters — $24.99/yr ]` | `[ Settle Splits & Bulk Register with 1-Click Exports — $44.99/yr ]` | `[ Customize Contracts & Collect E-Signatures — $89.99/yr ]` |
| *Includes unlimited MP3 embedding and full catalog storage for 1 full year.* | *Includes everything in Plus, split sheets, 1-click PRO exports & more.* | *Includes everything in Collaborate, WAV embedding, blueprints & more.* |

Rules:
- Say **PDF catalog exports** — never "branded" (avoids confusion with Brand Kits).
- Management uses **Customize** — not "generate" (the standalone Contract Generator is $3.99) and not "access"/"draft".
- No assumptions about which tier artists pick; all three equally visible. No dropdown, no drawer, no Free column, no big comparison grid.
- Buttons go to the existing Stripe checkout for that tier (prices from `src/lib/plans.ts`).

---

## 4. Streaming Fast-Track (NOTE — how it works)

**Why:** automatic searches of agency registries were found not to be allowed. Instead of scraping registries, we use what the artist gives us (streaming links + their own agency exports). This gives instant gratification: catalog entries arrive prefilled.

**How it works:**
1. Artist pastes a streaming artist/album link (Spotify / Apple Music) in Intake & Records.
2. We read public release metadata from permitted sources (official catalog/search APIs): titles, release, artist/featured artists, ISRC, UPC, release date, album cover.
3. Agency exports the artist uploads add the composition side: legal names, PRO, IPI, splits, publisher.
4. Both merge into one entry per song → diagnosed in the scan.
5. **Paid tiers:** entries **prefill My Catalog** automatically. Artist chooses **Upload audio now** or **Add Audio Later**.
6. With audio: **`[ Embed Verified Metadata & Download Official Master ]`**
   Subtext: *"Your Sovereign Backup — an exact, distributor-proof copy kept in your own vault with permanent metadata, ready whenever a platform or distributor takes your music down."*
7. Album covers attach to the catalog entry and are downloadable with the artist's backup **only where the source's terms allow it** (confirm before build; never promise otherwise).
8. **Free accounts:** get the diagnosis; saving to catalog / embedding is behind the §3 cards.

**Invariants:**
- Track title written to `TIT2` **exactly as entered/imported** — no "(Master)", "[Official Master]", no casing/punctuation changes.
- Embeds never carry publisher, ℗ line, language, PRO, IPI or splits (catalog-only).
- Browser-safe local download (`browser-id3-writer`); never overwrite existing song values.
- Mission: artists keep their catalog in their own control even if music is taken down.

**Remove global wording:** find and replace every place on the site that says registries/databases "don't allow automatic searches" (or "we can't search the databases"). Replace with positive copy pointing to Streaming Profile + Agency Examination. Do not promise automatic registry lookups anywhere.

---

## 5. Affected files (expected)

- `src/components/RoyaltyHealthCheck.tsx` — Hub layout (Doctor centered, Front Desk, Waiting Area; remove old dropdowns)
- `src/components/DoctorsOffice.tsx` — full 4-step visit
- `src/components/RoyaltyInspector.tsx` — Patient Intake Form (Single Track Checkup)
- `src/components/AgencyLists.tsx`, `src/lib/agency-lists.ts` — five-agency CSV/XLSX/PDF import into checklist
- `src/components/HealthChecklist.tsx` — reused in step 4 and Front Desk (unchanged behavior)
- `src/components/HealthReport.tsx`, `src/lib/royalty-checkup.ts`, `src/lib/health-reports.ts` — diagnosis format, saved reports
- New: Waiting Area pamphlets, upgrade cards, streaming intake (server function for streaming metadata)
- Catalog prefill + embed: `src/lib/artist-profile.ts`, metadata writer utility, `MetadataUploader.tsx`
- Copy sweep for "can't search registries" wording (site-wide)

Writer fields / readiness / export templates are touched only through the shared module; explain before editing per project rules.

## 6. Done means
- Free account: Check In → upload BMI CSV → 81 songs in checklist → scan → diagnosis lines in locked format → Royalty Care Plan → three upgrade cards.
- Paid account: same + streaming link prefills My Catalog → add audio → embedded MP3 with verbatim title.
- Verified in the browser end to end before calling it complete.
