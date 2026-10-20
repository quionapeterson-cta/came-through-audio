-- 1. Support can unlock a badge for a user who reports a problem (founder, 2026-10-20).
--    Grants go through a server function that checks the Support department, never lets staff grant to themselves,
--    and records who, whom, which badge, the ticket and the reason here. Support and super admins read the log.
-- 2. user_id_by_email(): finds the account behind a ticket's email. Server (service role) only.
-- 3. Task Bank: Marketing tasks move from Sales (marketing_sales) to Marketing, and every planned project so far is
--    added to its department's Task Bank. Existing tasks are only moved, never changed or deleted.
-- Safe to run more than once.

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

-- Task Bank ------------------------------------------------------------------------------------------------------
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
