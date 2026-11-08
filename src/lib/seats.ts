import { supabase } from "@/integrations/supabase/client";
import type { Tier } from "@/lib/plans";

/**
 * Add-on artist seats (founder, 2026-11-04). The owner pays for a seat, names the artist and sends it to their email;
 * the artist signs up with that address and accepts it, like an invited signature request. These reads fail softly
 * while the migration hasn't been run, so the pages that mention seats still work.
 */

export type SeatStatus = "unclaimed" | "invited" | "active" | "canceled" | "ended" | "handed_off";

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
  handed_off_at?: string | null;
  handoff_offered_at?: string | null;
};

export type SeatInvite = {
  artist_name: string;
  tier: Exclude<Tier, "free">;
  inviter: string | null;
  email: string;
  claimed: boolean;
  ends_on: string | null;
};

const COLUMNS = "id, owner_id, tier, artist_name, invite_email, member_user_id, status, current_period_end, environment, accepted_at, handoff_offered_at";

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
    // Anyone attached to a live seat is an artist whose defaults the owner sets up, whatever the webhook last wrote
    // to the status: an artist who accepted must never vanish from the list because a row says "invited" (2026-11-04).
    // A cancelled seat stays usable until its paid year ends, and stops the day it does — the same rule the tier
    // function and every policy use, so the chooser can never offer an artist whose seat has lapsed.
    .filter((s) => s.owner_id === ownerId && !!s.member_user_id && seatIsLive(s))
    .map((s) => ({ userId: s.member_user_id!, name: s.artist_name || "Unnamed artist", tier: s.tier }));
}

/** A seat is usable while the owner keeps paying, and for the rest of the period after they cancel. */
export function seatIsLive(seat: ArtistSeat, now = new Date()) {
  // A handed-off seat is the artist's own plan now: the owner's access ended with the handoff.
  if (seat.status === "ended" || seat.status === "handed_off") return false;
  if (seat.status === "canceled") return !!seat.current_period_end && new Date(seat.current_period_end) > now;
  return true;
}

/**
 * An owner offered this plan to the artist (founder, 2026-11-08). Only an offer: nothing in billing moves until the
 * artist completes the same handoff checkout, and the offer dies with the seat.
 */
export const handoffOffered = (seat: Pick<ArtistSeat, "handoff_offered_at">) => !!seat.handoff_offered_at;

/** A seat whose paid period has passed is ended by the daily job. A handed-off seat is the artist's own plan now. */
export const seatShouldEnd = (seat: Pick<ArtistSeat, "status" | "current_period_end">, now = new Date()) =>
  ["unclaimed", "invited", "active", "canceled"].includes(seat.status)
  && !!seat.current_period_end && new Date(seat.current_period_end) <= now;

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
