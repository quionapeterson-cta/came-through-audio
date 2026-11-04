import { supabase } from "@/integrations/supabase/client";
import type { Tier } from "@/lib/plans";

/**
 * Add-on artist seats (founder, 2026-11-04). The owner pays for a seat, names the artist and sends it to their email;
 * the artist signs up with that address and accepts it, like an invited signature request. These reads fail softly
 * while the migration hasn't been run, so the pages that mention seats still work.
 */

export type SeatStatus = "unclaimed" | "invited" | "active" | "canceled" | "ended";

export type ArtistSeat = {
  id: string;
  owner_id: string;
  tier: Exclude<Tier, "free">;
  artist_name: string;
  invite_email: string | null;
  member_user_id: string | null;
  status: SeatStatus;
  current_period_end: string | null;
  environment: string;
  accepted_at: string | null;
};

export type SeatInvite = {
  artist_name: string;
  tier: Exclude<Tier, "free">;
  inviter: string | null;
  email: string;
  claimed: boolean;
  ends_on: string | null;
};

const COLUMNS = "id, owner_id, tier, artist_name, invite_email, member_user_id, status, current_period_end, environment, accepted_at";

/** `ready: false` means the artist-seats migration hasn't run, so buying must stay off (no seat row could be written). */
export type SeatState = { ready: boolean; seats: ArtistSeat[] };

/** Seats this account owns, plus the seat they were invited to (RLS returns both). */
export async function listSeatState(): Promise<SeatState> {
  const { data, error } = await supabase.from("artist_seats" as never).select(COLUMNS as never)
    .order("created_at", { ascending: false });
  if (error) {
    if (/does not exist|schema cache/i.test(error.message)) return { ready: false, seats: [] };
    throw error;
  }
  return { ready: true, seats: (data ?? []) as unknown as ArtistSeat[] };
}

/** The artists on this account's seats who accepted: the profiles an owner can switch between to edit their defaults. */
export function seatArtistsFor(seats: ArtistSeat[], ownerId: string): { userId: string; name: string; tier: Exclude<Tier, "free"> }[] {
  return seats
    .filter((s) => s.owner_id === ownerId && !!s.member_user_id && (s.status === "active" || s.status === "canceled"))
    .map((s) => ({ userId: s.member_user_id!, name: s.artist_name || "Unnamed artist", tier: s.tier }));
}

/** A seat is usable while the owner keeps paying, and for the rest of the period after they cancel. */
export function seatIsLive(seat: ArtistSeat, now = new Date()) {
  if (seat.status === "ended") return false;
  if (seat.status === "canceled") return !!seat.current_period_end && new Date(seat.current_period_end) > now;
  return true;
}

/** The invite behind /seat/<id>, readable without an account (the link is what the email carries). */
export async function getSeatInvite(seatId: string): Promise<SeatInvite | null> {
  const { data, error } = await supabase.rpc("get_artist_seat_invite" as never, { _seat_id: seatId } as never);
  if (error) throw new Error(error.message);
  return (data as SeatInvite | null) ?? null;
}

/** Claims the seat for the signed-in account. The database checks the email it was sent to. */
export async function acceptSeat(seatId: string): Promise<{ tier: Exclude<Tier, "free">; artist_name: string }> {
  const { data, error } = await supabase.rpc("accept_artist_seat" as never, { _seat_id: seatId } as never);
  if (error) throw new Error(error.message);
  return data as { tier: Exclude<Tier, "free">; artist_name: string };
}
