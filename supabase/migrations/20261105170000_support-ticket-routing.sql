-- Support is its own department and owns the ticket queue; Billing answers its own billing tickets (founder, 2026-11-05).
-- A billing ticket is one whose category starts with "Account & billing", the same prefix the inbox routing uses
-- (BILLING_AREA in src/lib/support-topics.ts), so a ticket is never in two queues by accident. Additive, safe to run
-- more than once.

DROP POLICY IF EXISTS "Support staff read tickets" ON public.support_tickets;
CREATE POLICY "Support staff read tickets" ON public.support_tickets FOR SELECT TO authenticated
  USING (public.in_department(auth.uid(), 'support'));

DROP POLICY IF EXISTS "Support staff update tickets" ON public.support_tickets;
CREATE POLICY "Support staff update tickets" ON public.support_tickets FOR UPDATE TO authenticated
  USING (public.in_department(auth.uid(), 'support')) WITH CHECK (public.in_department(auth.uid(), 'support'));

DROP POLICY IF EXISTS "Billing staff read their tickets" ON public.support_tickets;
CREATE POLICY "Billing staff read their tickets" ON public.support_tickets FOR SELECT TO authenticated
  USING (public.in_department(auth.uid(), 'billing') AND category LIKE 'Account & billing%');

DROP POLICY IF EXISTS "Billing staff update their tickets" ON public.support_tickets;
CREATE POLICY "Billing staff update their tickets" ON public.support_tickets FOR UPDATE TO authenticated
  USING (public.in_department(auth.uid(), 'billing') AND category LIKE 'Account & billing%')
  WITH CHECK (public.in_department(auth.uid(), 'billing') AND category LIKE 'Account & billing%');

-- The queue is read newest-first, and billing reads one category: the index serves both.
CREATE INDEX IF NOT EXISTS support_tickets_category_idx ON public.support_tickets (category, created_at DESC);
