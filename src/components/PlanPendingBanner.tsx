import { useState } from "react";
import { CreditCard } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { openCheckout } from "@/lib/checkout";
import { PLAN_TIERS, PRICE_TIER, TIER_LABEL, takePlanIntent } from "@/lib/plans";

/**
 * A plan picked before or during sign-up stays on screen until Stripe actually opens (founder, 2026-11-06): a member
 * who lands in a free workspace must be able to see the purchase is still waiting and pay for it in one click, instead
 * of discovering a free plan and starting over. It is the retry, not the only attempt — the workspace tries by itself
 * the moment billing has loaded.
 */
export function PlanPendingBanner({ priceId }: { priceId: string }) {
  const tier = PRICE_TIER[priceId];
  const plan = PLAN_TIERS.find((p) => p.priceId === priceId);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  if (!tier || done) return null;

  async function pay() {
    setBusy(true);
    try {
      await openCheckout({ kind: "plan", priceId });
      takePlanIntent();
      setDone(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Checkout could not open. Try again, or contact support and we'll help right away.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary bg-primary/10 px-4 py-3">
      <p className="flex items-center gap-2 text-sm">
        <CreditCard className="h-4 w-4 shrink-0 text-primary" />
        <span>
          <span className="font-semibold">Your {TIER_LABEL[tier]} plan isn&apos;t paid for yet.</span> Your account is
          ready; the card is the last step, and everything on the plan unlocks the moment Stripe confirms it.
        </span>
      </p>
      <Button size="sm" disabled={busy} onClick={() => void pay()}>
        {busy ? "Opening checkout…" : `Pay ${plan?.price ?? ""} for ${TIER_LABEL[tier]}`.replace("  ", " ")}
      </Button>
    </div>
  );
}
