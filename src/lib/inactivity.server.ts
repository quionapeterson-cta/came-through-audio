import { DAY } from "./retention";
import {
  dueInactivityReminder,
  hasBeenActiveSince,
  inactivityDeleteOn,
  inactivityOutcome,
  type InactivityRow,
} from "./inactivity";
import { sendInactivityEmail } from "./inactivity-email.server";

/**
 * The daily two-year inactivity job (founder, 2026-11-08). It schedules dormant accounts, sends the four upgrade
 * notices, and on the date removes what the account has not earned the right to keep: the stored files go for anyone
 * still on Free, and the account goes only if it never came back.
 *
 * Guards, all re-checked on the day so a payment always wins: a paid plan, a staff role or a live artist seat in either
 * direction cancels everything. A sign-in is different — it saves the account and leaves it on Free, but it does not
 * save the files.
 *
 * It never touches a plan ending: a lapsed plan is kept read-only on Free elsewhere.
 */
type Admin = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];

async function db(): Promise<Admin> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

const BUCKET = "catalog-files";
const NOW = () => new Date().toISOString();
/** How long a deletion receipt waits for its email before the address is dropped unsent. */
const RECEIPT_DAYS = 30;

/** The later of the last sign-in and the account's creation: what "activity" means for this job. */
const lastActiveOf = (user: { last_sign_in_at?: string | null; created_at: string }) =>
  user.last_sign_in_at && new Date(user.last_sign_in_at) > new Date(user.created_at) ? user.last_sign_in_at : user.created_at;

/** A paid plan, a staff role or a live seat in either direction: never touched for inactivity. */
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
  const { data: top, error: topError } = await bucket.list(userId);
  if (topError) throw new Error(topError.message);
  const paths: string[] = [];
  for (const entry of top ?? []) {
    if (entry.id) { paths.push(`${userId}/${entry.name}`); continue; }
    const { data: inner, error: innerError } = await bucket.list(`${userId}/${entry.name}`);
    if (innerError) throw new Error(innerError.message);
    for (const file of inner ?? []) if (file.id) paths.push(`${userId}/${entry.name}/${file.name}`);
  }
  if (!paths.length) return;
  const { error } = await bucket.remove(paths);
  if (error) throw new Error(error.message);
}

/**
 * Daily job. Schedules anyone dormant past the notice window, sends the reminders that are due, removes the files and
 * account on the date, and sends the day-after confirmation to an address whose account has just been deleted.
 */
export async function runInactiveAccounts(now = new Date()) {
  const client = await db();
  const result = {
    inactivityScheduled: 0,
    inactivityCancelled: 0,
    inactivityReminded: 0,
    inactivityFilesCleared: 0,
    inactivityDeleted: 0,
    inactivityNotified: 0,
  };

  const { data, error } = await client.from("account_inactivity" as never)
    .select("user_id, last_active_at, delete_on, reminders, deleted_at").is("deleted_at", null);
  if (error) throw error;
  const rows = (data ?? []) as unknown as InactivityRow[];

  for (const row of rows) {
    const { data: found } = await client.auth.admin.getUserById(row.user_id);
    if (!found.user) {
      await client.from("account_inactivity" as never).delete().eq("user_id", row.user_id);
      continue;
    }
    if (await protectedAccount(client, row.user_id)) {
      await client.from("account_inactivity" as never).delete().eq("user_id", row.user_id);
      result.inactivityCancelled += 1;
      continue;
    }

    const email = found.user.email ?? null;
    const signedIn = hasBeenActiveSince(row, lastActiveOf(found.user));

    if (new Date(row.delete_on) <= now) {
      try {
        await removeUserFiles(client, row.user_id);
      } catch (e) {
        // Leave the row in place and try again tomorrow rather than delete an account whose files are still there.
        console.error(`Inactivity: couldn't clear files for ${row.user_id}`, String(e));
        continue;
      }
      if (inactivityOutcome(signedIn) === "files") {
        await client.from("account_inactivity" as never).delete().eq("user_id", row.user_id);
        result.inactivityFilesCleared += 1;
        continue;
      }
      const { error: delError } = await client.auth.admin.deleteUser(row.user_id);
      if (delError) { console.error(`Inactivity: couldn't delete ${row.user_id}`, delError.message); continue; }
      // The auth row (and with it the schedule) is gone; the address is kept only long enough for the day-after email.
      if (email) {
        const { error: receiptError } = await client.from("account_deletions" as never)
          .insert({ user_id: row.user_id, email, deleted_at: NOW() } as never);
        if (receiptError) console.error(`Inactivity: couldn't record the deletion of ${row.user_id}`, receiptError.message);
      }
      result.inactivityDeleted += 1;
      continue;
    }

    const due = dueInactivityReminder(row, now);
    if (!due || !email) continue;
    const sent = await sendInactivityEmail(
      email,
      { kind: due, deleteOn: row.delete_on, keepsAccount: signedIn },
      `inactivity-${due}-${row.user_id}-${row.delete_on.slice(0, 10)}`,
    );
    if (sent) {
      await client.from("account_inactivity" as never)
        .update({ reminders: [...new Set([...row.reminders, due])], updated_at: NOW() } as never).eq("user_id", row.user_id);
      result.inactivityReminded += 1;
    }
  }

  // Day 731: the account is gone, so the only address left is the one saved with the receipt.
  const dayAgo = new Date(now.getTime() - DAY).toISOString();
  const { data: receipts } = await client.from("account_deletions" as never)
    .select("user_id, email, deleted_at").lte("deleted_at", dayAgo);
  for (const r of (receipts ?? []) as unknown as { user_id: string; email: string; deleted_at: string }[]) {
    const sent = await sendInactivityEmail(r.email, { kind: "deleted", deletedOn: r.deleted_at }, `inactivity-deleted-${r.user_id}`);
    if (!sent) continue;
    await client.from("account_deletions" as never).delete().eq("user_id", r.user_id);
    result.inactivityNotified += 1;
  }
  // An address we couldn't reach is not kept forever: a receipt older than 30 days goes unsent.
  const stale = new Date(now.getTime() - RECEIPT_DAYS * DAY).toISOString();
  const { error: staleError, count } = await client.from("account_deletions" as never)
    .delete({ count: "exact" }).lt("deleted_at", stale);
  if (staleError) console.error("Inactivity: couldn't clear old deletion receipts", staleError.message);
  else if (count) console.error(`Inactivity: dropped ${count} unsent deletion receipt(s) older than ${RECEIPT_DAYS} days`);

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
