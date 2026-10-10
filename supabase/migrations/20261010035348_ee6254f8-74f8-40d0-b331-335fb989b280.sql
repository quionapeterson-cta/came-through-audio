ALTER TABLE public.catalogs ADD COLUMN IF NOT EXISTS details jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.catalogs ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
GRANT SELECT, INSERT, UPDATE, DELETE ON public.catalogs TO authenticated;
GRANT ALL ON public.catalogs TO service_role;
GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.catalogs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own catalog" ON public.catalogs FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users read own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
INSERT INTO public.profiles (id, stage_name, legal_name)
SELECT u.id, u.raw_user_meta_data->>'stage_name', u.raw_user_meta_data->>'legal_name' FROM auth.users u
ON CONFLICT (id) DO NOTHING;