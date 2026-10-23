import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getStaffRole } from "@/lib/admin.functions";
import { ShieldCheck, FileAudio, Disc3, Activity, FileSignature, ScrollText, GraduationCap, LogOut, Moon, Sun, UserRound, Gem, Users, Calculator, Smartphone } from "lucide-react";
import { IosInstallHelp, useInstallApp } from "@/components/InstallApp";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useArtistName } from "@/hooks/useArtistName";
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
import { NextBadgeHint } from "@/components/Badges";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { toast } from "sonner";
import { sendTrialEndingReminder } from "@/lib/collab-trial.functions";
import { useBilling, type Purchase } from "@/hooks/useBilling";
import { openCheckout, getPaymentsEnvironment } from "@/lib/checkout";
import { PRICE_TIER, TIER_LABEL, hasTier, takePlanIntent, type Tier } from "@/lib/plans";
import { PlanComparison, planAction } from "@/components/PlanComparison";
import { BadgeWatcher } from "@/components/Badges";
import { BadgeViewer } from "@/components/BadgeViewer";
import type { ShareInfo } from "@/components/BadgeCelebration";
import { isBadgeImage, type CollectionId } from "@/lib/badges";
import { UpgradeLock } from "@/components/UpgradeLock";
import { CatalogLapseBanner } from "@/components/CatalogLapseBanner";
import { inGrace, isPaused } from "@/lib/retention";

export const Route = createFileRoute("/workspace")({
  head: () => ({
    meta: [
      { title: "Workspace — Came Through Audio" },
      { name: "description", content: "Your Came Through Audio workspace: catalog, royalty health, splits and contracts." },
      { property: "og:title", content: "Workspace — Came Through Audio" },
      { property: "og:description", content: "Manage your music business from one secure dashboard." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  validateSearch: (s: Record<string, unknown>) => ({ tab: typeof s["tab"] === "string" ? (s["tab"] as string) : undefined, checkout: s["checkout"] === "success" ? "success" : undefined, view: s["view"] === "expert" ? "expert" : undefined } as { tab?: string | undefined; checkout?: "success" | undefined; view?: "expert" | undefined }),
  component: Workspace,
});

const tabs = [
  { id: "embed", label: "Embed Metadata", icon: FileAudio },
  { id: "catalog", label: "My Catalog", icon: Disc3 },
  { id: "splits", label: "Split Sheets", icon: FileSignature },
  { id: "protect", label: "AI Protection Hub", icon: ShieldCheck },
  { id: "health", label: "Royalty Health Check", icon: Activity },
  { id: "learn", label: "Contracts & Blueprints", icon: GraduationCap },
];

/** Which badge collections each tab's next-badge card suggests from. */
const TAB_BADGES: Record<string, CollectionId[]> = {
  embed: ["core", "lyrics", "producer", "live"],
  catalog: ["core", "lyrics", "hiphop", "spiritual", "night"],
  splits: ["splits"],
  protect: ["core"],
  health: ["health"],
  learn: ["contracts"],
};

function Workspace() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const search = Route.useSearch();
  const [tab, setTab] = useState(search.tab ?? "embed");
  const [splitTrackId, setSplitTrackId] = useState<string>();
  const [catalogKey, setCatalogKey] = useState(0);
  const [protectTrack, setProtectTrack] = useState<CatalogTrack>();
  const [catalogFix, setCatalogFix] = useState<{ trackId: string; field: string }>();
  const { tier: realTier, purchases, loaded: billingLoaded, lapse, pauses, sub, reload: reloadBilling } = useBilling(user?.id);
  const [previewTier, setPreviewTier] = useState<Tier | "real">("real");
  // The test-mode tier preview is for super admins only, so testers can't hand themselves a paid plan in the UI.
  const staff = useQuery({ queryKey: ["staff-role", user?.id], queryFn: () => getStaffRole(), enabled: !!user && getPaymentsEnvironment() === "sandbox" });
  const canPreview = staff.data?.role === "super_admin";
  const tier: Tier = canPreview && previewTier !== "real" ? previewTier : realTier;
  // Free accounts may only sign invited split sheets (/sign/$token). Generating one starts at Plus; collecting
  // collaborator e-signatures, agency exports and the utility suite need Collaborate. The database enforces both.
  // Free accounts use the Royalty Inspector with their own song details; embedding and the catalog start at Plus.
  const canCatalog = hasTier(tier, "plus");
  const canSplit = hasTier(tier, "plus");
  const canCollect = hasTier(tier, "collaborate");
  // After a plan ends (30 days before emptying) or while paused, the catalog stays viewable and downloadable.
  const catalogReadOnly = !canCatalog && (inGrace(lapse) || isPaused(pauses));
  const [onboard, setOnboard] = useState<Onboarding | null>(null);
  const names = useArtistName(user, onboard?.stageName);
  const name = names.display;
  const [onboardSynced, setOnboardSynced] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [embedKey, setEmbedKey] = useState(0);
  const [viewAvatar, setViewAvatar] = useState(false);
  // Song share cards reported by Embed and My Catalog; every other tab shares the profile card.
  const [tabShare, setTabShare] = useState<Record<string, Partial<ShareInfo> & Pick<ShareInfo, "ctx">>>({});
  const share = tabShare[tab] ?? { ctx: "profile" as const };
  useEffect(() => {
    if (!user) return;
    setOnboard(loadOnboarding(user.id));
    let live = true;
    syncFromCloud(user.id).then((o) => {
      if (!live) return;
      setOnboard(o); setEmbedKey((k) => k + 1); setOnboardSynced(true);
    });
    return () => { live = false; };
  }, [user]);
  // The setup walkthrough (embed defaults, catalog profile) is for plans that can embed. Free accounts skip it and
  // land on the Royalty Health Check; it opens the first time they upgrade.
  useEffect(() => {
    if (billingLoaded && onboardSynced && !onboard?.done && hasTier(tier, "plus")) setProfileOpen(true);
  }, [billingLoaded, onboardSynced, onboard?.done, tier]); // eslint-disable-line react-hooks/exhaustive-deps
  const upgrade = () => document.getElementById("plans-trigger")?.click();
  const openQuickCheck = () => { setTab("health"); setTimeout(() => document.getElementById("quick-check")?.scrollIntoView({ behavior: "smooth" }), 50); };
  const studio = useStudioMode();
  const app = useInstallApp();
  // Free accounts open on the Royalty Health Check (Royalty Inspector) instead of the locked Embed tab.
  useEffect(() => { if (billingLoaded && !search.tab && !hasTier(realTier, "plus")) setTab((t) => (t === "embed" ? "health" : t)); }, [billingLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  // A plan picked before signup ("Sign up to start") goes straight to that plan's checkout once billing has loaded.
  useEffect(() => {
    if (!user || !billingLoaded) return;
    const priceId = takePlanIntent();
    if (!priceId || hasTier(realTier, PRICE_TIER[priceId]!)) return;
    toast.info(`Opening checkout for ${TIER_LABEL[PRICE_TIER[priceId]!]}…`);
    openCheckout({ kind: "plan", priceId })
      .catch((e) => toast.error(e instanceof Error ? e.message : "Checkout could not open. Use View Plans to try again."));
  }, [user, billingLoaded, realTier]);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/" });
  }, [loading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    sendTrialEndingReminder({ data: { environment: getPaymentsEnvironment(), origin: window.location.origin } })
      .then((r) => { if (r.sent) toast.info(`Your free Collaborate trial ends in ${r.daysLeft} day(s). We emailed you the details.`); })
      .catch(() => {});
  }, [user]);


  if (loading || !user) {
    return <div className="flex min-h-screen items-center justify-center bg-ink text-ink-muted">Loading…</div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <PaymentTestModeBanner previewTier={previewTier} onPreviewTier={canPreview ? setPreviewTier : undefined} />
      <header className="border-b border-ink-border bg-ink text-ink-foreground">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <BrandLogo showName={false} />
            <div className="min-w-0">
              <div className="text-xs uppercase tracking-widest text-ink-muted">Came Through Audio</div>
              <div className="truncate text-xl font-bold">{name}</div>
            </div>
          </div>
          {/* Phones: everything sits in one menu on the profile picture, so the header never runs off the screen. */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-auto shrink-0 rounded-full p-1 hover:bg-ink-border sm:hidden" aria-label="Account menu">
                <ArtistAvatar src={onboard?.avatar} className="h-9 w-9" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="font-normal text-muted-foreground">{TIER_LABEL[tier]}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => navigate({ to: "/profile" })}><UserRound />Profile</DropdownMenuItem>
              <DropdownMenuItem onSelect={upgrade}><Gem />View Plans</DropdownMenuItem>
              <DropdownMenuItem onSelect={studio.toggle}>{studio.on ? <Sun /> : <Moon />}{studio.on ? "Light mode" : "Studio Mode"}</DropdownMenuItem>
              {app.canInstall && <DropdownMenuItem onSelect={() => void app.install()}><Smartphone />Install the app</DropdownMenuItem>}
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={async () => { await supabase.auth.signOut(); navigate({ to: "/" }); }}><LogOut />Log out</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <div className="hidden items-center gap-3 sm:flex">
            <Badge variant="outline" className="border-ink-border text-ink-foreground">{TIER_LABEL[tier]}</Badge>
            <Button variant="ghost" className="gap-2 text-ink-foreground hover:bg-ink-border hover:text-ink-foreground" onClick={() => navigate({ to: "/profile" })}>
              <ArtistAvatar src={onboard?.avatar} className="h-7 w-7" />Profile
            </Button>
            <Button variant="ghost" size="icon" aria-label={studio.on ? "Switch to light mode" : "Switch to Studio Mode (dark)"} title={studio.on ? "Light mode" : "Studio Mode"}
              className="text-ink-muted hover:bg-ink-border hover:text-ink-foreground" onClick={studio.toggle}>
              {studio.on ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            {app.canInstall && (
              <Button variant="ghost" size="icon" aria-label="Install the app" title="Install the app" className="text-ink-muted hover:bg-ink-border hover:text-ink-foreground" onClick={() => void app.install()}>
                <Smartphone className="h-4 w-4" />
              </Button>
            )}
            <PlansDialog tier={tier} />
            <Button variant="ghost" size="icon" aria-label="Log out" className="text-ink-muted hover:bg-ink-border hover:text-ink-foreground"
              onClick={async () => { await supabase.auth.signOut(); navigate({ to: "/" }); }}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>
      <IosInstallHelp open={app.iosHelp} onOpenChange={app.setIosHelp} />

      <ArtistOnboarding userId={user.id} open={profileOpen} onOpenChange={setProfileOpen} firstRun={!onboard?.done}
        onSaved={(o) => { setOnboard(o); setEmbedKey((k) => k + 1); setTab(canCatalog ? "embed" : "health"); }} />
      <BadgeWatcher userId={user.id} artist={names.artist} />
      <main className="mx-auto max-w-7xl px-6 py-8">
        <CatalogLapseBanner sub={sub} lapse={lapse} pauses={pauses} onRenew={upgrade} onChanged={() => void reloadBilling()} />
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="h-auto w-full flex-nowrap justify-start gap-1 overflow-x-auto bg-muted p-1">
            {tabs.map(({ id, label, icon: Icon }, i) => (
              <TabsTrigger key={id} value={id} className="shrink-0 gap-2 px-3 py-2.5 font-semibold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <span className="text-xs opacity-70">{i + 1}.</span><Icon className="h-4 w-4" /> {label}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* Same row on every tab: the artist name centered, the next-badge card pinned top right. Fixed side columns
              and height keep the card in the exact same spot from tab to tab. */}
          <div className="mt-8 grid items-center gap-4 sm:min-h-24 sm:grid-cols-[14rem_minmax(0,1fr)_14rem]">
            <div className="hidden sm:block" />
            <h1 className="flex items-center justify-center gap-[0.3em] text-center text-4xl font-extrabold leading-none tracking-tight md:text-5xl">
              <span className="min-w-0 break-words">{name}</span>
              {/* Avatar matches the name's height so badges can be enjoyed up close; click for full size. */}
              {onboard?.avatar && <button type="button" aria-label="View your profile badge" onClick={() => setViewAvatar(true)} className="shrink-0 rounded-full transition hover:ring-2 hover:ring-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <ArtistAvatar src={onboard.avatar} className="h-[1.15em] w-[1.15em]" />
              </button>}
            </h1>
            <NextBadgeHint userId={user.id} collections={TAB_BADGES[tab] ?? ["core"]} />
          </div>
          <BadgeViewer src={viewAvatar ? onboard?.avatar : undefined} round={!isBadgeImage(onboard?.avatar)} onClose={() => setViewAvatar(false)}
            share={{ ...share, artist: share.artist || names.artist || name }} />

          <TabsContent value="embed" forceMount className="data-[state=inactive]:hidden">
            {canCatalog ? <MetadataUploader key={`embed-${embedKey}`} userId={user.id} mode="embed" onShareInfo={(i) => setTabShare((m) => ({ ...m, embed: i }))} onSubmitted={() => setCatalogKey((k) => k + 1)} />
              : <PlusLock title="Embed Metadata starts with Catalog Plus" onQuickCheck={openQuickCheck} onUpgrade={upgrade} />}
          </TabsContent>
          <TabsContent value="catalog" forceMount className="data-[state=inactive]:hidden">
            {!canCatalog && !catalogReadOnly ? <PlusLock title="My Catalog starts with Catalog Plus" onQuickCheck={openQuickCheck} onUpgrade={upgrade} /> : <>
            <MetadataUploader key={catalogKey} userId={user.id} mode="catalog" readOnly={catalogReadOnly} onShareInfo={(i) => setTabShare((m) => ({ ...m, catalog: i }))} canSplit={canSplit} canExport={canCollect} focus={catalogFix} onFocused={() => setCatalogFix(undefined)} onSplitSheet={(t) => { setSplitTrackId(t.id); setTab("splits"); }} onProtect={(t) => { setProtectTrack(t); setTab("protect"); }} /></>}
          </TabsContent>
          <TabsContent value="protect"><AIProtectionHub userId={user.id} purchases={purchases} justPaid={search.checkout === "success" && search.tab === "protect"} track={protectTrack} /></TabsContent>
          <TabsContent value="splits"><SplitSheets userId={user.id} canSplit={canSplit} canCollect={canCollect} prefillTrackId={splitTrackId} onUpgrade={upgrade} /></TabsContent>
          <TabsContent value="health"><Health startView={search.view === "expert" || (search.tab === "health" && search.checkout === "success") ? "expert" : "check"} justPaid={search.tab === "health" && search.checkout === "success"} canCatalog={canCatalog} onFix={() => setTab("catalog")} onFixField={(trackId, field) => { setCatalogFix({ trackId, field }); setTab("catalog"); }} onEmbed={() => setTab("embed")} userId={user.id} purchases={purchases} canUtility={canCollect} onUpgrade={upgrade} onSplitSheet={(id) => { setSplitTrackId(id); setTab("splits"); }} /></TabsContent>
          <TabsContent value="learn"><Learn userId={user.id} unlocked={hasTier(tier, "management")} onUpgrade={upgrade} /></TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function PlusLock({ title, onQuickCheck, onUpgrade }: { title: string; onQuickCheck: () => void; onUpgrade: () => void }) {
  return <UpgradeLock title={title} tier="plus" onUpgrade={onUpgrade} free={{ label: "Run a free Royalty Health Check", onClick: onQuickCheck }}
    text="Embed your credits into every master, keep your catalog, masters, art and lyrics in one place, and generate split sheets." />;
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

/** One on One Coaching stays hidden until there's a plan for it (founder, 2026-10-23). Set to true to bring it back. */
const SHOW_COACHING = false;

function Learn({ userId, unlocked, onUpgrade }: { userId: string; unlocked: boolean; onUpgrade: () => void }) {
  const [view, setView] = useState<"contracts" | "classes">("contracts");
  return (
    <div className="mt-6">
      {SHOW_COACHING && <div className="inline-flex gap-1 rounded-lg bg-muted p-1">
        <Button size="sm" variant={view === "contracts" ? "default" : "ghost"} onClick={() => setView("contracts")}><ScrollText className="h-4 w-4" />Contracts & Blueprints</Button>
        <Button size="sm" variant={view === "classes" ? "default" : "ghost"} onClick={() => setView("classes")}><GraduationCap className="h-4 w-4" />One on One Coaching</Button>
      </div>}
      {/* Contracts handles its own gating: blueprint guides are a preview for everyone, and contracts sent to you are always visible. */}
      {view === "contracts" || !SHOW_COACHING ? <Contracts userId={userId} unlocked={unlocked} onUpgrade={onUpgrade} />
        : !unlocked ? <UpgradeLock title="One on One Coaching" tier="management" onUpgrade={onUpgrade}
            text="Private sessions with a music business expert on your catalog, releases, royalties or deals." />
        : <Coaching userId={userId} />}
    </div>
  );
}

function PlansDialog({ tier }: { tier: Tier }) {
  const buy = async (priceId: string) => {
    try { await openCheckout({ kind: "plan", priceId }); }
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

/** One on One Coaching (was Masterclasses): a notify list until booking opens. Keeps the "masterclasses" interest key, so earlier sign-ups carry over. */
function Coaching({ userId }: { userId: string }) {
  const [asked, setAsked] = useState(false);
  const [busy, setBusy] = useState(false);
  async function notifyMe() {
    setBusy(true);
    const { error } = await supabase.from("feature_interest" as never).upsert({ user_id: userId, feature: "masterclasses" } as never, { onConflict: "user_id,feature", ignoreDuplicates: true });
    setBusy(false);
    if (error) { toast.error("Couldn't save that. Try again."); return; }
    setAsked(true);
    toast.success("You're on the list. We'll email you as soon as coaching opens.");
  }
  return (
    <div className="mt-6 grid gap-6 md:grid-cols-2">
      <div className="rounded-2xl border border-border p-6">
        <GraduationCap className="h-8 w-8 text-primary" />
        <h2 className="mt-3 text-2xl font-bold">One on One Coaching</h2>
        <p className="mt-2 text-muted-foreground">A private video session with a music business expert, about your catalog, releases, royalties or deals.</p>
        <div className="mt-4 space-y-2">
          {([["30-minute session", "$25"], ["60-minute session", "$45"]] as const).map(([label, price]) => (
            <div key={label} className="flex items-center justify-between rounded-lg bg-muted p-4"><span className="font-semibold">{label}</span><span className="text-xl font-bold text-primary">{price}</span></div>
          ))}
        </div>
        <p className="mt-4 text-sm text-muted-foreground">Coaching sessions are being scheduled now. Join the list and we'll email you as soon as booking opens.</p>
        <Button className="mt-3 w-full" disabled={busy || asked} onClick={() => void notifyMe()}>{asked ? "You're on the list" : "Notify me when coaching opens"}</Button>
      </div>
    </div>
  );
}

function Health({ startView, justPaid, canCatalog, onFix, onFixField, onEmbed, userId, purchases, canUtility, onUpgrade, onSplitSheet }: { startView: "check" | "expert"; justPaid: boolean; canCatalog: boolean; userId: string; purchases: Purchase[]; canUtility: boolean; onUpgrade: () => void; onFix: () => void; onFixField: (trackId: string, field: string) => void; onEmbed: () => void; onSplitSheet: (trackId: string) => void }) {
  // Three tools, one at a time, switched like Contracts & Blueprints.
  const [view, setView] = useState<"check" | "expert" | "utility">(startView);
  const views = [["check", "Health Check", Activity], ["expert", "Expert Help", Users], ["utility", "Utility Suite", Calculator]] as const;
  return (
    <div className="mt-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex flex-wrap gap-1 rounded-lg bg-muted p-1">
          {views.map(([id, label, Icon]) => <Button key={id} size="sm" variant={view === id ? "default" : "ghost"} onClick={() => setView(id)}><Icon className="h-4 w-4" />{label}</Button>)}
        </div>
      </div>
      {view === "check" && <RoyaltyHealthCheck userId={userId} canCatalog={canCatalog} canExport={canUtility} onUpgrade={onUpgrade} onFixField={onFixField} onEmbed={onEmbed} onSplitSheet={canCatalog ? onSplitSheet : undefined}
        onExpert={() => { setView("expert"); window.scrollTo({ top: 0, behavior: "smooth" }); }} />}
      {view === "expert" && <div id="expert-assistance"><ExpertAssistance userId={userId} purchases={purchases} justPaid={justPaid} onFix={onFixField} onCatalog={onFix} /></div>}
      {view === "utility" && <RoyaltyUtilitySuite unlocked={canUtility} onUpgrade={onUpgrade} />}
    </div>
  );
}
