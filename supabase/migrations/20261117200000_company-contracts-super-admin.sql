-- Company Contracts is the super admin's own again (founder, 2026-11-17, narrowing 2026-11-16).
--
-- The 2026-11-16 pass let the four lead roles draft a company agreement for a super admin to approve. That is closed:
-- creating a company contract is the super admin's alone again, enforced here as well as on the tab, because
-- `send_contract` and the table are reachable from any browser holding a session and a hidden tab is not a rule.
-- Nothing else moves: the approval functions keep their own super-admin checks, and a lead's older drafts stay
-- readable to them through the owner's own policy.

DROP POLICY IF EXISTS "Leads create company contracts" ON public.contracts;
CREATE POLICY "Super admins create company contracts" ON public.contracts AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (NOT coalesce(is_company, false) OR public.has_role(auth.uid(), 'super_admin'));
