-- PDF email delivery results (founder, 2026-11-15): every email sent from Admin → PDF Tools gets a row, and Resend's
-- webhook moves it from "sent" to delivered, bounced, delayed or failed, with the reason Gmail and friends give.
-- Additive: nothing existing is touched.
CREATE TABLE IF NOT EXISTS public.pdf_email_sends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Resend's own id for the message, which is what its webhook names.
  resend_id text UNIQUE,
  sent_by uuid NOT NULL,
  mailbox text NOT NULL,
  recipients text[] NOT NULL,
  subject text NOT NULL,
  file_name text NOT NULL,
  status text NOT NULL DEFAULT 'accepted',
  bounce_type text,
  bounce_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pdf_email_sends_status CHECK (status IN ('accepted', 'delivered', 'delayed', 'bounced', 'complained', 'failed'))
);

CREATE INDEX IF NOT EXISTS pdf_email_sends_created_idx ON public.pdf_email_sends (created_at DESC);

GRANT SELECT, INSERT ON public.pdf_email_sends TO authenticated;
GRANT ALL ON public.pdf_email_sends TO service_role;

ALTER TABLE public.pdf_email_sends ENABLE ROW LEVEL SECURITY;

-- Every staff member sees what the team sent; nobody writes a row for someone else. Only the webhook (service role)
-- moves a row's delivery status, so a browser can never claim an email was delivered.
DROP POLICY IF EXISTS "Staff read pdf email sends" ON public.pdf_email_sends;
CREATE POLICY "Staff read pdf email sends" ON public.pdf_email_sends FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Staff record pdf email sends" ON public.pdf_email_sends;
CREATE POLICY "Staff record pdf email sends" ON public.pdf_email_sends FOR INSERT TO authenticated
  WITH CHECK (public.is_staff(auth.uid()) AND sent_by = auth.uid());
