-- What a seat holder may read (founder, 2026-11-08): an accepted seat already lets the owner read and edit the artist's
-- catalog, files and profile defaults. This adds read-only access to the artist's split sheets and contracts, so the
-- owner can see what was agreed without being able to send, sign or change any of it: only the invited artist sends a
-- contract under their own name. Additive; no existing policy is weakened and nothing an artist could do changes.
--
-- A seat counts while it is paid for and for the rest of the period after a cancellation, the same rule user_tier and
-- every other seat policy use. The period check is here as well as in the catalog policies because the first seat
-- policies (20261104120000) check status only.

-- One definition of "this owner holds a live seat for this artist", so the three policies below cannot drift apart.
CREATE OR REPLACE FUNCTION public.seat_is_live(_owner uuid, _member uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.artist_seats s
    WHERE s.owner_id = _owner AND s.member_user_id = _member
      AND s.status IN ('active', 'canceled')
      AND (s.current_period_end IS NULL OR s.current_period_end > now())
  )
$$;
REVOKE ALL ON FUNCTION public.seat_is_live(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.seat_is_live(uuid, uuid) TO authenticated, service_role;

-- Split sheets: the artist owns the sheet, so owner_id is the artist's account. Read only.
DROP POLICY IF EXISTS "Seat owners read their artists' split sheets" ON public.split_sheets;
CREATE POLICY "Seat owners read their artists' split sheets" ON public.split_sheets FOR SELECT TO authenticated
  USING (public.seat_is_live(auth.uid(), owner_id));

-- Contracts: the contract belongs to the artist (contracts.user_id). Read only, so a seat holder can never send,
-- edit, sign or delete one. Sending stays with the artist through send_contract below.
DROP POLICY IF EXISTS "Seat owners read their artists' contracts" ON public.contracts;
CREATE POLICY "Seat owners read their artists' contracts" ON public.contracts FOR SELECT TO authenticated
  USING (public.seat_is_live(auth.uid(), user_id));

-- The people on those contracts, their roles and their signature records. Read only.
DROP POLICY IF EXISTS "Seat owners read the parties on their artists' contracts" ON public.contract_parties;
CREATE POLICY "Seat owners read the parties on their artists' contracts" ON public.contract_parties FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.contracts k
    WHERE k.id = contract_parties.contract_id AND public.seat_is_live(auth.uid(), k.user_id)
  ));

-- Sending a contract is the artist's act, never the seat holder's (founder, 2026-11-08). Same body as 20261025160000,
-- with the caller checked by id first so a seat holder gets a clear refusal instead of a misleading "not found".
CREATE OR REPLACE FUNCTION public.send_contract(_contract_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE k record; n int; bad int; h text;
BEGIN
  SELECT * INTO k FROM contracts WHERE id = _contract_id;
  IF k.id IS NULL THEN RAISE EXCEPTION 'Contract not found.'; END IF;
  IF k.user_id <> auth.uid() THEN
    IF public.seat_is_live(auth.uid(), k.user_id) THEN
      RAISE EXCEPTION 'Only the artist can send this contract under their name. A seat lets you read it, not send it.';
    END IF;
    RAISE EXCEPTION 'Contract not found.';
  END IF;
  IF NOT public.has_tier(auth.uid(), 'management') AND k.paid_purchase_id IS NULL THEN RAISE EXCEPTION 'Sending contracts for signature is included with Catalog Management, or with a $3.99 generated contract.'; END IF;
  IF k.status <> 'draft' THEN RETURN k.body_hash; END IF;
  IF char_length(trim(k.body)) = 0 THEN RAISE EXCEPTION 'Add the contract text first.'; END IF;
  -- POSIX classes rather than \s and \. so the pattern survives every SQL transport unchanged.
  SELECT count(*), count(*) FILTER (WHERE trim(legal_name) = '' OR email !~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$') INTO n, bad FROM contract_parties WHERE contract_id = k.id;
  IF n < 2 THEN RAISE EXCEPTION 'Add at least two parties.'; END IF;
  IF bad > 0 THEN RAISE EXCEPTION 'Every party needs a legal name and a valid email.'; END IF;
  h := encode(extensions.digest(k.body, 'sha256'), 'hex');
  UPDATE contracts SET status = 'sent', body_hash = h, sent_at = now(), updated_at = now() WHERE id = k.id;
  RETURN h;
END $$;
REVOKE ALL ON FUNCTION public.send_contract(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_contract(uuid) TO authenticated;
