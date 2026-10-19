-- Public share cards: the teaser image a user chooses to post, so Facebook, X, Threads and WhatsApp can show it
-- in link previews (they only read og:image from a public URL). Users write only inside their own folder;
-- anyone can view, since these images exist to be posted publicly.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('share-cards', 'share-cards', true, 5242880, ARRAY['image/png'])
ON CONFLICT (id) DO UPDATE SET public = true, file_size_limit = 5242880, allowed_mime_types = ARRAY['image/png'];

DROP POLICY IF EXISTS "Users upload own share cards" ON storage.objects;
CREATE POLICY "Users upload own share cards" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'share-cards' AND (storage.foldername(name))[1] = auth.uid()::text);
DROP POLICY IF EXISTS "Users replace own share cards" ON storage.objects;
CREATE POLICY "Users replace own share cards" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'share-cards' AND (storage.foldername(name))[1] = auth.uid()::text);
DROP POLICY IF EXISTS "Users delete own share cards" ON storage.objects;
CREATE POLICY "Users delete own share cards" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'share-cards' AND (storage.foldername(name))[1] = auth.uid()::text);
