-- 2026-11-23, founder: the HR Admin is staff too.
--
-- Four staff surfaces still asked public.is_staff (super_admin, employee and department_lead only), so the HR seat — the
-- seat that reads the Idea Box and hands everyone the Support Scripts — hit "Only staff can send submissions", saw the
-- Team Board's notices and the win feed empty, and read Free in public.user_tier because only is_staff maps to
-- management. Each predicate here only adds the HR department; every policy keeps its name, and every other clause
-- (the submitter's own row, the pause, the paid and seat ranks) is unchanged.

-- Idea Box: an HR Admin sends an idea, paperwork, a video, music, a photo or a project like any other staff member.
drop policy if exists "Staff send submissions" on public.staff_submissions;
create policy "Staff send submissions" on public.staff_submissions for insert to authenticated
  with check (
    (public.is_staff(auth.uid()) or public.in_department(auth.uid(), 'hr'))
    and submitted_by = auth.uid()
  );

-- Team Board notices and the win feed: every staff member reads them, the HR Admin included.
drop policy if exists "Staff read team notices" on public.team_notices;
create policy "Staff read team notices" on public.team_notices for select to authenticated
  using (public.is_staff(auth.uid()) or public.in_department(auth.uid(), 'hr'));

drop policy if exists "Staff read the win feed" on public.staff_wins;
create policy "Staff read the win feed" on public.staff_wins for select to authenticated
  using (public.is_staff(auth.uid()) or public.in_department(auth.uid(), 'hr'));

-- The staff plan is Catalog Management, and an HR Admin holds a staff role too: the workspace must never show the seat
-- as Free. Everything below the staff branches is the definition that shipped in 20261121163000, untouched.
create or replace function public.user_tier(_uid uuid)
returns text
language sql
stable security definer
set search_path to 'public'
as $function$
  WITH env AS (
    SELECT content->>'environment' AS e FROM site_settings WHERE id = 'payments' AND content->>'environment' IN ('live', 'sandbox')
  ), tiers AS (
    SELECT array_position(ARRAY['free', 'plus', 'collaborate', 'management'], coalesce((
      SELECT f.granted_tier FROM founding_upgrades f
      WHERE f.user_id = _uid AND f.ended_at IS NULL AND f.paid_tier = public.paid_tier(_uid)
        AND (NOT EXISTS (SELECT 1 FROM env) OR f.environment = (SELECT e FROM env))
      LIMIT 1
    ), public.paid_tier(_uid), 'free')) AS paid_rank,
    array_position(ARRAY['free', 'plus', 'collaborate', 'management'], coalesce((
      SELECT s.tier FROM artist_seats s
      WHERE s.member_user_id = _uid AND s.status IN ('active', 'canceled')
        AND (s.current_period_end IS NULL OR s.current_period_end > now())
        AND (NOT EXISTS (SELECT 1 FROM env) OR s.environment = (SELECT e FROM env))
      ORDER BY array_position(ARRAY['plus', 'collaborate', 'management'], s.tier) DESC
      LIMIT 1
    ), 'free')) AS seat_rank
  )
  SELECT CASE
    WHEN public.has_role(_uid, 'super_admin') THEN 'management'
    WHEN public.is_staff(_uid) OR public.in_department(_uid, 'hr') THEN 'management'
    WHEN public.staff_plan_active(_uid) THEN 'management'
    WHEN public.is_paused(_uid) THEN 'free'
    ELSE (ARRAY['free', 'plus', 'collaborate', 'management'])[greatest((SELECT paid_rank FROM tiers), (SELECT seat_rank FROM tiers))]
  END
$function$;
