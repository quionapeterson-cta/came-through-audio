-- Renewal reminders 90, 60, 30, 7 and 1 day before a yearly plan renews (PLAN-catalog-emptying §11a). Run AFTER 20261024090000.
-- Two columns record which reminders went out for which renewal date, so nobody gets one twice. Safe to run again.
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS renewal_reminders text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS renewal_reminders_for timestamptz;
