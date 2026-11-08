import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Check, Loader2, Music4, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { SignupCard } from "@/components/SignupCard";
import { BrandLogo } from "@/components/BrandLogo";
import { Button } from "@/components/ui/button";
import { TIER_LABEL } from "@/lib/plans";
import { supabase } from "@/integrations/supabase/client";
import { acceptSeat, getSeatInvite, type SeatInvite } from "@/lib/seats";

export const Route = createFileRoute("/seat/$seatId")({
  head: () => ({
    meta: [
      { title: "Accept Your Artist Seat — Came Through Audio" },
      { name: "description", content: "Accept the add-on artist seat a catalog owner bought for you." },
      { property: "og:title", content: "You've been invited as an artist" },
      { property: "og:description", content: "Sign up with the email this invite was sent to and accept your artist seat." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SeatPage,
});

/**
 * Where the seat invite lands (founder, 2026-11-04). Same shape as an invited signature: the artist signs up with the
 * address the seat was sent to, then accepts. The database refuses the claim from any other inbox.
 */
function SeatPage() {
  const { seatId } = Route.useParams();
  const { user, loading } = useAuth();
  const [invite, setInvite] = useState<SeatInvite | null>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = () => {
    setError("");
    getSeatInvite(seatId).then(setInvite).catch((e) => setError(e instanceof Error ? e.message : "This invite could not be opened."));
  };
  useEffect(() => { load(); }, [seatId]);

  const accept = async () => {
    setBusy(true);
    try {
      const r = await acceptSeat(seatId);
      toast.success(`You're in as ${r.artist_name} — ${TIER_LABEL[r.tier]} is open.`);
      // A full load, so the workspace reads the new tier from the database instead of a page that was already open.
      window.location.assign("/workspace");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "That seat couldn't be accepted.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-ink text-ink-foreground">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
        <BrandLogo />
        <Link to="/plans" className="text-sm font-semibold text-ink-muted hover:text-ink-foreground">See the plans</Link>
      </header>
      <main className="mx-auto max-w-3xl px-6 pb-16">
        {error ? (
          <div className="rounded-2xl border border-ink-border bg-ink p-8 text-center">
            <p className="text-lg font-bold">This invite can't be opened</p>
            <p className="mt-2 text-sm text-ink-muted">{error}</p>
            <Button asChild className="mt-4"><Link to="/">Go to Came Through Audio</Link></Button>
          </div>
        ) : !invite ? (
          <p className="flex items-center gap-2 text-ink-muted"><Loader2 className="h-4 w-4 animate-spin" />Opening your invite…</p>
        ) : (
          <div className="space-y-6">
            <div className="rounded-2xl border border-ink-border bg-ink p-6">
              <p className="text-xs font-bold uppercase tracking-[2px] text-brand-electric">Add-on artist seat</p>
              <h1 className="mt-2 text-3xl font-bold">
                {invite.inviter ? `${invite.inviter} added you` : "You've been added"} as {invite.artist_name}
              </h1>
              <p className="mt-3 text-sm text-ink-muted">
                Accept this seat and your own catalog opens at <b className="text-ink-foreground">{TIER_LABEL[invite.tier]}</b>:
                MP3 embedding, your songs, splits and the tools in that plan. The owner keeps paying for it, and you can
                take your catalog with you whenever you go independent. They will be able to read your split sheets and
                contracts, but only you can send a contract under your name.
              </p>
              <p className="mt-3 text-sm">
                <Music4 className="mr-1 inline h-4 w-4 align-[-2px] text-brand-electric" />
                Sign in or sign up with <b>{invite.email}</b> — the seat can only be accepted from that inbox.
              </p>
              {invite.ends_on && <p className="mt-1 text-xs text-ink-muted">Paid through {new Date(invite.ends_on).toLocaleDateString()}.</p>}
            </div>

            {loading ? (
              <p className="flex items-center gap-2 text-ink-muted"><Loader2 className="h-4 w-4 animate-spin" />Checking your session…</p>
            ) : user ? (
              <div className="rounded-2xl border border-ink-border bg-ink p-6">
                {invite.claimed && user.email?.toLowerCase() !== invite.email.toLowerCase() ? (
                  <p className="text-sm text-ink-muted">This seat is already claimed. Signed in as {user.email}.</p>
                ) : (
                  <>
                    {!invite.claimed && user.email?.toLowerCase() !== invite.email.toLowerCase() ? (
                      <div className="space-y-3">
                        <p className="text-sm text-ink-muted">
                          You're signed in as {user.email}, but this seat was sent to <b className="text-ink-foreground">{invite.email}</b>.
                          Sign out and sign in with that address to accept it.
                        </p>
                        <Button variant="outline" onClick={() => void supabase.auth.signOut().then(load)}>Sign out</Button>
                      </div>
                    ) : (<>
                    <p className="text-sm">Signed in as {user.email}.</p>
                    <Button className="mt-3" disabled={busy} onClick={() => void accept()}>
                      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                      {invite.claimed ? "Open my catalog" : "Accept my artist seat"}
                    </Button>
                    </>)}
                  </>
                )}
              </div>
            ) : (
              <SignupCard returnPath={`/seat/${seatId}`} onAuthed={load} />
            )}

            <p className="flex items-start gap-2 text-xs text-ink-muted">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-brand-electric" />
              Your name, songs and splits are always yours. The seat only decides which tools are unlocked while it's paid for.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
