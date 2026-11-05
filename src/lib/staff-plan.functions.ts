import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveAccess, type StaffAccess } from "./departments";
import { getPaymentsEnvironment } from "./payments-env";
import { memberEmailProblem, staffPlanWindow } from "./staff-plan";

/**
 * The staff plan's server side (founder, 2026-11-05). Any staff login is management already (the database's user_tier
 * says so). Here a staff member reports the member account they already use, and a super admin or HR marks it staff,
 * which gives that account the same free management plan — after the year it has paid for runs out.
 *
 * Nothing here can grant a role, a tier by hand or a refund: it writes one grant row, and the tier only follows while
 * that row is approved and inside its window.
 */
async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

type GrantRow = {
  user_id: string;
  member_email: string;
  status: "pending" | "active" | "declined";
  starts_at: string | null;
  ends_at: string | null;
  reported_by: string | null;
  created_at: string;
};

/**
 * staff_plan_grants ships with its migration, so the generated database types lag behind it until the next sync. This is
 * the one place that reaches it, and every read comes back empty before the migration instead of throwing.
 */
type Grants = {
  select: (cols: string) => {
    eq: (col: string, value: unknown) => {
      maybeSingle: () => Promise<{ data: GrantRow | null }>;
      order: (col: string, opts: { ascending: boolean }) => Promise<{ data: GrantRow[] | null }>;
    };
    order: (col: string, opts: { ascending: boolean }) => { limit: (n: number) => Promise<{ data: GrantRow[] | null }> };
  };
  insert: (row: Record<string, unknown>) => Promise<{ error: unknown }>;
  update: (row: Record<string, unknown>) => { eq: (col: string, value: unknown) => Promise<{ error: unknown }> };
};

const COLS = "user_id, member_email, status, starts_at, ends_at, reported_by, created_at";

const grantsTable = async () => (await db()) as unknown as Grants;

type Ctx = {
  supabase: { from: (table: "user_roles") => { select: (c: string) => { eq: (col: string, v: unknown) => PromiseLike<{ data: unknown }> } } };
  userId: string;
};

async function accessOf(context: Ctx): Promise<StaffAccess | null> {
  const { data } = await context.supabase.from("user_roles").select("role, departments").eq("user_id", context.userId);
  return resolveAccess((data ?? []) as { role: string; departments?: string[] | null }[]);
}

async function requireStaff(context: Ctx): Promise<StaffAccess> {
  const access = await accessOf(context);
  if (!access) throw new Error("The staff plan is for team members. Ask HR if your access is missing.");
  return access;
}

export type StaffGrant = {
  userId: string;
  memberEmail: string;
  status: GrantRow["status"];
  startsAt: string | null;
  endsAt: string | null;
  reportedBy: string | null;
  reportedAt: string;
};

const toGrant = (r: GrantRow): StaffGrant => ({
  userId: r.user_id,
  memberEmail: r.member_email,
  status: r.status,
  startsAt: r.starts_at,
  endsAt: r.ends_at,
  reportedBy: r.reported_by,
  reportedAt: r.created_at,
});

/** The caller's own staff plan: staff status, the grant on this account, and the accounts they reported. */
export const myStaffPlan = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ isStaff: boolean; own: StaffGrant | null; reported: StaffGrant[] }> => {
    if (!(await accessOf(context as unknown as Ctx))) return { isStaff: false, own: null, reported: [] };
    try {
      const t = await grantsTable();
      const [own, reports] = await Promise.all([
        t.select(COLS).eq("user_id", context.userId).maybeSingle(),
        t.select(COLS).eq("reported_by", context.userId).order("created_at", { ascending: false }),
      ]);
      return { isStaff: true, own: own.data ? toGrant(own.data) : null, reported: (reports.data ?? []).map(toGrant) };
    } catch {
      // The table arrives with its migration; until then the page simply shows nothing.
      return { isStaff: true, own: null, reported: [] };
    }
  });

/** A staff member reports the member account they already use, so it can be marked staff. */
export const reportStaffMemberEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ email: z.string().trim().toLowerCase().min(3).max(320) }).parse(d))
  .handler(async ({ data, context }) => {
    await requireStaff(context as unknown as Ctx);
    const problem = memberEmailProblem(data.email, false);
    if (problem) throw new Error(problem);
    const d = await db();
    const { data: found } = await d.rpc("billing_find_user" as never, { _email: data.email } as never);
    const target = typeof found === "string" ? found : null;
    if (!target) throw new Error("No account uses that email yet. Check the spelling, or sign up with it first.");
    if (target === context.userId) throw new Error("That is the account you are signed in with. Report the other one, the account you use as an artist.");
    const t = await grantsTable();
    const existing = await t.select(COLS).eq("user_id", target).maybeSingle();
    if (existing.data) throw new Error(memberEmailProblem(data.email, true)!);
    const { error } = await t.insert({ user_id: target, reported_by: context.userId, member_email: data.email, status: "pending" });
    if (error) throw new Error("Couldn't save that. Try again, or ask a super admin to add it.");
    return { ok: true as const };
  });

/** The queue a super admin or HR works: everything reported, newest first. */
export const staffPlanQueue = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ grants: StaffGrant[] }> => {
    const access = await requireStaff(context as unknown as Ctx);
    if (!access.canManageStaff) throw new Error("Only a super admin or HR can review staff plan requests.");
    const t = await grantsTable();
    const { data } = await t.select(COLS).order("created_at", { ascending: false }).limit(100);
    return { grants: (data ?? []).map(toGrant) };
  });

/**
 * Approve or decline a reported account. Approving works out the window from that account's own subscription: a member
 * who is paying finishes the year first, and the free staff year is measured from that cycle's start.
 */
export const decideStaffPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ userId: z.string().uuid(), approve: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const access = await requireStaff(context as unknown as Ctx);
    // Marking an account as staff is the founder's call, and HR may do it too; nobody may mark their own account.
    if (access.role !== "super_admin" && access.role !== "hr_admin") throw new Error("Only a super admin or HR can decide this.");
    if (data.userId === context.userId) throw new Error("You can't mark your own account.");
    const now = new Date().toISOString();
    const t = await grantsTable();
    if (!data.approve) {
      const { error } = await t.update({ status: "declined", updated_at: now }).eq("user_id", data.userId);
      if (error) throw new Error("Couldn't save that decision.");
      return { ok: true as const, window: null };
    }
    const d = await db();
    const { data: sub } = await d.from("subscriptions").select("current_period_start, current_period_end")
      .eq("user_id", data.userId).eq("environment", getPaymentsEnvironment())
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    const s = sub as { current_period_start: string | null; current_period_end: string | null } | null;
    const window = staffPlanWindow({ cycleStart: s?.current_period_start ?? null, cycleEnd: s?.current_period_end ?? null });
    const { error } = await t.update({
      status: "active", starts_at: window.startsAt, ends_at: window.endsAt, granted_by: context.userId, granted_at: now, updated_at: now,
    }).eq("user_id", data.userId);
    if (error) throw new Error("Couldn't mark that account as staff.");
    return { ok: true as const, window };
  });
