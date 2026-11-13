import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { FILL_RELEASE_TYPES, type FillRelease } from "./fill-releases";

/**
 * The releases a member typed by hand in the fill dialog (founder, 2026-11-16): kept with the account, so a title named on one
 * device is offered on the next. The table only ever answers for the caller — the row's user_id defaults to auth.uid() and RLS
 * refuses anyone else's (20261116120000_fill-releases.sql).
 */

const entry = z.object({
  type: z.enum(FILL_RELEASE_TYPES),
  name: z.string().trim().min(1).max(160),
});
export type FillReleaseInput = z.infer<typeof entry>;

/** Newest first, at most the handful the dialog offers. */
export const listFillReleases = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("fill_releases")
      .select("id, kind, name")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(24);
    if (error) throw new Error(error.message);
    return (data ?? []).map((row) => ({ id: String(row.id), type: row.kind as FillRelease["type"], name: String(row.name) }));
  });

/**
 * Remembers one release and hands back the account's list. A title typed the same way twice comes back as the same row: the case-
 * and space-insensitive unique index makes the second write a no-op update, so "afterglow " can't sit beside "Afterglow".
 */
export const rememberFillRelease = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => entry.parse(data))
  .handler(async ({ data, context }) => {
    const { data: saved, error } = await context.supabase
      .from("fill_releases")
      .upsert({ user_id: context.userId, kind: data.type, name: data.name }, { onConflict: "user_id,kind,name", ignoreDuplicates: false })
      .select("id, kind, name")
      .single();
    if (error) throw new Error(error.message);
    return { id: String(saved.id), type: saved.kind as FillRelease["type"], name: String(saved.name) };
  });

/** Forgets an entry the member no longer wants offered. */
export const forgetFillRelease = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: z.infer<typeof entry>) => entry.parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("fill_releases")
      .delete()
      .eq("user_id", context.userId)
      .eq("kind", data.type)
      .ilike("name", data.name);
    if (error) throw new Error(error.message);
    return true;
  });
