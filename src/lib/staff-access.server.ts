import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { resolveAccess, type StaffAccess } from "./departments";

/**
 * The signed-in staff member's access, read from public.user_roles. One lookup for every staff gate — the auth
 * middleware's context goes straight in, no hand-written client shape — and `resolveAccess`, not `public.is_staff`,
 * decides, so the HR Admin is staff like everyone else (founder, 2026-11-23). No staff row returns null.
 */
export type StaffContext = { supabase: SupabaseClient<Database>; userId: string };

export async function staffAccessOf(context: StaffContext): Promise<StaffAccess | null> {
  const { data } = await context.supabase
    .from("user_roles")
    .select("role, departments")
    .eq("user_id", context.userId);
  return resolveAccess((data ?? []) as { role: string; departments?: string[] | null }[]);
}

/** Refuse anyone without a staff seat, in the caller panel's own wording. */
export async function requireStaffAccess(
  context: StaffContext,
  message: string,
): Promise<StaffAccess> {
  const access = await staffAccessOf(context);
  if (!access) throw new Error(message);
  return access;
}
