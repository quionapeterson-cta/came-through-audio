import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { BrandLogo } from "@/components/BrandLogo";
import { PlanComparison, planAction } from "@/components/PlanComparison";
import { useAuth } from "@/hooks/useAuth";
import { useBilling } from "@/hooks/useBilling";
import { upgradeNote } from "@/lib/plans";
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
  const buy = async (priceId: string) => {
    if (!user) { navigate({ to: "/", hash: "signup" }); return; }
    try { await openCheckout({ kind: "plan", priceId }); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Checkout could not open."); }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="bg-ink text-ink-foreground">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <BrandLogo />
          <Link to="/workspace" search={{ tab: undefined }} className="text-sm font-semibold text-ink-muted hover:text-primary">{user ? "Back to workspace" : "Log in"}</Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <h1 className="text-center text-4xl font-bold md:text-5xl">Choose your plan</h1>
        <p className="mt-3 text-center text-muted-foreground">Simple yearly pricing. Start free and upgrade anytime.</p>
        {spots.some((s) => s.spots_left > 0) && (
          <div className="mx-auto mt-8 max-w-3xl rounded-2xl border border-primary/40 bg-primary/5 p-5 text-center">
            <p className="text-sm font-bold uppercase tracking-[2px] text-primary">Founding offer</p>
            <p className="mt-2 text-sm">The first 100 members on Catalog Plus get Catalog &amp; Collaborate, and the first 100 on Catalog &amp; Collaborate get Catalog Management, for as long as their plan stays active.</p>
            <p className="mt-2 text-sm font-semibold">Catalog Plus: {left("plus")} of 100 spots left · Catalog &amp; Collaborate: {left("collaborate")} of 100 spots left</p>
          </div>
        )}
        <div className="mt-12">
          <PlanComparison currentTier={user ? tier : undefined} note={plan ? upgradeNote(plan.orderedAt) : undefined} action={(p) => planAction(p, { tier: user ? tier : undefined, onBuy: (id) => void buy(id), onSignup: () => navigate({ to: "/", hash: "signup" }) })} />
        </div>
      </main>

      <footer className="bg-ink text-ink-muted">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-6 px-6 py-8 text-sm">
          <Link to="/terms-of-service" className="hover:text-ink-foreground">Terms of Service</Link>
          <Link to="/refund-policy" className="hover:text-ink-foreground">Refund Policy</Link>
          <Link to="/privacy-policy" className="hover:text-ink-foreground">Privacy Policy</Link>
        </div>
        <div className="border-t border-ink-border py-6 text-center text-sm">© {new Date().getFullYear()} Came Through Audio, LLC</div>
      </footer>
    </div>
  );
}
