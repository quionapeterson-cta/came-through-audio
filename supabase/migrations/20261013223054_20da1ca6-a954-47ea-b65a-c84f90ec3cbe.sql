CREATE OR REPLACE FUNCTION public.is_room_member(_room_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$ SELECT EXISTS (SELECT 1 FROM public.room_participants WHERE room_id = _room_id AND user_id = _user_id) $$;
CREATE OR REPLACE FUNCTION public.is_room_host(_room_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$ SELECT EXISTS (SELECT 1 FROM public.video_rooms WHERE id = _room_id AND host_id = _user_id) $$;
REVOKE EXECUTE ON FUNCTION public.is_room_member(uuid, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_room_host(uuid, uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.is_room_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_room_host(uuid, uuid) TO authenticated;

DROP POLICY IF EXISTS "Hosts view room participants" ON public.room_participants;
CREATE POLICY "Hosts view room participants" ON public.room_participants
  FOR SELECT TO authenticated USING (public.is_room_host(room_id, auth.uid()));

DROP POLICY IF EXISTS "Hosts and participants view rooms" ON public.video_rooms;
CREATE POLICY "Hosts and participants view rooms" ON public.video_rooms
  FOR SELECT TO authenticated USING (
    host_id = auth.uid() OR public.is_room_member(id, auth.uid()) OR public.is_staff(auth.uid())
  );