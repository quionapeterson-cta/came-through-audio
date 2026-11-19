-- An escalated thread belongs to the receiving department's lead and to a super admin — never to the whole department
-- (founder, 2026-11-19).
--
-- The 2026-11-19 escalation policies opened Marketing's escalated rows to everyone holding the Marketing department.
-- This narrows them to that department's lead (public.is_department_lead) plus the founder, which is who the handoff is
-- routed to: the lead's notice in My Queue, the flagged thread, its conversation and the escalation log.
--
-- Additive and safe to run more than once: each policy is replaced in place, the Support queue's own policies are
-- untouched, and no row is rewritten. The escalated thread stays read-only — Support still writes the member's reply.

-- 1. The flagged ticket itself.
DROP POLICY IF EXISTS "Marketing reads tickets escalated to it" ON public.support_tickets;
DROP POLICY IF EXISTS "Marketing lead reads tickets escalated to it" ON public.support_tickets;
CREATE POLICY "Marketing lead reads tickets escalated to it" ON public.support_tickets FOR SELECT TO authenticated
  USING (
    escalated_marketing
    AND public.is_department_lead(auth.uid())
    AND public.in_department(auth.uid(), 'marketing')
  );

-- 2. Its conversation, internal notes included: the lead reads what Support wrote for them.
DROP POLICY IF EXISTS "Marketing reads escalated threads" ON public.support_ticket_messages;
DROP POLICY IF EXISTS "Marketing lead reads escalated threads" ON public.support_ticket_messages;
CREATE POLICY "Marketing lead reads escalated threads" ON public.support_ticket_messages FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.support_tickets t
    WHERE t.id = ticket_id
      AND t.escalated_marketing
      AND public.is_department_lead(auth.uid())
      AND public.in_department(auth.uid(), 'marketing')
  ));

-- 3. The escalation log: who handed it over, why, and whether the lead has read it.
DROP POLICY IF EXISTS "Marketing reads its escalations" ON public.support_ticket_escalations;
DROP POLICY IF EXISTS "Marketing lead reads its escalations" ON public.support_ticket_escalations;
CREATE POLICY "Marketing lead reads its escalations" ON public.support_ticket_escalations FOR SELECT TO authenticated
  USING (
    tag = 'marketing'
    AND public.is_department_lead(auth.uid())
    AND public.in_department(auth.uid(), 'marketing')
  );

DROP POLICY IF EXISTS "Receiving team marks an escalation read" ON public.support_ticket_escalations;
DROP POLICY IF EXISTS "Receiving lead marks an escalation read" ON public.support_ticket_escalations;
CREATE POLICY "Receiving lead marks an escalation read" ON public.support_ticket_escalations FOR UPDATE TO authenticated
  USING (
    tag = 'marketing'
    AND public.is_department_lead(auth.uid())
    AND public.in_department(auth.uid(), 'marketing')
  )
  WITH CHECK (
    tag = 'marketing'
    AND public.is_department_lead(auth.uid())
    AND public.in_department(auth.uid(), 'marketing')
  );

-- 4. Writing an escalation stays Support's and the founder's, with the receiving lead allowed to hand one on.
DROP POLICY IF EXISTS "Support staff escalate" ON public.support_ticket_escalations;
CREATE POLICY "Support staff escalate" ON public.support_ticket_escalations FOR INSERT TO authenticated
  WITH CHECK (
    by_id = auth.uid()
    AND (
      public.in_department(auth.uid(), 'support')
      OR public.has_role(auth.uid(), 'super_admin')
      OR (public.is_department_lead(auth.uid()) AND public.in_department(auth.uid(), 'marketing'))
    )
  );
