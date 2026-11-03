import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  FastTrackError,
  pullDiscography,
  type ArtistCandidate,
  type Discography,
} from "@/lib/discography";
import { matchCompositions, type CompositionMatch } from "@/lib/composition";
import { mlcLookup } from "@/lib/composition.server";

/**
 * The Streaming Fast-Track pull (hub plan §4). Reads an artist's released tracks from Deezer — no key, no approval —
 * then asks the composition side about each recording. That second half answers honestly: with no MLC credentials
 * every work comes back unverified and the UI says so, rather than inventing registrations.
 *
 * A typed name that several artists share comes back as `choose`, so the artist picks themselves. Nothing is
 * diagnosed against an artist we merely guessed at.
 */
export type FastTrackResult =
  | {
      ok: true;
      kind: "discography";
      discography: Discography;
      matches: CompositionMatch[];
      mlcActive: boolean;
    }
  | { ok: true; kind: "choose"; candidates: ArtistCandidate[] }
  | { ok: false; error: string };

const input = z.object({
  link: z.string().trim().max(500).optional(),
  name: z.string().trim().max(120).optional(),
  artistId: z.number().int().positive().optional(),
});

export const runStreamingFastTrack = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => input.parse(d))
  .handler(async ({ data }): Promise<FastTrackResult> => {
    try {
      const result = await pullDiscography({
        link: data.link,
        name: data.name,
        artistId: data.artistId,
      });
      if (result.kind === "choose")
        return { ok: true, kind: "choose", candidates: result.candidates };
      const { discography } = result;
      const lookup = mlcLookup();
      const queries = discography.releases.flatMap((r) =>
        r.tracks.map((t) => ({
          ...(t.isrc ? { isrc: t.isrc } : {}),
          title: t.title,
          artist: t.artist,
        })),
      );
      const matches = await matchCompositions(queries, lookup);
      return { ok: true, kind: "discography", discography, matches, mlcActive: lookup.available };
    } catch (error) {
      // Every FastTrackError message is written for the artist, so it can go straight back to the page.
      if (error instanceof FastTrackError) return { ok: false, error: error.message };
      console.error("streaming fast-track failed:", error);
      return { ok: false, error: "Couldn't read your releases just now. Try again in a moment." };
    }
  });
