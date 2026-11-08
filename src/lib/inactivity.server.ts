import { dueInactivityReminder, hasBeenActiveSince, inactivityDeleteOn, type InactivityRow } from "./inactivity";
import { sendInactivityEmail } from "./inactivity-email.server";

/**
 * The daily two-year inactivity job (founder, 2026-11-08). It schedules dormant accounts, re-checks them every day,
 * sends the four notices, and deletes only what is still dormant and unprotected on its date. It never touches a plan
 * ending: a lapsed plan is kept read-only on Free elsewhere.
 *
 * Guards, all re-checked on the day so a sign-in or a payment always wins: a sign-in or profile change after the
 * schedule was written, a paid plan, a staff role, or a live artist seat in either direction.
 */
type Admin = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];

async function db(): Promise<Admin> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

const BUCKET = "catalog-files";
const NOW = () => new Date().toISOString();

/** The later of the last sign-in and the account's creation: what "activity" means for this job. */
const lastActiveOf = (user: { last_sign_in_at?: string | null; created_at: string }) =>
  user.last_sign_in_at && new Date(user.last_sign_in_at) > new Date(user.created_at) ? user.last_sign_in_at : user.created_at;

/** A paid plan, a staff role or a live seat in either direction: never deleted for inactivity. */
async function protectedAccount(client: Admin, userId: string): Promise<boolean> {
  const [tier, roles, seats] = await Promise.all([
    client.rpc("user_tier" as never, { _uid: userId } as never),
    client.from("user_roles").select("role").eq("user_id", userId),
    client.from("artist_seats" as never).select("id")
      .or(`owner_id.eq.${userId},member_user_id.eq.${userId}`)
      .in("status" as never, ["unclaimed", "invited", "active", "canceled"] as never)
      .gt("current_period_end", NOW()),
  ]);
  return String(tier.data) !== "free" || (roles.data ?? []).length > 0 || (seats.data ?? []).length > 0;
}

/** Every file under the member's own folder: song folders, and anything saved at the top (a kit's logos). */
async function removeUserFiles(client: Admin, userId: string) {
  const bucket = client.storage.from(BUCKET);
  const { data: top } = await bucket.list(userId);
  const paths: string[] = [];
  for (const entry of top ?? []) {
    if (entry.id) { paths.push(`${userId}/${entry.name}`); continue; }
    const { data: inner } = await bucket.list(`${userId}/${entry.name}`);
    for (const file of inner ?? []) if (file.id) paths.push(`${userId}/${entry.name}/${file.name}`);
  }
  if (paths.length) await bucket.remove(paths);
}

/**
 * Daily job. Schedules anyone dormant past the notice window, cancels a schedule the moment the account shows activity
 * (or gains a plan, a role or a seat), sends the reminders that are due and deletes on the day.
 */
export async function runInactiveAccounts(now = new Date()) {
  const client = await db();
  const result = { inactivityScheduled: 0, inactivityCancelled: 0, inactivityReminded: 0, inactivityDeleted: 0 };

  const { data, error } = await client.from("account_inactivity" as never)
    .select("user_id, last_active_at, delete_on, reminders, deleted_at").is("deleted_at", null);
  if (error) throw error;
  const rows = (data ?? []) as unknown as InactivityRow[];

  for (const row of rows) {
    const { data: found } = await client.auth.admin.getUserById(row.user_id);
    if (!found.user) {
      await client.from("account_inactivity" as never).update({ deleted_at: NOW(), updated_at: NOW() } as never).eq("user_id", row.user_id);
      continue;
    }
    if (hasBeenActiveSince(row, lastActiveOf(found.user))) {
      await client.from("account_inactivity" as never).delete().eq("user_id", row.user_id);
      result.inactivityCancelled += 1;
      continue;
    }
    if (await protectedAccount(client, row.user_id)) {
      await client.from("account_inactivity" as never).delete().eq("user_id", row.user_id);
      result.inactivityCancelled += 1;
      continue;
    }
    if (new Date(row.delete_on) <= now) {
      await removeUserFiles(client, row.user_id);
      const { error: delError } = await client.auth.admin.deleteUser(row.user_id);
      if (delError) { console.error(`Inactivity: couldn't delete ${row.user_id}`, delError.message); continue; }
      await client.from("account_inactivity" as never).update({ deleted_at: NOW(), updated_at: NOW() } as never).eq("user_id", row.user_id);
      result.inactivityDeleted += 1;
      continue;
    }
    const due = dueInactivityReminder(row, now);
    const email = found.user.email;
    if (!due || !email) continue;
    if (await sendInactivityEmail(email, { kind: due, deleteOn: row.delete_on }, `inactivity-${due}-${row.user_id}-${row.delete_on.slice(0, 10)}`)) {
      await client.from("account_inactivity" as never)
        .update({ reminders: [...new Set([...row.reminders, due])], updated_at: NOW() } as never).eq("user_id", row.user_id);
      result.inactivityReminded += 1;
    }
  }

  const known = new Set(rows.map((r) => r.user_id));
  const { data: candidates } = await client.rpc("inactivity_candidates" as never);
  for (const c of (candidates ?? []) as unknown as { user_id: string; last_active_at: string }[]) {
    if (known.has(c.user_id)) continue;
    const { error: insError } = await client.from("account_inactivity" as never).insert({
      user_id: c.user_id,
      last_active_at: c.last_active_at,
      delete_on: inactivityDeleteOn(c.last_active_at, now).toISOString(),
    } as never);
    if (!insError) result.inactivityScheduled += 1;
  }
  return result;
}
