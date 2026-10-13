CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, legal_name, stage_name, role, tier)
  VALUES (new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'stage_name', 'user', 'free');
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.assign_admin_role_on_signup()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.admin_whitelist WHERE email = NEW.email) THEN
    UPDATE public.profiles
    SET role = (SELECT assigned_role FROM public.admin_whitelist WHERE email = NEW.email)
    WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP POLICY IF EXISTS "Participant logging loop" ON public.room_participants;
CREATE POLICY "Participants manage own membership" ON public.room_participants
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Hosts view room participants" ON public.room_participants
  FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.video_rooms v WHERE v.id = room_id AND v.host_id = auth.uid()));

DROP POLICY IF EXISTS "Authenticated users view rooms" ON public.video_rooms;
CREATE POLICY "Hosts and participants view rooms" ON public.video_rooms
  FOR SELECT TO authenticated USING (
    host_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.room_participants p WHERE p.room_id = id AND p.user_id = auth.uid())
    OR public.is_staff(auth.uid())
  );

DROP POLICY IF EXISTS "Signals switchboard open loop" ON public.webrtc_signals;
CREATE POLICY "Signal parties read signals" ON public.webrtc_signals
  FOR SELECT TO authenticated USING (auth.uid() = sender_id OR auth.uid() = receiver_id);
CREATE POLICY "Senders create signals" ON public.webrtc_signals
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = sender_id);
CREATE POLICY "Signal parties delete signals" ON public.webrtc_signals
  FOR DELETE TO authenticated USING (auth.uid() = sender_id OR auth.uid() = receiver_id);