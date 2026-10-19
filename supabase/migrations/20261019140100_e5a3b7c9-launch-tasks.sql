-- Marketing & Sales Task Bank: the Founding 100 launch plan and the testimonial gift program (Oct 2026).
INSERT INTO public.department_tasks (department, title, status, created_by, body)
SELECT 'marketing_sales', 'Launch: Founding 100 (free year of Catalog Plus, then a lifetime offer)', 'planned', NULL, $plan$
THE OFFER
- The first 100 people who create a free account get Catalog Plus free for their first year ("Founding Members").
- Around month 10, Founding Members who actually used it get a one-time Lifetime Catalog Plus offer.
- Suggested lifetime price: $69 one time (about 2.8 years of Plus). Test $59 vs $79 if the list is big enough. Never free: a price keeps it valued and covers ongoing storage.
- "Active" means all of: catalog profile complete, at least 5 songs embedded, and logged in during at least 6 different months.

HOW EACH MILESTONE WORKS
Every milestone has one owner, a target date, a clear "done when", and what has to finish before it can start. Move it to In Progress when work starts and Done only when the "done when" is true.

MILESTONE 1: Lock the offer (week 1)
Owner: Founder + Marketing lead
- Confirm Founding 100 terms, the lifetime price and the "active" definition.
- Write the terms page: what happens after year one (drops to Free unless they subscribe or buy lifetime), one account per person.
Done when: terms are written and approved by the founder.

MILESTONE 2: Build it (weeks 2–3). Needs Milestone 1.
Owner: Product
- Founding counter: the first 100 confirmed free accounts get one year of Plus automatically, granted from a verified server record (never the browser).
- Fraud guard: confirmed email required, no throwaway inboxes, one Founding spot per network, staff can revoke.
- "Founding Member" profile badge (CTA design, not Gold or Platinum).
- Lifetime Catalog Plus as a one-time Paddle price, only offered to eligible founders.
- Activity score on each account so "active" is measured, not guessed.
Done when: the whole flow passes in test mode, including spot 101 being refused.

MILESTONE 3: Get the story ready (week 3). Needs Milestone 1.
Owner: Marketing
- Homepage banner: "Founding 100: X spots left" (live count).
- Email sequence: welcome (day 0), first-embed tips (day 3), catalog check-in (day 30), "you're halfway" (month 6), lifetime offer (month 10), last call (month 11).
- Testimonials with signed releases (see the Testimonial gift program task).
- 10 ready-to-post share cards and captions.
Done when: banner, all six emails and 10 posts are approved and scheduled.

MILESTONE 4: Launch (week 4). Needs Milestones 2 and 3.
Owner: Marketing lead
- Open signups, announce on every channel, ask testimonial givers to share.
- Check signups, spots left and fraud flags every day.
Done when: all 100 spots are claimed, or 30 days pass (then decide: extend, or open Founding 250).

MILESTONE 5: Keep founders active (months 1–9). Needs Milestone 4.
Owner: Support + Marketing
- Monthly tip email and an in-app nudge for anyone who hasn't embedded in 30 days.
- Track the activity score; personally reach out to founders falling behind at month 3.
Done when: at least 60% of founders meet "active" by month 9.

MILESTONE 6: Lifetime offer (months 10–11). Needs Milestone 5.
Owner: Marketing lead + Finance
- Email active founders the lifetime offer with a 30-day window; inactive founders get a 20%-off first year of Plus instead.
Done when: the window closes and results are recorded.

MILESTONE 7: Wrap up and learn (month 12). Needs Milestone 6.
Owner: Founder + Finance
- Remind non-lifetime founders 30 and 7 days before their free year ends.
- Record: lifetime buyers, paid renewals, revenue, and cost per founder.
Done when: a one-page results summary is in the Task Bank and the next promotion is chosen.

RISKS TO WATCH
- Spot farming (fake accounts): fraud guard plus a manual review of the last 20 spots.
- Lifetime members cost storage forever: lifetime covers Plus features with the standard storage allowance.
- Founders who never come back: the Milestone 5 nudges, and a clear "your free year ends" notice.
$plan$
WHERE NOT EXISTS (SELECT 1 FROM public.department_tasks WHERE title LIKE 'Launch: Founding 100%');

INSERT INTO public.department_tasks (department, title, status, created_by, body)
SELECT 'marketing_sales', 'Testimonial gift program: free year of Catalog Plus for signed releases', 'idea', NULL, $plan$
GOAL
Collect real testimonials (written, photo and video) and thank each person with one free year of Catalog Plus.

STEPS
1. Pick the people and confirm they're 18+ (under 18 needs a parent or guardian to sign too).
2. In Contracts & Blueprints, use "Photo, Video & Testimonial Release". Fill in their approved testimonial, "What they receive: One year of Catalog Plus at no cost", and how they'll be credited.
3. Add yourself (Came Through Audio, LLC) as Company and them as Participant, then lock and send for signature.
4. When it shows Fully signed, download the signed PDF for the records.
5. Grant the free year (a staff gift grant, logged with a note that links to the signed release).
6. Use the material: homepage testimonials, share cards, launch emails.

DONE WHEN
Every published testimonial has a fully signed release in the Signed Vault.
$plan$
WHERE NOT EXISTS (SELECT 1 FROM public.department_tasks WHERE title LIKE 'Testimonial gift program%');
