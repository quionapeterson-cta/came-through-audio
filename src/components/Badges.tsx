import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronRight, Lock, Settings2, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { CelebrationStage, SharePanel } from "@/components/BadgeCelebration";
import { useBadges } from "@/hooks/useBadges";
import { badgePrefs, loadOnboarding, saveOnboarding, type Onboarding } from "@/lib/artist-profile";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { BADGES, COLLECTIONS, METRIC_UNIT, TIER_LABEL, isBigTier, nextGoal, withArtist, type BadgeDef, type BadgePrefs, type CollectionId } from "@/lib/badges";
import { markBadgesSeen } from "@/lib/badge-events";
import { pickBadgeArt, type EarnedBadge } from "@/lib/badges.functions";

export type BadgeState = { badge: BadgeDef; count: number; earned?: EarnedBadge | undefined; off: boolean };

/** Every badge with the user's progress, plus the earned ones still waiting for their pop-up. */
export function useBadgeStates(userId: string | undefined) {
  const query = useBadges(userId);
  const states = useMemo(() => {
    const d = query.data;
    const held = new Map((d?.earned ?? []).map((e) => [e.id, e]));
    const off = new Set(d?.disabled ?? []);
    return BADGES.map((badge): BadgeState => ({ badge, count: d?.metrics[badge.metric] ?? 0, earned: held.get(badge.id), off: off.has(badge.id) }));
  }, [query.data]);
  return { ...query, states, unseen: states.filter((s) => s.earned && !s.earned.seenAt) };
}

/** The art for one earning: the user's pick for badges with choices, otherwise the badge's own art. */
const artFor = (badge: BadgeDef, pick?: string | null) => (pick && badge.choices?.includes(pick) ? pick : badge.src);
/** The art the shelf shows: the latest pick, or the badge's own art. */
const shelfArt = (s: BadgeState) => artFor(s.badge, [...(s.earned?.log ?? [])].reverse().find((e) => e.pick)?.pick);

function TierChip({ badge }: { badge: BadgeDef }) {
  const label = TIER_LABEL[badge.tier];
  if (!label) return null;
  return <span className={`${isBigTier(badge.tier) ? "cta-badge-gold" : "cta-badge-blue"} text-xs uppercase tracking-widest`}>{label}</span>;
}

/**
 * Celebrates newly earned badges, following the user's settings: all, big moments only (others get a quiet toast),
 * or off (they wait, unseen, until celebrations are back on). Four or more at once show as one summary.
 */
export function BadgeWatcher({ userId, artist }: { userId: string; artist?: string | undefined }) {
  const { unseen: waiting } = useBadgeStates(userId);
  const [queue, setQueue] = useState<BadgeState[]>([]);
  const [summary, setSummary] = useState<BadgeState[]>([]);
  // Badges already shown this visit, so a pop-up never repeats while the server copy catches up.
  const shown = useRef(new Set<string>());
  const unseen = waiting.filter((s) => !shown.current.has(`${s.badge.id}:${s.earned?.times}`));

  useEffect(() => {
    if (!unseen.length || queue.length || summary.length) return;
    const prefs = badgePrefs(loadOnboarding(userId));
    if (prefs.celebrations === "off") return;
    for (const s of unseen) shown.current.add(`${s.badge.id}:${s.earned?.times}`);
    const quiet = unseen.filter((s) => prefs.hidden.includes(s.badge.collection) || (prefs.celebrations === "big" && !isBigTier(s.badge.tier)));
    const loud = unseen.filter((s) => !quiet.includes(s));
    if (quiet.length) {
      void markBadgesSeen(userId, quiet.map((s) => s.badge.id));
      for (const s of quiet.filter((q) => !prefs.hidden.includes(q.badge.collection)).slice(0, 3)) toast.success(`New badge: ${s.badge.title}`);
    }
    if (loud.length >= 4) setSummary(loud); else setQueue(loud);
  }, [unseen.length, userId]); // eslint-disable-line react-hooks/exhaustive-deps

  function next() {
    const [done, ...rest] = queue;
    if (done) void markBadgesSeen(userId, [done.badge.id]);
    setQueue(rest);
  }
  function closeSummary() {
    void markBadgesSeen(userId, summary.map((s) => s.badge.id));
    setSummary([]);
  }

  const current = queue[0];
  return <>
    <Dialog open={!!current} onOpenChange={(o) => !o && next()}>
      {current && <UnlockPopup key={`${current.badge.id}:${current.earned?.times}`} state={current} artist={artist} more={queue.length - 1} onNext={next}
        share={badgePrefs(loadOnboarding(userId)).share} />}
    </Dialog>
    <Dialog open={summary.length > 0} onOpenChange={(o) => !o && closeSummary()}>
      <DialogContent className="max-h-[90svh] max-w-2xl overflow-y-auto bg-card text-card-foreground">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">You came through: {summary.length} new badges</DialogTitle>
          <DialogDescription>Every one of these was earned by handling your music business. Open your profile to see what each one means.</DialogDescription>
        </DialogHeader>
        <ul className="grid grid-cols-3 gap-4 sm:grid-cols-4">
          {summary.map((s) => <li key={s.badge.id} className="flex flex-col items-center gap-2 text-center">
            <img src={s.badge.src} alt="" className="aspect-square w-full object-contain drop-shadow-lg" style={{ animation: "badge-pop 0.6s ease-out" }} />
            <span className="text-xs font-semibold">{s.badge.title}</span>
          </li>)}
        </ul>
        <div className="flex flex-wrap gap-2">
          <Button asChild onClick={closeSummary}><Link to="/profile">See all my badges</Link></Button>
          <Button variant="outline" onClick={closeSummary}>Keep going</Button>
        </div>
      </DialogContent>
    </Dialog>
  </>;
}

/**
 * The unlock pop-up: the big badge pops in, shines, rains and floats, with the message underneath and a Share button
 * that opens the share-card panel. Badges with art choices (Self-Produced) ask for the pick first.
 */
function UnlockPopup({ state, artist, more, onNext, share }: { state: BadgeState; artist?: string | undefined; more: number; onNext: () => void; share: boolean }) {
  const { badge, earned } = state;
  const pickFn = useServerFn(pickBadgeArt);
  const qc = useQueryClient();
  const log = earned?.log ?? [];
  const open = badge.choices ? log.findIndex((e) => e.pick === null) : -1;
  const [picked, setPicked] = useState<string>();
  const [saving, setSaving] = useState(false);
  const [sharing, setSharing] = useState(false);
  const choosing = open >= 0 && !picked;
  const src = artFor(badge, picked ?? log[log.length - 1]?.pick);

  async function choose(pick: string) {
    setSaving(true);
    try {
      await pickFn({ data: { badgeId: badge.id, index: open, pick } });
      setPicked(pick);
      void qc.invalidateQueries({ queryKey: ["badges"] });
    } catch { toast.error("Couldn't save your pick. Try again."); }
    finally { setSaving(false); }
  }

  return (
    <DialogContent className="h-full max-h-none max-w-none overflow-y-auto border-0 bg-transparent p-0 shadow-none sm:rounded-none [&>button]:!bg-transparent [&>button]:!text-white [&>button]:opacity-90">
      <DialogTitle className="sr-only">New badge: {badge.title}</DialogTitle>
      <DialogDescription className="sr-only">{withArtist(badge.popup, artist)}</DialogDescription>
      <div className="mx-auto flex min-h-full w-full max-w-[min(94vw,40rem)] flex-col items-center justify-center gap-6 px-2 py-12 text-center text-white">
        {choosing ? <section className="w-full space-y-6">
          <p className="text-xs font-bold uppercase tracking-[2px] text-[#4d8cff]">{badge.title}</p>
          <h2 className="text-2xl font-bold sm:text-3xl">{withArtist(badge.popup, artist)}</h2>
          <ul className="grid grid-cols-3 gap-3 sm:gap-6">
            {badge.choices!.map((c) => <li key={c}>
              <button type="button" disabled={saving} onClick={() => void choose(c)} aria-label={`Pick ${c.split("/").pop()?.replace(/[_-]/g, " ").replace(/\.\w+$/, "")}`}
                className="w-full rounded-2xl border border-white/20 p-2 transition hover:border-[#4d8cff] hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50">
                <img src={c} alt="" className="aspect-square w-full object-contain drop-shadow-xl" style={{ animation: "badge-pop 0.6s ease-out" }} />
              </button>
            </li>)}
          </ul>
        </section> : <>
          <CelebrationStage src={src} name={badge.title} float />
          <section className="w-full space-y-3">
            <p className="text-xs font-bold uppercase tracking-[2px] text-[#4d8cff]">
              {TIER_LABEL[badge.tier] || "New badge"}{(earned?.times ?? 0) > 1 ? ` · ×${earned!.times}` : ""}
            </p>
            <p className="text-2xl font-bold sm:text-3xl">{withArtist(badge.popup, artist)}</p>
            <p className="text-white/75">{badge.description}</p>
            <p className="text-sm text-white/60"><span className="font-semibold">Milestone: </span>{badge.milestone}</p>
            <div className="flex flex-wrap justify-center gap-3 pt-3">
              {share && <Button size="lg" onClick={() => setSharing((v) => !v)} aria-expanded={sharing}><Share2 />Share</Button>}
              <Button size="lg" variant="outline" className="border-white/60 bg-transparent text-white hover:bg-white/10 hover:text-white" onClick={onNext}>
                {more > 0 ? <>Next badge ({more} more)<ChevronRight /></> : "Keep going"}
              </Button>
            </div>
            <Link to="/profile" hash="badges" onClick={onNext} className="inline-block pt-1 text-sm text-white/70 underline-offset-4 hover:text-white hover:underline">See all my badges</Link>
          </section>
          {sharing && <SharePanel avatar={src} share={{ ctx: "profile", artist: artist ?? "" }} />}
        </>}
      </div>
    </DialogContent>
  );
}

const remaining = (s: BadgeState) => Math.max(0, s.badge.goal - s.count);
const unitFor = (s: BadgeState, n: number) => {
  const unit = METRIC_UNIT[s.badge.metric];
  return unit ? `${n} more ${n === 1 ? unit[0] : unit[1]}` : null;
};

/** "3 more lyrics to Lyric Lover": the closest badge in these collections, linking to the profile shelf. */
export function NextBadgeHint({ userId, collections, className = "" }: { userId: string; collections: CollectionId[]; className?: string }) {
  const { states } = useBadgeStates(userId);
  const prefs = badgePrefs(loadOnboarding(userId));
  if (!prefs.hints) return null;
  const next = states
    .filter((s) => collections.includes(s.badge.collection) && !prefs.hidden.includes(s.badge.collection) && !s.earned && !s.off)
    .sort((a, b) => remaining(a) / a.badge.goal - remaining(b) / b.badge.goal)[0];
  if (!next) return null;
  const left = unitFor(next, remaining(next));
  return (
    <Link to="/profile" hash="badges" className={`inline-flex items-center gap-3 rounded-full border border-border bg-card py-1 pl-1 pr-4 text-sm transition hover:border-primary ${className}`}>
      <img src={next.badge.src} alt="" className="h-8 w-8 object-contain opacity-60 grayscale" />
      <span><span className="font-semibold">{left ? `${left} to ${next.badge.title}` : `Next badge: ${next.badge.title}`}</span>
        <span className="text-muted-foreground"> · {next.count}/{next.badge.goal}</span></span>
    </Link>
  );
}

type Size = "large" | "small";
const UP_NEXT = 3;

/** Profile shelf: earned badges and the next few locked ones, grouped by collection. */
export function BadgeShelf({ userId, size, onOpen }: { userId: string; size: Size; onOpen: (s: BadgeState) => void }) {
  const { states, isLoading, isError } = useBadgeStates(userId);
  const prefs = badgePrefs(loadOnboarding(userId));
  if (isLoading) return <p className="text-sm text-muted-foreground">Loading your badges…</p>;
  if (isError) return <p className="text-sm text-destructive">Couldn't load your badges. Refresh to try again.</p>;
  const groups = COLLECTIONS.filter((c) => !prefs.hidden.includes(c.id)).map((c) => {
    const mine = states.filter((s) => s.badge.collection === c.id);
    const earned = mine.filter((s) => s.earned);
    const started = c.always || earned.length > 0 || mine.some((s) => s.count > 0);
    const locked = started ? mine.filter((s) => !s.earned && !s.off).slice(0, UP_NEXT) : [];
    return { ...c, earned, locked };
  }).filter((g) => g.earned.length || g.locked.length);
  const grid = size === "large" ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-3 sm:grid-cols-6";
  return (
    <div className="space-y-8">
      {groups.map((g) => (
        <section key={g.id} className="space-y-4 border-t border-border pt-6 first:border-t-0 first:pt-0">
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="text-xs font-bold uppercase tracking-widest text-primary">{g.title}</h3>
            <span className="text-xs text-muted-foreground">{g.earned.length} earned</span>
          </div>
          <ul className={`grid gap-6 ${grid}`}>
            {[...g.earned, ...g.locked].map((s) => <li key={s.badge.id}>
              <button type="button" onClick={() => onOpen(s)} aria-label={s.earned ? `View ${s.badge.title}` : `${s.badge.title} (locked): ${s.badge.milestone}`}
                className="group flex w-full flex-col items-center gap-2 rounded-xl p-3 text-center transition hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <span className="relative flex aspect-square w-full items-center justify-center">
                  <img src={shelfArt(s)} alt="" loading="lazy" className={`h-full w-full object-contain transition ${s.earned ? "drop-shadow-lg group-hover:drop-shadow-2xl" : "opacity-30 grayscale"}`} />
                  {!s.earned && <Lock className="absolute h-6 w-6 text-muted-foreground" />}
                  {(s.earned?.times ?? 0) > 1 && <span className="cta-badge-count absolute right-0 top-0" aria-label={`Earned ${s.earned!.times} times`}>×{s.earned!.times}</span>}
                </span>
                <span className={`font-semibold ${size === "large" ? "text-sm" : "text-xs"} ${s.earned ? "" : "text-muted-foreground"}`}>{s.badge.title}</span>
                {!s.earned && s.badge.goal > 1 && <span className="text-xs text-muted-foreground">{Math.min(s.count, s.badge.goal)}/{s.badge.goal}</span>}
              </button>
            </li>)}
          </ul>
        </section>
      ))}
    </div>
  );
}

/** Close-up of one badge: what it's for, when it was earned, or how far along the user is. */
export function BadgeDetail({ state, artist, onClose, onShare }: { state?: BadgeState | undefined; artist?: string | undefined; onClose: () => void; onShare?: ((s: BadgeState) => void) | undefined }) {
  const s = state;
  return (
    <Dialog open={!!s} onOpenChange={(o) => !o && onClose()}>
      {s && <DialogContent className="max-h-[95svh] max-w-[min(94vw,52rem)] overflow-y-auto bg-card text-card-foreground">
        <div className="grid items-center gap-6 md:grid-cols-2">
          <img src={shelfArt(s)} alt="" className={`mx-auto max-h-[40svh] w-full object-contain ${s.earned ? "drop-shadow-2xl" : "opacity-40 grayscale"}`} />
          <div className="space-y-3">
            <TierChip badge={s.badge} />
            <DialogTitle className="text-2xl font-bold">{s.badge.title}</DialogTitle>
            <DialogDescription className="text-base text-muted-foreground">{s.earned ? s.badge.description : `Locked. ${s.badge.milestone}.`}</DialogDescription>
            {s.earned
              ? <p className="text-sm"><span className="font-semibold">Earned </span>{new Date(s.earned.earnedAt).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}{s.earned.times > 1 ? ` · ${s.earned.times} times` : ""}</p>
              : <>
                <p className="text-sm"><span className="font-semibold">Progress: </span>{Math.min(s.count, s.badge.goal)} of {s.badge.goal}</p>
                <div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuemin={0} aria-valuemax={s.badge.goal} aria-valuenow={Math.min(s.count, s.badge.goal)}>
                  <div className="h-full bg-primary" style={{ width: `${Math.min(100, (s.count / s.badge.goal) * 100)}%` }} />
                </div>
              </>}
            {s.earned && s.badge.every && <p className="text-sm"><span className="font-semibold">Earn it again: </span>{s.count} of {nextGoal(s.badge, s.count)}</p>}
            {s.earned && <p className="text-sm italic text-muted-foreground">“{withArtist(s.badge.popup, artist)}”</p>}
            {s.earned && onShare && <Button onClick={() => onShare(s)}>Share your badge</Button>}
          </div>
        </div>
        {s.earned && s.earned.times > 1 && <Earnings state={s} />}
      </DialogContent>}
    </Dialog>
  );
}

/** Every time a badge was earned, as its own small badge with its date. Earnings from before dates were kept show their number only. */
function Earnings({ state }: { state: BadgeState }) {
  const { badge, earned } = state;
  const log = earned?.log ?? [];
  const times = earned?.times ?? 0;
  // Badges earned before dates were kept have only their first date; later dates line up from the most recent.
  const gap = times - log.length;
  const items = Array.from({ length: times }, (_, i) => (i === 0 ? log[0] : i > gap ? log[i - gap] : undefined));
  return (
    <section className="space-y-3 border-t border-border pt-5">
      <h3 className="text-xs font-bold uppercase tracking-widest text-primary">Earned {times} times</h3>
      <ol className="grid grid-cols-4 gap-4 sm:grid-cols-6">
        {items.map((e, i) => <li key={i} className="flex flex-col items-center gap-1 text-center">
          <img src={artFor(badge, e?.pick)} alt="" loading="lazy" className="aspect-square w-full object-contain drop-shadow-md" />
          <span className="text-xs text-muted-foreground">{e?.at ? new Date(e.at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : `#${i + 1}`}</span>
        </li>)}
      </ol>
    </section>
  );
}

/** Badge settings: what shows, never what's earned. Saved with the profile so it follows the user across devices. */
export function BadgeSettings({ userId, open, onOpenChange, onSaved }: { userId: string; open: boolean; onOpenChange: (o: boolean) => void; onSaved?: (o: Onboarding) => void }) {
  const [prefs, setPrefs] = useState<BadgePrefs>(() => badgePrefs(loadOnboarding(userId)));
  useEffect(() => { if (open) setPrefs(badgePrefs(loadOnboarding(userId))); }, [open, userId]);
  function save(next: BadgePrefs) {
    setPrefs(next);
    const ob = loadOnboarding(userId);
    if (!ob) return;
    const updated = { ...ob, badgePrefs: next };
    saveOnboarding(userId, updated);
    onSaved?.(updated);
  }
  const choices = [["all", "All"], ["big", "Big moments only"], ["off", "Off"]] as const;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-y-auto bg-card text-card-foreground">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">Badge settings</DialogTitle>
          <DialogDescription>You keep earning badges no matter what you choose here. These settings only change what you see.</DialogDescription>
        </DialogHeader>
        <div className="space-y-6">
          <fieldset className="space-y-2">
            <legend className="text-sm font-semibold">Celebrations</legend>
            <p className="text-xs text-muted-foreground">"Big moments only" celebrates MEGA and Ultimate badges and quietly adds the rest. With celebrations off, new badges wait for you until you turn them back on.</p>
            <div role="radiogroup" aria-label="Celebrations" className="flex flex-wrap rounded-lg border border-border p-0.5">
              {choices.map(([v, label]) => <button key={v} type="button" role="radio" aria-checked={prefs.celebrations === v} onClick={() => save({ ...prefs, celebrations: v })}
                className={`rounded-md px-3 py-1.5 text-sm font-semibold transition ${prefs.celebrations === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>{label}</button>)}
            </div>
          </fieldset>
          <label className="flex items-start justify-between gap-4">
            <span><span className="block text-sm font-semibold">Next-badge hints</span><span className="text-xs text-muted-foreground">Shows how close you are to your next badge in My Catalog, Embed Metadata and the Royalty Health Check.</span></span>
            <Switch checked={prefs.hints} onCheckedChange={(v) => save({ ...prefs, hints: v })} />
          </label>
          <label className="flex items-start justify-between gap-4">
            <span><span className="block text-sm font-semibold">Badge sharing</span><span className="text-xs text-muted-foreground">Shows the Share button on your earned badges.</span></span>
            <Switch checked={prefs.share} onCheckedChange={(v) => save({ ...prefs, share: v })} />
          </label>
          <fieldset className="space-y-2">
            <legend className="text-sm font-semibold">Collections</legend>
            <p className="text-xs text-muted-foreground">Turn off collections that don't fit your music. Hidden collections still earn quietly.</p>
            <ul className="divide-y divide-border rounded-lg border border-border">
              {COLLECTIONS.map((c) => <li key={c.id}>
                <label className="flex items-center justify-between gap-4 px-3 py-2 text-sm">
                  {c.title}
                  <Switch checked={!prefs.hidden.includes(c.id)} aria-label={`Show ${c.title}`}
                    onCheckedChange={(v) => save({ ...prefs, hidden: v ? prefs.hidden.filter((h) => h !== c.id) : [...prefs.hidden, c.id] })} />
                </label>
              </li>)}
            </ul>
          </fieldset>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function BadgeSettingsButton({ onClick }: { onClick: () => void }) {
  return <Button variant="outline" size="sm" onClick={onClick}><Settings2 />Badge settings</Button>;
}
