import { useState } from "react";
import { FileDown, Image as ImageIcon } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ALL_BADGES, COLLECTIONS, METRIC_UNIT, TIER_LABEL, type BadgeDef } from "@/lib/badges";
import { artUrl } from "@/lib/art-url";
import { listBadgeSettings, logBadgeDrop, setBadgeArt, setBadgesEnabled } from "@/lib/badges.functions";

/** The badge reference PDF for Branding, Marketing & Social Media and Support, built from the live badge list. */
function ReferenceDownload({ art }: { art: Record<string, string> }) {
  const [busy, setBusy] = useState(false);
  async function download() {
    setBusy(true);
    try { await (await import("@/lib/badge-reference-pdf")).downloadBadgeReferencePdf(art); }
    catch { toast.error("Couldn't build the badge reference. Try again."); }
    finally { setBusy(false); }
  }
  return (
    <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-card p-5">
      <div className="min-w-0">
        <h3 className="text-lg font-bold">Badge Reference</h3>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Every badge with its art, milestone and pop-up message, in the order users earn them. Built from the live badge list, so it always matches the app.</p>
      </div>
      <Button onClick={() => void download()} disabled={busy}><FileDown />{busy ? "Building…" : "Download PDF"}</Button>
    </section>
  );
}

const DROP_MONTHS = 6;
const fmt = (d: Date) => d.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });

/**
 * Branding's reminder: every six months, release a new badge for each collection (a holiday badge, a promotion…).
 * Logging the drop restarts the clock.
 */
function DropReminder({ last }: { last: { note: string; created_at: string } | null }) {
  const log = useServerFn(logBadgeDrop);
  const qc = useQueryClient();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const due = last ? new Date(new Date(last.created_at).setMonth(new Date(last.created_at).getMonth() + DROP_MONTHS)) : new Date();
  const overdue = due.getTime() <= Date.now();

  async function save() {
    setBusy(true);
    try {
      await log({ data: { note } });
      setNote("");
      toast.success("Badge drop logged. Next reminder in six months.");
      await qc.invalidateQueries({ queryKey: ["badge-settings"] });
    } catch { toast.error("Couldn't save the badge drop."); }
    finally { setBusy(false); }
  }

  return (
    <section className={`rounded-2xl border p-5 ${overdue ? "border-primary bg-primary/5" : "border-border bg-card"}`}>
      <h3 className="text-lg font-bold">{overdue ? "Time for a new badge drop" : `Next badge drop due ${fmt(due)}`}</h3>
      <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
        Every {DROP_MONTHS} months, create a new badge for each collection: a holiday badge, a promotion or a new milestone.
        {last ? ` Last drop ${fmt(new Date(last.created_at))}: ${last.note}` : " No drop logged yet."}
      </p>
      <form className="mt-4 flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); if (note.trim()) void save(); }}>
        <label htmlFor="badge-drop-note" className="sr-only">What was released</label>
        <Input id="badge-drop-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="What was released, e.g. Holiday 2026 badges" className="min-w-0 flex-1" />
        <Button type="submit" disabled={busy || !note.trim()}>Log badge drop</Button>
      </form>
    </section>
  );
}

/** One badge, full size, so the art can be judged before it is approved or replaced (founder, 2026-11-06). */
export type BadgePeek = { badge: BadgeDef; src?: string | undefined };

function PeekDialog({ peek, onClose }: { peek: BadgePeek | null; onClose: () => void }) {
  const collection = peek ? COLLECTIONS.find((c) => c.id === peek.badge.collection)?.title : undefined;
  return (
    <Dialog open={!!peek} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{peek?.badge.title}</DialogTitle>
          <DialogDescription>
            {collection ? `${collection} · ` : ""}{peek?.badge.milestone}
          </DialogDescription>
        </DialogHeader>
        {peek && (
          <figure className="space-y-2">
            <div className="flex items-center justify-center rounded-xl border border-border bg-[radial-gradient(circle_at_50%_40%,#141a2b_0%,#0b0b0b_100%)] p-6">
              <img src={artUrl(peek.src ?? peek.badge.src)} alt={peek.badge.title} className="h-72 w-72 object-contain drop-shadow-xl" />
            </div>
            <figcaption className="space-y-1 text-xs text-muted-foreground">
              <p>Art key: <code className="break-all">{peek.src ?? peek.badge.src}</code></p>
              {peek.badge.every ? <p>Repeatable: first at {peek.badge.goal}, then every {peek.badge.every}.</p> : null}
              {peek.badge.artPending ? <p className="text-destructive">Art still to come: this badge cannot be earned yet.</p> : null}
            </figcaption>
          </figure>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** The badge picture, which is always the button that opens it full size. */
function Thumb({ badge, src, onPeek, size = "h-12 w-12" }: { badge: BadgeDef; src?: string | undefined; onPeek: (p: BadgePeek) => void; size?: string }) {
  if (badge.artPending) return <span className={`${size} shrink-0 rounded-lg bg-muted`} aria-hidden />;
  return (
    <button type="button" onClick={() => onPeek({ badge, src })} title={`See ${badge.title} full size`}
      className={`${size} shrink-0 cursor-zoom-in rounded-lg transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`}>
      <img src={artUrl(src ?? badge.src)} alt={badge.title} loading="lazy" className="h-full w-full object-contain" />
    </button>
  );
}

/**
 * Founder-only art replacement (founder, 2026-11-06): the file is uploaded to the R2 bucket by hand at the key typed
 * here, and the app then requests that key everywhere the badge is drawn. Only `public.is_founder` can save one, which
 * the server checks — the panel is shown to every badge manager so they can see what the current art is.
 */
function ArtReplace({ badge, current }: { badge: BadgeDef; current?: string | undefined }) {
  const save = useServerFn(setBadgeArt);
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [src, setSrc] = useState(current ?? badge.src);
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    try {
      await save({ data: { badgeId: badge.id, src: src.trim() } });
      toast.success(`${badge.title} art replaced.`);
      setOpen(false);
      await qc.invalidateQueries({ queryKey: ["badge-settings"] });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Couldn't save the art."); }
    finally { setBusy(false); }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button type="button" size="sm" variant="ghost" aria-expanded={open} title="Replace this badge's art" onClick={() => setOpen((v) => !v)}><ImageIcon className="h-4 w-4" />Art</Button>
      {open && (
        <form className="w-56 space-y-1" onSubmit={(e) => { e.preventDefault(); void run(); }}>
          <label htmlFor={`art-${badge.id}`} className="block text-[11px] font-semibold">Art path for {badge.title}</label>
          <Input id={`art-${badge.id}`} value={src} onChange={(e) => setSrc(e.target.value)} maxLength={200} placeholder="/icons/serious/name.webp" className="h-8" />
          <p className="text-[11px] text-muted-foreground">Upload the 512px WebP to the bucket at this key first. Only the founder can save it.</p>
          <Button type="submit" size="sm" disabled={busy || !src.trim()}>{busy ? "Saving…" : "Save art"}</Button>
        </form>
      )}
    </div>
  );
}

/**
 * Repeatable badges in one place (founder, 2026-11-06): what comes back, how often, and the art each one shows. The
 * count is how many members hold it, never who.
 */
function Repeatable({ art, earned, onPeek }: { art: Record<string, string>; earned: Record<string, number>; onPeek: (p: BadgePeek) => void }) {
  const list = ALL_BADGES.filter((b) => b.every);
  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <h3 className="text-lg font-bold">Repeatable badges <span className="text-sm font-normal text-muted-foreground">· {list.length}</span></h3>
      <p className="mt-1 max-w-3xl text-sm text-muted-foreground">These are earned again as the work adds up, and the member's profile shows the count (×3). Their art can be swapped from this list without a deploy.</p>
      <ul className="mt-4 grid gap-2 md:grid-cols-2">
        {list.map((b) => {
          const unit = METRIC_UNIT[b.metric] ?? ["", ""];
          const many = (n: number) => (n === 1 ? unit[0] : unit[1]);
          return (
            <li key={b.id} className="flex flex-wrap items-start gap-3 rounded-xl border border-border p-2">
              <Thumb badge={b} src={art[b.id]} onPeek={onPeek} />
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold">{b.title}</div>
                <div className="text-xs text-muted-foreground">First at {b.goal} {many(b.goal)}, then every {b.every} {many(b.every!)} after that</div>
                <div className="text-xs text-muted-foreground">Earned by {earned[b.id] ?? 0} {(earned[b.id] ?? 0) === 1 ? "user" : "users"}</div>
              </div>
              <ArtReplace badge={b} current={art[b.id]} />
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/**
 * Super admins, Branding, Marketing & Sales and Support see every badge, how many users hold it, and turn badges on or off for new unlocks, one at a time or a whole collection. Switching one off never
 * takes it from anyone who already earned it. Badges still waiting on art are listed but can't be switched yet, and
 * every picture opens full size for review (founder, 2026-11-06).
 */
export function BadgeSwitchboard() {
  const fetchSettings = useServerFn(listBadgeSettings);
  const save = useServerFn(setBadgesEnabled);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["badge-settings"], queryFn: () => fetchSettings() });
  const [busy, setBusy] = useState(false);
  const [peek, setPeek] = useState<BadgePeek | null>(null);

  if (q.isLoading) return <p className="mt-6 text-muted-foreground">Loading…</p>;
  if (q.isError) return <p className="mt-6 text-destructive">Couldn't load badge settings.</p>;
  const off = new Set((q.data?.settings ?? []).filter((s) => !s.enabled).map((s) => s.badge_id));
  const earned = q.data?.earned ?? {};
  const art = q.data?.art ?? {};

  async function toggle(ids: string[], enabled: boolean) {
    setBusy(true);
    try {
      await save({ data: { ids, enabled } });
      await qc.invalidateQueries({ queryKey: ["badge-settings"] });
    } catch { toast.error("Couldn't save the badge setting."); }
    finally { setBusy(false); }
  }

  return (
    <div className="mt-6 space-y-6">
      <ReferenceDownload art={art} />
      <DropReminder last={q.data?.lastDrop ?? null} />
      <Repeatable art={art} earned={earned} onPeek={setPeek} />
      <p className="max-w-3xl text-sm text-muted-foreground">Turning a badge off stops new unlocks only. Anyone who already earned it keeps it on their shelf. Click any badge to see it full size.</p>
      {COLLECTIONS.map((c) => {
        const list = ALL_BADGES.filter((b) => b.collection === c.id);
        const live = list.filter((b) => !b.artPending);
        const allOn = live.every((b) => !off.has(b.id));
        return (
          <section key={c.id} className="rounded-2xl border border-border bg-card p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-lg font-bold">{c.title} <span className="text-sm font-normal text-muted-foreground">· {live.filter((b) => !off.has(b.id)).length} of {list.length} on</span></h3>
              {live.length > 0 && <label className="flex items-center gap-2 text-sm font-semibold">Whole collection
                <Switch checked={allOn} disabled={busy} onCheckedChange={(v) => void toggle(live.map((b) => b.id), v)} /></label>}
            </div>
            <ul className="grid gap-2 md:grid-cols-2">
              {list.map((b) => <li key={b.id} className="flex items-start gap-3 rounded-xl border border-border p-2">
                <Thumb badge={b} src={art[b.id]} onPeek={setPeek} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 font-semibold">{b.title}{TIER_LABEL[b.tier] && <Badge variant="secondary">{TIER_LABEL[b.tier]}</Badge>}</div>
                  <div className="truncate text-xs text-muted-foreground">{b.milestone}</div>
                  {!b.artPending && <div className="text-xs text-muted-foreground">Earned by {earned[b.id] ?? 0} {(earned[b.id] ?? 0) === 1 ? "user" : "users"}</div>}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <ArtReplace badge={b} current={art[b.id]} />
                  {b.artPending ? <Badge variant="outline">Art coming</Badge>
                    : <Switch aria-label={`${b.title} on`} checked={!off.has(b.id)} disabled={busy} onCheckedChange={(v) => void toggle([b.id], v)} />}
                </div>
              </li>)}
            </ul>
          </section>
        );
      })}
      <PeekDialog peek={peek} onClose={() => setPeek(null)} />
    </div>
  );
}
