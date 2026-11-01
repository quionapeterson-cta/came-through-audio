# PLAN — Contracts, Blueprints & Cheat Sheets: three separate libraries · v1

Status: **LOCKED by founder 2026-11-01. Not built yet.** No shortcuts or workarounds.
Source: founder decisions in chat, 2026-10-31 → 2026-11-01. Related: PLAN-contracts-simplify.md, PLAN-royalty-health-hub-v2.md §3.

---

## 1. Three separate terms (global, never mixed)

| Term | What it is | Examples |
|---|---|---|
| **Contracts** | Legal agreements between parties. Customize deal points, send for legally binding e-signatures, store in the signed vault. | Producer Agreement, Work-for-Hire, Split Agreement, Featured Artist License |
| **Blueprints** | In-depth how-to manuals for running a music business. | Record Label Blueprint, Running a Studio Blueprint, Publishing Blueprint, Royalties Blueprint |
| **Cheat Sheets** | Quick guides for artists. | Studio Etiquette, Recording Professional Rap Vocals, Pro Pop Vocals, Home Recording |

- Never call a contract a "blueprint". Call the agreement documents **contract templates**.
- Blueprints and Cheat Sheets are **not** contracts and don't get signing.

## 2. Problem found
Founder uploaded blueprints and checklists, but the Contracts tab only shows contracts. Earlier code put them in a "Blueprints" sub-tab (Management-only) that isn't visible as expected.

## 3. Fix
- Contracts area shows three clear sections/tabs in this order: **Contracts · Blueprints · Cheat Sheets**.
- Every uploaded blueprint and checklist/cheat sheet is found, sorted into the right library, and visible (none lost or deleted).
- Access: Contracts templates + e-signatures + Blueprints + Cheat Sheets unlock with **Catalog Management ($89.99/yr)**. The **Contract Generator** stays a separate **$3.99** one-off unlock (or included in Management as today).
- Wording: Management copy uses **"Customize"** for contracts — never "generate" (confuses with $3.99 generator), "access" or "draft".

## 4. Locked Management upgrade copy
- **Title:** Customize Contracts, Collect E-Signatures & Unlock Business Blueprints
- **Description:** *Don't risk your ownership on handshakes. Customize official contract templates for your exact deal points, send for legally binding e-signatures, and unlock step-by-step business blueprints and artist cheat sheets.*
- **Button:** `[ Customize Contracts & Collect E-Signatures — $89.99/yr ]`
- **Trust line:** *Includes everything in Collaborate, WAV embedding, blueprints & more.*

## 5. Affected files (expected)
- `src/components/Contracts.tsx` — three sections
- `src/lib/contract-blueprints.ts` — keep contract definitions; split out blueprint / cheat-sheet library data
- Upgrade/pricing copy wherever Management is described

## 6. Done means
Founder signs in → Contracts area → sees Contracts, Blueprints and Cheat Sheets each with their uploaded documents; Management copy matches §4.
