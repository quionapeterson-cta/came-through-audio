import { supabase } from "@/integrations/supabase/client";

const BUCKET = "share-cards";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isShareId = (s: string) => UUID.test(s);

/** Public URL of a stored share card (what og:image points at). */
export function shareCardImage(owner: string, card: string) {
  return `${import.meta.env['VITE_SUPABASE_URL']}/storage/v1/object/public/${BUCKET}/${owner}/${card}.png`;
}

/**
 * Uploads the teaser card to the public share-cards bucket and returns its /share page, whose og:image is the card.
 * Social sites only build previews from a public link, so this is what makes the image show up when posted.
 */
export async function publishShareCard(blob: Blob): Promise<string> {
  const { data } = await supabase.auth.getUser();
  const owner = data.user?.id;
  if (!owner) throw new Error("Log in to share your card.");
  const card = crypto.randomUUID();
  const { error } = await supabase.storage.from(BUCKET).upload(`${owner}/${card}.png`, blob, { contentType: "image/png", upsert: false });
  if (error) throw error;
  return `${window.location.origin}/share/${owner}/${card}`;
}
