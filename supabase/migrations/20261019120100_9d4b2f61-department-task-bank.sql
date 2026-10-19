-- Department Task Bank: ideas and plans each staff department keeps for later. New table only.
-- Access follows public.in_department(), so each department (and super admins) sees only its own tasks.
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

ALTER TABLE public.department_tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Department staff manage their tasks" ON public.department_tasks;
CREATE POLICY "Department staff manage their tasks" ON public.department_tasks FOR ALL TO authenticated
  USING (public.in_department(auth.uid(), department))
  WITH CHECK (public.in_department(auth.uid(), department));

-- First Marketing & Sales entry: the sponsored badge program (from the MPC badge retirement, Oct 2026).
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
