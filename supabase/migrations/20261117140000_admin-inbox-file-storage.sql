-- The files themselves stay with the inbox message (founder, 2026-11-17): 10 MB per file, kept as long as the message.
--
-- Part 2 recorded only each attachment's name, so a thread carrying a contract or a master read as a list of what staff
-- could not open. The bytes now live in the private `admin-inbox` bucket and each attachment keeps the key it was stored
-- under (`storagePath`), beside the name, type and size it already had. Additive: existing rows keep their names and
-- simply have no path, so nothing that reads attachments today changes.
--
-- The bucket is private and the app is the only thing that writes to it: the Worker and the file page upload with the
-- service role, and a super admin reads through a short-lived signed link. No policy is added for `authenticated` or
-- `anon`, so the bucket can never be listed or downloaded from the browser without that link.

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('admin-inbox', 'admin-inbox', false, 10485760)
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = 10485760;

COMMENT ON COLUMN public.admin_inbox_messages.attachments IS
  'Each attachment the mail carried: [{filename, mimeType, size, storagePath?, kept?, reason?}]. storagePath is the key in the private admin-inbox bucket; kept=false means the file was too big to store and only its name is known.';
