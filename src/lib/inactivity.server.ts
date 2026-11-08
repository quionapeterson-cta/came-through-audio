import { getPaymentsEnvironment } from "./payments-env";
import { DAY } from "./retention";
import {
  dueInactivityReminder,
  dueSignedReminder,
  fullySignedSheetIds,
  hasBeenActiveSince,
  inactivityDeleteOn,
  inactivityOutcome,
  signedDeleteOn,
  type InactivityRow,
} from "./inactivity";
import { sendInactivityEmail } from "./inactivity-email.server";

/**
 * The daily two-year inactivity job (founder, 2026-11-08). It schedules dormant accounts, sends the four upgrade
 * notices, and on the date removes what the account has not earned the right to keep: the stored files and catalog
 * entries go for anyone still on Free, and the account goes only if it never came back.
 *
 * A sign-in saves the account, and then the paperwork gets a second, shorter window of its own (founder, 2026-11-08):
 * signed split sheets, contracts and certificates stay for 30 days after the files came off, with 30/14/7/1 day
 * reminders, and are deleted then unless a plan has been paid for.
 *
 * Guards, all re-checked on the day so a payment always wins: a live paid plan cancels everything, at either date.
 * Staff accounts and live artist seats are on the same footing as everyone else (founder, 2026-11-08), so only a plan
 * stops a deadline. A sign-in is different — it saves the account and leaves it on Free, but it does not save the files,
 * and it does not stop the paperwork clock once that has started.
 *
 * It never touches a plan ending: a lapsed plan is kept read-only on Free elsewhere.
 */
type Admin = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];

async function db(): Promise<Admin> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

const BUCKET = "catalog-files";
/** AI Protection proof videos are kept apart from the catalog bucket, and go with the certificates that point at them. */
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

type Sheet = { id: string; catalog_id: string | null; track_title: string | null; isrc: string | null; signed_at: string | null };

/** The split sheet rows of the songs this account owns, including the ones whose catalog row is already gone. */
async function splitSheets(client: Admin, userId: string): Promise<Sheet[]> {
  const { data, error } = await client.from("split_sheets")
    .select("id, catalog_id, track_title, isrc, signed_at").eq("owner_id", userId);
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as Sheet[];
}

/**
 * Whether anything signed is still on the account: a contract everyone has signed, a split sheet every collaborator has
 * signed, or an issued AI Protection certificate. Unsigned drafts are not part of this, so they never start the clock.
 */
async function hasSignedRecords(client: Admin, userId: string): Promise<boolean> {
  const { data: contracts, error: contractError } = await client.from("contracts" as never)
    .select("id").eq("user_id", userId).eq("status", "signed").limit(1);
  if (contractError) throw new Error(contractError.message);
  if ((contracts ?? []).length) return true;
  const { data: certificates, error: certificateError } = await client.from("ai_protection_certificates" as never)
    .select("id").eq("user_id", userId).limit(1);
  if (certificateError) throw new Error(certificateError.message);
  if ((certificates ?? []).length) return true;
  return fullySignedSheetIds(await splitSheets(client, userId)).length > 0;
}

/** The second date: the signed contracts, fully signed split sheets and certificates go. The account itself stays. */
async function removeSignedRecords(client: Admin, userId: string) {
  // A certificate's proof videos are only meaningful with the certificate, so they go now, never at the earlier date.
  await removeBucketFiles(client, PROOF_BUCKET, userId);
  const ids = fullySignedSheetIds(await splitSheets(client, userId));
  if (ids.length) {
    const { error } = await client.from("split_sheets").delete().in("id", ids);
    if (error) throw new Error(error.message);
  }
  const { error: contractError } = await client.from("contracts" as never).delete()
    .eq("user_id", userId).eq("status", "signed");
  if (contractError) throw new Error(contractError.message);
  const { error: certificateError } = await client.from("ai_protection_certificates" as never).delete()
    .eq("user_id", userId);
  if (certificateError) throw new Error(certificateError.message);
}

/**
 * Daily job. Schedules anyone dormant past the notice window, sends the reminders that are due, removes the files and
 * account on the date, runs the paperwork window a signed-in account is given, and sends the day-after confirmation to
 * an address whose account has just been deleted.
 */
export async function runInactiveAccounts(now = new Date()) {
  const client = await db();
  const result = {
    inactivityScheduled: 0,
    inactivityCancelled: 0,
    inactivityReminded: 0,
    inactivityCleared: 0,
    inactivityPaperworkReminded: 0,
    inactivityPaperworkCleared: 0,
    inactivityDeleted: 0,
    inactivityNotified: 0,
  };

  const { data, error } = await client.from("account_inactivity" as never)
    .select("user_id, last_active_at, delete_on, reminders, deleted_at, cleared_at, signed_delete_on, signed_reminders")
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

    // The paperwork window: the files and catalog are already off, so only the signed records are left to decide.
    if (row.signed_delete_on) {
      if (new Date(row.signed_delete_on) <= now) {
        try {
          await removeSignedRecords(client, row.user_id);
        } catch (e) {
          // Leave the schedule in place and try again tomorrow rather than claim paperwork was cleared.
          console.error(`Inactivity: couldn't clear the signed paperwork for ${row.user_id}`, String(e));
          continue;
        }
        await client.from("account_inactivity" as never).delete().eq("user_id", row.user_id);
        result.inactivityPaperworkCleared += 1;
        continue;
      }
      const dueSigned = dueSignedReminder(row, now);
      if (!dueSigned || !email) continue;
      const sentPaperwork = await sendInactivityEmail(
        email,
        { kind: dueSigned, stage: "signed", deleteOn: row.signed_delete_on },
        `inactivity-signed-${dueSigned}-${row.user_id}-${row.signed_delete_on.slice(0, 10)}`,
      );
      if (sentPaperwork) {
        await client.from("account_inactivity" as never)
          .update({ signed_reminders: [...new Set([...(row.signed_reminders ?? []), dueSigned])], updated_at: NOW() } as never)
          .eq("user_id", row.user_id);
        result.inactivityPaperworkReminded += 1;
      }
      continue;
    }

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
          await removeCatalogEntries(client, row.user_id);
        } catch (e) {
          console.error(`Inactivity: couldn't clear the catalog for ${row.user_id}`, String(e));
          continue;
        }
        let paperwork = false;
        try {
          paperwork = await hasSignedRecords(client, row.user_id);
        } catch (e) {
          console.error(`Inactivity: couldn't read the signed paperwork for ${row.user_id}`, String(e));
          continue;
        }
        if (!paperwork) {
          await client.from("account_inactivity" as never).delete().eq("user_id", row.user_id);
          result.inactivityCleared += 1;
          continue;
        }
        // The files are off and signed records remain, so the paperwork gets its own date and the first notice now.
        const signedOn = signedDeleteOn(now).toISOString();
        const { error: keepError } = await client.from("account_inactivity" as never)
          .update({ cleared_at: NOW(), signed_delete_on: signedOn, signed_reminders: [], updated_at: NOW() } as never)
          .eq("user_id", row.user_id);
        if (keepError) { console.error(`Inactivity: couldn't start the paperwork window for ${row.user_id}`, keepError.message); continue; }
        result.inactivityCleared += 1;
        if (email) {
          const sent = await sendInactivityEmail(
            email,
            { kind: "30", stage: "signed", deleteOn: signedOn },
            `inactivity-signed-30-${row.user_id}-${signedOn.slice(0, 10)}`,
          );
          if (sent) {
            await client.from("account_inactivity" as never)
              .update({ signed_reminders: ["30"], updated_at: NOW() } as never).eq("user_id", row.user_id);
            result.inactivityPaperworkReminded += 1;
          }
        }
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
