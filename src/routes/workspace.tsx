import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ShieldCheck, FileAudio, Lock, Disc3, Activity, FileSignature, ScrollText, GraduationCap, LogOut, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { MetadataUploader } from "@/components/MetadataUploader";
import { AIProtectionHub } from "@/components/AIProtectionHub";
import { SplitSheets } from "@/components/SplitSheets";
import { BrandLogo } from "@/components/BrandLogo";
import type { CatalogTrack } from "@/lib/catalog";
import { RoyaltyUtilitySuite } from "@/components/RoyaltyUtilitySuite";
import { ExpertAssistance } from "@/components/ExpertAssistance";
import { RoyaltyHealthCheck } from "@/components/RoyaltyHealthCheck";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { useBilling, type Purchase } from "@/hooks/useBilling";
import { openCheckout, getPaddleEnvironment } from "@/lib/paddle";
import { FREE_CARD, PLAN_CARDS, TIER_LABEL, hasTier, type Tier } from "@/lib/plans";

export const Route = createFileRoute("/workspace")({
  head: () => ({
    meta: [
      { title: "Workspace — Came Through Audio" },
      { name: "description", content: "Your Came Through Audio workspace: catalog, royalty health, splits, contracts and masterclasses." },
      { property: "og:title", content: "Workspace — Came Through Audio" },
      { property: "og:description", content: "Manage your music business from one secure dashboard." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  validateSearch: (s: Record<string, unknown>) => ({ tab: typeof s["tab"] === "string" ? (s["tab"] as string) : undefined } as { tab?: string | undefined }),
  component: Workspace,
});

const tabs = [
  { id: "embed", label: "Embed Metadata", icon: FileAudio },
  { id: "catalog", label: "My Catalog", icon: Disc3 },
  { id: "splits", label: "Split Sheets", icon: FileSignature },
  { id: "protect", label: "AI Protection Hub", icon: ShieldCheck },
  { id: "health", label: "Royalty Health Check", icon: Activity },
  { id: "learn", label: "Contracts & Masterclasses", icon: GraduationCap },
];

function Workspace() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState<string>("");
  const search = Route.useSearch();
  const [tab, setTab] = useState(search.tab ?? "embed");
  const [splitTrackId, setSplitTrackId] = useState<string>();
  const [catalogKey, setCatalogKey] = useState(0);
  const [protectTrack, setProtectTrack] = useState<CatalogTrack>();
  const { tier: realTier, purchases } = useBilling(user?.id);
  const [previewTier, setPreviewTier] = useState<Tier | "real">("real");
  const tier: Tier = getPaddleEnvironment() === "sandbox" && previewTier !== "real" ? previewTier : realTier;
  // Free accounts may only sign invited split sheets (/sign/$token); creation requires Collaborate.
  const canSplit = hasTier(tier, "collaborate");
  const hasAi = purchases.some((p) => p.kind === "ai");
  const upgrade = () => document.getElementById("plans-trigger")?.click();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/" });
  }, [loading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    const meta = user.user_metadata ?? {};
    setName(meta["stage_name"] || meta["legal_name"] || user.email || "");
    supabase.from("profiles").select("stage_name, legal_name, tier").eq("id", user.id).maybeSingle().then(({ data }) => {
      if (data) {
        setName(data.stage_name || data.legal_name || meta["stage_name"] || user.email || "");
      }
    });
  }, [user]);

  if (loading || !user) {
    return <div className="flex min-h-screen items-center justify-center bg-ink text-ink-muted">Loading…</div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <PaymentTestModeBanner previewTier={previewTier} onPreviewTier={setPreviewTier} />
      <header className="bg-ink text-ink-foreground">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-3">
            <BrandLogo showName={false} />
            <div>
              <div className="text-xs uppercase tracking-widest text-ink-muted">Came Through Audio</div>
              <div className="text-xl font-bold">{name}</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="border-ink-border text-ink-foreground">{TIER_LABEL[tier]}</Badge>
            <PlansDialog tier={tier} userId={user.id} email={user.email} />
            <Button variant="ghost" size="icon" aria-label="Log out" className="text-ink-muted hover:bg-ink-border hover:text-ink-foreground"
              onClick={async () => { await supabase.auth.signOut(); navigate({ to: "/" }); }}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="h-auto w-full flex-nowrap justify-start gap-1 overflow-x-auto bg-muted p-1">
            {tabs.map(({ id, label, icon: Icon }, i) => (
              <TabsTrigger key={id} value={id} className="shrink-0 gap-2 px-3 py-2.5 font-semibold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <span className="text-xs opacity-70">{i + 1}.</span><Icon className="h-4 w-4" /> {label}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="embed" forceMount className="data-[state=inactive]:hidden"><MetadataUploader stageName={name} userId={user.id} mode="embed" onSubmitted={() => setCatalogKey((k) => k + 1)} /></TabsContent>
          <TabsContent value="catalog" forceMount className="data-[state=inactive]:hidden">
            <MetadataUploader key={catalogKey} stageName={name} userId={user.id} mode="catalog" canSplit={canSplit} onSplitSheet={(t) => { setSplitTrackId(t.id); setTab("splits"); }} onProtect={(t) => { setProtectTrack(t); setTab("protect"); }} />
          </TabsContent>
          <TabsContent value="protect"><AIProtectionHub userId={user.id} paid={hasAi} email={user.email} track={protectTrack} /></TabsContent>
          <TabsContent value="splits"><SplitSheets userId={user.id} canSplit={canSplit} prefillTrackId={splitTrackId} onUpgrade={upgrade} /></TabsContent>
          <TabsContent value="health"><Health onFix={() => setTab("catalog")} onEmbed={() => setTab("embed")} userId={user.id} email={user.email} purchases={purchases} canUtility={canSplit} onUpgrade={upgrade} /></TabsContent>
          <TabsContent value="learn"><Learn unlocked={hasTier(tier, "management")} onUpgrade={upgrade} /></TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function Learn({ unlocked, onUpgrade }: { unlocked: boolean; onUpgrade: () => void }) {
  const [view, setView] = useState<"contracts" | "classes">("contracts");
  return (
    <div className="mt-6">
      <div className="inline-flex gap-1 rounded-lg bg-muted p-1">
        <Button size="sm" variant={view === "contracts" ? "default" : "ghost"} onClick={() => setView("contracts")}><ScrollText className="h-4 w-4" />Contracts & Blueprints</Button>
        <Button size="sm" variant={view === "classes" ? "default" : "ghost"} onClick={() => setView("classes")}><GraduationCap className="h-4 w-4" />Masterclasses</Button>
      </div>
      {!unlocked ? (
        <div className="mt-6 flex flex-col items-center gap-3 rounded-2xl border-2 border-primary p-8 text-center">
          <Lock className="h-8 w-8 text-primary" />
          <h2 className="text-2xl font-bold">Included with Catalog Management</h2>
          <p className="max-w-md text-muted-foreground">Unlimited contract blueprints and industry masterclasses.</p>
          <Button onClick={onUpgrade}>Upgrade to unlock</Button>
        </div>
      ) : view === "contracts"
        ? <Blank icon={ScrollText} title="Contracts & Blueprints" text="Producer agreements, videographer releases, beat licenses, label and studio blueprints." />
        : <Masterclasses />}
    </div>
  );
}

function Blank({ icon: Icon, title, text }: { icon: React.ElementType; title: string; text: string }) {
  return (
    <div className="mt-6 flex min-h-72 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border p-10 text-center">
      <Icon className="h-10 w-10 text-primary" />
      <h2 className="mt-4 text-2xl font-bold">{title}</h2>
      <p className="mt-2 max-w-md text-muted-foreground">{text}</p>
    </div>
  );
}

function PlansDialog({ tier, userId, email }: { tier: Tier; userId: string; email?: string | undefined }) {
  const buy = async (priceId: string) => {
    try { await openCheckout({ items: [{ priceId, quantity: 1 }], email, customData: { userId } }); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Checkout could not open."); }
  };
  return (
    <Dialog>
      <DialogTrigger asChild><Button id="plans-trigger" className="font-semibold">View Plans</Button></DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto">
        <DialogHeader><DialogTitle className="text-2xl font-bold">Choose your plan</DialogTitle></DialogHeader>
        <TooltipProvider delayDuration={100}>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[FREE_CARD, ...PLAN_CARDS].map((p) => {
              const current = tier === p.tier;
              const owned = hasTier(tier, p.tier);
              return (
                <div key={p.tier} className={`flex flex-col rounded-xl p-5 ${p.tier === "collaborate" ? "bg-ink text-ink-foreground" : "border border-border"}`}>
                  <div className={`font-bold ${p.tier === "collaborate" ? "w-fit rounded-xl bg-card px-3 py-1 text-primary" : "text-primary"}`}>{TIER_LABEL[p.tier]}</div>
                  <div className="mt-2 text-3xl font-bold">{p.price}<span className="text-base font-semibold">{p.price === "$0" ? "" : "/yr"}</span></div>
                  <div className="text-sm opacity-80">{p.monthly}</div>
                  {p.lead && <p className="mt-4 text-xs italic opacity-80">{p.lead}</p>}
                  <ul className="mt-3 flex-1 space-y-2">
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
                  {p.tier === "free" ? (
                    <Button className="mt-5 w-full" variant="secondary" disabled={owned}>
                      {current ? "Current plan" : "Included"}
                    </Button>
                  ) : (
                    <Button className="mt-5 w-full" variant={p.tier === "collaborate" ? "secondary" : "default"} disabled={owned} onClick={() => buy(p.priceId)}>
                      {current ? "Current plan" : owned ? "Included" : tier === "free" ? "Get started" : "Upgrade"}
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </TooltipProvider>
        <p className="text-center text-xs text-muted-foreground">Free plans include unlimited royalty audits &amp; unlimited split sheet signatures. Billed annually.</p>
      </DialogContent>
    </Dialog>
  );
}

function Masterclasses() {
  return (
    <div className="mt-6 grid gap-6 md:grid-cols-2">
      <div className="rounded-2xl border border-border p-6">
        <GraduationCap className="h-8 w-8 text-primary" />
        <h2 className="mt-3 text-2xl font-bold">Music Business Masterclasses</h2>
        <p className="mt-2 text-muted-foreground">Live group classes with an industry expert.</p>
        <div className="mt-4 flex items-center justify-between rounded-lg bg-muted p-4"><span className="font-semibold">1 class slot</span><span className="text-xl font-bold text-primary">$19/slot</span></div>
        <Button className="mt-4 w-full" disabled>Checkout coming soon</Button>
      </div>
    </div>
  );
}

function Health({ onFix, onEmbed, userId, email, purchases, canUtility, onUpgrade }: { userId: string; email?: string | undefined; purchases: Purchase[]; canUtility: boolean; onUpgrade: () => void; onFix: () => void; onEmbed: () => void }) {
  return (
    <div className="mt-6 space-y-6">
      <RoyaltyHealthCheck onFix={onFix} onEmbed={onEmbed} />
      <div id="expert-assistance"><ExpertAssistance userId={userId} email={email} purchases={purchases} /></div>
      <RoyaltyUtilitySuite unlocked={canUtility} onUpgrade={onUpgrade} />
    </div>
  );
}
