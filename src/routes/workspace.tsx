import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getStaffRole } from "@/lib/admin.functions";
import { ShieldCheck, FileAudio, Disc3, Activity, FileSignature, ScrollText, GraduationCap, LogOut, Moon, Sun, UserRound, Gem, Users, Calculator, Smartphone , PenLine, LifeBuoy, ChevronDown } from "lucide-react";
import { IosInstallHelp, useInstallApp } from "@/components/InstallApp";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useArtistName } from "@/hooks/useArtistName";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { MetadataUploader, type CatalogFocus } from "@/components/MetadataUploader";
import { AIProtectionHub } from "@/components/AIProtectionHub";
import { SplitSheets } from "@/components/SplitSheets";
import { Contracts } from "@/components/Contracts";
import { BrandLogo } from "@/components/BrandLogo";
import type { CatalogTrack } from "@/lib/catalog";
import { ArtistAvatar, ArtistOnboarding } from "@/components/ArtistOnboarding";
import { badgePrefs, loadOnboarding, loadSeatArtistDefaults, syncFromCloud, type Onboarding } from "@/lib/artist-profile";
import { RoyaltyUtilitySuite } from "@/components/RoyaltyUtilitySuite";
import { ExpertAssistance } from "@/components/ExpertAssistance";
import { RoyaltyHealthCheck, type HealthStart } from "@/components/RoyaltyHealthCheck";
import { NextBadgeHint } from "@/components/Badges";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { toast } from "sonner";
import { sendTrialEndingReminder } from "@/lib/collab-trial.functions";
import { useBilling, type Purchase } from "@/hooks/useBilling";
import { openCheckout, getPaymentsEnvironment } from "@/lib/checkout";
import { listSeatState, seatArtistsFor } from "@/lib/seats";
import { AddArtistDialog } from "@/components/ArtistSeats";
import { PRICE_TIER, TIER_LABEL, hasTier, planIntentFromSearch, rememberPlanIntent, takePlanIntent, upgradeNote, type Tier } from "@/lib/plans";
import { PlanComparison, planAction } from "@/components/PlanComparison";
import { readWorkingAs, rememberWorkingAs, scopedTier, workingProfiles, type WorkingProfile } from "@/lib/profile-switch";
import { BadgeWatcher } from "@/components/Badges";
import { Confetti } from "@/components/Confetti";
import { celebrateReturn } from "@/lib/celebrate";
import { rememberReturn } from "@/lib/password";
import { BadgeViewer } from "@/components/BadgeViewer";
import type { ShareInfo } from "@/components/BadgeCelebration";
import { isBadgeImage, badgeForArt, type CollectionId } from "@/lib/badges";
import { UpgradeLock } from "@/components/UpgradeLock";
import { EagleStatusBadge } from "@/components/EagleStatusBadge";
import { eagleStatus } from "@/lib/eagle-status";
import { CatalogLapseBanner } from "@/components/CatalogLapseBanner";
import { EmailConfirmBanner } from "@/components/EmailConfirmBanner";
import { InactivityBanner } from "@/components/InactivityBanner";
import { PlanPendingBanner } from "@/components/PlanPendingBanner";
import { PdfTools } from "@/components/PdfTools";
import { SupportCenter } from "@/components/SupportCenter";
import { inGrace, isPaused } from "@/lib/retention";
import type { GuideLink } from "@/lib/guides";

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
  // `plan` names a plan picked before the account existed: the workspace opens its checkout, so the purchase survives the
  // email round trip (and a link opened on another device, where the browser never held the pick).
  validateSearch: (s: Record<string, unknown>) => ({ tab: typeof s["tab"] === "string" ? (s["tab"] as string) : undefined, checkout: s["checkout"] === "success" ? "success" : undefined, view: s["view"] === "expert" ? "expert" : undefined, plan: planIntentFromSearch(s["plan"]) ?? undefined, ticket: typeof s["ticket"] === "string" ? (s["ticket"] as string) : undefined } as { tab?: string | undefined; checkout?: "success" | undefined; view?: "expert" | undefined; plan?: string | undefined; ticket?: string | undefined }),
  component: Workspace,
});

const tabs = [
  // Order (founder, 2026-10-25): the Hub sits right after My Catalog (they work together), Split Sheets right before Contracts.
  { id: "embed", label: "Embed Metadata", icon: FileAudio },
  { id: "catalog", label: "My Catalog", icon: Disc3 },
  { id: "health", label: "Royalty Health Hub", icon: Activity },
  { id: "protect", label: "AI Protection Hub", icon: ShieldCheck },
  { id: "splits", label: "Split Sheets", icon: FileSignature },
  { id: "learn", label: "Contracts & Blueprints", icon: GraduationCap },
  { id: "pdf", label: "PDF Fill & Sign", icon: PenLine },
  // Their own tickets last (founder, 2026-11-08): a reply email links straight here.
  { id: "support", label: "Support", icon: LifeBuoy },
];

/** Which badge collections each tab's next-badge card suggests from. */
const TAB_BADGES: Record<string, CollectionId[]> = {
  embed: ["core", "lyrics", "producer", "live"],
  catalog: ["core", "lyrics", "hiphop", "spiritual", "night"],
  splits: ["splits"],
  protect: ["core"],
  health: ["health"],
  learn: ["contracts"],
  pdf: ["contracts"],
};

function Workspace() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const search = Route.useSearch();
  const [tab, setTab] = useState(search.tab ?? "embed");
  const [splitTrackId, setSplitTrackId] = useState<string>();
  const [catalogKey, setCatalogKey] = useState(0);
  const [protectTrack, setProtectTrack] = useState<CatalogTrack>();
  const [catalogFix, setCatalogFix] = useState<CatalogFocus>();
  // A Royalty Health Check started from My Catalog: opens the Hub on that song's (or release's, or the catalog's) check-in.
  const [healthStart, setHealthStart] = useState<HealthStart>();
  /** My Catalog's "Continue Expert Registration" opens Royalty Health → Expert Help. */
  const [openExpert, setOpenExpert] = useState(false);
  // Used once: leaving the tab clears it, so coming back opens the Hub itself.
  useEffect(() => { if (tab !== "health") { setHealthStart(undefined); setOpenExpert(false); } }, [tab]);
  const { tier: realTier, purchases, loaded: billingLoaded, lapse, pauses, sub, plan, reload: reloadBilling } = useBilling(user?.id);
  // Back from paying for seats: open the invite form, so the artist's email is asked for right away (2026-11-04) — once
  // per visit, never again after it is closed (founder, 2026-11-07).
  const [seatsOpen, setSeatsOpen] = useState(false);
  // The artists on this account's live seats, and which one is being worked as. Declared here because the seat prompt
  // below fills the list as soon as the page settles.
  const [seatArtists, setSeatArtists] = useState<{ userId: string; name: string; tier: Exclude<Tier, "free"> }[]>([]);
  const [actingId, setActingId] = useState<string | null>(null);
  const seatPrompted = useRef(false);
  useEffect(() => {
    if (!user || seatPrompted.current || new URLSearchParams(window.location.search).get("checkout") !== "success") return;
    seatPrompted.current = true;
    listSeatState()
      .then((s) => { if (s.seats.some((seat) => seat.owner_id === user.id && seat.status === "unclaimed")) setSeatsOpen(true); })
      .catch(() => {});
  }, [user]);
  // The artists this account can work as: everyone who accepted a seat that is still paid for.
  useEffect(() => {
    if (!user) return;
    listSeatState()
      .then((s) => setSeatArtists(seatArtistsFor(s.seats, user.id)))
      .catch(() => setSeatArtists([]));
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  // A reload lands back on the artist being worked on, and only while that seat is still one of theirs.
  useEffect(() => {
    if (!user || !seatArtists.length) return;
    const remembered = readWorkingAs(workingProfiles({ userId: user.id, name: "", tier }, seatArtists));
    if (remembered) setActingId(remembered);
  }, [seatArtists.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const [previewTier, setPreviewTier] = useState<Tier | "real">("real");
  // A welcome burst only after 30 days away (founder, 2026-11-06): a routine visit gets none, and finishing a
  // blueprint checklist keeps its own celebration. Never for someone who turned celebrations off or asked for reduced motion.
  const [welcomeBurst, setWelcomeBurst] = useState(false);
  // The test-mode tier preview is for super admins only, so testers can't hand themselves a paid plan in the UI.
  const staff = useQuery({ queryKey: ["staff-role", user?.id], queryFn: () => getStaffRole(), enabled: !!user && getPaymentsEnvironment() === "sandbox" });
  const canPreview = staff.data?.role === "super_admin";
  const tier: Tier = canPreview && previewTier !== "real" ? previewTier : realTier;
  // Free accounts may only sign invited split sheets (/sign/$token). Generating one starts at Plus; collecting
  // collaborator e-signatures, agency exports and the utility suite need Collaborate. The database enforces both.
  // Free accounts use the Royalty Inspector with their own song details; embedding and the catalog start at Plus.
  // Working as an artist on one of this account's seats (founder, 2026-11-08): the switch is the same login, and the
  // workspace works at the seat's own tier, so an owner never borrows their plan's tools inside someone else's account.
  const actingSeat = seatArtists.find((a) => a.userId === actingId) ?? null;
  const actingAs: WorkingProfile | null = actingSeat ? { ...actingSeat, seat: true } : null;
  const workTier: Tier = scopedTier(actingAs, tier);
  // Every catalog read and write inside the two working tabs follows this id, never the browser's own account.
  const catalogOwner = actingSeat?.userId ?? user?.id ?? "";
  const canCatalog = hasTier(workTier, "plus");
  const canSplit = hasTier(workTier, "plus");
  const canCollect = hasTier(workTier, "collaborate");
  // After a plan ends (30 days before emptying) or while paused, the catalog stays viewable and downloadable.
  const catalogReadOnly = !canCatalog && (inGrace(lapse) || isPaused(pauses));
  const [onboard, setOnboard] = useState<Onboarding | null>(null);
  const names = useArtistName(user, onboard?.stageName);
  const name = names.display;
  // You, then each artist on a live seat: exactly the list the switcher shows.
  const profiles = workingProfiles({ userId: user?.id ?? "", name: name || "You", tier }, seatArtists);
  const [seatDefaultsFor, setSeatDefaultsFor] = useState<{ userId: string; name: string } | null>(null);
  /**
   * Switching remounts both working tabs, so the editor opens on the selected artist's saved defaults instead of the
   * last one's. Their defaults are read first: nothing is ever written by the switch itself.
   */
  const workAs = async (p: WorkingProfile) => {
    if (p.seat) await loadSeatArtistDefaults(p.userId).catch(() => {});
    setActingId(p.seat ? p.userId : null);
    rememberWorkingAs(p.seat ? p.userId : null);
    setEmbedKey((k) => k + 1);
    setCatalogKey((k) => k + 1);
  };
  const [onboardSynced, setOnboardSynced] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [embedKey, setEmbedKey] = useState(0);
  // The Health visit stays mounted once it is opened, so a check-in in progress survives a tab switch. Until it is
  // opened it stays unmounted, so its live agency lookups don't run for someone who never visits it.
  const [healthMounted, setHealthMounted] = useState(tab === "health");
  useEffect(() => { if (tab === "health") setHealthMounted(true); }, [tab]);
  const [viewAvatar, setViewAvatar] = useState(false);
  // The Catalog Management status eagle opens full size, with its own share card, like the profile badge above.
  const [viewEagle, setViewEagle] = useState(false);
  // Song share cards reported by Embed and My Catalog; every other tab shares the profile card.
  const [tabShare, setTabShare] = useState<Record<string, Partial<ShareInfo> & Pick<ShareInfo, "ctx">>>({});
  const share = tabShare[tab] ?? { ctx: "profile" as const };
  useEffect(() => {
    if (!user) return;
    const local = loadOnboarding(user.id);
    setOnboard(local);
    let live = true;
    syncFromCloud(user.id).then((o) => {
      if (!live) return;
      // Only the default actually changing remounts the two working tabs. An auth event (a token refresh, another
      // window signing in) used to look like a profile change and wipe an embed session or a visit in progress.
      if (JSON.stringify(o ?? null) !== JSON.stringify(local ?? null)) setEmbedKey((k) => k + 1);
      setOnboard(o); setOnboardSynced(true);
    });
    return () => { live = false; };
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  // The setup walkthrough (embed defaults, catalog profile) is for plans that can embed. Free accounts skip it and
  // land on the Royalty Health Hub; it opens the first time they upgrade.
  useEffect(() => {
    if (billingLoaded && onboardSynced && !onboard?.done && hasTier(tier, "plus")) setProfileOpen(true);
  }, [billingLoaded, onboardSynced, onboard?.done, tier]); // eslint-disable-line react-hooks/exhaustive-deps
  const upgrade = () => document.getElementById("plans-trigger")?.click();
  const openQuickCheck = () => { setTab("health"); setTimeout(() => document.getElementById("quick-check")?.scrollIntoView({ behavior: "smooth" }), 50); };
  const studio = useStudioMode();
  const app = useInstallApp();
  // Free accounts open on the Royalty Health Hub (Royalty Inspector) instead of the locked Embed tab.
  // A checkout return is never redirected: the webhook can still be in flight, so a brand-new Plus member would be
  // read as Free and moved off the tab they just bought (founder, 2026-11-08).
  useEffect(() => { if (billingLoaded && !search.tab && !search.checkout && !hasTier(realTier, "plus")) setTab((t) => (t === "embed" ? "health" : t)); }, [billingLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  // A plan picked before or during sign-up goes straight to that plan's checkout once billing has loaded. The plan
  // arrives two ways: named in the URL (the sign-up's confirmation link) or left in this browser (founder, 2026-11-06).
  // Until Stripe actually opens, it stays on screen as a banner, so nobody is left in a free workspace wondering where
  // the purchase went.
  const [pendingPlan, setPendingPlan] = useState<string | null>(() => planIntentFromSearch(search.plan));
  // One automatic attempt per plan per visit; the banner is the retry, so a closed checkout doesn't reopen itself.
  const [triedPlan, setTriedPlan] = useState<string | null>(null);
  useEffect(() => {
    if (!user || !billingLoaded) return;
    // Back from Stripe is the purchase itself: never reopen its checkout here. The webhook lands seconds later, so the
    // tier still reads Free at this moment and a second session for the same plan would charge them twice.
    if (search.checkout === "success") { takePlanIntent(); setPendingPlan(null); return; }
    const priceId = planIntentFromSearch(search.plan) ?? takePlanIntent();
    if (!priceId || hasTier(realTier, PRICE_TIER[priceId]!)) { setPendingPlan(null); return; }
    setPendingPlan(priceId);
    if (triedPlan === priceId) return;
    setTriedPlan(priceId);
    toast.info(`Opening checkout for ${TIER_LABEL[PRICE_TIER[priceId]!]}…`);
    openCheckout({ kind: "plan", priceId })
      .then(() => { takePlanIntent(); setPendingPlan(null); })
      .catch((e) => {
        // Keep the pick whatever went wrong: the banner, the next visit and the upgrade button all resume the purchase
        // instead of leaving them in a free workspace with it forgotten (founder, 2026-11-05).
        rememberPlanIntent(priceId);
        setPendingPlan(priceId);
        toast.error(e instanceof Error ? e.message : "Checkout could not open. Use the button at the top to try again.");
      });
  }, [user, billingLoaded, realTier]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!user) return;
    if (badgePrefs(loadOnboarding(user.id)).celebrations === "off") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    if (!celebrateReturn()) return;
    setWelcomeBurst(true);
    const t = setTimeout(() => setWelcomeBurst(false), 2800);
    return () => clearTimeout(t);
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Signed out: the dedicated log-in page, not the homepage. A returning member lands on their own form with their
  // email already filled in (founder, 2026-11-05), instead of being bounced back to the sign-up box.
  // Where they were going is saved first (founder, 2026-11-10): a ticket email opens `?tab=support&ticket=…`, and without
  // this the login round trip dropped it, so "Open your ticket" landed on Embed Metadata instead of their own thread.
  // Any workspace URL with a query is kept whole, so a tab, a ticket and a checkout return all survive signing in.
  useEffect(() => {
    if (loading || user) return;
    const here = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (window.location.search) rememberReturn(here);
    navigate({ to: "/login", replace: true });
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

  // One place decides which eagle the account shows (Soaring 1–4, Keep Soaring 4–8, I Soar The Highest 8+), so the
  // header badge and its share card can never disagree.
  const eagle = eagleStatus({ onManagement: tier === "management", startedAt: sub?.current_period_start ?? null });

  return (
    <div className="min-h-screen bg-background">
      {welcomeBurst && <div className="pointer-events-none fixed inset-0 z-[85]"><Confetti /></div>}
      <PaymentTestModeBanner previewTier={previewTier} onPreviewTier={canPreview ? setPreviewTier : undefined} />
      <header className="border-b border-ink-border bg-ink text-ink-foreground">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <BrandLogo showName={false} />
            <div className="min-w-0">
              <div className="text-xs uppercase tracking-widest text-ink-muted">Came Through Audio</div>
              <div className="truncate text-xl font-bold">{name}</div>
            </div>
            {/* Catalog Management status eagle: at the far right of the header's left group, after the wordmark and
                the artist name. Soaring (months 1–4) → Keep Soaring (4–8) → I Soar The Highest (8+), or grayed out
                until the account is on the plan (founder art, 2026-11-03). */}
            <button type="button" aria-label={`View your Catalog Management status: ${eagle.label}`} onClick={() => setViewEagle(true)}
              className="ml-1 shrink-0 self-center rounded-full transition hover:ring-2 hover:ring-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <EagleStatusBadge size={52} status={eagle} />
            </button>
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
              {profiles.length > 1 && (<>
                {profiles.map((p) => (
                  <DropdownMenuItem key={p.userId} onSelect={() => void workAs(p)} className="justify-between gap-3">
                    <span className="truncate">{p.seat ? p.name : "You"}</span>
                    <span className="text-xs font-semibold text-muted-foreground">{TIER_LABEL[p.tier]}</span>
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
              </>)}
              <DropdownMenuItem onSelect={() => navigate({ to: "/profile" })}><UserRound />Profile</DropdownMenuItem>
              <DropdownMenuItem onSelect={upgrade}><Gem />View Plans</DropdownMenuItem>
              <DropdownMenuItem onSelect={studio.toggle}>{studio.on ? <Sun /> : <Moon />}{studio.on ? "Light mode" : "Studio Mode"}</DropdownMenuItem>
              {app.canInstall && <DropdownMenuItem onSelect={() => void app.install()}><Smartphone />Install the app</DropdownMenuItem>}
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={async () => { await supabase.auth.signOut(); navigate({ to: "/" }); }}><LogOut />Log out</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <div className="hidden items-center gap-3 sm:flex">
            {/* Working as an artist on a seat: the same shape as switching accounts in Instagram or TikTok (founder, 2026-11-08). */}
            {profiles.length > 1 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="gap-2 text-ink-foreground hover:bg-ink-border hover:text-ink-foreground" aria-label="Switch the artist you are working as">
                    <Users className="h-4 w-4" />{actingAs ? actingAs.name : "You"}<ChevronDown className="h-4 w-4 opacity-70" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                  <DropdownMenuLabel className="font-normal text-muted-foreground">Working as</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {profiles.map((p) => (
                    <DropdownMenuItem key={p.userId} onSelect={() => void workAs(p)} className="justify-between gap-3">
                      <span className="truncate">{p.seat ? p.name : "You"}</span>
                      <span className="text-xs font-semibold text-muted-foreground">{TIER_LABEL[p.tier]}</span>
                    </DropdownMenuItem>
                  ))}
                  {actingAs && (<>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={() => setSeatDefaultsFor({ userId: actingAs.userId, name: actingAs.name })}>
                      <UserRound />Edit their defaults
                    </DropdownMenuItem>
                  </>)}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
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
            <PlansDialog tier={tier} note={plan ? upgradeNote(plan.orderedAt) : undefined} />
            <Button variant="ghost" size="icon" aria-label="Log out" className="text-ink-muted hover:bg-ink-border hover:text-ink-foreground"
              onClick={async () => { await supabase.auth.signOut(); navigate({ to: "/" }); }}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>
      <IosInstallHelp open={app.iosHelp} onOpenChange={app.setIosHelp} />

      <AddArtistDialog open={seatsOpen} onOpenChange={setSeatsOpen} canAddArtist={realTier !== "free"} />
      <ArtistOnboarding userId={user.id} open={profileOpen} onOpenChange={setProfileOpen} firstRun={!onboard?.done}
        canAddArtist={realTier !== "free"}
        onSaved={(o) => { setOnboard(o); setEmbedKey((k) => k + 1); setTab(canCatalog ? "embed" : "health"); }} />
      {/* The same defaults editor, on a seat artist's account, reachable from the switcher without leaving the workspace. */}
      {seatDefaultsFor && (
        <ArtistOnboarding userId={seatDefaultsFor.userId} seatArtist={{ name: seatDefaultsFor.name }} open firstRun={false}
          onOpenChange={(o) => { if (!o) setSeatDefaultsFor(null); }}
          onSaved={() => { setSeatDefaultsFor(null); setEmbedKey((k) => k + 1); setCatalogKey((k) => k + 1); }} />
      )}
      <BadgeWatcher userId={user.id} artist={names.artist} eagle={tier === "management"} />
      <main className="mx-auto max-w-7xl px-6 py-8">
        {pendingPlan && <PlanPendingBanner priceId={pendingPlan} />}
        {!user.email_confirmed_at && <EmailConfirmBanner email={user.email} />}
        <CatalogLapseBanner sub={sub} lapse={lapse} pauses={pauses} onRenew={upgrade} onChanged={() => void reloadBilling()} />
        <InactivityBanner userId={user.id} paid={realTier !== "free"} />
        {/* Which artist the two working tabs are on, so a saved song can never land in the wrong catalog by mistake. */}
        {actingAs && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/40 bg-accent/30 p-3 text-sm">
            <span>
              Working in <b>{actingAs.name}</b>&rsquo;s catalog at {TIER_LABEL[actingAs.tier]}. Embed Metadata and My Catalog save to their
              account; everything else in the workspace is still yours.
            </span>
            <Button variant="outline" size="sm" onClick={() => void workAs(profiles[0]!)}>Back to mine</Button>
          </div>
        )}
        <Tabs value={tab} onValueChange={setTab}>
          {/* One row, left to right, scrolled on narrow screens: all six belong on the same line (founder, 2026-11-04;
              centering is for the sub-tab strip under the artist name, not this row). */}
          <TabsList className="h-auto w-full flex-nowrap justify-start gap-1 overflow-x-auto bg-muted p-1">
            {tabs.map(({ id, label, icon: Icon }, i) => (
              <TabsTrigger key={id} value={id} className="shrink-0 gap-2 px-3 py-2.5 font-semibold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <span className="text-xs opacity-70">{i + 1}.</span><Icon className="h-4 w-4" /> {label}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* Same row on every tab: the artist name centered, the next-badge card pinned top right (founder, 2026-10-25:
              back to the card, not the round medal). Fixed side columns and height keep it in the same spot on every tab. */}
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
            about={(() => { const b = badgeForArt(onboard?.avatar); return b ? { description: b.description, times: 1 } : undefined; })()}
            share={{ ...share, artist: share.artist || names.artist || name }} />
          {/* The status eagle's share card: the same art the header shows, shared as a card under the artist's name. */}
          <BadgeViewer src={viewEagle ? eagle.art : undefined} name={eagle.label} round={false} onClose={() => setViewEagle(false)}
            about={{ description: eagle.locked ? eagle.detail : `${eagle.label}. ${eagle.stage.detail}`, times: 1 }}
            share={{ ...share, artist: share.artist || names.artist || name }} />

          <TabsContent value="embed" forceMount className="data-[state=inactive]:hidden">
            {canCatalog ? <MetadataUploader key={`embed-${catalogOwner}-${embedKey}`} userId={catalogOwner} mode="embed" canWav={hasTier(workTier, "management")} onShareInfo={(i) => setTabShare((m) => ({ ...m, embed: i }))} onSubmitted={() => setCatalogKey((k) => k + 1)} />
              : <PlusLock title="Embed Metadata starts with Catalog Plus" onQuickCheck={openQuickCheck} onUpgrade={upgrade} />}
          </TabsContent>
          <TabsContent value="catalog" forceMount className="data-[state=inactive]:hidden">
            {!canCatalog && !catalogReadOnly ? <PlusLock title="My Catalog starts with Catalog Plus" onQuickCheck={openQuickCheck} onUpgrade={upgrade} /> : <>
            <MetadataUploader key={`catalog-${catalogOwner}-${catalogKey}`} userId={catalogOwner} mode="catalog" canWav={hasTier(workTier, "management")} readOnly={catalogReadOnly} onShareInfo={(i) => setTabShare((m) => ({ ...m, catalog: i }))} canSplit={canSplit} canExport={canCollect} focus={catalogFix} onFocused={() => setCatalogFix(undefined)} onSplitSheet={(t) => { setSplitTrackId(t.id); setTab("splits"); }} onProtect={(t) => { setProtectTrack(t); setTab("protect"); }} onHealthCheck={(trackId, release) => { setHealthStart({ trackId, release, nonce: Date.now() }); setTab("health"); }} onExpert={() => { setOpenExpert(true); setTab("health"); }} /></>}
          </TabsContent>
          <TabsContent value="protect"><AIProtectionHub userId={user.id} purchases={purchases} justPaid={search.checkout === "success" && search.tab === "protect"} track={protectTrack} /></TabsContent>
          <TabsContent value="splits"><SplitSheets userId={user.id} canSplit={canSplit} canCollect={canCollect} prefillTrackId={splitTrackId} onUpgrade={upgrade} /></TabsContent>
          {/* forceMount: a visit has state in it (the streaming pull, an agency list, the check-in answers), so
              switching to My Catalog or another tab must not throw the appointment away. */}
          <TabsContent value="health" {...(healthMounted ? { forceMount: true as const } : {})} className="data-[state=inactive]:hidden"><Health startView={openExpert || search.view === "expert" || (search.tab === "health" && search.checkout === "success") ? "expert" : "check"} justPaid={search.tab === "health" && search.checkout === "success"} canCatalog={canCatalog} onFix={() => setTab("catalog")} onFixField={(trackId, field) => { setCatalogFix({ trackId, field }); setTab("catalog"); }} onAddSong={(newTitle, artist) => { setCatalogFix({ newTitle, artist, nonce: Date.now() }); setTab("catalog"); }} onEmbed={() => setTab("embed")} userId={user.id} purchases={purchases} canUtility={canCollect} onUpgrade={upgrade} onSplitSheet={(id) => { setSplitTrackId(id); setTab("splits"); }} start={healthStart} /></TabsContent>
          <TabsContent value="learn"><Learn userId={user.id} unlocked={hasTier(tier, "management")} onUpgrade={upgrade}
            onOpen={(link) => {
              if (link.where === "profile") setProfileOpen(true);
              else if (link.where === "catalog" || link.where === "health" || link.where === "splits") setTab(link.where);
            }} /></TabsContent>
          <TabsContent value="pdf">
            {hasTier(tier, "management")
              ? <PdfTools canEmail={false} title="Fill, sign and download a PDF" />
              : <PlusLock title="PDF Fill & Sign starts with Catalog Management" onQuickCheck={openQuickCheck} onUpgrade={upgrade} />}
          </TabsContent>
          <TabsContent value="support">
            <SupportCenter userId={user.id} openTicketId={search.ticket} />
          </TabsContent>
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

function Learn({ userId, unlocked, onUpgrade, onOpen }: { userId: string; unlocked: boolean; onUpgrade: () => void; /** A checklist item's shortcut, so a blueprint can be worked from its own list (founder, 2026-11-06). */ onOpen: (link: GuideLink) => void }) {
  const [view, setView] = useState<"contracts" | "classes">("contracts");
  return (
    <div className="mt-6">
      {SHOW_COACHING && <div className="inline-flex gap-1 rounded-lg bg-muted p-1">
        <Button size="sm" variant={view === "contracts" ? "default" : "ghost"} onClick={() => setView("contracts")}><ScrollText className="h-4 w-4" />Contracts & Blueprints</Button>
        <Button size="sm" variant={view === "classes" ? "default" : "ghost"} onClick={() => setView("classes")}><GraduationCap className="h-4 w-4" />One on One Coaching</Button>
      </div>}
      {/* Contracts handles its own gating: blueprint guides are a preview for everyone, and contracts sent to you are always visible. */}
      {view === "contracts" || !SHOW_COACHING ? <Contracts userId={userId} unlocked={unlocked} onUpgrade={onUpgrade} onOpen={onOpen} />
        : !unlocked ? <UpgradeLock title="One on One Coaching" tier="management" onUpgrade={onUpgrade}
            text="Private sessions with a music business expert on your catalog, releases, royalties or deals." />
        : <Coaching userId={userId} />}
    </div>
  );
}

function PlansDialog({ tier, note }: { tier: Tier; note?: string | undefined }) {
  const buy = async (priceId: string) => {
    try { await openCheckout({ kind: "plan", priceId }); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Checkout could not open."); }
  };
  return (
    <Dialog>
      <DialogTrigger asChild><Button id="plans-trigger" className="font-semibold">View Plans</Button></DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-6xl overflow-y-auto">
        <DialogHeader><DialogTitle className="text-2xl font-bold">Choose your plan</DialogTitle></DialogHeader>
        <PlanComparison currentTier={tier} note={note} action={(p) => planAction(p, { tier, onBuy: (id) => void buy(id), onSignup: () => {} })} />
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

function Health({ startView, justPaid, canCatalog, onFix, onFixField, onAddSong, onEmbed, userId, purchases, canUtility, onUpgrade, onSplitSheet, start }: { startView: "check" | "expert"; justPaid: boolean; canCatalog: boolean; userId: string; purchases: Purchase[]; canUtility: boolean; onUpgrade: () => void; onFix: () => void; onFixField: (trackId: string, field: string) => void; onAddSong: (title: string, artist?: string) => void; onEmbed: () => void; onSplitSheet: (trackId: string) => void; start?: HealthStart | undefined }) {
  // Three tools, one at a time, switched like Contracts & Blueprints.
  const [view, setView] = useState<"check" | "expert" | "utility">(startView);
  useEffect(() => { if (start) setView("check"); }, [start?.nonce]); // eslint-disable-line react-hooks/exhaustive-deps
  const views = [["check", "Health Hub", Activity], ["expert", "Expert Help", Users], ["utility", "Utility Suite", Calculator]] as const;
  return (
    <div className="mt-6 space-y-6">
      <div className="flex flex-wrap items-center justify-center gap-3">
        <div className="inline-flex flex-wrap justify-center gap-1 rounded-lg bg-muted p-1">
          {views.map(([id, label, Icon]) => <Button key={id} size="sm" variant={view === id ? "default" : "ghost"} onClick={() => setView(id)}><Icon className="h-4 w-4" />{label}</Button>)}
        </div>
      </div>
      {view === "check" && <RoyaltyHealthCheck userId={userId} canCatalog={canCatalog} canExport={canUtility} onUpgrade={onUpgrade} onFixField={onFixField} onEmbed={onEmbed} onSplitSheet={canCatalog ? onSplitSheet : undefined}
        onExpert={() => { setView("expert"); window.scrollTo({ top: 0, behavior: "smooth" }); }} start={start} />}
      {view === "expert" && <div id="expert-assistance"><ExpertAssistance userId={userId} purchases={purchases} justPaid={justPaid} onFix={onFixField} onCatalog={onFix} onAddSong={onAddSong} /></div>}
      {view === "utility" && <RoyaltyUtilitySuite unlocked={canUtility} onUpgrade={onUpgrade} userId={userId} />}
    </div>
  );
}
