CREATE TABLE IF NOT EXISTS public.department_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  department text NOT NULL CHECK (department IN ('registration','royalty_accounts','finance','branding','marketing_sales','support','hr')),
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  body text NOT NULL DEFAULT '' CHECK (char_length(body) <= 20000),
  status text NOT NULL DEFAULT 'idea' CHECK (status IN ('idea','planned','in_progress','done')),
  created_by uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS department_tasks_department ON public.department_tasks (department, status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.department_tasks TO authenticated;
GRANT ALL ON public.department_tasks TO service_role;
ALTER TABLE public.department_tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Department staff manage their tasks" ON public.department_tasks;
CREATE POLICY "Department staff manage their tasks" ON public.department_tasks FOR ALL TO authenticated
  USING (public.in_department(auth.uid(), department))
  WITH CHECK (public.in_department(auth.uid(), department));

INSERT INTO public.department_tasks (department, title, status, created_by, body)
SELECT 'marketing_sales', 'Sponsored badge program: music companies sponsor CTA badges', 'idea', NULL, $plan$
GOAL
Music companies sponsor CTA badges. Musicians unlock discount codes and perks, CTA earns sponsorship revenue, and sponsors reach independent artists in a way that feels like a reward, not an ad.

WHY NOW
We retired the MPC producer badge because MPC is a trademark. Instead of using brand names without permission, we invite brands to license their name onto badges officially.

1. TRADEMARK RULE
Never use a company's name, product name or logo in a badge without a signed co-branding license. Default badges stay generic (for example the laptop and beat box producer badge).

2. BADGE FORMATS
- Presented-by profile badges: for example a Producer badge co-designed with a beat machine or DAW maker.
- Sponsored achievements: hitting a milestone (first 10 embeds, first split sheet, first signed contract) unlocks the sponsor's perk.
- Limited-time challenge badges tied to a sponsor's product launch.

3. PERKS
Unique single-use discount codes per user (preferred, because they're trackable) or a shared code, plus free trials, sample packs and contest entries. Every perk has an expiry date and redemption tracking.

4. GUARDRAILS
- Sponsored badges never use Gold or Platinum. Those are reserved for CTA prestige awards.
- Sponsors get aggregate numbers only. They never receive names, emails, PRO/IPI or split data, unless a user opts in.
- Every sponsored badge shows a visible "Sponsored" label (FTC disclosure).

5. TARGET SPONSOR CATEGORIES
Beat machines and controllers, DAWs and plugins, microphones and interfaces, headphones and studio monitors, sample libraries, distributors, mastering services.

6. PRICING MODELS TO TEST
- A flat fee per badge per quarter.
- A cost per redeemed code.
- A hybrid with a minimum guarantee.

7. PHASES
0. Research: list 20 target companies and draft a one-page pitch with user stats.
1. Pitch kit: badge mock-ups, the audience profile, and a perk menu.
2. Pilot: one sponsor and one badge, for 90 days, measuring unlocks, redemptions and conversion.
3. Productize: sponsor and perk-code tables, a sponsor report, and an in-app perk wallet.

8. SUCCESS METRICS
Badge unlock rate, code redemption rate, sponsor renewal, and upgrades from users who earned a sponsored badge.

9. LEGAL CHECKLIST
Co-branding license, data-sharing terms, disclosure wording, and an expiry/refund policy for codes.
$plan$
WHERE NOT EXISTS (SELECT 1 FROM public.department_tasks WHERE title LIKE 'Sponsored badge program%');

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

-- Badge round 2
ALTER TABLE public.user_badges ADD COLUMN IF NOT EXISTS log jsonb NOT NULL DEFAULT '[]'::jsonb;
UPDATE public.user_badges SET log = jsonb_build_array(jsonb_build_object('at', earned_at)) WHERE log = '[]'::jsonb;

CREATE TABLE IF NOT EXISTS public.badge_drops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  note text NOT NULL CHECK (char_length(note) BETWEEN 1 AND 500),
  created_by uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.badge_drops TO authenticated;
GRANT ALL ON public.badge_drops TO service_role;
ALTER TABLE public.badge_drops ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Badge staff read badge drops" ON public.badge_drops;
CREATE POLICY "Badge staff read badge drops" ON public.badge_drops FOR SELECT TO authenticated
  USING (public.can_manage_badges(auth.uid()));
DROP POLICY IF EXISTS "Badge staff log badge drops" ON public.badge_drops;
CREATE POLICY "Badge staff log badge drops" ON public.badge_drops FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_badges(auth.uid()) AND created_by = auth.uid());

-- New departments
ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS user_roles_departments_valid;
ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_departments_valid CHECK (
  departments <@ ARRAY['registration','royalty_accounts','finance','branding','marketing_sales','support','hr','ai','marketing','software','security']::text[]
);
UPDATE public.user_roles SET departments = array_append(departments, 'marketing')
WHERE 'marketing_sales' = ANY(departments) AND NOT 'marketing' = ANY(departments);

ALTER TABLE public.department_tasks DROP CONSTRAINT IF EXISTS department_tasks_department_check;
ALTER TABLE public.department_tasks ADD CONSTRAINT department_tasks_department_check CHECK (
  department IN ('registration','royalty_accounts','finance','branding','marketing_sales','support','hr','ai','marketing','software','security')
);

CREATE OR REPLACE FUNCTION public.can_manage_badges(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.in_department(_user_id, 'branding') OR public.in_department(_user_id, 'marketing') OR public.in_department(_user_id, 'support')
$$;
REVOKE ALL ON FUNCTION public.can_manage_badges(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_manage_badges(uuid) TO authenticated, service_role;

-- Support badge grants
CREATE TABLE IF NOT EXISTS public.badge_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  badge_id text NOT NULL CHECK (char_length(badge_id) BETWEEN 1 AND 80),
  ticket_id uuid REFERENCES public.support_tickets(id) ON DELETE SET NULL,
  reason text NOT NULL CHECK (char_length(reason) BETWEEN 3 AND 500),
  granted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS badge_grants_user ON public.badge_grants (user_id);
GRANT SELECT ON public.badge_grants TO authenticated;
GRANT ALL ON public.badge_grants TO service_role;
ALTER TABLE public.badge_grants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Support reads badge grants" ON public.badge_grants;
CREATE POLICY "Support reads badge grants" ON public.badge_grants FOR SELECT TO authenticated
  USING (public.in_department(auth.uid(), 'support'));

CREATE OR REPLACE FUNCTION public.user_id_by_email(_email text)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth AS $$
  SELECT id FROM auth.users WHERE lower(email) = lower(trim(_email)) LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.user_id_by_email(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.user_id_by_email(text) TO service_role;

UPDATE public.department_tasks SET department = 'marketing' WHERE department = 'marketing_sales';

INSERT INTO public.department_tasks (department, title, status, created_by, body)
SELECT v.department, v.title, v.status, NULL, v.body
FROM (VALUES
  ('registration', 'Live Assist: video help sessions for registrations', 'planned', $t$
Customers book a short live video session (Daily.co) with Registration staff to register songs together.
- Room created per booking; only the customer and the assigned staff member can join.
- Staff see the customer's Registration Ready songs and readiness warnings during the call.
- Recording off by default; a written summary is saved to the ticket.
$t$),
  ('registration', 'Neighbouring rights: partner or administrator option (undecided)', 'idea', $t$
Option E from the neighbouring-rights plan: work with a neighbouring-rights administrator so users can collect
international airplay without registering with each society themselves. Decide partner vs. in-house first.
$t$),
  ('ai', 'Set up the AI department', 'planned', $t$
- Take ownership of the AI Protection tab (certificates, timestamps) with Registration.
- Scorecard: certificates processed, timestamp confirmations with no errors, upload-to-certificate turnaround.
- Write the SOP for handling a failed or pending Bitcoin timestamp.
$t$),
  ('software', 'Music role at paid onboarding', 'planned', $t$
Users pick a music role (Artist · Singer/Songwriter · Composer/Producer · Live Musician → instruments ·
Author/Lyricist · Label Executive → role). It only changes what they see: default badge collections and share-card captions.
Open question: how bands sign up.
$t$),
  ('software', 'WAV and FLAC embedding', 'idea', $t$
The uploader embeds MP3 only. WAV embedding unlocks the WAV pricing tiers and Master Crowned's repeat for full albums of WAV masters.
$t$),
  ('software', 'Accessibility: WCAG 2.2 AA pass', 'planned', $t$
Contrast, keyboard use, screen-reader labels, reduced motion and captions across the site.
$t$),
  ('software', 'Installable app (PWA), then app stores', 'idea', $t$
Installable web app first (free, one codebase); App Store / Google Play wrapper later.
$t$),
  ('security', 'Re-run the Lovable security scan', 'planned', $t$
Re-run the scan. Mark the 8 helper-function "authenticated can execute" warnings as ignored (row security needs them); do not revoke them.
$t$),
  ('security', 'Quarterly access review and staff 2FA', 'planned', $t$
Every quarter: review who holds each staff role and department, remove anyone who left, confirm 2FA on staff accounts and company inboxes.
$t$),
  ('support', 'SOP: unlocking a badge for a user', 'planned', $t$
When a user reports a badge that didn't unlock: check their records first (is the song Ready, the split sheet fully signed…).
If the app should have awarded it, open their ticket → Unlock a badge, pick the badge and write the reason. Every unlock is logged.
Never unlock badges as gifts or favors.
$t$),
  ('finance', 'Finance Center updates', 'planned', $t$
Add free vendors (Gmail inboxes, email routing, cron-job.org), a cron heartbeat tile for the trial-reminder emails,
and an account-ownership register (owner, recovery email, 2FA; never passwords).
Finance sees revenue, fees and expenses; profit, projections and payroll stay super admin only.
$t$),
  ('finance', 'Bonus pool calculator', 'idea', $t$
Quarter close → pool calculator → founder review and approval → payroll CSV. The pool starts only after the company has earned
$1,000,000 in net profit after taxes and all expenses, with profits trending up. Formula in the staff recognition plan.
$t$),
  ('hr', 'Staff recognition: badges, appreciation and bonuses', 'planned', $t$
Department scorecards, staff badges geared to thanks (welcome, certified, quality, team, peer kudos, tenure, Founder's Crown),
Win of the Week, quarterly Came Through Award, learning budget, yearly anniversary party, and the profit-based bonus pool.
$t$),
  ('hr', 'Training area (/admin/training)', 'planned', $t$
Level 1 company core for everyone, Level 2 department tracks, Level 3 worldwide collection-society library with quizzes that
earn certification badges. 30-60-90 day plan for new hires.
$t$),
  ('hr', 'Worldwide hiring: regional registration experts', 'idea', $t$
Lawyer-reviewed customer authorisation first. Hire part-time contractors in the top two regions once about 50 songs a month
wait there, through an employer-of-record platform, with a paid test task.
$t$),
  ('hr', 'Company contracts tab and launch legal set', 'planned', $t$
Super-admin Contracts tab for company agreements (staff, contractors, partners) with e-signature evidence, plus the launch legal set.
Every pre-launch agreement includes the NDA clause.
$t$),
  ('marketing', 'Artist ad-content campaign (lifetime membership, up to 5 artists)', 'idea', $t$
Up to 5 artists create ad content for Came Through Audio in exchange for a lifetime membership, under a signed agreement.
$t$),
  ('marketing', 'Phone check: share cards open a new post or story', 'planned', $t$
On iPhone and Android, check that badge and catalog share cards open a new post or story in each social app.
$t$),
  ('branding', 'Badge art still owed', 'planned', $t$
Unbreakable 2–5 year chains · Full EP · Full Album · health-check art for Checkup Champ · cobalt first-credit art for
steel pan, ukulele, banjo, clarinet, trombone, xylophone, cello and harp. Then the staff badge set.
$t$)
) AS v(department, title, status, body)
WHERE NOT EXISTS (SELECT 1 FROM public.department_tasks t WHERE t.title = v.title);

-- Company plans
CREATE TABLE IF NOT EXISTS public.company_plans (
  slug text PRIMARY KEY CHECK (char_length(slug) BETWEEN 1 AND 80),
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  status text NOT NULL DEFAULT '',
  body text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.company_plans TO authenticated;
GRANT ALL ON public.company_plans TO service_role;
ALTER TABLE public.company_plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Super admins read plans" ON public.company_plans;
CREATE POLICY "Super admins read plans" ON public.company_plans FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

INSERT INTO public.department_tasks (department, title, status, created_by, body)
SELECT v.department, v.title, 'planned', NULL, v.body
FROM (VALUES
  ('marketing', 'Homepage testimonials editor (with Branding)', $t$
Marketing and Branding update homepage testimonials from Admin: name, title, location, service, quote and photo.
- The brand photo filter (black-and-white, cobalt tint, dark fade) is applied automatically and can't be changed or turned off.
- Quotes stay in the client's own words; only trims marked with … are allowed.
- A signed Photo, Video & Testimonial Release is required before a testimonial can be published.
Full plan: Admin → Plans → Homepage testimonials editor.
$t$),
  ('branding', 'Homepage testimonials editor (with Marketing)', $t$
Branding checks each new testimonial photo's crop and focus point. The brand filter is applied automatically and locked.
Full plan: Admin → Plans → Homepage testimonials editor.
$t$)
) AS v(department, title, body)
WHERE NOT EXISTS (SELECT 1 FROM public.department_tasks t WHERE t.title = v.title);