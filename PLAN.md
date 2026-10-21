# PLAN — Departments, Staff Management & Live Assist · v3

Status: **departments, staff management (/admin/staff) and the department switcher are built. Live Assist (§3) is replaced by PLAN-live-registration.md (no appointments).**
v3 changes: departments become a `text[]` on the staff row (multi-department employees), a super_admin department switcher, employees see only their tabs, and a new **/admin/staff** management page.

---

## 0. Lock: unchanged, and inherited by every new page

- The `/unlock` gate is the root `beforeLoad` in `src/routes/__root.tsx`. It skips only the exact path `/unlock`. **`/admin`, `/admin/staff`, `/admin/assist/:sessionId` and `/assist/:sessionId` are all children of the root, so all of them stay locked.**
- **Not touched:** `src/routes/unlock.tsx`, `src/lib/gate.functions.ts`, `SITE_PASSWORD`, `SESSION_SECRET`, the root `beforeLoad`.
- Regression test: each of the four paths redirects to `/unlock` without the gate cookie.
- Staff checks sit **on top of** the gate: Supabase login → staff role → department.

---

## 1. Staff roster & departments

### What exists today
- `public.admin_whitelist (id, email, assigned_role, created_at)` is the staff roster, already shown in the `/admin` "Staff" tab. **There is no `staff` table**, so `departments` goes on this table.
- `public.user_roles` is what `is_staff()` / `has_role()` actually check.
- ⚠️ **Existing bug:** the signup trigger `assign_admin_role_on_signup` only sets `profiles.role` and **never inserts into `user_roles`**. So an email whitelisted *before* that person signs up never gets staff access. This is fixed below, because the Staff page depends on it.

### Migration
```sql
alter table public.admin_whitelist
  add column departments text[] not null default '{}',
  add column user_id uuid unique references auth.users(id) on delete set null,
  add column added_by uuid references auth.users(id),
  add column updated_at timestamptz not null default now(),
  add constraint admin_whitelist_departments_valid check (
    departments <@ array['registration','finance','branding','marketing_sales','support']::text[]
  );
create unique index admin_whitelist_email_lower on public.admin_whitelist (lower(email));

-- link existing rows to their auth users
update public.admin_whitelist w set user_id = u.id
  from auth.users u where lower(u.email) = lower(w.email) and w.user_id is null;

-- fix signup: also write user_roles + user_id
create or replace function public.assign_admin_role_on_signup() ... as $$
begin
  update public.admin_whitelist set user_id = new.id where lower(email) = lower(new.email);
  insert into public.user_roles (user_id, role)
    select new.id, assigned_role from public.admin_whitelist
    where lower(email) = lower(new.email) and assigned_role in ('super_admin','employee')
  on conflict do nothing;
  update public.profiles set role = (...) where id = new.id;   -- existing behaviour kept
  return new;
end $$;

create function public.in_department(_user_id uuid, _dept text)
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_role(_user_id, 'super_admin')
      or (public.has_role(_user_id, 'employee') and exists (
            select 1 from public.admin_whitelist
            where user_id = _user_id and _dept = any(departments)))
$$;

create function public.my_departments() returns text[] ...   -- all 5 for super_admin, else own row
-- both: revoke from anon/public, grant execute to authenticated + service_role
```

- **RLS on `admin_whitelist`:** no client reads or writes. All access goes through the super_admin-checked server functions in §2. It's read today only via `supabaseAdmin` in `getAdminOverview`, so nothing breaks.
- **Backfill (Q1):** existing employees get **all five departments**, so nobody loses access on deploy. You then trim them in `/admin/staff`.
- Your examples, set in the UI after deploy:
  - Employee 1 → `{registration, branding}`
  - Employee 2 → `{finance, support, marketing_sales}`

### Department keys → labels (`src/lib/departments.ts`, shared client and server)
| key | Label |
| --- | --- |
| `registration` | Registration / Royalty Accounts |
| `finance` | Finance (Billing) |
| `branding` | Branding |
| `marketing_sales` | Marketing & Sales |
| `support` | Support |

### Tab → department mapping (Q2)
| `/admin` tab | Department |
| --- | --- |
| Registrations | registration |
| Live Assist (new) | registration |
| Split Sheets | registration |
| AI Protection | registration |
| Purchases | finance |
| Support Tickets | support |
| Branding / Marketing & Sales | *(no tabs yet; placeholder "Coming soon" panel)* |
| Staff | **removed** → replaced by the `/admin/staff` link (super_admin only) |

Stat cards at the top follow the same mapping.

### Enforced server-side, not just hidden in the UI
- `getStaffRole()` → `{ role, departments }` (from `my_departments()`)
- `getAdminOverview()` only queries and returns the sections the caller's departments allow. An employee without `finance` never receives purchase rows.
- `listTickets` / `updateTicketStatus` check `in_department(...,'support')`.
- RLS updates: `support_tickets` staff policies → `in_department(auth.uid(),'support')`; `agency_registrations` staff policy → `in_department(auth.uid(),'registration')`.

### `/admin` UI changes (`src/routes/admin.tsx`)
- **super_admin:** a department switcher in the `bg-ink` header (shadcn `Select`): **All departments** · Registration / Royalty Accounts · Finance · Branding · Marketing & Sales · Support. It filters the tabs and stat cards, and the choice is remembered in `localStorage`. Next to it is a **Staff** button → `/admin/staff`.
- **employee:** no switcher. They see the union of tabs for their departments, with their department `Badge`s in the header. With no departments → "You haven't been assigned a department yet. Ask an admin."

---

## 2. Staff Management — `/admin/staff`

Route file: **`src/routes/admin_.staff.tsx`**. The `_` escapes `admin.tsx`, which has no `<Outlet />`. It stays under the root gate. `ssr: false`, `noindex`.

**Access:** super_admin only. Employees see "Super admin only", which means **employees can't add staff or grant themselves departments**, in line with the existing "admin access cannot be self-granted" rule.

**UI (shadcn, CTA tokens, same `bg-ink` header as `/admin`):**
- A table with Email · Name (from profile, if signed up) · Status `Badge` (**Active** = has an account, **Invited** = waiting for signup) · Departments (chips) · Added · actions
- **Add employee** `Dialog`: email + one checkbox per department (at least one required) + "Send invite email" switch (default on)
- **Edit departments**: the same checkbox group in a `Popover`, saved on confirm
- **Remove**: `AlertDialog` "Remove {email} from staff? They'll lose admin access immediately."
- super_admin rows are shown as "Super Admin · All departments" and can't be edited or removed here. You can't remove yourself.

**Server functions — `src/lib/staff.functions.ts`** (`requireSupabaseAuth` + zod + `has_role(…,'super_admin')`, then `supabaseAdmin`):
| Function | Does |
| --- | --- |
| `listStaff()` | Roster with active/invited status |
| `addEmployee({ email, departments, sendInvite })` | Upserts the whitelist row (`assigned_role='employee'`, `added_by`). If an auth user with that email already exists → sets `user_id` and inserts `user_roles` employee. Optionally sends the invite email. |
| `updateDepartments({ id, departments })` | Validates against the 5 keys and sets `updated_at` |
| `removeEmployee({ id })` | Refuses super_admin rows and the caller's own row. Deletes the `user_roles` employee row, sets `profiles.role='user'` (service role passes `protect_profile_privileges`), and deletes the whitelist row. |

Looking up an auth user by email uses a small `security definer` SQL function granted **only to `service_role`**.

**Invite email:** Resend via `fetch`, the same setup as `support.functions.ts`, wrapped in **`emailLayout()`**. "You've been added to the Came Through Audio team ({departments}). Sign in or create an account with this email at {site}/admin." The private-preview passcode is **not** included; you share that separately.

---

## 3. Live Assist (Registration department): carried over from v2, now dept-gated

### Data
- **Song entries = existing `agency_registrations` rows** (one song × one agency). Flag/Pass writes their real status.
  - Separate migration: `alter type public.registration_status add value 'needs_fix';`
  - New columns: `review_note text (≤1000)`, `reviewed_by uuid`, `reviewed_at timestamptz`
  - **Flag** → `needs_fix` + required note · **Pass** → `completed` (labelled "Passed")
  - Artist SELECT on their own rows (added if missing). Staff writes only through server functions.
- **`assist_sessions`** = call container: `user_id` (artist), `registration_id`, `started_by`, `daily_room_name`, `status open|closed`, `created_at`, `closed_at`.
  - RLS SELECT: the artist, or `in_department(auth.uid(),'registration')`. No client writes.
- Realtime publication: `assist_sessions`, `agency_registrations` (RLS-filtered).

### Server functions — `src/lib/assist.functions.ts` (all `in_department(…,'registration')`, except the artist's own reads)
`startAssist` (creates or reuses the open session, emails the join link via Resend + `emailLayout()`, idempotency key `assist-<id>`) · `getAssistSession` · `getAssistJoinToken` (private Daily room, screenshare on, **recording off**, 3h expiry, owner token for staff) · `decideEntry` · `closeAssist`.
`DAILY_API_KEY` is a server-only placeholder. While it's missing, the pages show "Video isn't connected yet", and **Flag/Pass still works**.

### Pages
- **`src/routes/admin_.assist.$sessionId.tsx`** → `/admin/assist/:sessionId`. Registration dept only. CTA header (Open/Closed badge, copy link, close session). A branded card *around* the Daily Prebuilt iframe. Entries grouped by song → agency rows with **Pass** / **Flag** (a `Dialog` with a required note). Live progress.
- **`src/routes/assist.$sessionId.tsx`** → `/assist/:sessionId`. The artist only: same call card, screen share from Daily's toolbar, a read-only entry list with live badges and fix notes.
- Shared: `components/assist/DailyCall.tsx` (dynamic import of `@daily-co/daily-js`, `createFrame`), `components/assist/EntryList.tsx` (`editable` prop), `hooks/useAssistSession.ts` (React Query + one realtime channel, the same pattern as `useBilling.ts`).
- Entry points: the **Live Assist** tab in `/admin` (registration dept) with **Start Assist** on `pending_review` / `assigned` / `needs_fix` registrations; `ExpertAssistance.tsx` step 4 → **Join live session** when an open session exists.

---

## 4. Build order (each step leaves the branch working; Lovable syncs every push)
1. Migration: departments on `admin_whitelist`, signup trigger fix, `in_department` / `my_departments`, backfill. `getStaffRole` returns departments. **Nothing visible changes yet.**
2. `/admin/staff` page + `staff.functions.ts`
3. `/admin` tab filtering, switcher, and server-side section filtering. Tighten support / registration RLS.
4. `needs_fix` enum migration, then the assist tables, columns and realtime
5. Live Assist pages, the tab, the email, the ExpertAssistance join button
6. Tests + regenerate `types.ts`

## 5. Tests (vitest)
- `departments.test.ts`: tab visibility per department set (super_admin = all; Employee 1/2 examples; empty = none)
- `staff.test.ts`: zod (valid email, at least 1 department, only the 5 keys), refuse removing super_admin or self
- `assist.test.ts`: flag needs a note, `flag→needs_fix` / `pass→completed`
- `app-routing.test.tsx`: the `/unlock` redirect for all four paths; `/admin/staff` and `/admin/assist/x` render their own pages, not the dashboard

## 6. Files
```
NEW  supabase/migrations/<ts1>_staff_departments.sql
NEW  supabase/migrations/<ts2>_registration_needs_fix.sql      (enum value only)
NEW  supabase/migrations/<ts3>_assist_sessions.sql
NEW  src/lib/departments.ts (+ .test.ts)
NEW  src/lib/staff.functions.ts (+ staff.test.ts)
NEW  src/lib/assist.functions.ts (+ assist.test.ts)
NEW  src/hooks/useAssistSession.ts
NEW  src/components/assist/DailyCall.tsx, EntryList.tsx
NEW  src/routes/admin_.staff.tsx
NEW  src/routes/admin_.assist.$sessionId.tsx
NEW  src/routes/assist.$sessionId.tsx
EDIT src/lib/admin.functions.ts         (departments, filtered overview, Live Assist queue)
EDIT src/lib/support.functions.ts       (support dept check)
EDIT src/routes/admin.tsx               (switcher, filtered tabs, Staff link, Live Assist tab)
EDIT src/components/ExpertAssistance.tsx
EDIT src/test/app-routing.test.tsx
EDIT src/integrations/supabase/types.ts (regenerated)
EDIT package.json                       (+ @daily-co/daily-js)
```
**Untouched:** the unlock gate files, `user_roles` schema, `is_staff` / `has_role` definitions, Paddle tables, `video_rooms` / `webrtc_signals`.

---

## Open questions
1. **Backfill:** give existing employees all 5 departments on deploy so you can trim them (default), or start them with none? None locks them out until you assign.
2. **Tab mapping:** OK to put **Split Sheets** and **AI Protection** under Registration? Should anything go under Branding or Marketing & Sales now?
3. **Emailed links vs. passcode:** invited staff and assist artists will hit `/unlock` first during preview. Keep it that way (default)? I won't add any bypass without your explicit OK.
4. **Passed wording:** Pass writes the existing `completed` status, labelled "Passed". OK?
