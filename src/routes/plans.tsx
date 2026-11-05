import { useEffect, useState } from "react";
import { Disclaimer } from "@/components/Disclaimer";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { BrandLogo } from "@/components/BrandLogo";
import { PlanComparison, planAction } from "@/components/PlanComparison";
import { useAuth } from "@/hooks/useAuth";
import { useBilling } from "@/hooks/useBilling";
import { PRICE_TIER, TIER_LABEL, isEmailConfirmError, peekPlanIntent, rememberPlanIntent, takePlanIntent, upgradeNote } from "@/lib/plans";
import { Button } from "@/components/ui/button";
import { SignupCard } from "@/components/SignupCard";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { getPaymentsEnvironment, openCheckout } from "@/lib/checkout";
import { supabase } from "@/integrations/supabase/client";

type Spots = { paid_tier: "plus" | "collaborate"; spots_left: number };

/** Founding 100 spots left on each tier (PLAN-founding-upgrades); empty until the migration runs. */
function useFoundingSpots() {
  const [spots, setSpots] = useState<Spots[]>([]);
  useEffect(() => {
    void supabase.rpc("founding_spots" as never, { _env: getPaymentsEnvironment() } as never)
      .then(({ data }) => setSpots(((data ?? []) as unknown as Spots[])));
  }, []);
  return spots;
}

export const Route = createFileRoute("/plans")({
  head: () => ({
    meta: [
      { title: "Plans & Pricing — Came Through Audio" },
      { name: "description", content: "Compare Catalog Plus, Catalog & Collaborate, and Catalog Management yearly plans for independent musicians." },
      { property: "og:title", content: "Plans & Pricing — Came Through Audio" },
      { property: "og:description", content: "Yearly plans for metadata embedding, cataloging, split sheets and contracts." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PlansPage,
});

function PlansPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  // Buttons follow the plan they pay for: a founding Plus member can still buy Catalog & Collaborate.
  const { paidTier: tier, plan } = useBilling(user?.id);
  const spots = useFoundingSpots();
  const left = (t: Spots["paid_tier"]) => spots.find((s) => s.paid_tier === t)?.spots_left ?? 0;
  // Picked a paid tier while signed out: the sign-up form opens here, and that tier's checkout opens the moment the
  // account exists (founder, 2026-11-03: the button leads straight to checkout, without a trip to the homepage).
  const [signupFor, setSignupFor] = useState<string | null>(null);
  // A confirmed email is required before paying, and it's checked before Stripe opens so the payment form itself is
  // never interrupted (founder, 2026-11-03).
  const [confirmFor, setConfirmFor] = useState<string | null>(null);
  const startCheckout = async (priceId: string) => {
    const { data } = await supabase.auth.getUser();
    if (data.user && !data.user.email_confirmed_at) { rememberPlanIntent(priceId); setConfirmFor(priceId); return; }
    try { await openCheckout({ kind: "plan", priceId }); }
    catch (e) {
      if (isEmailConfirmError(e)) { rememberPlanIntent(priceId); setConfirmFor(priceId); return; }
      toast.error(e instanceof Error ? e.message : "Checkout could not open.");
    }
  };
  const buy = async (priceId: string) => {
    if (!user) { rememberPlanIntent(priceId); setSignupFor(priceId); return; }
    await startCheckout(priceId);
  };
  const afterSignup = () => {
    const priceId = takePlanIntent() ?? signupFor;
    setSignupFor(null);
    if (priceId) void startCheckout(priceId);
  };
  const retryConfirmed = async () => {
    await supabase.auth.refreshSession();
    const { data } = await supabase.auth.getUser();
    if (!data.user?.email_confirmed_at) { toast.error("That email isn't confirmed yet. Open the link we sent, then try again."); return; }
    const priceId = confirmFor;
    setConfirmFor(null);
    if (priceId) await startCheckout(priceId);
  };
  const resendConfirmation = async () => {
    const { data } = await supabase.auth.getUser();
    const email = data.user?.email;
    if (!email) { toast.error("Sign in again to resend the confirmation link."); return; }
    const { error } = await supabase.auth.resend({ type: "signup", email, options: { emailRedirectTo: `${window.location.origin}/plans` } });
    if (error) toast.error(error.message); else toast.success(`Confirmation link sent to ${email}.`);
  };

  return (
    <div className="min-h-screen bg-ink text-ink-foreground">
      <header className="bg-ink text-ink-foreground">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <BrandLogo />
          {/* Log in is small, so it gets the Electric Cobalt with a soft glow to find it at a glance on ink. Signed out,
              it goes to the dedicated log-in page, which already has their email filled in (founder, 2026-11-05). */}
          {user ? (
            <Link to="/workspace" search={{ tab: undefined }} className="text-sm font-bold text-ink-muted hover:text-primary">
              Back to workspace
            </Link>
          ) : (
            <Link to="/login" className="text-sm font-bold text-brand-electric drop-shadow-[0_0_10px_rgba(95,153,255,0.55)] hover:text-ink-foreground">
              Log in
            </Link>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <h1 className="text-center text-4xl font-bold md:text-5xl">Choose your plan</h1>
        <p className="mt-3 text-center text-ink-muted">Simple yearly pricing. Start free and upgrade anytime.</p>
        {spots.some((s) => s.spots_left > 0) && (
          <div className="mx-auto mt-8 max-w-3xl rounded-2xl border border-brand-electric/40 bg-brand-electric/10 p-5 text-center">
            <p className="text-sm font-bold uppercase tracking-[2px] text-brand-electric">Founding offer</p>
            <p className="mt-2 text-sm text-ink-muted">The first 100 members on Catalog Plus get Catalog &amp; Collaborate, and the first 100 on Catalog &amp; Collaborate get Catalog Management, for as long as their plan stays active.</p>
            <p className="mt-2 text-sm font-semibold">Catalog Plus: {left("plus")} of 100 spots left · Catalog &amp; Collaborate: {left("collaborate")} of 100 spots left</p>
          </div>
        )}
        <div className="mt-12">
          {/* Dark chart on the plans page (founder, 11/3/2026); the homepage keeps the light one. */}
          <PlanComparison tone="dark" currentTier={user ? tier : undefined} note={plan ? upgradeNote(plan.orderedAt) : undefined} action={(p) => planAction(p, { tier: user ? tier : undefined, onBuy: (id) => void buy(id), onSignup: () => { const id = peekPlanIntent(); if (id) setSignupFor(id); else navigate({ to: "/", hash: "signup" }); } })} />
        </div>
      </main>

      {signupFor && (
        <Dialog open onOpenChange={(o) => !o && setSignupFor(null)}>
          <DialogContent className="max-w-md border-0 bg-transparent p-0 shadow-none">
            <DialogTitle className="sr-only">Sign up for {TIER_LABEL[PRICE_TIER[signupFor]!]}</DialogTitle>
            <DialogDescription className="sr-only">Create your account and this plan's checkout opens right after.</DialogDescription>
            <SignupCard onAuthed={afterSignup} />
          </DialogContent>
        </Dialog>
      )}

      {confirmFor && (
        <Dialog open onOpenChange={(o) => !o && setConfirmFor(null)}>
          <DialogContent className="max-w-md">
            <DialogTitle>Confirm your email to finish</DialogTitle>
            <DialogDescription>
              We sent a confirmation link to your address. Click it, then continue: {TIER_LABEL[PRICE_TIER[confirmFor]!]} checkout opens right after, with no extra steps.
            </DialogDescription>
            <div className="mt-5 space-y-2">
              <Button className="w-full" onClick={() => void retryConfirmed()}>I've confirmed — continue to checkout</Button>
              <Button className="w-full" variant="outline" onClick={() => void resendConfirmation()}>Send the link again</Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      <footer className="bg-ink text-ink-muted">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-6 px-6 py-8 text-sm">
          <Link to="/terms-of-service" className="hover:text-ink-foreground">Terms of Service</Link>
          <Link to="/refund-policy" className="hover:text-ink-foreground">Refund Policy</Link>
          <Link to="/privacy-policy" className="hover:text-ink-foreground">Privacy Policy</Link>
        </div>
        <div className="border-t border-ink-border py-6 text-center text-sm">© {new Date().getFullYear()} Came Through Audio, LLC</div>
        <Disclaimer k="site" tone="ink" className="mx-auto max-w-4xl justify-center px-6 pb-8 text-center" />
      </footer>
    </div>
  );
}
