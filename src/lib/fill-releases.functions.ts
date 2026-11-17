import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { FILL_RELEASE_TYPES, releaseKey, type FillRelease } from "./fill-releases";

/**
 * The releases a member typed by hand in the fill dialog (founder, 2026-11-16): kept with the account, so a title named on one
 * device is offered on the next. The table only ever answers for the caller — the row's user_id defaults to auth.uid() and RLS
 * refuses anyone else's (20261117133708_fill-releases.sql).
 */

const entry = z.object({
  type: z.enum(FILL_RELEASE_TYPES),
  name: z.string().trim().min(1).max(160),
});
export type FillReleaseInput = z.infer<typeof entry>;

const toRelease = (row: { id: string; kind: string; name: string }): FillRelease => ({
  id: String(row.id),
  type: row.kind as FillRelease["type"],
  name: String(row.name),
});

/** The dialog's own spelling rule, so "afterglow " and "Afterglow" are one release here too. */
const sameRelease = (row: { kind: string; name: string }, wanted: { kind: string; name: string }) =>
  releaseKey({ type: row.kind, name: row.name }) === releaseKey({ type: wanted.kind, name: wanted.name });

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
 * Remembers one release and hands it back. A title typed the same way twice comes back as the same row, so "afterglow "
 * can't sit beside "Afterglow".
 *
 * The row is found and updated rather than upserted (founder, 2026-11-17): the unique index that keeps one entry is on
 * `lower(btrim(name))` (20261117133708_fill-releases.sql), an expression PostgREST cannot name as an `on_conflict`
 * target, so an upsert on the plain columns fails with 42P10 and the release would only ever live in the browser.
 */
export const rememberFillRelease = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => entry.parse(data))
  .handler(async ({ data, context }) => {
    const wanted = { kind: data.type, name: data.name };
    const { data: rows, error: readError } = await context.supabase
      .from("fill_releases")
      .select("id, kind, name")
      .eq("user_id", context.userId);
    if (readError) throw new Error(readError.message);
    const existing = (rows ?? []).find((row) => sameRelease(row, wanted));
    if (existing) {
      const { data: saved, error } = await context.supabase
        .from("fill_releases")
        .update({ name: data.name })
        .eq("user_id", context.userId)
        .eq("id", existing.id)
        .select("id, kind, name")
        .single();
      if (error) throw new Error(error.message);
      return toRelease(saved);
    }
    const { data: saved, error } = await context.supabase
      .from("fill_releases")
      .insert({ user_id: context.userId, kind: data.type, name: data.name })
      .select("id, kind, name")
      .single();
    if (error) {
      // Another tab may have written the same release between the read and the insert. The unique index refuses the
      // duplicate, so hand back the row that won instead of an error the dialog would swallow.
      const { data: again } = await context.supabase
        .from("fill_releases")
        .select("id, kind, name")
        .eq("user_id", context.userId);
      const won = (again ?? []).find((row) => sameRelease(row, wanted));
      if (won) return toRelease(won);
      throw new Error(error.message);
    }
    return toRelease(saved);
  });

/**
 * Forgets an entry the member no longer wants offered. The row is matched with the same rule the dialog uses, so a title
 * holding a `%` or `_` is still found as itself rather than as a wildcard.
 */
export const forgetFillRelease = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: z.infer<typeof entry>) => entry.parse(data))
  .handler(async ({ data, context }) => {
    const wanted = { kind: data.type, name: data.name };
    const { data: rows, error: readError } = await context.supabase
      .from("fill_releases")
      .select("id, kind, name")
      .eq("user_id", context.userId);
    if (readError) throw new Error(readError.message);
    const matching = (rows ?? []).filter((row) => sameRelease(row, wanted));
    if (!matching.length) return true;
    const { error } = await context.supabase
      .from("fill_releases")
      .delete()
      .eq("user_id", context.userId)
      .in("id", matching.map((row) => row.id));
    if (error) throw new Error(error.message);
    return true;
  });
