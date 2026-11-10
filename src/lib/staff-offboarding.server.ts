import { ADMIN_EMAIL, emailLayout, escapeHtml, SITE_URL } from "@/lib/email-layout";
import { mailKey } from "@/lib/mailer";
import { addDays } from "@/lib/retention";
import { ASSET_DAYS, dueDepartureReminder, keepsAccountOnPayment, leftWithinProbation, SECURE_COPY } from "@/lib/offboarding";

/**
 * Offboarding, server side (founder, 2026-11-05): records the departure, ends the staff plan, schedules the deletion and
 * sends the two emails. The daily job deletes only what is due, and only once.
 */
type Admin = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];

async function db(): Promise<Admin> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

type DepartureRow = {
  id: string; user_id: string | null; member_email: string; delete_on: string | null; reminders: string[];
};

/** staff_departures ships with its migration, so its generated types lag behind: reached through one cast. */
type DepartQuery = PromiseLike<{ data: DepartureRow[] | null; error: unknown }> & {
  is: (col: string, op: "null", value: null) => DepartQuery;
  not: (col: string, op: "is", value: null) => DepartQuery;
};
type Departures = {
  insert: (row: Record<string, unknown>) => { select: (cols: string) => { single: () => Promise<{ data: { id: string } | null; error: unknown }> } };
  select: (cols: string) => DepartQuery;
  update: (row: Record<string, unknown>) => { eq: (col: string, value: unknown) => Promise<{ error: unknown }> };
};
type Grants = {
  update: (row: Record<string, unknown>) => { eq: (col: string, value: unknown) => Promise<{ error: unknown }> };
};

const departures = async () => (await db()) as unknown as Departures;
const grants = async () => (await db()) as unknown as Grants;

async function sendOffboardingEmail(to: string, kind: "ended" | "7", deleteOn: string): Promise<boolean> {
  const key = process.env["RESEND_API_KEY"] || process.env["CameThroughAudio"];
  if (!key) return false;
  const on = new Date(deleteOn).toLocaleDateString();
  const html = emailLayout(`<p style="font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#004AAD;margin:0">Your account</p>
<h1 style="font-size:22px;margin:8px 0 16px">${kind === "ended" ? "Your access has ended" : `Your account is deleted on ${escapeHtml(on)}`}</h1>
${kind === "ended"
    ? `<p style="font-size:15px;line-height:1.6">Your work with Came Through Audio has ended, so this account's access ended the same day.</p>`
    : `<p style="font-size:15px;line-height:1.6">This is a reminder that this account and everything in it is deleted on <b>${escapeHtml(on)}</b>.</p>`}
<p style="font-size:15px;line-height:1.6"><b>Want to keep it? ${escapeHtml(SECURE_COPY)}</b> Any plan, any tier: your songs, their files, split sheets, contracts and certificates stay exactly where they are, and the deletion stops.</p>
<p style="font-size:15px;line-height:1.6">If you'd rather take your work with you, you have until ${escapeHtml(on)} to download it — the same date the account is deleted if nothing is paid.</p>
<p style="margin:24px 0"><a href="${SITE_URL}/profile" style="background:#004AAD;color:#ffffff;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:8px;display:inline-block">Keep my account</a>
<a href="${SITE_URL}/workspace" style="color:#004AAD;font-weight:700;padding:12px 12px;display:inline-block">Download my assets</a></p>
<p style="font-size:15px;line-height:1.6">If you think this is a mistake, reply to this email and a person will look at it.</p>`,
    { reason: "You're receiving this because this email is on a Came Through Audio account." });
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "Idempotency-Key": mailKey("offboarding", to, kind) },
    body: JSON.stringify({
      from: `Came Through Audio <${ADMIN_EMAIL}>`, to: [to],
      subject: kind === "ended" ? "Your Came Through Audio access has ended" : `Your account is deleted on ${on}`, html,
    }),
  }).catch((e) => { console.error("Offboarding email failed", e); return null; });
  return !!res?.ok;
}

/**
 * Called the moment staff access is removed. Ends the staff plan on this account and on any member account it reported,
 * records the departure, and schedules the deletion when the person left inside their first 90 days. Past 90 days nothing
 * is scheduled: that policy is undecided.
 */
export async function recordStaffDeparture(input: { userId: string; firstDay: string; actorId: string; lastDay?: string }) {
  const client = await db();
  const now = new Date();
  const lastDay = input.lastDay ?? now.toISOString();
  const within = leftWithinProbation(input.firstDay, lastDay);
  const deleteOn = within ? addDays(now, ASSET_DAYS).toISOString() : null;
  const { data: user } = await client.auth.admin.getUserById(input.userId);
  const email = user.user?.email ?? "";
  if (!email) return { ok: true as const, within, deleteOn, emailed: false };

  // Inside 90 days the grant follows the job, not the account: ending it here is what stops management features that
  // day. Past 90 days it is left alone, because the plan runs to the end of its period and then bills as a normal plan.
  if (within) {
    const g = await grants();
    await g.update({ ended_at: now.toISOString(), updated_at: now.toISOString() }).eq("user_id", input.userId);
    await g.update({ ended_at: now.toISOString(), updated_at: now.toISOString() }).eq("reported_by", input.userId);
  }

  const t = await departures();
  const { data: row, error } = await t.insert({
    user_id: input.userId, member_email: email, first_day: input.firstDay, last_day: lastDay,
    within_probation: within, access_ended_at: now.toISOString(), delete_on: deleteOn, recorded_by: input.actorId,
  }).select("id").single();
  if (error || !row) throw new Error("Staff access was removed, but the departure record didn't save. Add it by hand.");
  const emailed = deleteOn ? await sendOffboardingEmail(email, "ended", deleteOn) : false;
  if (emailed) await t.update({ reminders: ["ended"], updated_at: now.toISOString() }).eq("id", row.id);
  return { ok: true as const, within, deleteOn, emailed };
}

/**
 * Daily job: the week-before reminder, then the deletion itself. Skips anyone who holds a staff role again (rehired or
 * recorded by mistake), anyone cancelled, and anyone already deleted. Deleting the account removes its data with it.
 */
export async function runStaffOffboarding(now = new Date()) {
  const client = await db();
  const result = { staffReminded: 0, staffDeleted: 0, staffSkipped: 0 };
  const t = await departures();
  const { data, error } = await t.select("id, user_id, member_email, delete_on, reminders")
    .is("deleted_at", "null", null).is("cancelled_at", "null", null).not("delete_on", "is", null);
  if (error) throw error;

  for (const row of data ?? []) {
    if (!row.user_id || !row.delete_on) continue;
    const { data: roles } = await client.from("user_roles").select("role").eq("user_id", row.user_id);
    if ((roles ?? []).length) { result.staffSkipped += 1; continue; }

    const reminder = dueDepartureReminder({ access_ended_at: "", delete_on: row.delete_on, reminders: row.reminders }, now);
    if (reminder) {
      if (!(await sendOffboardingEmail(row.member_email, reminder, row.delete_on))) continue;
      await t.update({ reminders: [...new Set([...row.reminders, reminder])], updated_at: now.toISOString() }).eq("id", row.id);
      result.staffReminded += 1;
    }
    // Paying at any point in the 30 days keeps the account: re-checked on the day so a late payment still wins.
    if (new Date(row.delete_on) > now) continue;
    const tier = (await client.rpc("user_tier" as never, { _uid: row.user_id } as never)).data as unknown as string;
    if (keepsAccountOnPayment(tier ?? "free")) {
      await t.update({ cancelled_at: now.toISOString(), updated_at: now.toISOString() }).eq("id", row.id);
      result.staffSkipped += 1;
      continue;
    }

    const { error: delError } = await client.auth.admin.deleteUser(row.user_id);
    if (delError) { console.error(`Staff offboarding: couldn't delete ${row.user_id}`, delError.message); continue; }
    await t.update({ deleted_at: now.toISOString(), updated_at: now.toISOString() }).eq("id", row.id);
    result.staffDeleted += 1;
  }
  return result;
}
