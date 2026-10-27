-- Weekly reminders for a task (founder, 2026-10-27): from `remind_weekly_from` until the task is done or its deadline
-- passes, the hourly reminder job emails once a week. Additive; existing tasks don't change. Safe to run again.
ALTER TABLE public.department_tasks ADD COLUMN IF NOT EXISTS remind_weekly_from timestamptz;

-- The camethroughaudio.com renewal: weekly reminders Jan 1 – May 16, 2027; checking it off stops them and crosses it
-- off the Admin calendar. Owned by the founder's account. Added once.
INSERT INTO public.department_tasks (department, title, body, status, importance, due_at, remind_weekly_from, owner_id, created_by)
SELECT 'finance',
  'Renew camethroughaudio.com on GoDaddy',
  'Renew the camethroughaudio.com domain at GoDaddy before it expires. Price: $341.82 for 9 years, or $37.98 for 1 year. Mark this task done once it''s renewed; the weekly reminders stop.',
  'planned', 'high', '2027-05-16 17:00:00-04', '2027-01-01 09:00:00-05', u.id, u.id
FROM auth.users u
WHERE u.email = 'camethroughaudio@gmail.com'
  AND NOT EXISTS (SELECT 1 FROM public.department_tasks WHERE title = 'Renew camethroughaudio.com on GoDaddy');
