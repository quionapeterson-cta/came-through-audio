import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveAccess, RETIRED_ISRC_DEPARTMENTS, type StaffAccess } from "./departments";
import { retiredRow, type CatalogRow, type RetiredIsrcRow } from "./retired-isrcs";

/**
 * Admin → Retired ISRCs (founder, 2026-11-12). Registration and Royalty Accounts chase a code change with the agencies;
 * Support sees it too, because a member often raises it in a ticket first. The server decides, the browser only reads.
 *
 * No new table and no new policy: the retired codes already live in each song's `details`, so this reads the catalogs
 * with the service role after a staff check and filters in code. `catalogs` is a member table, which is exactly why the
 * check comes first and the rows leave only as the fields named below.
 */
async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

type Ctx = {
  supabase: {
    from: (table: "user_roles") => { select: (columns: string) => { eq: (column: string, value: unknown) => PromiseLike<{ data: unknown }> } };
  };
  userId: string;
};

async function requireRetiredAccess(context: Ctx): Promise<StaffAccess> {
  const { data } = await context.supabase.from("user_roles").select("role, departments").eq("user_id", context.userId);
  const access = resolveAccess((data ?? []) as { role: string; departments?: string[] | null }[]);
  if (!access || !RETIRED_ISRC_DEPARTMENTS.some((d) => access.departments.includes(d))) {
    throw new Error("Retired ISRCs are for Registration, Royalty Accounts and Support.");
  }
  return access;
}

export type RetiredIsrcEntry = RetiredIsrcRow & { owner: string; email: string };

type Row = CatalogRow & { user_id: string };

/**
 * Every song carrying a retired code, newest change first, with the account it belongs to. A member's stage name and
 * email come from their own rows: stage name from the profile, email from the auth record, because the queue is worked
 * by telling the right person what was done.
 */
export const listRetiredIscrs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<RetiredIsrcEntry[]> => {
    await requireRetiredAccess(context as unknown as Ctx);
    const d = await db();
    const { data, error } = await d
      .from("catalogs")
      .select("id, user_id, track_title, artist_name, album_title, release_date, isrc, details, updated_at")
      .order("updated_at", { ascending: false })
      .limit(2000);
    if (error) throw new Error("Couldn't read the catalogs. Try again in a moment.");
    const rows = ((data ?? []) as Row[]).map(retiredRow).filter((r): r is RetiredIsrcRow => !!r);
    if (!rows.length) return [];

    // One lookup per account, not per song: a member with ten retired codes costs one profile and one auth read.
    const owners = [...new Set(rows.map((r) => r.ownerId))];
    const people = new Map<string, { owner: string; email: string }>();
    await Promise.all(owners.map(async (id) => {
      const [{ data: profile }, { data: auth }] = await Promise.all([
        d.from("profiles").select("stage_name").eq("id", id).maybeSingle(),
        d.auth.admin.getUserById(id).catch(() => ({ data: null })),
      ]);
      const stage = (profile as { stage_name?: string | null } | null)?.stage_name ?? "";
      const email = (auth as { user?: { email?: string | null } } | null)?.user?.email ?? "";
      people.set(id, { owner: stage.trim(), email });
    }));
    return rows.map((r) => ({ ...r, ...(people.get(r.ownerId) ?? { owner: "", email: "" }) }));
  });
