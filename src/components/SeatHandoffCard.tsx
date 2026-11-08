import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { TIER_LABEL } from "@/lib/plans";
import { listSeatState, seatIsLive, type ArtistSeat } from "@/lib/seats";
import { openCheckout } from "@/lib/checkout";

const day = (iso: string | null) => (iso
  ? new Date(iso).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })
  : "");

/**
 * The artist's side of an add-on seat (founder, 2026-11-08): someone else pays for the plan until the seat's year ends,
 * and the artist can take it over at any time. Taking it over enters a card now and starts the plan's first charge at
 * that renewal, so nothing is paid twice and nothing is charged at handoff.
 */
export function SeatHandoffCard({ userId }: { userId: string }) {
  const [seats, setSeats] = useState<ArtistSeat[] | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    listSeatState()
      .then((s) => setSeats(s.seats.filter((seat) => seat.member_user_id === userId && seat.status !== "invited" && seat.status !== "unclaimed")))
      .catch(() => setSeats([]));
  }, [userId]);

  if (!seats) return null;
  const handedOff = seats.find((seat) => seat.status === "handed_off");
  const seat = seats.find((candidate) => candidate.status !== "handed_off" && seatIsLive(candidate) && !!candidate.current_period_end);
  if (!seat) {
    return handedOff
      ? (
        <section className="rounded-2xl border border-border bg-card p-6 sm:p-8">
          <h2 className="text-lg font-bold">Your plan</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            You pay for this plan yourself now, and the card on file is charged at each renewal. You can change or cancel
            it in Profile whenever you like. Your artist seat is closed.
          </p>
        </section>
      )
      : null;
  }

  const takeOver = async () => {
    setBusy(true);
    try {
      await openCheckout({ kind: "seat_handoff", seatId: seat.id });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Checkout could not open.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-2xl border border-border bg-card p-6 sm:p-8">
      <h2 className="text-lg font-bold">Your artist seat</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        You work on <span className="font-semibold text-foreground">{TIER_LABEL[seat.tier]}</span> through an add-on seat
        another account pays for. It is paid through {day(seat.current_period_end)}.
      </p>
      {seat.handoff_offered_at ? (
        <p className="mt-2 text-sm font-semibold text-primary">
          The account that pays for this seat has offered it to you. It's your choice: take it over below, or stay on the
          seat.
        </p>
      ) : null}
      <p className="mt-2 text-sm text-muted-foreground">
        You can keep this plan yourself when that year ends. Enter a card now and nothing is charged until the seat's
        paid year is over; the card is only used from that renewal on.
      </p>
      <Button className="mt-4" disabled={busy} onClick={() => void takeOver()}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Keep this plan after {day(seat.current_period_end)}
      </Button>
    </section>
  );
}
