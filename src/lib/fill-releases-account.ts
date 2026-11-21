import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { releaseKey, type FillRelease } from "./fill-releases";

/**
 * The account's own copy of the releases a member typed by hand (founder, 2026-11-16): a title named on one device is
 * offered on the next. The table only ever answers for the caller — the row's user_id defaults to auth.uid() and RLS
 * refuses anyone else's (20261117133708_fill-releases.sql) — so every statement here is scoped by user_id as well.
 *
 * These writes live apart from the server functions so the update, insert and duplicate-race paths can be tested with a
 * stand-in client (fill-releases-account.test.ts): a release that only reaches the browser is the bug that hid here, and
 * it hid because nothing exercised the write.
 */
export type ReleaseDb = SupabaseClient<Database>;
export type ReleaseEntry = { type: FillRelease["type"]; name: string };

type Row = { id: string; kind: string; name: string };

export const toRelease = (row: Row): FillRelease => ({
  id: String(row.id),
  type: row.kind as FillRelease["type"],
  name: String(row.name),
});

/** The dialog's own spelling rule, so "afterglow " and "Afterglow" are one release here too. */
const sameRelease = (row: { kind: string; name: string }, wanted: { kind: string; name: string }) =>
  releaseKey({ type: row.kind, name: row.name }) ===
  releaseKey({ type: wanted.kind, name: wanted.name });

async function rowsFor(db: ReleaseDb, userId: string): Promise<Row[]> {
  const { data, error } = await db
    .from("fill_releases")
    .select("id, kind, name")
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  return data ?? [];
}

/**
 * Remembers one release and hands it back. A title typed the same way twice comes back as the same row, so "afterglow "
 * can't sit beside "Afterglow".
 *
 * The row is found and updated rather than upserted (founder, 2026-11-17): the unique index that keeps one entry is on
 * `lower(btrim(name))` (20261117133708_fill-releases.sql), an expression PostgREST cannot name as an `on_conflict`
 * target, so an upsert on the plain columns fails with 42P10 and the release would only ever live in the browser.
 */
export async function rememberRelease(
  db: ReleaseDb,
  userId: string,
  data: ReleaseEntry,
): Promise<FillRelease> {
  const wanted = { kind: data.type, name: data.name };
  const existing = (await rowsFor(db, userId)).find((row) => sameRelease(row, wanted));
  if (existing) {
    const { data: saved, error } = await db
      .from("fill_releases")
      .update({ name: data.name })
      .eq("user_id", userId)
      .eq("id", existing.id)
      .select("id, kind, name")
      .single();
    if (error) throw new Error(error.message);
    return toRelease(saved);
  }
  const { data: saved, error } = await db
    .from("fill_releases")
    .insert({ user_id: userId, kind: data.type, name: data.name })
    .select("id, kind, name")
    .single();
  if (error) {
    // Another tab may have written the same release between the read and the insert. The unique index refuses the
    // duplicate, so hand back the row that won instead of an error the dialog would show as a failed save.
    const won = (await rowsFor(db, userId)).find((row) => sameRelease(row, wanted));
    if (won) return toRelease(won);
    throw new Error(error.message);
  }
  return toRelease(saved);
}

/**
 * Forgets an entry the member no longer wants offered. The row is matched with the same rule the dialog uses, so a title
 * holding a `%` or `_` is still found as itself rather than as a wildcard.
 */
export async function forgetRelease(
  db: ReleaseDb,
  userId: string,
  data: ReleaseEntry,
): Promise<true> {
  const wanted = { kind: data.type, name: data.name };
  const matching = (await rowsFor(db, userId)).filter((row) => sameRelease(row, wanted));
  if (!matching.length) return true;
  const { error } = await db
    .from("fill_releases")
    .delete()
    .eq("user_id", userId)
    .in(
      "id",
      matching.map((row) => row.id),
    );
  if (error) throw new Error(error.message);
  return true;
}
