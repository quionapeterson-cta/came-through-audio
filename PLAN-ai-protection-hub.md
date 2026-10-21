# PLAN — AI Protection Hub fix
Status: **Built 2026-10-21** (approved; founder runs migration 20261022140000 in the Supabase SQL editor)

## Bugs found in the current hub
1. **Song not linked.** The hub never saves which catalog song a certificate belongs to (`catalog_id` is left empty), and you can pay with no song picked.
2. **EP / Album only unlock one certificate.** The database counts one certificate per purchase, so a $9.99 EP buys 1 certificate instead of 6 (Album 12, Album+ 20).
3. **Hub stays "active" after you use your certificate.** It checks "has this person ever bought one", not "do they have one left", so a second try fails at the database.
4. **Big videos.** Videos over 50MB (our storage limit) are shrunk in the browser while they play. If the tab is hidden or the phone sleeps, the shrink stalls with no progress shown, which is why the 76MB video failed at first.
5. **Videos under 15 seconds are rejected** with a brief pop-up, and Scan & Rate just stays dimmed with no reason given.

## New layout (top to bottom)
```
┌ AI Protection Hub ─────────────────────────────────────────┐
│ MY CERTIFICATES                                            │
│  Song A · Grade A+ · Anchored on Bitcoin · [PDF] [.ots]    │
│  Song B · Ready to protect (paid) · [Start proof →]        │
│  You have 4 of 6 certificates left (EP, bought Oct 21)     │
│  Empty state: "Certificates of Human Origin prove you made │
│  your song first. Your issued certificates live here."     │
├────────────────────────────────────────────────────────────┤
│ PROTECT A SONG                                             │
│  [☑ Song A] [☑ Song B] [☐ Song C] …  (from My Catalog)     │
│  2 songs selected → EP · up to 6 songs · $9.99             │
│  (package picked for you; can choose a bigger one)         │
│  [Lock In Protection · $9.99]                              │
│  ▸ How it works (the 3 info boxes, folded away)            │
├────────────────────────────────────────────────────────────┤
│ After paying: "Confirming payment…" → then                 │
│ "Payment received. Next: record your proof for Song A."    │
│  (page scrolls to the steps; songs auto-filled)            │
│ Step 1 · Song details (prefilled from catalog)             │
│ Step 2 · Record your proof (melody first)                  │
│ Step 3 · I attest …  ☐                                     │
│ Step 4 · Scan & Rate  — shows what's missing, e.g.         │
│     ✗ Draft History video (yours was 12s; any length 5–60s)│
│     ✓ DAW Session video   ✗ Check the attestation          │
│ Step 5 · Generate certificate                              │
└────────────────────────────────────────────────────────────┘
```
- The 3 info boxes and 4 price cards move out of the top: prices become the auto-picked package line; explainers fold into "How it works".
- Each issued certificate can be downloaded again (PDF rebuilt from the saved record; .ots receipt from the saved receipt).

## Proof videos
- Accept **5–60 seconds** (5s floor only so the date scanner has frames to read and accidental taps aren't fingerprinted).
- Over 50MB: show a progress bar ("Shrinking 42%… keep this tab open") instead of a silent wait.

## Melody emphasis (copy)
DAW Session Proof tip becomes:
> **Start with your melody.** Copyright protects melody and lyrics, not drum patterns or chord progressions, so your melody is the most important thing to prove. Solo your lead vocal or melody line first, then solo as many other tracks as you can, then play the full mix.

Draft History tip adds: "Early melody ideas (hummed voice memos, rough toplines) are your strongest drafts."

## Writer rows (touches writer fields, per AGENTS.md)
- Role dropdown labels become exactly **Author**, **Composer**, **Author/Composer** (now "Both (Author & Composer)", "Author (Lyrics)", "Composer (Music / Beat)"). **Producer** stays as a separate credit line, as in Embed.
- No schema change to writer data; nothing deleted.

## Files
- `src/components/AIProtectionHub.tsx` (layout, song picker, certificates list, steps order, missing-items checklist)
- `src/lib/proof.ts` (5s floor, package from song count, credits helper)
- `src/lib/draft-chain.ts` (shrink progress)
- `src/lib/stripe-mapping.ts` (+ test) (carry up to 20 song IDs in checkout metadata)
- `src/routes/workspace.tsx` (pass catalog songs + certificate credits)
- New migration: `can_issue_ai_certificate` counts songs per package (Single 1, EP 6, Album 12, Album+ 20) and a certificate must be for one of your own catalog songs. Run once in the Supabase SQL editor (no Lovable credits).

---
# Round 2 — founder test feedback (2026-10-21) · Status: **awaiting approval**

## 1. "Paid for 4, says 7 left"
Cause: credits count the package size, not the songs picked. 4 songs → EP, and an EP counts as 6. Plus 1 from an earlier Single = 7.
Fix: the badge shows what was paid for, by song:
```
4 songs paid · 1 protected · 3 waiting for proof
+ 2 open slots left in your EP (add any song)
```
## 2. "Protect a song" gets stuck open
Make it a real dropdown: header row with a chevron, click to open AND close. Closed by default once you have paid songs.
## 3. Price jumps to EP too early
Singles stack up to 3: 1 song $2.99 · 2 songs $5.98 · 3 songs $8.97 · 4–6 songs EP $9.99 · 7–12 Album $16.99 · 13–20 Album+ $24.99.
Checkout sends the Single price with quantity 1–3; the webhook saves `songs` so credits = quantity.
Needs one small SQL migration (founder runs it): the database credit count reads `songs` for Singles.
## 4. Big phone videos (76MB, 26s fails)
- The fingerprint (SHA-256) is taken from the ORIGINAL video on the device, so nothing needs shrinking to prove anything. (Stronger evidence too: the hash matches the file on your phone.)
- The date scan also reads the original, on the device.
- Only the backup copy we store has the 50MB storage limit. It now uploads in the background: under 50MB as-is; over 50MB we try the shrink in the background. If that fails, the certificate still issues and says "Original video kept on your device — keep this file; its fingerprint is on the certificate."
- Never blocks the user. Also accepts .m4v and phone files with no file type, by extension. Length stays 5–60 seconds.
