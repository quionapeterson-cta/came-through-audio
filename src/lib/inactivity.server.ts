import { getPaymentsEnvironment } from "./payments-env";
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
 * notices, and on the date removes what the account has not earned the right to keep: the stored files (masters,
 * artwork and AI Protection proof videos) and catalog entries go for anyone still on Free, and the account goes only if
 * it never came back.
 *
 * Everything that is not storage stays with the account on Free for as long as it exists (founder, 2026-11-08,
 * replacing the 30-day paperwork window): split sheets, contracts, AI Protection certificates, blueprints and Working
 * On are removed only when the account itself is deleted.
 *
 * Guards, all re-checked on the day so a payment always wins: a live paid plan cancels everything before the date.
 * Staff accounts and live artist seats are on the same footing as everyone else (founder, 2026-11-08), so only a plan
 * stops a deadline. A sign-in saves the account and leaves it on Free, but it does not save the files or the catalog.
 *
 * It never touches a plan ending: a lapsed plan is kept read-only on Free elsewhere.
 */
type Admin = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];

async function db(): Promise<Admin> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

const BUCKET = "catalog-files";
/** AI Protection proof videos live in their own bucket and are the biggest files an account stores, so they go on the date. */
const PROOF_BUCKET = "proof-videos";
const NOW = () => new Date().toISOString();
/** How long a deletion receipt waits for its email before the address is dropped unsent. */
const RECEIPT_DAYS = 30;

/** The later of the last sign-in and the account's creation: what "activity" means for this job. */
const lastActiveOf = (user: { last_sign_in_at?: string | null; created_at: string }) =>
  user.last_sign_in_at && new Date(user.last_sign_in_at) > new Date(user.created_at) ? user.last_sign_in_at : user.created_at;

/**
 * A live paid plan is the only thing that stops a deadline (founder, 2026-11-08): staff accounts, seat owners and seat
 * artists are scheduled like everyone else, so nothing here asks who someone works for or what seat they hold.
 */
async function paidAccount(client: Admin, userId: string): Promise<boolean> {
  const { data } = await client.from("subscriptions")
    .select("status, current_period_end")
    .eq("user_id", userId).eq("environment", getPaymentsEnvironment())
    .not("stripe_subscription_id", "is", null)
    .in("status", ["active", "trialing", "past_due", "canceled"]);
  const rows = (data ?? []) as unknown as { status: string; current_period_end: string | null }[];
  return rows.some((s) => {
    const end = s.current_period_end ? new Date(s.current_period_end) : null;
    if (s.status === "canceled") return !!end && end > new Date();
    return !end || end > new Date();
  });
}

/** Every file under the member's own folder in a bucket: song folders, and anything saved at the top (a kit's logos). */
async function removeBucketFiles(client: Admin, bucketName: string, userId: string) {
  const bucket = client.storage.from(bucketName);
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

/** The masters, artwork and anything else stored for the account's catalog. */
const removeUserFiles = (client: Admin, userId: string) => removeBucketFiles(client, BUCKET, userId);

/**
 * Clears a certificate's pointer to a proof video as well as the video itself (founder, 2026-11-09): once the copy is
 * gone, the column goes back to its empty default, so My certificates offers no download that cannot work. The
 * certificate, its fingerprints and its manifest stay exactly as they were issued.
 */
async function clearProofVideoLinks(client: Admin, userId: string) {
  const { error } = await client.from("ai_protection_certificates" as never)
    .update({ session_video_url: "", notes_proof_url: "" } as never)
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
}

/** The catalog itself: the songs and their health ticks, so no entry survives the files it pointed at. */
async function removeCatalogEntries(client: Admin, userId: string) {
  const { data: songs, error } = await client.from("catalogs").select("id").eq("user_id", userId);
  if (error) throw new Error(error.message);
  const ids = ((songs ?? []) as unknown as { id: string }[]).map((s) => s.id);
  if (!ids.length) return;
  const { error: healthError } = await client.from("health_song_status" as never)
    .delete().eq("user_id", userId).in("song_ref" as never, ids as never);
  if (healthError) throw new Error(healthError.message);
  const { error: delError } = await client.from("catalogs").delete().eq("user_id", userId);
  if (delError) throw new Error(delError.message);
}

/**
 * Everything a deleted account owned that the auth cascade does not reach: its proof videos, and every split sheet on its
 * songs. Contracts and certificates cascade with the account; split sheets have no foreign key left, so they would
 * otherwise linger as rows nobody can open.
 */
async function removeAccountPaperwork(client: Admin, userId: string) {
  await removeBucketFiles(client, PROOF_BUCKET, userId);
  const { data: songs, error: songError } = await client.from("catalogs").select("id").eq("user_id", userId);
  if (songError) throw new Error(songError.message);
  const ids = ((songs ?? []) as unknown as { id: string }[]).map((s) => s.id);
  if (ids.length) {
    const { error } = await client.from("split_sheets").delete().in("catalog_id", ids);
    if (error) throw new Error(error.message);
  }
  const { error: ownedError } = await client.from("split_sheets").delete().eq("owner_id", userId);
  if (ownedError) throw new Error(ownedError.message);
}

/**
 * Daily job. Schedules anyone dormant past the notice window, sends the reminders that are due, removes the files and
 * account on the date, and sends the day-after confirmation to
 * an address whose account has just been deleted.
 */
export async function runInactiveAccounts(now = new Date()) {
  const client = await db();
  const result = {
    inactivityScheduled: 0,
    inactivityCancelled: 0,
    inactivityReminded: 0,
    inactivityCleared: 0,
    inactivityDeleted: 0,
    inactivityNotified: 0,
  };

  const { data, error } = await client.from("account_inactivity" as never)
    .select("user_id, last_active_at, delete_on, reminders, deleted_at")
    .is("deleted_at", null);
  if (error) throw error;
  const rows = (data ?? []) as unknown as InactivityRow[];

  for (const row of rows) {
    const { data: found } = await client.auth.admin.getUserById(row.user_id);
    if (!found.user) {
      await client.from("account_inactivity" as never).delete().eq("user_id", row.user_id);
      continue;
    }
    if (await paidAccount(client, row.user_id)) {
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
      if (inactivityOutcome(signedIn) === "catalog") {
        try {
          // The proof videos are the biggest files an account stores, so they go with the masters even though the
          // certificates that point at them stay on the account. The pointers go too, so nothing dead is left to click.
          await removeBucketFiles(client, PROOF_BUCKET, row.user_id);
          await clearProofVideoLinks(client, row.user_id);
          await removeCatalogEntries(client, row.user_id);
        } catch (e) {
          console.error(`Inactivity: couldn't clear the catalog for ${row.user_id}`, String(e));
          continue;
        }
        // Nothing else is scheduled: the account, its paperwork and everything that is not storage stay on Free.
        await client.from("account_inactivity" as never).delete().eq("user_id", row.user_id);
        result.inactivityCleared += 1;
        continue;
      }
      try {
        await removeAccountPaperwork(client, row.user_id);
      } catch (e) {
        console.error(`Inactivity: couldn't clear the paperwork of ${row.user_id}`, String(e));
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
