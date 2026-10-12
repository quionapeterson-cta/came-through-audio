import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { BrandLogo } from "@/components/BrandLogo";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { openCheckout } from "@/lib/paddle";
import { FREE_CARD, PLAN_CARDS, TIER_LABEL } from "@/lib/plans";

const ALL_CARDS = [FREE_CARD, ...PLAN_CARDS];

export const Route = createFileRoute("/plans")({
  head: () => ({
    meta: [
      { title: "Plans & Pricing — Came Through Audio" },
      { name: "description", content: "Compare Catalog Plus, Catalog and Collaborate, and Catalog Management yearly plans for independent musicians." },
      { property: "og:title", content: "Plans & Pricing — Came Through Audio" },
      { property: "og:description", content: "Yearly plans for metadata embedding, cataloging, split sheets, contracts and masterclasses." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PlansPage,
});

function PlansPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const buy = async (priceId: string) => {
    if (!user) { navigate({ to: "/", hash: "signup" }); return; }
    try { await openCheckout({ items: [{ priceId, quantity: 1 }], email: user.email, customData: { userId: user.id } }); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Checkout could not open."); }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="bg-ink text-ink-foreground">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <BrandLogo />
          <Link to="/workspace" search={{ tab: undefined }} className="text-sm font-semibold text-ink-muted hover:text-primary">Log in</Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-16">
        <h1 className="text-center text-4xl font-bold md:text-5xl">Choose your plan</h1>
        <p className="mt-3 text-center text-muted-foreground">Simple yearly pricing. Start free and upgrade anytime.</p>
        <TooltipProvider delayDuration={100}>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {PLAN_CARDS.map((p, i) => (
              <div key={p.tier} className={`flex flex-col rounded-2xl p-6 ${i === 1 ? "bg-ink text-ink-foreground shadow-xl" : "border border-border"}`}>
                <div className={`font-bold ${i === 1 ? "w-fit rounded-xl bg-card px-3 py-1 text-primary" : "text-primary"}`}>{TIER_LABEL[p.tier]}</div>
                <div className="mt-3 text-4xl font-bold">{p.price}<span className="text-base font-semibold">/yr</span></div>
                <div className="text-sm opacity-80">{p.monthly}</div>
                {p.lead && <p className="mt-4 text-xs italic opacity-80">{p.lead}</p>}
                <ul className="mt-4 flex-1 space-y-3">
                  {p.features.map((f) => (
                    <li key={f.title}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="flex cursor-help items-start gap-2 text-sm font-semibold"><Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" strokeWidth={3} />{f.title}</span>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-60">{f.tip}</TooltipContent>
                      </Tooltip>
                    </li>
                  ))}
                </ul>
                <Button className="mt-6 w-full" variant={i === 1 ? "secondary" : "default"} onClick={() => buy(p.priceId)}>
                  {user ? "Get started" : "Sign up to start"}
                </Button>
              </div>
            ))}
          </div>
        </TooltipProvider>
        <p className="mt-8 text-center text-sm text-muted-foreground">Free plans include unlimited royalty audits &amp; unlimited split sheet signatures. Billed annually.</p>
      </main>

      <footer className="bg-ink text-ink-muted">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-6 px-6 py-8 text-sm">
          <Link to="/terms-and-conditions" className="hover:text-ink-foreground">Terms and Conditions</Link>
          <Link to="/refund-policy" className="hover:text-ink-foreground">Refund Policy</Link>
          <Link to="/privacy-notice" className="hover:text-ink-foreground">Privacy Notice</Link>
        </div>
        <div className="border-t border-ink-border py-6 text-center text-sm">© {new Date().getFullYear()} Came Through Audio, LLC</div>
      </footer>
    </div>
  );
}
