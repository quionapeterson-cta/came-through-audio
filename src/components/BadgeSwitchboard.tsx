import { useState } from "react";
import { FileDown } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { ALL_BADGES, COLLECTIONS, TIER_LABEL } from "@/lib/badges";
import { listBadgeSettings, logBadgeDrop, setBadgesEnabled } from "@/lib/badges.functions";

/** The badge reference PDF for Branding, Marketing & Social Media and Support, built from the live badge list. */
function ReferenceDownload() {
  const [busy, setBusy] = useState(false);
  async function download() {
    setBusy(true);
    try { await (await import("@/lib/badge-reference-pdf")).downloadBadgeReferencePdf(); }
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

/**
 * Super admins, Branding, Marketing & Sales and Support see every badge, how many users hold it, and turn badges on or off for new unlocks, one at a time or a whole collection. Switching one off never
 * takes it from anyone who already earned it. Badges still waiting on art are listed but can't be switched yet.
 */
export function BadgeSwitchboard() {
  const fetchSettings = useServerFn(listBadgeSettings);
  const save = useServerFn(setBadgesEnabled);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["badge-settings"], queryFn: () => fetchSettings() });
  const [busy, setBusy] = useState(false);

  if (q.isLoading) return <p className="mt-6 text-muted-foreground">Loading…</p>;
  if (q.isError) return <p className="mt-6 text-destructive">Couldn't load badge settings.</p>;
  const off = new Set((q.data?.settings ?? []).filter((s) => !s.enabled).map((s) => s.badge_id));
  const earned = q.data?.earned ?? {};

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
      <ReferenceDownload />
      <DropReminder last={q.data?.lastDrop ?? null} />
      <p className="max-w-3xl text-sm text-muted-foreground">Turning a badge off stops new unlocks only. Anyone who already earned it keeps it on their shelf.</p>
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
              {list.map((b) => <li key={b.id} className="flex items-center gap-3 rounded-xl border border-border p-2">
                {b.artPending ? <span className="h-12 w-12 shrink-0 rounded-lg bg-muted" /> : <img src={b.src} alt="" loading="lazy" className="h-12 w-12 shrink-0 object-contain" />}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 font-semibold">{b.title}{TIER_LABEL[b.tier] && <Badge variant="secondary">{TIER_LABEL[b.tier]}</Badge>}</div>
                  <div className="truncate text-xs text-muted-foreground">{b.milestone}</div>
                  {!b.artPending && <div className="text-xs text-muted-foreground">Earned by {earned[b.id] ?? 0} {(earned[b.id] ?? 0) === 1 ? "user" : "users"}</div>}
                </div>
                {b.artPending ? <Badge variant="outline">Art coming</Badge>
                  : <Switch aria-label={`${b.title} on`} checked={!off.has(b.id)} disabled={busy} onCheckedChange={(v) => void toggle([b.id], v)} />}
              </li>)}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
