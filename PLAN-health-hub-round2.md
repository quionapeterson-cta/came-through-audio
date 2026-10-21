# PLAN — Royalty Health Hub round 2: consolidated checklist, grouped sidebar, agency pie charts · v1

Status: **awaiting approval.**
Source: founder testing notes, 2026-10-21. Follows PLAN-health-hub-feedback.md (built 2026-10-20).

---

1. **Song Health Checklist consolidated:** related steps merged so there are fewer, clearer sections. **Sections 1, 2 and 3 each get their own dropdown** with a summary line when closed (✓ done / ⚠️ 2 to fix).
2. **Sidebar song list grouped:** dropdowns for **Singles · EPs · Albums** (then Other), each with its song count.
3. **Remove the two red boxes** from the Royalty Health check. Their text moves to the FAQ (`/docs`) and, if you want, a short version on the homepage.
4. **New section: "How each agency pays you"**, one card per agency (ASCAP, BMI, SoundExchange, The MLC, and more later):
   - A **pie chart** of how that agency splits the money (e.g. performance royalties: 50% writer share / 50% publisher share; SoundExchange: 50% featured artist, 45% label/rights owner, 5% non-featured musicians and vocalists; MLC mechanicals: song owners by their shares).
   - Below it, the **fields that agency needs to register a song**, in plain words, with ✓ when the user's song already has them.
   - Brand colors on the charts (black, white, cobalt; no gold). Every figure checked against each agency's official site before it ships, with the source linked.

Files: Royalty Health Hub components, sidebar list, `src/lib/docs.ts` (FAQ text), homepage (optional), new agency-chart component.
