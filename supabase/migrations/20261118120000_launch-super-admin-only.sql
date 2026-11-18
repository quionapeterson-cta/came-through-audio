-- Launch and its pre-launch tasks are super-admin only (founder, 2026-11-18).
--
-- The launch department's milestones name hosting, secrets and vendors, which standard staff must never read, so
-- public.in_department refuses "launch" for every role but super_admin. That single function is what the
-- department_tasks, department_plans and queue policies already ask, so this closes the department everywhere at once:
-- a hand-edited user_roles row listing "launch" now grants nothing.
--
-- The department stays unassignable in the app (ASSIGNABLE_DEPARTMENTS in src/lib/departments.ts, and
-- normalizeDepartments drops it), so this is the belt behind those braces, not a new way to grant access.

CREATE OR REPLACE FUNCTION public.in_department(_user_id uuid, _dept text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND (
      role = 'super_admin'
      OR (
        _dept <> 'launch'
        AND (
          (role IN ('employee','department_lead') AND _dept = ANY(departments))
          OR (role = 'hr_admin' AND _dept = 'hr')
        )
      )
    )
  )
$function$;

-- Nobody but a super admin keeps a stored "launch" value (none exist today; this is for a row edited by hand).
UPDATE public.user_roles
   SET departments = array_remove(departments, 'launch')
 WHERE role <> 'super_admin'
   AND 'launch' = ANY(coalesce(departments, '{}'));
