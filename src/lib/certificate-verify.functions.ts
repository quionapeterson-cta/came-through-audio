import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type PublicCertificate = {
  id: string; track_title: string | null; artist_name: string | null; issued_at: string | null;
  proof_digest: string | null; ots_receipt: string | null; ots_calendar: string | null;
};

/**
 * What the QR code on a certificate opens (/verify/$id): the song, artist, issue time and the stamped fingerprint, so
 * anyone holding the certificate can check it. Never the manifest, credits, video fingerprints or files. Certificate
 * ids are random UUIDs, so they can't be guessed.
 */
export const getPublicCertificate = createServerFn({ method: "GET" })
  .inputValidator((input: { id: string }) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }): Promise<PublicCertificate | null> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin.from("ai_protection_certificates")
      .select("id, track_title, artist_name, issued_at, proof_digest, ots_receipt, ots_calendar").eq("id", data.id).maybeSingle();
    return (row as PublicCertificate | null) ?? null;
  });
