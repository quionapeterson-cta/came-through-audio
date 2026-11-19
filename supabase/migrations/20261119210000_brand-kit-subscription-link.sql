-- Exact kit ↔ paid year (founder, 2026-11-19). A kit's paid year names the subscription that paid for it: the same
-- `sub:<subscription_id>` key the purchase row is filed under, so a paid year unlocks the kit it was actually bought
-- for instead of whichever kit happens to be newest. Blank on the kit included with Catalog Management, on kits whose
-- subscription lapsed before this column existed, and on a kit that has no paid year yet.
-- Additive; safe to run again.

ALTER TABLE public.brand_kits ADD COLUMN IF NOT EXISTS paid_key text;

-- One paid year can only ever unlock one kit.
CREATE UNIQUE INDEX IF NOT EXISTS brand_kits_paid_key
  ON public.brand_kits (user_id, paid_key)
  WHERE paid_key IS NOT NULL;

-- The link is the server's to write (the webhook when it pays for a named kit, or bindKitYear when a new kit is
-- created). A member's own browser can still edit the rest of the row, but never the year it is paid by.
CREATE OR REPLACE FUNCTION public.brand_kits_paid_key_guard()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NEW.paid_key IS DISTINCT FROM (CASE WHEN TG_OP = 'UPDATE' THEN OLD.paid_key END) THEN
    RAISE EXCEPTION 'A kit''s paid year is set by the server.';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS brand_kits_paid_key_guard ON public.brand_kits;
CREATE TRIGGER brand_kits_paid_key_guard
  BEFORE INSERT OR UPDATE ON public.brand_kits
  FOR EACH ROW EXECUTE FUNCTION public.brand_kits_paid_key_guard();
