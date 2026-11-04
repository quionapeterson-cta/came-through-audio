import { lazy, Suspense, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Check, Loader2, Mail, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ARTIST_SEAT_PRICES, SEAT_MAX, TIER_LABEL, type Tier } from "@/lib/plans";
import { listSeatState, seatIsLive, type ArtistSeat, type SeatState } from "@/lib/seats";
import { inviteSeatArtist } from "@/lib/seats.functions";
import { openCheckout } from "@/lib/checkout";
// ArtistOnboarding renders this panel for "Add another artist", so importing it statically here would be a cycle.
// Loaded on demand only when an owner opens an accepted artist's defaults.
const ArtistOnboarding = lazy(() => import("@/components/ArtistOnboarding").then((m) => ({ default: m.ArtistOnboarding })));

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
  const [state, setState] = useState<SeatState | null>(null);
  const [buying, setBuying] = useState(false);
  const [sendingFor, setSendingFor] = useState<string | null>(null);
  const [artistName, setArtistName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  // An artist who accepted: the owner fills in the defaults their songs and embeds start from.
  const [editingArtist, setEditingArtist] = useState<{ userId: string; name: string } | null>(null);
  // How many artists at each tier. Artists aren't all on the same tier, so the owner picks a count per tier and pays
  // for the lot in one go: one subscription, one seat row per artist (founder, 2026-11-04).
  const [qty, setQty] = useState<Record<SeatTier, number>>({ plus: 0, collaborate: 0, management: 0 });
  const invite = useServerFn(inviteSeatArtist);
  /** Typing the address the seat was already sent to is a resend; anything else replaces (and voids) the old invite. */
  const sameEmail = (seat: ArtistSeat) => !!seat.invite_email && seat.invite_email.toLowerCase() === email.trim().toLowerCase();

  // A seat only earns its keep once the artist is invited, so the first seat still waiting for an artist opens its
  // invite form by itself (founder, 2026-11-04: buying a seat and then hunting for the button was a dead end).
  const load = () => listSeatState().then((next) => {
    setState(next);
    // A seat with no invite yet opens itself; an invite that already went out stays a row action, so "Resend or
    // change their email" is on screen rather than hidden behind an open form.
    const fresh = next.seats.find((s) => seatIsLive(s) && !s.member_user_id && s.status === "unclaimed");
    setSendingFor((cur) => cur ?? fresh?.id ?? null);
    if (fresh) { setArtistName((n) => n || fresh.artist_name); setEmail((e) => e || (fresh.invite_email ?? "")); }
  }).catch(() => setState({ ready: false, seats: [] }));
  useEffect(() => { void load(); }, []);
  // Just back from paying: Stripe's webhook writes the seat a moment later, so keep looking for a few seconds rather
  // than showing an empty panel exactly when the artist's email needs typing (founder, 2026-11-04).
  useEffect(() => {
    if (!state?.ready || state.seats.length) return;
    if (typeof window === "undefined" || new URLSearchParams(window.location.search).get("checkout") !== "success") return;
    const poll = setInterval(() => void load(), 3000);
    const stop = setTimeout(() => clearInterval(poll), 30_000);
    return () => { clearInterval(poll); clearTimeout(stop); };
  }, [state]);

  // What the one button will buy: every tier with a count, and the year's total across them.
  const chosen = ARTIST_SEAT_PRICES.filter((s) => qty[s.tier] > 0);
  const totalSeats = chosen.reduce((n, s) => n + qty[s.tier], 0);
  const totalPrice = `$${chosen.reduce((n, s) => n + s.amount * qty[s.tier], 0).toFixed(2)}`;

  const buy = async () => {
    setBuying(true);
    try {
      await openCheckout({ kind: "seat", seats: qty });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Checkout could not open.");
    } finally {
      setBuying(false);
    }
  };

  const send = async (seat: ArtistSeat) => {
    setBusy(true);
    try {
      const r = await invite({ data: { seatId: seat.id, email: email.trim(), artistName: artistName.trim(), origin: window.location.origin } });
      toast.success(sameEmail(seat)
        ? `Invite resent to ${email.trim()}. ${r.link ? "The same link is in their email." : ""}`
        : `Invite sent to ${email.trim()}. The previous address can no longer accept this seat.`);
      // Straight on to the next artist who still needs their invite.
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

  /** Opens the invite form filled with the seat's own artist name and address, ready to resend as-is. */
  const startInvite = (seat: ArtistSeat) => {
    setSendingFor(seat.id);
    setArtistName(seat.artist_name);
    setEmail(seat.invite_email ?? "");
  };

  if (!state) return <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Checking your seats…</p>;
  if (!state.ready) {
    return (
      <div className="space-y-3">
        <h2 className="text-xl font-bold">Add another artist</h2>
        <p className="text-sm text-muted-foreground">
          Add-on artist seats aren't switched on yet. Nothing can be bought here until they are, so nothing can be
          charged for a seat that has nowhere to go.
        </p>
        <div className="flex justify-end"><Button variant="outline" onClick={onClose}>Close</Button></div>
      </div>
    );
  }

  const live = state.seats.filter((seat) => seatIsLive(seat));

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold">Add another artist</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Buy seats, then send each one to the artist's email. They sign up with that address and accept it, and their
          own catalog, embedding and tools open at the seat's tier. Pick how many artists you're adding and buy them in
          one go. You see and manage every artist you pay for.
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
                      {seat.invite_email && !sameEmail(seat) && (
                        <p className="text-xs font-semibold text-destructive">This seat is already invited at {seat.invite_email}. Sending this one voids that invite: the old email can no longer accept the seat.</p>
                      )}
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setSendingFor(null)}>Cancel</Button>
                      <Button disabled={busy || !email.trim() || !artistName.trim()} onClick={() => void send(seat)}>
                        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                        {!seat.invite_email ? "Send the invite" : sameEmail(seat) ? "Resend the invite" : "Change the email & send"}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button className="mt-3" variant="outline" onClick={() => startInvite(seat)}>
                    <Mail className="h-4 w-4" />{seat.invite_email ? "Resend or change their email" : "Send to the artist"}
                  </Button>
                )
              )}
              {seat.member_user_id && (
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  <p className="flex items-center gap-1 text-xs font-semibold text-primary"><Check className="h-3.5 w-3.5" />Accepted by the artist</p>
                  {/* Their Embed Defaults and Catalog Defaults are the owner's to fill in, so the way in sits here. */}
                  <Button size="sm" variant="outline" onClick={() => setEditingArtist({ userId: seat.member_user_id!, name: seat.artist_name })}>
                    <Pencil className="h-4 w-4" />Edit their defaults
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="rounded-xl border border-border p-3">
          <p className="text-sm font-semibold">{live.length ? "Buy another seat" : "Choose the seats' tiers"}</p>
          <p className="mt-1 text-xs text-muted-foreground">Artists can be on different tiers. Pick how many at each, then buy them all together.</p>
          <ul className="mt-2 space-y-2">
            {ARTIST_SEAT_PRICES.map((s) => {
              const n = qty[s.tier];
              return (
                <li key={s.tier} className="rounded-lg bg-muted px-3 py-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm">
                      <span className="font-semibold">{TIER_LABEL[s.tier]}</span>
                      <span className="ml-2 text-muted-foreground">{s.price}/yr each · {s.monthly}</span>
                    </span>
                    <div className="flex items-center gap-2">
                      <Label htmlFor={`seat-qty-${s.tier}`} className="text-xs text-muted-foreground">Artists</Label>
                      <Input id={`seat-qty-${s.tier}`} type="number" inputMode="numeric" min={0} max={SEAT_MAX} value={n}
                        aria-label={`How many ${TIER_LABEL[s.tier]} artist seats`}
                        className="h-8 w-16"
                        onChange={(e) => {
                          const next = Math.max(0, Math.min(SEAT_MAX, Math.trunc(Number(e.target.value)) || 0));
                          setQty((q) => ({ ...q, [s.tier]: next }));
                        }} />
                      <span className="w-24 text-right text-sm text-muted-foreground">{n ? `${(s.amount * n).toFixed(2)}/yr` : "—"}</span>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
            <p className="text-sm">
              {totalSeats
                ? <><span className="font-semibold">{totalSeats} {totalSeats === 1 ? "artist" : "artists"}</span><span className="text-muted-foreground"> · {totalPrice}/yr</span></>
                : <span className="text-muted-foreground">Pick how many artists at each tier.</span>}
            </p>
            <Button disabled={buying || totalSeats === 0} onClick={() => void buy()}>
              {buying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              {totalSeats ? `Buy ${totalSeats} ${totalSeats === 1 ? "seat" : "seats"} · ${totalPrice}/yr` : "Buy the seats"}
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Yearly, per added artist, billed separately from your own plan. Cancel any time; the artist keeps the seat until the paid year ends.</p>
      </div>

      {editingArtist && (
        <Suspense fallback={null}>
          <ArtistOnboarding userId={editingArtist.userId} seatArtist={{ name: editingArtist.name }} open
            onOpenChange={(o) => { if (!o) setEditingArtist(null); }} firstRun={false} onSaved={() => setEditingArtist(null)} />
        </Suspense>
      )}

      <div className="flex justify-end">
        <Button variant="outline" onClick={onClose}>Close</Button>
      </div>
    </div>
  );
}

/**
 * The seats panel as its own dialog, so a page can open it straight after a seat purchase instead of burying it in the
 * profile editor. Add-on seats are a paid feature, so a free account gets the reason instead of a checkout.
 */
export function AddArtistDialog({ open, onOpenChange, canAddArtist = false }: {
  open: boolean; onOpenChange: (o: boolean) => void; canAddArtist?: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        {canAddArtist ? <ArtistSeats onClose={() => onOpenChange(false)} /> : (
          <div className="space-y-3">
            <h2 className="text-xl font-bold">Add another artist</h2>
            <p className="text-sm text-muted-foreground">Add-on artist seats come with any paid plan. Pick a plan first, then add as many artists as you need.</p>
            <div className="flex justify-end"><Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button></div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
