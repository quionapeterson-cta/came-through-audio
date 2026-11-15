-- Packet signing emails in the delivery log (founder, 2026-11-15): the signing link now goes out through the same
-- `pdf_email_sends` rows as every other PDF email, so Resend's webhook moves it from "Sent" to Delivered, Bounced or
-- Failed and the packet can show what happened. Additive: one nullable column and an index, nothing existing changes.
ALTER TABLE public.pdf_email_sends
  ADD COLUMN IF NOT EXISTS packet_id uuid REFERENCES public.pdf_packets(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS pdf_email_sends_packet_idx
  ON public.pdf_email_sends (packet_id, created_at DESC);
