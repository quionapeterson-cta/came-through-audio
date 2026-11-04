import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Check, Loader2, Mail, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ARTIST_SEAT_PRICES, TIER_LABEL, type Tier } from "@/lib/plans";
import { listSeats, seatIsLive, type ArtistSeat } from "@/lib/seats";
import { inviteSeatArtist } from "@/lib/seats.functions";
import { openCheckout } from "@/lib/checkout";

type SeatTier = Exclude<Tier, "free">;

const STATUS_LABEL: Record<ArtistSeat["status"], string> = {
  unclaimed: "Paid · waiting for an artist name",
  invited: "Invite sent · waiting for them to accept",
  active: "Active",
  canceled: "Ends when the paid year ends",
  ended: "Ended",
};

const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "");

/**
 * Add another artist (founder, 2026-11-04): the owner buys a seat on its own yearly subscription, then sends it to the
 * artist's email. The artist signs up with that address and accepts, exactly like an invited signature request.
 */
export function ArtistSeats({ onClose }: { onClose: () => void }) {
  const [seats, setSeats] = useState<ArtistSeat[] | null>(null);
  const [buying, setBuying] = useState<SeatTier | null>(null);
  const [sendingFor, setSendingFor] = useState<string | null>(null);
  const [artistName, setArtistName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const invite = useServerFn(inviteSeatArtist);

  const load = () => listSeats().then(setSeats).catch(() => setSeats([]));
  useEffect(() => { void load(); }, []);

  const buy = async (tier: SeatTier) => {
    setBuying(tier);
    try {
      await openCheckout({ kind: "seat", tier });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Checkout could not open.");
    } finally {
      setBuying(null);
    }
  };

  const send = async (seat: ArtistSeat) => {
    setBusy(true);
    try {
      const r = await invite({ data: { seatId: seat.id, email: email.trim(), artistName: artistName.trim(), origin: window.location.origin } });
      toast.success(`Invite sent to ${email.trim()}. ${r.link ? "The link is in their email." : ""}`);
      setSendingFor(null);
      setArtistName("");
      setEmail("");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The invite could not be sent.");
    } finally {
      setBusy(false);
    }
  };

  if (!seats) return <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Checking your seats…</p>;

  const live = seats.filter((seat) => seatIsLive(seat));
  const waiting = live.find((s) => !s.member_user_id);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold">Add another artist</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Buy a seat, then send it to the artist's email. They sign up with that address and accept it, and their own
          catalog, embedding and tools open at the seat's tier. You see and manage every artist you pay for.
        </p>
      </div>

      {live.length > 0 && (
        <ul className="space-y-2">
          {live.map((seat) => (
            <li key={seat.id} className="rounded-xl border border-border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold">{seat.artist_name || "Seat (no artist named yet)"}</span>
                <span className="text-xs font-bold uppercase tracking-wider text-primary">{TIER_LABEL[seat.tier]}</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {STATUS_LABEL[seat.status]}{seat.current_period_end ? ` · renews ${day(seat.current_period_end)}` : ""}
                {seat.invite_email ? ` · ${seat.invite_email}` : ""}
              </p>
              {!seat.member_user_id && (
                sendingFor === seat.id ? (
                  <div className="mt-3 space-y-3">
                    <div className="space-y-1">
                      <Label htmlFor={`seat-name-${seat.id}`}>Artist name</Label>
                      <Input id={`seat-name-${seat.id}`} value={artistName} maxLength={80} placeholder="The name on their releases" onChange={(e) => setArtistName(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor={`seat-email-${seat.id}`}>Their email</Label>
                      <Input id={`seat-email-${seat.id}`} type="email" value={email} placeholder="artist@example.com" onChange={(e) => setEmail(e.target.value)} />
                      <p className="text-xs text-muted-foreground">The seat can only be accepted from this inbox, so double-check it.</p>
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setSendingFor(null)}>Cancel</Button>
                      <Button disabled={busy || !email.trim() || !artistName.trim()} onClick={() => void send(seat)}>
                        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}Send the invite
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button className="mt-3" variant="outline" onClick={() => { setSendingFor(seat.id); setArtistName(seat.artist_name); setEmail(seat.invite_email ?? ""); }}>
                    <Mail className="h-4 w-4" />{seat.invite_email ? "Resend the invite" : "Send to the artist"}
                  </Button>
                )
              )}
              {seat.member_user_id && <p className="mt-2 flex items-center gap-1 text-xs font-semibold text-primary"><Check className="h-3.5 w-3.5" />Accepted by the artist</p>}
            </li>
          ))}
        </ul>
      )}

      {!waiting && (
        <div className="rounded-xl border border-border p-3">
          <p className="text-sm font-semibold">{live.length ? "Buy another seat" : "Choose the seat's tier"}</p>
          <ul className="mt-2 space-y-2">
            {ARTIST_SEAT_PRICES.map((s) => (
              <li key={s.tier} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted px-3 py-2">
                <span className="text-sm">
                  <span className="font-semibold">{TIER_LABEL[s.tier]}</span>
                  <span className="ml-2 text-muted-foreground">{s.price}/yr · {s.monthly}</span>
                </span>
                <Button size="sm" disabled={buying !== null} onClick={() => void buy(s.tier)}>
                  {buying === s.tier ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}Buy
                </Button>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted-foreground">Yearly, per added artist, billed separately from your own plan. Cancel any time; the artist keeps the seat until the paid year ends.</p>
        </div>
      )}

      <div className="flex justify-end">
        <Button variant="outline" onClick={onClose}>Close</Button>
      </div>
    </div>
  );
}
