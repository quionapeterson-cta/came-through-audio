import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { ALL_BADGES, COLLECTIONS, TIER_LABEL } from "@/lib/badges";
import { listBadgeSettings, setBadgesEnabled } from "@/lib/badges.functions";

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
