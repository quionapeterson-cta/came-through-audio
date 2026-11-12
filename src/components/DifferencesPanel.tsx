import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, FileSearch, Loader2, RefreshCw, Stethoscope } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DifferencesChart } from "@/components/DifferencesChart";
import { saveTrack, type CatalogTrack } from "@/lib/catalog";
import type { SavedListSummary } from "@/lib/agency-lists";
import {
  buildDifferenceRows, openDifferenceCount, readStoredLists, societyName,
  type DifferenceRow, type StoredLists,
} from "@/lib/discrepancy-treatments";

/**
 * The "Music Royalty Doctors" Differences panel (founder, 2026-11-13).
 *
 * It is the one place a member triages what the agencies have on file against their own catalog. The comparisons come from
 * the agency intake that already saved them on this device for twelve hours (`readIntake`), so this panel reads — it never
 * writes a comparison of its own — and the only thing it saves is the fix the member confirms, through `saveTrack`.
 *
 * No new table, no new store: the catalog is the record, and the handoff from Intake is a link with the society in it.
 */

const EKG = "M0,12 L18,12 L24,4 L30,20 L36,12 L60,12";

const FILTERS = [
  { id: "all", label: "All differences" },
  { id: "catalog", label: "Catalog vs. Agency" },
  { id: "agencies", label: "Agency vs. Agency" },
] as const;

type Side = (typeof FILTERS)[number]["id"];

export function DifferencesPanel({ userId, tracks, societies, summaries, defaultSociety, onSaved, className = "" }: {
  userId?: string | undefined;
  tracks: CatalogTrack[];
  societies: { id: string; name: string; url?: string }[];
  /** The account's saved counts: they survive a device change, and tell an empty cache apart from no differences. */
  summaries?: Record<string, SavedListSummary | undefined> | undefined;
  defaultSociety?: string | undefined;
  onSaved?: (() => void) | undefined;
  className?: string | undefined;
}) {
  const [stored, setStored] = useState<StoredLists | undefined>(() => readStoredLists(userId));
  const [side, setSide] = useState<Side>("all");
  const [society, setSociety] = useState<string>(defaultSociety ?? "");
  const [open, setOpen] = useState(true);
  const [busyKey, setBusyKey] = useState<string>();
  const [treated, setTreated] = useState<Set<string>>(() => new Set());
  const [pick, setPick] = useState<{ row: DifferenceRow; current: string }>();

  // The stored comparison is re-read when the account changes, and again when the intake writes a new one in this sitting.
  useEffect(() => { setStored(readStoredLists(userId)); }, [userId, tracks.length]);
  useEffect(() => { if (defaultSociety) setSociety(defaultSociety); }, [defaultSociety]);

  // Arriving from Intake: the panel opens, the society is preselected and the panel announces itself.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const p = new URLSearchParams(window.location.search);
    const wanted = p.get("society");
    if (wanted) setSociety(wanted);
    if (window.location.hash === "#differences-panel" || p.get("panel") === "differences") {
      setOpen(true);
      setTimeout(() => document.getElementById("differences-panel")?.scrollIntoView({ behavior: "smooth", block: "start" }), 120);
    }
  }, []);

  const rows = useMemo(() => buildDifferenceRows({ stored, tracks, societies }), [stored, tracks, societies]);
  const shown = useMemo(() => rows
    .map((r) => treated.has(r.key) ? { ...r, status: "both-registered" as const } : r)
    .filter((r) => side === "all" || r.side === side)
    .filter((r) => !society || r.claims.some((c) => c.society === society)),
  [rows, side, society, treated]);

  const counts = useMemo(() => {
    const open = openDifferenceCount(rows);
    const agencies = rows.filter((r) => r.side === "agencies").length;
    const waiting = rows.filter((r) => r.status === "waiting").length;
    const bySociety = new Map<string, number>();
    for (const r of rows) for (const c of r.claims) bySociety.set(c.society, (bySociety.get(c.society) ?? 0) + 1);
    return { open, agencies, waiting, catalog: rows.length - agencies, bySociety };
  }, [rows]);

  const savedDiffCount = Object.values(summaries ?? {}).reduce((n, s) => n + (s?.differences ?? 0), 0);
  const expired = !stored && savedDiffCount > 0;
  const societyList = societies.length ? societies : [...new Set(rows.flatMap((r) => r.claims.map((c) => c.society)))].map((id) => ({ id, name: societyName(id) }));

  async function resolve(row: DifferenceRow, patch: Partial<CatalogTrack["metadata"]>, note: string) {
    const track = tracks.find((t) => t.id === row.songId);
    if (!userId || !track) return;
    setBusyKey(row.key);
    try {
      await saveTrack({ ...track.metadata, ...patch }, userId, track.id);
      setTreated((set) => new Set(set).add(row.key));
      toast.success(note);
      onSaved?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save that. Try again.");
    } finally {
      setBusyKey(undefined);
    }
  }

  function fixInCatalog(row: DifferenceRow) {
    const agency = row.claims[0]?.isrc ?? "";
    const p = new URLSearchParams({ tab: "catalog", songId: row.songId, focusField: "isrc", action: row.status === "needs-triage" ? (agency ? "adopt" : "review") : "review" });
    if (agency) p.set("agencyIsrc", agency);
    window.location.assign(`/workspace?${p.toString()}#song-${row.songId}`);
  }

  return (
    <section id="differences-panel" aria-labelledby="differences-title"
      className={`scroll-mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-sm dark:border-slate-800 dark:bg-[#111620] dark:text-slate-100 ${className}`}>
      <header className="border-b border-slate-200 dark:border-slate-800">
        <div className="flex flex-wrap items-start justify-between gap-3 px-4 py-3.5">
          <div className="flex min-w-0 items-start gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-teal-600/30 bg-teal-50 text-teal-700 dark:border-cyan-400/30 dark:bg-cyan-400/10 dark:text-cyan-300">
              <Stethoscope className="h-4.5 w-4.5" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-teal-700 dark:text-cyan-300">Music Royalty Doctors · Diagnostics</p>
              <h2 id="differences-title" className="text-lg font-extrabold leading-tight">Differences</h2>
              <p className="mt-0.5 max-w-[70ch] text-xs text-slate-500 dark:text-slate-400">
                Your catalog against each agency, and the agencies against each other. Every row says what disagrees and the exact treatment.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden items-center gap-2 sm:flex" aria-hidden>
              <svg viewBox="0 0 60 24" className="h-6 w-16 text-teal-600 dark:text-cyan-300">
                <path d={EKG} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="font-mono text-[10px] uppercase tracking-widest text-slate-400 dark:text-slate-500">12h device read</span>
            </div>
            <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-controls="differences-body"
              className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
              {open ? <ChevronDown className="h-3.5 w-3.5" aria-hidden /> : <ChevronRight className="h-3.5 w-3.5" aria-hidden />}
              {open ? "Hide" : "Open"}
            </button>
          </div>
        </div>
        {open && (
          <div className="grid grid-cols-2 gap-2 px-4 pb-3 sm:grid-cols-4">
            {[
              { label: "Needs triage", value: counts.open, tone: "text-amber-700 dark:text-amber-300" },
              { label: "Catalog vs. agency", value: counts.catalog, tone: "text-slate-900 dark:text-slate-100" },
              { label: "Agency vs. agency", value: counts.agencies, tone: "text-slate-900 dark:text-slate-100" },
              { label: "Waiting on release", value: counts.waiting, tone: "text-slate-500 dark:text-slate-400" },
            ].map((m) => (
              <div key={m.label} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-900/50">
                <div className={`font-mono text-xl font-bold tabular-nums leading-none ${m.tone}`}>{m.value}</div>
                <div className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{m.label}</div>
              </div>
            ))}
          </div>
        )}
      </header>

      {open && (
        <div id="differences-body">
          <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-200 px-4 py-2.5 dark:border-slate-800" role="group" aria-label="Difference filters">
            {FILTERS.map((f) => {
              const active = side === f.id;
              const n = f.id === "all" ? rows.length : f.id === "catalog" ? counts.catalog : counts.agencies;
              return (
                <button key={f.id} type="button" aria-pressed={active} onClick={() => setSide(f.id)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${active
                    ? "border-slate-900 bg-slate-900 text-white dark:border-cyan-400 dark:bg-cyan-400 dark:text-slate-900"
                    : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-transparent dark:text-slate-300 dark:hover:bg-slate-800"}`}>
                  {f.label}<span className="font-mono tabular-nums opacity-70">{n}</span>
                </button>
              );
            })}
            <span className="mx-1 hidden h-4 w-px bg-slate-200 dark:bg-slate-700 sm:block" aria-hidden />
            {society && (
              <button type="button" onClick={() => setSociety("")}
                className="inline-flex items-center gap-1 rounded-full border border-slate-300 px-2.5 py-1 text-[11px] font-semibold text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800">
                All societies ✕
              </button>
            )}
            {societyList.map((s) => {
              const active = society === s.id;
              return (
                <button key={s.id} type="button" aria-pressed={active} onClick={() => setSociety(active ? "" : s.id)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${active
                    ? "border-teal-600 bg-teal-50 text-teal-800 dark:border-cyan-400 dark:bg-cyan-400/15 dark:text-cyan-200"
                    : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-transparent dark:text-slate-300 dark:hover:bg-slate-800"}`}>
                  {s.name}<span className="font-mono tabular-nums opacity-70">{counts.bySociety.get(s.id) ?? 0}</span>
                </button>
              );
            })}
          </div>

          {expired ? (
            <div className="flex flex-col items-start gap-3 px-4 py-8">
              <span className="grid h-10 w-10 place-items-center rounded-xl border border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-400/40 dark:bg-amber-400/10 dark:text-amber-300">
                <FileSearch className="h-5 w-5" aria-hidden />
              </span>
              <p className="max-w-[70ch] text-sm text-slate-600 dark:text-slate-300">
                Detailed row comparisons expire after 12 hours per device. Re-upload your{society ? ` ${societyName(society, societyList)}` : ""} list in Intake to view exact field differences.
              </p>
              <Button size="sm" onClick={() => window.location.assign("/workspace?tab=health")}>
                <RefreshCw className="mr-1 h-3.5 w-3.5" aria-hidden />Re-run Intake Scan →
              </Button>
            </div>
          ) : shown.length === 0 ? (
            <div className="px-4 py-8 text-sm text-slate-500 dark:text-slate-400">
              {rows.length === 0
                ? "No differences yet. Upload an agency list in Intake and every row it disagrees on shows here."
                : "Nothing in this filter. Try all societies, or the other comparison."}
            </div>
          ) : (
            <div className="p-3 sm:p-4">
              <DifferencesChart rows={shown} busyKey={busyKey} onFixCatalog={fixInCatalog}
                onAdopt={(row) => {
                  const agency = row.claims[0]?.isrc ?? "";
                  if (agency) void resolve(row, { isrc: agency }, `Adopted ${agency}. The catalog now matches ${row.claims[0]!.name}.`);
                }}
                onKeepBoth={(row) => {
                  const agency = row.claims.map((c) => c.isrc).find((c) => c && c.toUpperCase() !== row.catalogIsrc.toUpperCase()) ?? "";
                  setPick({ row, current: row.catalogIsrc || agency });
                }} />
            </div>
          )}
          <p className="border-t border-slate-200 px-4 py-2 text-[11px] text-slate-500 dark:border-slate-800 dark:text-slate-400">
            A saved detail is kept as you enter it until a lookup confirms it. Both ISRCs stay on the work for record-keeping; only the current one is embedded.
          </p>
        </div>
      )}

      <Dialog open={!!pick} onOpenChange={(o) => { if (!o) setPick(undefined); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Keep both ISRCs — which one is current?</DialogTitle></DialogHeader>
          {pick && (() => {
            const codes = [...new Set([pick.row.catalogIsrc, ...pick.row.claims.map((c) => c.isrc), ...pick.row.retiredIscrs].filter(Boolean))];
            const other = codes.find((c) => c !== pick.current) ?? "";
            return (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Never guessed for you: choose the code your distributor delivered as the current one. The other is marked Retired and stays on the
                  work, because royalties filed under it can still surface.
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {codes.map((code) => {
                    const active = pick.current === code;
                    const claim = pick.row.claims.find((c) => c.isrc === code);
                    return (
                      <button key={code} type="button" aria-pressed={active} onClick={() => setPick({ ...pick, current: code })}
                        className={`rounded-xl border p-3 text-left transition ${active ? "border-primary bg-accent/40" : "border-border hover:bg-muted/40"}`}>
                        <span className="block text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                          {claim ? claim.name : pick.row.retiredIscrs.includes(code) ? "Retired today" : "Your catalog"}
                        </span>
                        <span className="mt-1 block font-mono text-sm font-semibold tabular-nums">{code}</span>
                        {pick.row.release.date && <span className="mt-1 block text-[11px] text-muted-foreground">Release {pick.row.release.date}</span>}
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-muted-foreground">Suggestion only, from the release date and the code's year digits. You decide.</p>
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" onClick={() => setPick(undefined)}>Cancel</Button>
                  <Button disabled={!pick.current || busyKey === pick.row.key}
                    onClick={() => {
                      const row = pick.row;
                      setPick(undefined);
                      void resolve(row, { isrc: pick.current, retiredIscrs: [...new Set([...row.retiredIscrs, other])].filter(Boolean) },
                        `Kept ${pick.current} as current and marked ${other} retired. Both stay on the work.`);
                    }}>
                    {busyKey === pick.row.key ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" aria-hidden /> : null}
                    Keep both &amp; retire {other || "the other"}
                  </Button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </section>
  );
}
