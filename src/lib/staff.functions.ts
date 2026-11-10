import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ADMIN_EMAIL, emailLayout, escapeHtml, SITE_URL } from "./email-layout";
import { mailKey } from "./mailer";
import { ACCEPT_STEPS, inviteBlocker } from "./staff-invites";
import {
  ASSIGNABLE_DEPARTMENTS, DEPARTMENTS, DEPARTMENT_LABEL, MANAGED_ROLES, ROLE_LABEL, normalizeDepartments, resolveAccess, staffChangeError,
  type Department, type ManagedRole, type StaffRole,
} from "./departments";

type AuthContext = { supabase: SupabaseClient<Database>; userId: string };

/** super_admin or hr_admin only. Returns whether the caller is a super admin. */
async function requireStaffManager(context: AuthContext) {
  const { data: rows } = await context.supabase.from("user_roles").select("role, departments").eq("user_id", context.userId);
  const access = resolveAccess(rows ?? []);
  if (!access?.canManageStaff) throw new Error("Forbidden");
  return { actorIsSuper: access.role === "super_admin" };
}

async function admin() {
  return (await import("@/integrations/supabase/client.server")).supabaseAdmin;
}

const memberSchema = z.object({
  role: z.enum(MANAGED_ROLES),
  departments: z.array(z.enum(ASSIGNABLE_DEPARTMENTS as [Exclude<(typeof DEPARTMENTS)[number], "launch">, ...Exclude<(typeof DEPARTMENTS)[number], "launch">[]])).max(ASSIGNABLE_DEPARTMENTS.length),
});

/** Writes the one managed role row (with departments) for a user and drops any other managed role. */
async function applyRole(actor: { userId: string; actorIsSuper: boolean }, targetId: string, role: ManagedRole, input: readonly string[]) {
  const db = await admin();
  const { data: current } = await db.from("user_roles").select("role").eq("user_id", targetId);
  const problem = staffChangeError({ actorId: actor.userId, actorIsSuper: actor.actorIsSuper, targetId, targetRoles: (current ?? []).map((r) => r.role), nextRole: role });
  if (problem) throw new Error(problem);
  const departments = normalizeDepartments(role, input);
  if (!departments.length && role !== "project_manager") throw new Error("Pick at least one department.");
  const { error } = await db.from("user_roles").upsert({ user_id: targetId, role, departments }, { onConflict: "user_id,role" });
  if (error) throw new Error("Couldn't save staff access.");
  await db.from("user_roles").delete().eq("user_id", targetId).in("role", MANAGED_ROLES.filter((r) => r !== role));
  return departments;
}

export type StaffMember = {
  userId: string; email: string; name: string | null; role: StaffRole; departments: Department[]; joined: boolean; addedAt: string;
};

/** Everyone with a staff role, with email, role and departments. */
export const listStaff = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { actorIsSuper } = await requireStaffManager(context);
    const db = await admin();
    const { data: rows, error } = await db.from("user_roles").select("user_id, role, departments, created_at").neq("role", "user").order("created_at");
    if (error) throw new Error("Couldn't load staff.");
    const ids = [...new Set((rows ?? []).map((r) => r.user_id))];
    const [{ data: profiles }, users] = await Promise.all([
      db.from("profiles").select("id, legal_name, stage_name").in("id", ids),
      Promise.all(ids.map((id) => db.auth.admin.getUserById(id).then((r) => r.data.user))),
    ]);
    const members: StaffMember[] = ids.flatMap((id, i) => {
      const own = (rows ?? []).filter((r) => r.user_id === id);
      const access = resolveAccess(own);
      if (!access) return [];
      const user = users[i];
      const profile = profiles?.find((p) => p.id === id);
      return [{
        userId: id,
        email: user?.email ?? "—",
        name: profile?.legal_name || profile?.stage_name || null,
        role: access.role,
        departments: access.departments,
        joined: !!user?.last_sign_in_at,
        addedAt: own[0]!.created_at,
      }];
    });
    return { members, me: context.userId, actorIsSuper };
  });

/** Invites someone by email (creating their account if needed) and gives them a staff role. */
export const inviteStaff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => memberSchema.extend({ email: z.string().trim().toLowerCase().email("Enter a valid email").max(255) }).parse(d))
  .handler(async ({ data, context }) => {
    const { actorIsSuper } = await requireStaffManager(context);
    const db = await admin();
    // One email, one identity (founder, 2026-11-05): staff sign in with their own address, never the member account they
    // may already have. generateLink then creates the account so user_roles has a real user_id, and we send our own email.
    const { data: found } = await db.rpc("billing_find_user" as never, { _email: data.email } as never);
    const existingId = typeof found === "string" ? found : null;
    const onTeam = existingId ? ((await db.from("user_roles").select("role").eq("user_id", existingId)).data ?? []).length > 0 : false;
    const problem = inviteBlocker({ email: data.email, memberAccount: !!existingId, onTeam });
    if (problem) throw new Error(problem);

    const invite = await db.auth.admin.generateLink({
      type: "invite",
      email: data.email,
      // Our own page, not a sign-up form: the link already signed them in, and the page asks for the password.
      options: { redirectTo: `${SITE_URL}/reset-password?invite=1` },
    });
    const user = invite.data?.user;
    const link = invite.data?.properties?.action_link;
    if (invite.error || !user || !link) throw new Error("Couldn't create that account. Check the address and try again.");

    const departments = await applyRole({ userId: context.userId, actorIsSuper }, user.id, data.role, data.departments);
    const emailed = await sendStaffEmail(data.email, data.role, departments, link);
    return { ok: true, emailed };
  });

/** Changes an existing staff member's role and departments. */
export const updateStaff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => memberSchema.extend({ userId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { actorIsSuper } = await requireStaffManager(context);
    await applyRole({ userId: context.userId, actorIsSuper }, data.userId, data.role, data.departments);
    return { ok: true };
  });

/** Removes staff access, records the departure and starts the offboarding clock. The person keeps their regular account. */
export const removeStaff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ userId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { actorIsSuper } = await requireStaffManager(context);
    const db = await admin();
    const { data: current } = await db.from("user_roles").select("role, created_at").eq("user_id", data.userId);
    const problem = staffChangeError({ actorId: context.userId, actorIsSuper, targetId: data.userId, targetRoles: (current ?? []).map((r) => r.role) });
    if (problem) throw new Error(problem);
    const firstDay = (current ?? []).map((r) => r.created_at).sort()[0];
    const { error } = await db.from("user_roles").delete().eq("user_id", data.userId).in("role", [...MANAGED_ROLES]);
    if (error) throw new Error("Couldn't remove staff access.");
    // Access is gone either way; the record is what starts the 90-day rule and, inside it, the 30 days to download.
    const { recordStaffDeparture } = await import("./staff-offboarding.server");
    const departure = firstDay
      ? await recordStaffDeparture({ userId: data.userId, firstDay, actorId: context.userId })
      : { within: false, deleteOn: null, emailed: false };
    return { ok: true, withinProbation: departure.within, deleteOn: departure.deleteOn, emailed: departure.emailed };
  });

async function sendStaffEmail(to: string, role: ManagedRole, departments: Department[], link: string) {
  const key = process.env["RESEND_API_KEY"] || process.env["CameThroughAudio"];
  if (!key) return false;
  const depts = departments.map((d) => DEPARTMENT_LABEL[d]).join(", ");
  const html = emailLayout(`<p style="font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#004AAD;margin:0">Team Access</p>
<h1 style="font-size:22px;margin:8px 0 16px">You've been added to the Came Through Audio team</h1>
<p style="font-size:15px;line-height:1.6;margin:0 0 8px"><b>Role:</b> ${escapeHtml(ROLE_LABEL[role])}<br/><b>Departments:</b> ${escapeHtml(depts)}</p>
<p style="font-size:15px;line-height:1.6"><b>Your staff sign-in is separate from any member account.</b> Use this email and the password you choose here; the account you use as an artist stays just as it is.</p>
<ol style="font-size:15px;line-height:1.6;padding-left:20px">${ACCEPT_STEPS.map((s) => `<li style="margin:4px 0">${escapeHtml(s)}</li>`).join("")}</ol>
<p style="font-size:15px;line-height:1.6">While we're in private preview you'll also be asked for the preview passcode — your admin will share it with you.</p>
<p style="margin:24px 0"><a href="${link}" style="background:#004AAD;color:#ffffff;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:8px;display:inline-block">Set your password</a></p>`,
    { reason: "You're receiving this because a Came Through Audio admin gave this email staff access." });
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "Idempotency-Key": mailKey("staff-invite", to) },
    body: JSON.stringify({ from: `Came Through Audio <${ADMIN_EMAIL}>`, to: [to], subject: "Your Came Through Audio team access", html }),
  }).catch((e) => { console.error("Staff invite email failed", e); return null; });
  return !!res?.ok;
}
