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
- **All works import** into the Health Checklist (all work found from Streaming Profile,PRO's, The MLC and SoundExchange Examinations populate finds into checklist (checks off what is found from the checklist making it easier for artist). — including Free accounts — and every song is diagnosed. No "add them in My Catalog first" requirement (this was the 81-song bug).

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


## 4. Streaming Fast-Track & Automated Composition Lookup  (NOTE — how it works)


**Why:** Artists want instant intake without having to dig up spreadsheets or manual exports just to get their baseline catalog started. By entering a Spotify or streaming link, Came Through Audio cross-references released master recordings against federally mandated and public musical work databases (The MLC Public Work Database, Songview, and public PRO repertoires) to retrieve both recording and composition metadata automatically—matching the seamless intake experience of tools like UMogul.

**How it works:**
1. **Intake:** Artist pastes their Spotify or streaming artist/album link in Intake & Records, along with their name.
2. **Master Side (Recording Data):** 
   - System retrieves released tracks, release titles, artist/featured artists, ISRC codes, UPC barcodes, release dates, and album cover artwork.
3. **Composition Side (Automated Work Cross-Reference):**
   - Using the retrieved ISRC, Song Title, and Artist Name, the system automatically queries public composition databases (The MLC Public Search and public PRO repertories).
   - When a matching work is found, the system automatically populates:
     - **Writer Legal Name** (exactly as registered with their PRO)
     - **PRO Affiliation** (BMI, ASCAP, SESAC, etc.)
     - **IPI / CAE Name Number**
     - **Publisher Name & Publisher IPI**
     - **ISWC** (International Standard Musical Work Code)
4. **Clinical Diagnosis at Scan:**
   - **Matched Works:** Diagnosed for complete metadata health, publisher representation, and PRO,The MLC and SoundExchange recording registration readiness.
   - **Unmatched Works (Streams with No Registration):** If a track is active on Spotify but has no matching registration in public composition registries, the Royalty Doctor immediately flags:
     *`Diagnosis: Unregistered Musical Work : Mechanical and Digital Performance Royalties Uncollected.`*
5. **Agency File Uploads (Optional Deep Examination):**
   - Artists are never required to upload agency exports just to get their names or IPI numbers.
   - Agency exports (BMI, ASCAP, The MLC, SoundExchange, SESAC) are used for deep audits: verifying exact split percentages (which public databases do not display for privacy), auditing unreleased/non-streaming works, and catching catalog discrepancies.
6. **Paid Tiers:** Entries prefill **My Catalog** automatically with both recording and composition fields filled. Artist chooses **Upload audio now** or **Add Audio Later**.(Artist are informed that their catalog has been prefilled with their data and all they need to do is upload there masters, embed and download them)>
7. **With Audio:** 
   - **`[ Embed Verified Metadata & Download Official Master ]`**
   - Subtext: *"Your Sovereign Backup — an exact, distributor-proof copy kept in your own vault with permanent metadata, ready whenever a platform or distributor takes your music down."*
8. **Free Accounts:** Receive the complete diagnosis and prescription report; saving to catalog and downloading embedded masters are unlocked via the tier cards.

**Invariants:**
- Track title written to `TIT2` **exactly as entered/imported** — no "(Master)", "[Official Master]", no casing/punctuation changes.
- Embeds never carry publisher, ℗ line, language, PRO, IPI, or splits (these remain catalog-only).
- Browser-safe local download (`browser-id3-writer`); never overwrite existing song values.
- Mission: artists keep their catalog in their own control even if music is taken down.

**Copy Rule:**
- Eliminate all copy stating registries/databases "don't allow automatic searches" or "we can't search the databases."
- Position the intake as: *"Streaming Fast-Track connects your released music to official public work registries, pulling your verified legal credits, PRO affiliation, and IPI numbers automatically."*

How UMogul Does It (Note)

Spotify itself only stores the master / recording side of the metadata (track titles, artist names, ISRCs, UPCs, release dates, and album art). Spotify does not issue or store IPI numbers or PRO publisher shares.

What Mogul does is a two-step cross-reference:

1. Step 1 (Master / Release Discovery): From your Spotify artist link, they pull your discography, track titles, and ISRC codes.
2. Step 2 (Composition Registry Match): They take your ISRC and Song Title and immediately query public composition registries—specifically The MLC Public Database (which was created under the US Music Modernization Act and is federally mandated to maintain a publicly searchable database linking ISRCs to musical works), along with Songview (the joint ASCAP/BMI public repertoire) and open music databases.
3. The Result: The MLC and PRO work records match your ISRC to the underlying musical work, which unlocks:
   - Your full legal name as registered on the work
   - Your PRO affiliation (BMI, ASCAP, SESAC, etc.)
   - Your IPI / CAE name number
   - The registered publisher name and publisher IPI
   - The ISWC (International Standard Musical Work Code)

Why the Plan Previously Separated Them

Earlier in the project, we established a rule against attempting to "scrape" private, login-walled PRO member accounts. In drafting the plan, that caution swung too far by assuming all composition data had to come from manual user CSV/PDF uploads. 

However, public work matching via The MLC public search and public repertoire data is completely permitted and industry-standard.

Here is how distribution and release status work across the system:

1. With Streaming Fast-Track (Automated)

If an artist enters their Spotify or streaming link, we do not need to ask.
Because the track is actively live on DSPs, the system automatically marks it as Delivered & Released, pulls its exact release date, ISRC, and UPC barcode, and verifies distribution instantly.
2. For Agency Uploads & Manual Entries (Single Track Checkup)

When a song comes from a PRO export or is entered by hand, it could be an unreleased track sitting in their vault. We track this through two simple fields rather than a cumbersome questionnaire:
Release Date: If the date is in the future, it is automatically treated as unreleased. If it's in the past, it's released.
"This song isn't released yet" Checkbox: For songs with no release date set, artists can simply check this box.
3. Why Knowing Distribution Status Matters (Pre-Distribution vs. Released)

We never penalize an artist for a song that hasn't come out yet:
If Released / Distributed: The Royalty Doctor runs the full exam across live streaming, SoundExchange digital performance royalties, The MLC mechanicals, and PRO performance royalties.
If Unreleased: The song does not fail its exam or get broken organs for missing streaming plays or SoundExchange registration. Instead, it seamlessly switches to the Pre-Distribution Checklist ("Ready to Distribute: 7 of 10"), ensuring splits are signed, credits are locked, and master metadata is embedded before they send the file to DistroKid, TuneCore, or CD Baby.
4. What Was Replaced

In the older prototype, there was a manual question asking "Has your distributor delivered it? (Yes / No / Not sure)". In the new Royalty Doctor flow (PLAN-royalty-health-hub-v2.md), this is retired in favor of automatic streaming detection and the simple unreleased toggle.




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
