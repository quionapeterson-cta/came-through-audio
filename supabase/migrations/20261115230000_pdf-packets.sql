-- E-sign packets (founder, 2026-11-15): one row per packet an admin sends. The template is copied into `snapshot`, so a
-- document already out for signature never changes when the library template is edited afterwards. Additive: no existing
-- table or policy is touched.
CREATE TABLE IF NOT EXISTS public.pdf_packets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid REFERENCES public.pdf_templates(id) ON DELETE SET NULL,
  title text NOT NULL,
  snapshot jsonb NOT NULL,
  recipient_name text NOT NULL,
  recipient_email text NOT NULL,
  enabled_forms text[] NOT NULL DEFAULT '{}',
  admin_values jsonb NOT NULL DEFAULT '{}'::jsonb,
  values jsonb NOT NULL DEFAULT '{}'::jsonb,
  recipient_signature jsonb,
  admin_signature jsonb,
  status text NOT NULL DEFAULT 'sent',
  created_by uuid NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  recipient_signed_at timestamptz,
  admin_signed_at timestamptz,
  completed_at timestamptz,
  audit jsonb NOT NULL DEFAULT '{}'::jsonb,
  recipient_user_agent text,
  recipient_ip text,
  admin_user_agent text,
  admin_ip text,
  CONSTRAINT pdf_packets_status CHECK (status IN ('sent', 'pending_admin', 'completed', 'void')),
  CONSTRAINT pdf_packets_title CHECK (char_length(btrim(title)) BETWEEN 1 AND 140),
  CONSTRAINT pdf_packets_email CHECK (recipient_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$')
);

CREATE INDEX IF NOT EXISTS pdf_packets_sent_idx ON public.pdf_packets (sent_at DESC);
CREATE INDEX IF NOT EXISTS pdf_packets_status_idx ON public.pdf_packets (status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pdf_packets TO authenticated;
GRANT ALL ON public.pdf_packets TO service_role;

ALTER TABLE public.pdf_packets ENABLE ROW LEVEL SECURITY;

-- Staff send, read and counter-sign packets. The recipient never touches the table: the signing page goes through the two
-- functions below, which see exactly one packet by its unguessable id.
DROP POLICY IF EXISTS "Staff read pdf packets" ON public.pdf_packets;
CREATE POLICY "Staff read pdf packets" ON public.pdf_packets FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Staff send pdf packets" ON public.pdf_packets;
CREATE POLICY "Staff send pdf packets" ON public.pdf_packets FOR INSERT TO authenticated
  WITH CHECK (public.is_staff(auth.uid()) AND created_by = auth.uid());

DROP POLICY IF EXISTS "Staff update pdf packets" ON public.pdf_packets;
CREATE POLICY "Staff update pdf packets" ON public.pdf_packets FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- The signing page's read: one packet, by id, without exposing the table to anonymous callers.
CREATE OR REPLACE FUNCTION public.pdf_packet_signing(_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'id', id,
    'title', title,
    'snapshot', snapshot,
    'recipientName', recipient_name,
    'enabledForms', enabled_forms,
    'values', values,
    'adminValues', admin_values,
    'status', status,
    'sentAt', sent_at,
    'recipientSignedAt', recipient_signed_at,
    'adminSignedAt', admin_signed_at,
    'recipientSignature', recipient_signature,
    'adminSignature', admin_signature
  )
  FROM public.pdf_packets
  WHERE id = _id AND status <> 'void';
$$;

REVOKE ALL ON FUNCTION public.pdf_packet_signing(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.pdf_packet_signing(uuid) TO anon, authenticated;

-- The signing page's submit: only a packet still waiting on the recipient can be signed, once, and it needs a signature.
-- Everything else (required fields, switched-off forms) is checked in the server function against the same snapshot.
CREATE OR REPLACE FUNCTION public.pdf_packet_submit(
  _id uuid,
  _values jsonb,
  _signature jsonb,
  _user_agent text DEFAULT NULL,
  _ip text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  packet public.pdf_packets;
BEGIN
  SELECT * INTO packet FROM public.pdf_packets WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'This signing link is not valid.';
  END IF;
  IF packet.status <> 'sent' THEN
    RAISE EXCEPTION 'This packet has already been signed.';
  END IF;
  IF _signature IS NULL OR coalesce(_signature->>'data', '') = '' THEN
    RAISE EXCEPTION 'A signature is required.';
  END IF;

  UPDATE public.pdf_packets SET
    values = coalesce(_values, '{}'::jsonb),
    recipient_signature = _signature,
    recipient_signed_at = now(),
    recipient_user_agent = _user_agent,
    recipient_ip = _ip,
    status = CASE WHEN admin_signature IS NOT NULL THEN 'completed' ELSE 'pending_admin' END,
    completed_at = CASE WHEN admin_signature IS NOT NULL THEN now() ELSE NULL END,
    audit = coalesce(audit, '{}'::jsonb) || jsonb_build_object(
      'recipientSignedAt', now(),
      'recipientDevice', _user_agent,
      'recipientIp', _ip
    )
  WHERE id = _id
  RETURNING * INTO packet;

  RETURN jsonb_build_object(
    'status', packet.status,
    'completed', packet.status = 'completed',
    'id', packet.id,
    'title', packet.title,
    'snapshot', packet.snapshot,
    'enabledForms', packet.enabled_forms,
    'values', packet.values,
    'adminValues', packet.admin_values,
    'recipientSignature', packet.recipient_signature,
    'adminSignature', packet.admin_signature,
    'recipientName', packet.recipient_name,
    'recipientEmail', packet.recipient_email,
    'sentAt', packet.sent_at,
    'recipientSignedAt', packet.recipient_signed_at,
    'adminSignedAt', packet.admin_signed_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.pdf_packet_submit(uuid, jsonb, jsonb, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.pdf_packet_submit(uuid, jsonb, jsonb, text, text) TO anon, authenticated;
