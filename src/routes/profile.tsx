import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { ArrowLeft, ArrowUpCircle, Check, LayoutGrid, LogOut, Pencil, Rows3 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useBilling } from "@/hooks/useBilling";
import { useArtistName } from "@/hooks/useArtistName";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BrandLogo } from "@/components/BrandLogo";
import { ArtistAvatar, ArtistOnboarding } from "@/components/ArtistOnboarding";
import { BadgeViewer } from "@/components/BadgeViewer";
import type { ShareInfo } from "@/components/BadgeCelebration";
import { badgePrefs, loadOnboarding, loadProfile, saveOnboarding, syncFromCloud, type ArtistProfile, type Onboarding } from "@/lib/artist-profile";
import { isBadgeImage } from "@/lib/badges";
import { BadgeDetail, BadgeSettings, BadgeSettingsButton, BadgeShelf, BadgeWatcher, useBadgeStates, type BadgeState } from "@/components/Badges";
import { creditName, writerRole, type Contributor } from "@/lib/metadata";
import { TIER_LABEL, refundDaysLeft } from "@/lib/plans";
import { openBilling } from "@/lib/checkout";
import { passwordValid } from "@/lib/password";
import { PasswordField } from "@/components/PasswordField";
import { RetentionControls } from "@/components/RetentionControls";
import { BrandKit } from "@/components/BrandKit";

export const Route = createFileRoute("/profile")({
  head: () => ({ meta: [{ title: "Profile — Came Through Audio" }, { name: "description", content: "Your artist profile, account and awards." }] }),
  component: ProfilePage,
});

type Size = "large" | "small";
const SIZE_KEY = "cta-awards-size";

function ProfilePage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { tier, paidTier, founding, plan, sub, pauses, lapse, reload } = useBilling(user?.id);
  const [ob, setOb] = useState<Onboarding | null>(null);
  const names = useArtistName(user, ob?.stageName);
  const [profile, setProfile] = useState<ArtistProfile | null>(null);
  const [editing, setEditing] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [viewing, setViewing] = useState<{ src: string; name?: string; round?: boolean; share?: ShareInfo }>();
  const [badge, setBadge] = useState<BadgeState>();
  const [badgeList, setBadgeList] = useState<BadgeState[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { states } = useBadgeStates(user?.id);
  const [size, setSize] = useState<Size>(() => { try { return localStorage.getItem(SIZE_KEY) === "small" ? "small" : "large"; } catch { return "large"; } });

  useEffect(() => { if (!loading && !user) navigate({ to: "/" }); }, [loading, user, navigate]);
  useEffect(() => {
    if (!user) return;
    setOb(loadOnboarding(user.id));
    setProfile(loadProfile(user.id));
    syncFromCloud(user.id).then((o) => { setOb(o); setProfile(loadProfile(user.id)); });
  }, [user]);

  function chooseSize(s: Size) {
    setSize(s);
    try { localStorage.setItem(SIZE_KEY, s); } catch { /* per-device preference only */ }
  }

  if (loading || !user) return <div className="flex min-h-screen items-center justify-center bg-ink text-ink-muted">Loading…</div>;

  const name = names.display;
  const legalName = ob?.legalName || (user.user_metadata?.["legal_name"] as string | undefined) || "";
  const memberSince = new Date(user.created_at).toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const earnedCount = states.filter((s) => s.earned).length;
  const genres = [profile?.primaryGenre, profile?.secondaryGenre].filter(Boolean).join(" · ");

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-ink text-ink-foreground">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-4">
          <BrandLogo />
          <Button asChild variant="ghost" className="text-ink-foreground hover:bg-ink-border hover:text-ink-foreground">
            <Link to="/workspace"><ArrowLeft />Back to workspace</Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-8 px-6 py-10">
        {/* Hero */}
        <section className="flex flex-col items-center gap-6 rounded-2xl border border-border bg-card p-8 text-center sm:flex-row sm:text-left">
          <button type="button" aria-label="View your profile picture" disabled={!ob?.avatar} onClick={() => ob?.avatar && setViewing({ src: ob.avatar, name, round: !isBadgeImage(ob.avatar), share: { ctx: "profile", artist: names.artist, genre: profile?.primaryGenre } })}
            className="shrink-0 rounded-full transition enabled:hover:ring-2 enabled:hover:ring-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <ArtistAvatar src={ob?.avatar} className="h-32 w-32 sm:h-36 sm:w-36" />
          </button>
          <div className="min-w-0 flex-1 space-y-2">
            <h1 className="break-words text-4xl font-extrabold leading-tight tracking-tight">{name}</h1>
            <p className="text-muted-foreground">{[legalName, `Member since ${memberSince}`].filter(Boolean).join(" · ")}</p>
            <span className="inline-block rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">{TIER_LABEL[tier]}</span>
          </div>
          <Button variant="outline" onClick={() => setEditing(true)}><Pencil />Edit profile</Button>
        </section>

        <div className="grid gap-8 md:grid-cols-2">
          <Card title="Artist Profile">
            <Rows rows={[
              ["Artist name", name],
              ["Legal name", legalName],
              ["Label", profile?.label],
              ["Genres", genres],
              ["Release type", profile?.releaseType],
              ["Composition ©", profile?.copyright],
              ["Recording ℗", profile?.phonographic],
            ]} />
            <People title="Writers" rows={profile?.writers} writer />
            <People title="Producers" rows={profile?.producers} />
            <People title="Publishers" rows={profile?.publishers} />
          </Card>

          <Card title="Account">
            <Rows rows={[["Email", user.email], ["Plan", TIER_LABEL[tier]],
              ...(founding ? [["Founding member", `#${founding.seat}: you get ${TIER_LABEL[founding.granted_tier]} for the price of ${TIER_LABEL[founding.paid_tier]}, as long as your plan stays active`] as [string, string]] : []),
              ...(plan?.periodEnd ? [[plan.cancelling ? "Ends" : "Renews", longDate(plan.periodEnd)] as [string, string]] : []),
              // The Refund Policy's 30-day window; upgrades stay prorated all year either way.
              ...(plan && refundDaysLeft(plan.orderedAt) ? [["Full refund", `${refundDaysLeft(plan.orderedAt)} day${refundDaysLeft(plan.orderedAt) === 1 ? "" : "s"} left to ask for a full refund · upgrades are always prorated`] as [string, string]] : []),
              ["Member since", memberSince]]} />
            <div className="flex flex-wrap gap-3 border-t border-border pt-5">
              {paidTier !== "management" && <Button asChild size="lg" className="w-full text-base font-bold"><Link to="/plans"><ArrowUpCircle />Upgrade plan</Link></Button>}
              {plan && <ManageBilling />}
              <RetentionControls tier={paidTier} sub={sub} lapse={lapse} pauses={pauses} onChanged={() => void reload()} />
              <Button variant="outline" onClick={() => setPasswordOpen(true)}>Change password</Button>
              <Button variant="ghost" onClick={async () => { await supabase.auth.signOut(); navigate({ to: "/" }); }}><LogOut />Log out</Button>
            </div>
          </Card>
        </div>

        <Card id="brand-kit" title="Brand kit">
          <BrandKit userId={user.id} tier={tier} artistName={names.artist || name} />
        </Card>

        <Card id="badges" title="Awards & Badges" aside={<>
          <span className="text-sm text-muted-foreground">{earnedCount} earned</span>
          <BadgeSettingsButton onClick={() => setSettingsOpen(true)} />
          <div role="radiogroup" aria-label="Badge size" className="flex rounded-lg border border-border p-0.5">
            {([["large", LayoutGrid, "Large"], ["small", Rows3, "Small"]] as const).map(([s, Icon, label]) => (
              <button key={s} type="button" role="radio" aria-checked={size === s} onClick={() => chooseSize(s)}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-semibold transition ${size === s ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                <Icon className="h-4 w-4" />{label}
              </button>
            ))}
          </div>
        </>}>
          <BadgeShelf userId={user.id} size={size} onOpen={(s, list) => { setBadge(s); setBadgeList(list); }} />
        </Card>
      </main>

      <BadgeDetail state={badge} list={badgeList} artist={names.artist} onClose={() => setBadge(undefined)} onMove={setBadge}
        onUseAsAvatar={(src) => { if (!ob) return; const next = { ...ob, avatar: src }; saveOnboarding(user.id, next); setOb(next); toast.success("Your profile picture is updated."); }}
        onShare={badgePrefs(ob).share ? (s) => { setBadge(undefined); setViewing({ src: s.badge.src, name: s.badge.title, share: { ctx: "profile", artist: names.artist, genre: profile?.primaryGenre } }); } : undefined} />
      <BadgeSettings userId={user.id} open={settingsOpen} onOpenChange={setSettingsOpen} onSaved={setOb} />
      <BadgeWatcher userId={user.id} artist={names.artist} />
      <BadgeViewer src={viewing?.src} name={viewing?.name} round={viewing?.round} share={viewing?.share} onClose={() => setViewing(undefined)} />
      <ArtistOnboarding userId={user.id} open={editing} onOpenChange={setEditing} firstRun={false}
        onSaved={(o) => { setOb(o); setProfile(loadProfile(user.id)); setEditing(false); }} />
      <PasswordDialog open={passwordOpen} onOpenChange={setPasswordOpen} />
    </div>
  );
}

function Card({ id, title, aside, children }: { id?: string; title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-6 space-y-6 rounded-2xl border border-border bg-card p-6 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xs font-bold uppercase tracking-widest text-primary">{title}</h2>
        {aside && <div className="flex flex-wrap items-center gap-4">{aside}</div>}
      </div>
      {children}
    </section>
  );
}

function Rows({ rows }: { rows: [string, string | undefined][] }) {
  return (
    <dl className="grid grid-cols-[8.5rem_1fr] gap-x-4 gap-y-3 text-sm">
      {rows.map(([k, v]) => <div key={k} className="contents">
        <dt className="text-muted-foreground">{k}</dt>
        <dd className={`min-w-0 break-words font-medium ${v ? "" : "text-muted-foreground"}`}>{v || "—"}</dd>
      </div>)}
    </dl>
  );
}

function People({ title, rows, writer }: { title: string; rows?: Contributor[] | undefined; writer?: boolean }) {
  const list = (rows ?? []).filter(creditName);
  if (!list.length) return null;
  return (
    <div className="space-y-2 border-t border-border pt-5">
      <h3 className="text-sm font-semibold">{title}</h3>
      <ul className="space-y-2 text-sm">
        {list.map((r, i) => <li key={i} className="flex flex-wrap items-baseline justify-between gap-x-3">
          <span className="font-medium">{creditName(r)}</span>
          {writer && <span className="text-xs text-muted-foreground">{writerRole(r.role)}</span>}
          {!writer && r.hfa && <span className="text-xs text-muted-foreground">HFA P# {r.hfa}</span>}
        </li>)}
      </ul>
    </div>
  );
}

function PasswordDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!passwordValid(password)) { toast.error("Choose a password that meets every rule."); return; }
    if (password !== confirm) { toast.error("The passwords don't match."); return; }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Password updated.");
    setPassword(""); setConfirm(""); onOpenChange(false);
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card text-card-foreground">
        <DialogHeader><DialogTitle className="text-xl font-bold">Change password</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <PasswordField id="new-password" label="New password" value={password} onChange={setPassword} />
          <div className="space-y-2"><Label htmlFor="confirm-password">Confirm new password</Label><Input id="confirm-password" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} /></div>
          <Button type="submit" className="w-full" disabled={busy}>{busy ? "Saving…" : "Update password"}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const longDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });

/** Opens Stripe's billing page for this account: change the card, download invoices, switch plans. */
function ManageBilling() {
  const [busy, setBusy] = useState(false);
  async function open() {
    setBusy(true);
    try {
      await openBilling();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Billing couldn't open. Contact support and we'll help right away.");
    } finally { setBusy(false); }
  }
  return <Button variant="outline" disabled={busy} onClick={() => void open()}>{busy ? "Opening…" : "Manage billing"}</Button>;
}
