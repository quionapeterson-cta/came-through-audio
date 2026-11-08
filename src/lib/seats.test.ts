import { describe, expect, it } from "vitest";
import { handoffOffered, seatArtistsFor, seatIsLive, seatShouldEnd, type ArtistSeat } from "./seats";

const seat = (over: Partial<ArtistSeat>): ArtistSeat => ({
  id: "s1", owner_id: "owner", tier: "plus", artist_name: "Karma", invite_email: null,
  member_user_id: null, status: "unclaimed", current_period_end: null, environment: "sandbox", accepted_at: null, ...over,
});

/** Add-on artist seats: what an owner can manage, and which seats still lift their artist. */
describe("artist seats", () => {
  it("lists only the artists who accepted a seat this account owns", () => {
    const list = [
      seat({ id: "a", member_user_id: "u1", status: "active", artist_name: "Karma", tier: "management" }),
      seat({ id: "b", member_user_id: null, status: "invited" }),
      seat({ id: "c", member_user_id: "u2", status: "canceled", current_period_end: "2999-01-01T00:00:00Z", artist_name: "" }),
      seat({ id: "d", member_user_id: "u3", status: "active", owner_id: "someone-else" }),
    ];
    expect(seatArtistsFor(list, "owner")).toEqual([
      { userId: "u1", name: "Karma", tier: "management" },
      { userId: "u2", name: "Unnamed artist", tier: "plus" },
    ]);
  });

  it("keeps a cancelled seat live until the paid period ends", () => {
    const now = new Date("2026-11-04T00:00:00Z");
    expect(seatIsLive(seat({ status: "active" }), now)).toBe(true);
    expect(seatIsLive(seat({ status: "canceled", current_period_end: "2026-12-01T00:00:00Z" }), now)).toBe(true);
    expect(seatIsLive(seat({ status: "canceled", current_period_end: "2026-10-01T00:00:00Z" }), now)).toBe(false);
    expect(seatIsLive(seat({ status: "ended" }), now)).toBe(false);
  });

  it("stops treating a seat as live the day its paid year ends, whatever the webhook last wrote", () => {
    const now = new Date("2026-11-08T00:00:00Z");
    expect(seatIsLive(seat({ status: "active", current_period_end: "2026-11-07T00:00:00Z" }), now)).toBe(false);
    expect(seatIsLive(seat({ status: "invited", current_period_end: "2026-11-07T00:00:00Z" }), now)).toBe(false);
    expect(seatIsLive(seat({ status: "active", current_period_end: "2027-11-07T00:00:00Z" }), now)).toBe(true);
    expect(seatArtistsFor([seat({ status: "active", member_user_id: "u1", current_period_end: "2026-11-07T00:00:00Z" })], "owner")).toEqual([]);
  });

  it("ends a seat once its paid period has passed, and leaves a taken-over seat alone", () => {
    const now = new Date("2026-11-08T00:00:00Z");
    expect(seatShouldEnd(seat({ status: "active", current_period_end: "2026-11-01T00:00:00Z" }), now)).toBe(true);
    expect(seatShouldEnd(seat({ status: "canceled", current_period_end: "2027-01-01T00:00:00Z" }), now)).toBe(false);
    expect(seatShouldEnd(seat({ status: "handed_off", current_period_end: "2026-11-01T00:00:00Z" }), now)).toBe(false);
    expect(seatShouldEnd(seat({ status: "active", current_period_end: null }), now)).toBe(false);
  });

  it("treats an offer as an offer and nothing more", () => {
    expect(handoffOffered(seat({ handoff_offered_at: "2026-11-08T00:00:00Z" }))).toBe(true);
    expect(handoffOffered(seat({ handoff_offered_at: null }))).toBe(false);
    // An offer changes nothing about whether the seat is live.
    expect(seatIsLive(seat({ status: "active", handoff_offered_at: "2026-11-08T00:00:00Z" }))).toBe(true);
  });

  it("ends the owner's access the moment the artist takes the plan over", () => {
    const now = new Date("2026-11-08T00:00:00Z");
    const handedOff = seat({ status: "handed_off", member_user_id: "u1", current_period_end: "2027-01-01T00:00:00Z" });
    expect(seatIsLive(handedOff, now)).toBe(false);
    expect(seatArtistsFor([handedOff], "owner")).toEqual([]);
  });
});
