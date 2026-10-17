-- New staff roles. Kept in their own migration: Postgres can't use a new enum value in the transaction that adds it.
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'department_lead';
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'hr_admin';
