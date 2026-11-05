import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveAccess } from "./departments";

/**
 * Scheduled departures (founder, 2026-11-05). A super admin or HR reads the list so every deletion date is on a screen
 * before it happens, and can cancel a row for a rehire or a mistake. Cancelling never deletes anything; the daily job is
 * still the only thing that deletes an account.
 */
async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

type Ctx = {
  supabase: { from: (table: "user_roles") => { select: (c: string) => { eq: (col: string, v: unknown) => PromiseLike<{ data: unknown }> } } };
  userId: string;
};

async function requireManager(context: Ctx) {
  const { data } = await context.supabase.from("user_roles").select("role, departments").eq("user_id", context.userId);
  const access = resolveAccess((data ?? []) as { role: string; departments?: string[] | null }[]);
  if (!access?.canManageStaff) throw new Error("Super Admin or HR Admin only.");
  return access;
}

export type StaffDeparture = {
  id: string;
  email: string;
  accessEndedAt: string;
  deleteOn: string | null;
  withinProbation: boolean;
  cancelledAt: string | null;
  deletedAt: string | null;
};

type Row = {
  id: string; member_email: string; access_ended_at: string; delete_on: string | null;
  within_probation: boolean; cancelled_at: string | null; deleted_at: string | null;
};

/** staff_departures ships with its migration, so its generated types lag behind: reached through one cast. */
type Departures = {
  select: (cols: string) => { order: (col: string, opts: { ascending: boolean }) => { limit: (n: number) => Promise<{ data: Row[] | null }> } };
  update: (row: Record<string, unknown>) => { eq: (col: string, value: unknown) => Promise<{ error: unknown }> };
};
const table = async () => (await db()) as unknown as Departures;

const toRow = (r: Row): StaffDeparture => ({
  id: r.id, email: r.member_email, accessEndedAt: r.access_ended_at, deleteOn: r.delete_on,
  withinProbation: r.within_probation, cancelledAt: r.cancelled_at, deletedAt: r.deleted_at,
});

export const listStaffDepartures = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ departures: StaffDeparture[] }> => {
    await requireManager(context as unknown as Ctx);
    try {
      const t = await table();
      const { data } = await t.select("id, member_email, access_ended_at, delete_on, within_probation, cancelled_at, deleted_at")
        .order("created_at", { ascending: false }).limit(50);
      return { departures: (data ?? []).map(toRow) };
    } catch {
      // Before the migration runs there is nothing to show, not an error.
      return { departures: [] };
    }
  });

/** Calls off a scheduled deletion: a rehire, or a departure recorded by mistake. */
export const cancelStaffDeparture = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await requireManager(context as unknown as Ctx);
    const now = new Date().toISOString();
    const t = await table();
    const { error } = await t.update({ cancelled_at: now, updated_at: now }).eq("id", data.id);
    if (error) throw new Error("Couldn't cancel that deletion.");
    return { ok: true as const };
  });
