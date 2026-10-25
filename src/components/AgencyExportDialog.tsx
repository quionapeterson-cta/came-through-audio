import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { InfoTip } from "@/components/InfoTip";
import { EXPORT_REQUIRED, MLC_EXPORT_NOTES } from "@/lib/glossary";
import { releaseKind } from "@/lib/health-checklist";
import { AGENCY_LABEL, exportGate, listExports, mlcPlaceholderSongs, type Agency } from "@/lib/agency-export";
import type { CatalogTrack } from "@/lib/catalog";

type Release = { key: string; title: string; tracks: CatalogTrack[] };
type Scope = "all" | "release" | "pick";
const AGENCIES: Agency[] = ["mlc", "soundexchange", "pro"];
const short = (a: Agency) => AGENCY_LABEL[a].split(" (")[0]!;

/**
 * My Catalog → Agency Export (PLAN-master-notes 1.1): pick the agency, then the whole catalog, one release or chosen
 * songs (optionally only those not exported to that agency yet), then check and download. Readiness comes from the
 * shared check via exportGate; `run` is My Catalog's own export, so held songs and split warnings show as usual.
 */
export function AgencyExportDialog({ open, onOpenChange, tracks, releases, run }: {
  open: boolean; onOpenChange: (o: boolean) => void; tracks: CatalogTrack[]; releases: Release[];
  run: (agency: Agency, list: CatalogTrack[], name: string) => void;
}) {
  const [agency, setAgency] = useState<Agency>("mlc");
  const [scope, setScope] = useState<Scope>("all");
  const [release, setRelease] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [onlyNew, setOnlyNew] = useState(false);
  const [exported, setExported] = useState<Map<string, string>>(new Map());

  useEffect(() => { if (open) void listExports().then(setExported).catch(() => setExported(new Map())); }, [open]);
  useEffect(() => { if (!release && releases[0]) setRelease(releases[0].key); }, [releases, release]);

  const isNew = (t: CatalogTrack) => !exported.has(`${t.id}:${agency}`);
  const chosen = useMemo(() => {
    const base = scope === "all" ? tracks : scope === "release" ? releases.find((r) => r.key === release)?.tracks ?? [] : tracks.filter((t) => picked.has(t.id));
    return onlyNew ? base.filter(isNew) : base;
  }, [scope, tracks, releases, release, picked, onlyNew, exported, agency]); // eslint-disable-line react-hooks/exhaustive-deps
  const { ready, held } = exportGate(agency, chosen);
  const placeholders = agency === "mlc" ? mlcPlaceholderSongs(ready) : [];
  const name = scope === "release" ? releases.find((r) => r.key === release)?.title ?? "Release" : scope === "all" ? "Full Catalog" : `${chosen.length} Songs`;
  const groups = (["Single", "EP", "Album"] as const).map((g) => [g, [...tracks].filter((t) => releaseKind(t.metadata) === g).sort((a, b) => a.title.localeCompare(b.title))] as const).filter(([, l]) => l.length);
  const toggle = (id: string) => setPicked((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto bg-card text-card-foreground sm:max-w-2xl">
        <DialogHeader><DialogTitle className="text-xl font-bold">Agency export</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">One file with every song filled into the agency's own template. Upload it once instead of typing each song.</p>

        <fieldset className="space-y-2">
          <legend className="text-sm font-bold uppercase tracking-widest text-primary">1 · Agency</legend>
          {AGENCIES.map((a) => (
            <label key={a} className="flex items-center gap-2 text-sm">
              <input type="radio" name="export-agency" className="accent-[var(--primary)]" checked={agency === a} onChange={() => setAgency(a)} />
              {AGENCY_LABEL[a]}<InfoTip title="Required fields" text={EXPORT_REQUIRED[a]} />
            </label>
          ))}
        </fieldset>

        <fieldset className="space-y-2">
          <legend className="text-sm font-bold uppercase tracking-widest text-primary">2 · Songs</legend>
          <label className="flex items-center gap-2 text-sm"><input type="radio" name="export-scope" className="accent-[var(--primary)]" checked={scope === "all"} onChange={() => setScope("all")} />Whole catalog · {tracks.length}</label>
          {releases.length > 0 && (
            <label className="flex flex-wrap items-center gap-2 text-sm">
              <input type="radio" name="export-scope" className="accent-[var(--primary)]" checked={scope === "release"} onChange={() => setScope("release")} />An EP or album
              <select aria-label="Release" value={release} onChange={(e) => { setRelease(e.target.value); setScope("release"); }} className="h-8 rounded-md border border-input bg-background px-2 text-sm">
                {releases.map((r) => <option key={r.key} value={r.key}>{r.title} · {r.tracks.length}</option>)}
              </select>
            </label>
          )}
          <label className="flex items-center gap-2 text-sm"><input type="radio" name="export-scope" className="accent-[var(--primary)]" checked={scope === "pick"} onChange={() => setScope("pick")} />Pick songs</label>
          {scope === "pick" && (
            <div className="max-h-56 space-y-3 overflow-y-auto rounded-lg border border-border p-3">
              {groups.map(([g, list]) => (
                <div key={g}>
                  <div className="mb-1 text-xs font-bold uppercase tracking-widest text-muted-foreground">{g}s · {list.length}</div>
                  {list.map((t) => (
                    <label key={t.id} className="flex items-center gap-2 py-0.5 text-sm">
                      <input type="checkbox" className="accent-[var(--primary)]" checked={picked.has(t.id)} onChange={() => toggle(t.id)} />
                      <span className="truncate">{t.title || "Untitled"}</span>
                      {g !== "Single" && <span className="truncate text-muted-foreground">{t.metadata.album}</span>}
                      {!isNew(t) && <span className="ml-auto shrink-0 text-xs text-muted-foreground">exported</span>}
                    </label>
                  ))}
                </div>
              ))}
            </div>
          )}
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-[var(--primary)]" checked={onlyNew} onChange={(e) => setOnlyNew(e.target.checked)} />Only songs not exported to {short(agency)} yet</label>
        </fieldset>

        <section className="space-y-2 rounded-xl bg-muted p-4 text-sm">
          <div className="text-sm font-bold uppercase tracking-widest text-primary">3 · Check and download</div>
          <p><b>{ready.length}</b> {ready.length === 1 ? "song is" : "songs are"} ready{held.length ? <> · ⚠️ <b>{held.length}</b> {held.length === 1 ? "needs" : "need"} writer info first (you'll see what to fix after the download)</> : null}.</p>
          {agency === "mlc" && <>
            {placeholders.length > 0 && <p>⚠️ {MLC_EXPORT_NOTES.placeholder} <span className="text-muted-foreground">({placeholders.join(", ")})</span></p>}
            <p>{MLC_EXPORT_NOTES.recording}</p>
          </>}
        </section>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="button" disabled={!chosen.length} onClick={() => { run(agency, chosen, name); onOpenChange(false); }}>Download {short(agency)} file</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
