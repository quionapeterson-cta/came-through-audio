-- Expert Registration Assistance intake (PLAN-registration-intake §1–4, §6).
-- New tables only; no existing data is touched. expert_gateways and its rows stay as they are (no longer written).
--
-- One registration_orders row per paid Expert Assistance purchase, one registration_songs row per paid song.
-- Both are written only by server functions with the service role (submit, swap, sign, staff updates), so users
-- can read their own rows but never write them; staff read all through staff-verified server functions.

CREATE TABLE IF NOT EXISTS public.registration_orders (
  purchase_id uuid PRIMARY KEY REFERENCES public.purchases(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agencies text[] NOT NULL DEFAULT '{}',
  -- Registration Authorization: frozen text, its SHA-256, the typed legal name and when it was signed.
  agreement_body text CHECK (char_length(agreement_body) <= 100000),
  agreement_hash text,
  agreement_name text CHECK (char_length(agreement_name) <= 200),
  agreement_signed_at timestamptz,
  -- {"ascap": "2026-10-23T…"}: when the user confirmed adding Came Through Audio as their representative.
  access_confirmed jsonb NOT NULL DEFAULT '{}'::jsonb,
  alerted_at timestamptz,
  reminded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS registration_orders_user_id ON public.registration_orders (user_id);

CREATE TABLE IF NOT EXISTS public.registration_songs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id uuid NOT NULL REFERENCES public.registration_orders(purchase_id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  position int NOT NULL DEFAULT 0,
  -- The catalog song, or (bought before it was cataloged) the title typed at checkout until it's linked.
  track_id uuid REFERENCES public.catalogs(id) ON DELETE SET NULL,
  pending_title text CHECK (char_length(pending_title) <= 200),
  pending_artist text CHECK (char_length(pending_artist) <= 200),
  -- The registration copy saved at submit, so later catalog edits don't change what the agent registers.
  snapshot jsonb,
  submitted_at timestamptz,
  -- {"ascap": "pending" | "in_progress" | "registered"}
  status jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS registration_songs_purchase_id ON public.registration_songs (purchase_id);
CREATE INDEX IF NOT EXISTS registration_songs_user_id ON public.registration_songs (user_id);

ALTER TABLE public.registration_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registration_songs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own registration orders" ON public.registration_orders;
CREATE POLICY "Users read own registration orders" ON public.registration_orders FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_staff(auth.uid()));
DROP POLICY IF EXISTS "Users read own registration songs" ON public.registration_songs;
CREATE POLICY "Users read own registration songs" ON public.registration_songs FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_staff(auth.uid()));

GRANT SELECT ON public.registration_orders, public.registration_songs TO authenticated;
GRANT ALL ON public.registration_orders, public.registration_songs TO service_role;
