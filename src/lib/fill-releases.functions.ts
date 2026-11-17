import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { FILL_RELEASE_TYPES } from "./fill-releases";
import { forgetRelease, rememberRelease, toRelease } from "./fill-releases-account";

/**
 * The releases a member typed by hand in the fill dialog (founder, 2026-11-16): kept with the account, so a title named on one
 * device is offered on the next. The table only ever answers for the caller — the row's user_id defaults to auth.uid() and RLS
 * refuses anyone else's (20261117133708_fill-releases.sql). The writes themselves live in fill-releases-account.ts, where their
 * update, insert and duplicate-race paths are tested.
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
    return (data ?? []).map(toRelease);
  });

/** Remembers one release with the account, and hands back the row it lives in. */
export const rememberFillRelease = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => entry.parse(data))
  .handler(async ({ data, context }) => rememberRelease(context.supabase, context.userId, data));

/** Forgets one release, matched with the dialog's own spelling rule. */
export const forgetFillRelease = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => entry.parse(data))
  .handler(async ({ data, context }) => forgetRelease(context.supabase, context.userId, data));
