import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getStaffRole } from "@/lib/admin.functions";
import { ShieldCheck, FileAudio, Lock, Disc3, Activity, FileSignature, ScrollText, GraduationCap, LogOut, Moon, Sun } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { MetadataUploader } from "@/components/MetadataUploader";
import { AIProtectionHub } from "@/components/AIProtectionHub";
import { SplitSheets } from "@/components/SplitSheets";
import { Contracts } from "@/components/Contracts";
import { BrandLogo } from "@/components/BrandLogo";
import type { CatalogTrack } from "@/lib/catalog";
import { ArtistAvatar, ArtistOnboarding } from "@/components/ArtistOnboarding";
import { loadOnboarding, syncFromCloud, type Onboarding } from "@/lib/artist-profile";
import { RoyaltyUtilitySuite } from "@/components/RoyaltyUtilitySuite";
import { ExpertAssistance } from "@/components/ExpertAssistance";
import { RoyaltyHealthCheck } from "@/components/RoyaltyHealthCheck";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { toast } from "sonner";
import { sendTrialEndingReminder } from "@/lib/collab-trial.functions";
import { useBilling, type Purchase } from "@/hooks/useBilling";
import { openCheckout, getPaddleEnvironment } from "@/lib/paddle";
import { PRICE_TIER, TIER_LABEL, hasTier, takePlanIntent, type Tier } from "@/lib/plans";
import { PlanComparison, planAction } from "@/components/PlanComparison";

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
  const [catalogFix, setCatalogFix] = useState<{ trackId: string; field: string }>();
  const { tier: realTier, purchases, loaded: billingLoaded } = useBilling(user?.id);
  const [previewTier, setPreviewTier] = useState<Tier | "real">("real");
  // The test-mode tier preview is for super admins only, so testers can't hand themselves a paid plan in the UI.
  const staff = useQuery({ queryKey: ["staff-role", user?.id], queryFn: () => getStaffRole(), enabled: !!user && getPaddleEnvironment() === "sandbox" });
  const canPreview = staff.data?.role === "super_admin";
  const tier: Tier = canPreview && previewTier !== "real" ? previewTier : realTier;
  // Free accounts may only sign invited split sheets (/sign/$token). Generating one starts at Plus; collecting
  // collaborator e-signatures, agency exports and the utility suite need Collaborate. The database enforces both.
  // Free accounts use the Quick Check with their own song details; embedding and the catalog start at Plus.
  const canCatalog = hasTier(tier, "plus");
  const canSplit = hasTier(tier, "plus");
  const canCollect = hasTier(tier, "collaborate");
  const hasAi = purchases.some((p) => p.kind === "ai");
  const [onboard, setOnboard] = useState<Onboarding | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [embedKey, setEmbedKey] = useState(0);
  useEffect(() => {
    if (!user) return;
    setOnboard(loadOnboarding(user.id));
    let live = true;
    syncFromCloud(user.id).then((o) => {
      if (!live) return;
      setOnboard(o); setEmbedKey((k) => k + 1);
      if (!o?.done) setProfileOpen(true);
    });
    return () => { live = false; };
  }, [user]);
  const upgrade = () => document.getElementById("plans-trigger")?.click();
  const studio = useStudioMode();
  // Free accounts open on the Royalty Health Check (Quick Check) instead of the locked Embed tab.
  useEffect(() => { if (billingLoaded && !search.tab && !hasTier(realTier, "plus")) setTab((t) => (t === "embed" ? "health" : t)); }, [billingLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  // A plan picked before signup ("Sign up to start") goes straight to that plan's checkout once billing has loaded.
  useEffect(() => {
    if (!user || !billingLoaded) return;
    const priceId = takePlanIntent();
    if (!priceId || hasTier(realTier, PRICE_TIER[priceId]!)) return;
    toast.info(`Opening checkout for ${TIER_LABEL[PRICE_TIER[priceId]!]}…`);
    openCheckout({ items: [{ priceId, quantity: 1 }], email: user.email, customData: { userId: user.id } })
      .catch((e) => toast.error(e instanceof Error ? e.message : "Checkout could not open. Use View Plans to try again."));
  }, [user, billingLoaded, realTier]);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/" });
  }, [loading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    sendTrialEndingReminder({ data: { environment: getPaddleEnvironment(), origin: window.location.origin } })
      .then((r) => { if (r.sent) toast.info(`Your free Collaborate trial ends in ${r.daysLeft} day(s). We emailed you the details.`); })
      .catch(() => {});
  }, [user]);

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
      <PaymentTestModeBanner previewTier={previewTier} onPreviewTier={canPreview ? setPreviewTier : undefined} />
      <header className="border-b border-ink-border bg-ink text-ink-foreground">
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
            <Button variant="ghost" className="gap-2 text-ink-foreground hover:bg-ink-border hover:text-ink-foreground" onClick={() => navigate({ to: "/profile" })}>
              <ArtistAvatar src={onboard?.avatar} className="h-7 w-7" />Profile
            </Button>
            <Button variant="ghost" size="icon" aria-label={studio.on ? "Switch to light mode" : "Switch to Studio Mode (dark)"} title={studio.on ? "Light mode" : "Studio Mode"}
              className="text-ink-muted hover:bg-ink-border hover:text-ink-foreground" onClick={studio.toggle}>
              {studio.on ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <PlansDialog tier={tier} userId={user.id} email={user.email} />
            <Button variant="ghost" size="icon" aria-label="Log out" className="text-ink-muted hover:bg-ink-border hover:text-ink-foreground"
              onClick={async () => { await supabase.auth.signOut(); navigate({ to: "/" }); }}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <ArtistOnboarding userId={user.id} open={profileOpen} onOpenChange={setProfileOpen} firstRun={!onboard?.done}
        onSaved={(o) => { setOnboard(o); if (o.stageName) setName(o.stageName); setEmbedKey((k) => k + 1); setTab("embed"); }} />
      <main className="mx-auto max-w-7xl px-6 py-8">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="h-auto w-full flex-nowrap justify-start gap-1 overflow-x-auto bg-muted p-1">
            {tabs.map(({ id, label, icon: Icon }, i) => (
              <TabsTrigger key={id} value={id} className="shrink-0 gap-2 px-3 py-2.5 font-semibold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <span className="text-xs opacity-70">{i + 1}.</span><Icon className="h-4 w-4" /> {label}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="embed" forceMount className="data-[state=inactive]:hidden">
            {canCatalog ? <MetadataUploader key={`embed-${embedKey}`} stageName={name} avatar={onboard?.avatar} userId={user.id} mode="embed" onSubmitted={() => setCatalogKey((k) => k + 1)} />
              : <PlusLock title="Embed Metadata starts with Catalog Plus" onQuickCheck={() => setTab("health")} onUpgrade={upgrade} />}
          </TabsContent>
          <TabsContent value="catalog" forceMount className="data-[state=inactive]:hidden">
            {!canCatalog ? <PlusLock title="My Catalog starts with Catalog Plus" onQuickCheck={() => setTab("health")} onUpgrade={upgrade} /> : <>
            <MetadataUploader key={catalogKey} stageName={name} avatar={onboard?.avatar} userId={user.id} mode="catalog" canSplit={canSplit} canExport={canCollect} focus={catalogFix} onFocused={() => setCatalogFix(undefined)} onSplitSheet={(t) => { setSplitTrackId(t.id); setTab("splits"); }} onProtect={(t) => { setProtectTrack(t); setTab("protect"); }} /></>}
          </TabsContent>
          <TabsContent value="protect"><AIProtectionHub userId={user.id} paid={hasAi} email={user.email} track={protectTrack} /></TabsContent>
          <TabsContent value="splits"><SplitSheets userId={user.id} canSplit={canSplit} canCollect={canCollect} prefillTrackId={splitTrackId} onUpgrade={upgrade} /></TabsContent>
          <TabsContent value="health"><Health onFix={() => setTab("catalog")} onFixField={(trackId, field) => { setCatalogFix({ trackId, field }); setTab("catalog"); }} onEmbed={() => setTab("embed")} userId={user.id} email={user.email} purchases={purchases} canUtility={canCollect} onUpgrade={upgrade} /></TabsContent>
          <TabsContent value="learn"><Learn userId={user.id} unlocked={hasTier(tier, "management")} onUpgrade={upgrade} /></TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function PlusLock({ title, onQuickCheck, onUpgrade }: { title: string; onQuickCheck: () => void; onUpgrade: () => void }) {
  return (
    <div className="mt-6 flex flex-col items-center gap-3 rounded-2xl border-2 border-primary p-10 text-center">
      <Lock className="h-8 w-8 text-primary" />
      <h2 className="text-2xl font-bold">{title}</h2>
      <p className="max-w-lg text-muted-foreground">Embed your credits into every master, keep your catalog, masters, art and lyrics in one place, and generate split sheets for $24.99/yr. That's about $2.08 a month, billed annually.</p>
      <div className="mt-2 flex flex-wrap justify-center gap-3">
        <Button onClick={onUpgrade}>See plans</Button>
        <Button variant="outline" onClick={onQuickCheck}>Run a free Quick Check</Button>
      </div>
    </div>
  );
}

/**
 * Studio Mode: the workspace's dark theme for long sessions, on by default and remembered per browser. The class
 * goes on <html> so dialogs and menus (rendered outside the page) match; leaving the workspace removes it.
 */
function useStudioMode() {
  // Starts on (matches the server render), then applies the saved choice once in the browser.
  const [on, setOn] = useState(true);
  useEffect(() => {
    try { if (localStorage.getItem("cta.studioMode") === "off") setOn(false); } catch { /* storage blocked */ }
  }, []);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", on);
    try { localStorage.setItem("cta.studioMode", on ? "on" : "off"); } catch { /* storage blocked */ }
    return () => document.documentElement.classList.remove("dark");
  }, [on]);
  return { on, toggle: () => setOn((v) => !v) };
}

function Learn({ userId, unlocked, onUpgrade }: { userId: string; unlocked: boolean; onUpgrade: () => void }) {
  const [view, setView] = useState<"contracts" | "classes">("contracts");
  return (
    <div className="mt-6">
      <div className="inline-flex gap-1 rounded-lg bg-muted p-1">
        <Button size="sm" variant={view === "contracts" ? "default" : "ghost"} onClick={() => setView("contracts")}><ScrollText className="h-4 w-4" />Contracts & Blueprints</Button>
        <Button size="sm" variant={view === "classes" ? "default" : "ghost"} onClick={() => setView("classes")}><GraduationCap className="h-4 w-4" />Masterclasses</Button>
      </div>
      {/* Contracts handles its own gating: blueprint guides are a preview for everyone, and contracts sent to you are always visible. */}
      {view === "contracts" ? <Contracts userId={userId} unlocked={unlocked} onUpgrade={onUpgrade} />
        : !unlocked ? (
          <div className="mt-6 flex flex-col items-center gap-3 rounded-2xl border-2 border-primary p-8 text-center">
            <Lock className="h-8 w-8 text-primary" />
            <h2 className="text-2xl font-bold">Included with Catalog Management</h2>
            <p className="max-w-md text-muted-foreground">Industry masterclasses covering sync, publishing and royalties.</p>
            <Button onClick={onUpgrade}>Upgrade to unlock</Button>
          </div>
        ) : <Masterclasses />}
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
      <DialogContent className="max-h-[90vh] max-w-6xl overflow-y-auto">
        <DialogHeader><DialogTitle className="text-2xl font-bold">Choose your plan</DialogTitle></DialogHeader>
        <PlanComparison currentTier={tier} action={(p) => planAction(p, { tier, onBuy: (id) => void buy(id), onSignup: () => {} })} />
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

function Health({ onFix, onFixField, onEmbed, userId, email, purchases, canUtility, onUpgrade }: { userId: string; email?: string | undefined; purchases: Purchase[]; canUtility: boolean; onUpgrade: () => void; onFix: () => void; onFixField: (trackId: string, field: string) => void; onEmbed: () => void }) {
  return (
    <div className="mt-6 space-y-6">
      <RoyaltyHealthCheck userId={userId} onFix={onFix} onFixField={onFixField} onEmbed={onEmbed} />
      <div id="expert-assistance"><ExpertAssistance userId={userId} email={email} purchases={purchases} onFix={onFixField} /></div>
      <RoyaltyUtilitySuite unlocked={canUtility} onUpgrade={onUpgrade} />
    </div>
  );
}
