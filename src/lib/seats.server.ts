import { seatShouldEnd, type ArtistSeat } from "./seats";

/**
 * Daily seat endings (founder, 2026-11-08): a seat whose paid period has passed becomes `ended`, so the owner's list,
 * the artist's tier and the buyer's bill agree. It writes the status once and never deletes the seat. A handed-off seat
 * is the artist's own plan now and is left alone.
 */
type Admin = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];

export async function runSeatEndings(now = new Date()) {
  const db: Admin = (await import("@/integrations/supabase/client.server")).supabaseAdmin;
  const { data, error } = await db.from("artist_seats" as never)
    .select("id, status, current_period_end" as never)
    .in("status" as never, ["unclaimed", "invited", "active", "canceled"] as never)
    .not("current_period_end", "is", null)
    .lte("current_period_end", now.toISOString());
  if (error) throw error;
  const due = ((data ?? []) as unknown as Pick<ArtistSeat, "id" | "status" | "current_period_end">[])
    .filter((seat) => seatShouldEnd(seat, now))
    .map((seat) => seat.id);
  if (!due.length) return { seatsEnded: 0 };
  const { error: saveError } = await db.from("artist_seats" as never)
    .update({ status: "ended", updated_at: now.toISOString() } as never)
    .in("id" as never, due as never);
  if (saveError) throw saveError;
  return { seatsEnded: due.length };
}
