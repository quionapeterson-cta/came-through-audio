import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { fromCatalogRow } from "@/lib/catalog";
import { lookupSong, type LookupResult } from "@/lib/lookups";
import { INTERNATIONAL } from "@/lib/repertoires";

/**
 * Runs the live lookups for one of the caller's own songs and saves them as automatic repertoire checks.
 * The track is read with the caller's own client, so row-level security keeps people to their own catalog.
 */
export const runSongLookups = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ trackId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<LookupResult> => {
    const { data: row, error } = await context.supabase.from("catalogs").select("*").eq("id", data.trackId).maybeSingle();
    if (error || !row) throw new Error("Song not found.");
    const t = fromCatalogRow(row as Record<string, unknown>);
    const result = await lookupSong({ isrc: t.metadata.isrc, title: t.title, artist: t.artist });
    const now = new Date().toISOString();
    const rows = [
      { society: INTERNATIONAL.deezer.id, hit: result.streaming },
      { society: INTERNATIONAL.musicbrainz.id, hit: result.work },
    ].map(({ society, hit }) => ({
      user_id: context.userId, track_id: t.id, society, source: "auto", status: hit ? "found" : "not_listed",
      details: (hit ?? {}) as never, checked_at: now,
    }));
    const { error: saveError } = await context.supabase.from("repertoire_checks").upsert(rows, { onConflict: "track_id,society" });
    if (saveError) throw new Error("Couldn't save the lookup results.");
    return result;
  });
