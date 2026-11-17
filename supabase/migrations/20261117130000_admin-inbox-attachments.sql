-- An attachment left no trace (founder, 2026-11-17): the receiver stored the bodies and dropped the files, so a thread
-- carrying a contract or a split sheet read like a plain email and staff had no way to know something was sent.
--
-- The files themselves still stay out of the inbox — this is a record of the conversation, not a file store — but each
-- one's name, type and size now travel with its message, so the thread can say what came attached and staff can ask
-- for it. Additive: existing rows carry an empty list and nothing reads attachments before this lands.

ALTER TABLE public.admin_inbox_messages
  ADD COLUMN IF NOT EXISTS attachments jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.admin_inbox_messages
  DROP CONSTRAINT IF EXISTS admin_inbox_messages_attachments;
ALTER TABLE public.admin_inbox_messages
  ADD CONSTRAINT admin_inbox_messages_attachments
  CHECK (jsonb_typeof(attachments) = 'array');

COMMENT ON COLUMN public.admin_inbox_messages.attachments IS
  'Each attachment the mail carried: [{filename, mimeType, size}]. The file bytes are never stored.';
