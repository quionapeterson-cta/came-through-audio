import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, FileSearch, Loader2, RefreshCw, Stethoscope } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DifferencesChart } from "@/components/DifferencesChart";
import { saveTrack, type CatalogTrack } from "@/lib/catalog";
import { updateTarget } from "@/lib/ids";
import type { SavedListSummary } from "@/lib/agency-lists";
import { catalogHref } from "@/lib/catalog-links";
import {
  actionFor, buildDifferenceRows, fieldFor, openDifferenceCount, readStoredLists, rereadStored, societyName,
  type DifferenceRow, type StoredLists,
} from "@/lib/discrepancy-treatments";

/**
 * The "Music Royalty Doctors" Differences panel (founder, 2026-11-13).
 *
 * It is the one place a member reviews what the agencies have on file against their own catalog. The comparisons come from
 * the agency intake that already saved them on this device for twelve hours (`readIntake`), so this panel reads — it never
 * writes a comparison of its own — and the only thing it saves is the fix the member confirms, through `saveTrack`.
 *
 * No new table, no new store: the catalog is the record, and the handoff from Intake is a link with the society in it.
 * The palette is the brand's own: cobalt on white in light mode, electric cobalt on obsidian in dark mode, nothing gold.
 */

const EKG = "M0,12 L18,12 L24,4 L30,20 L36,12 L60,12";

const FILTERS = [
  { id: "all", label: "All differences" },
  { id: "catalog", label: "Catalog vs. Agency" },
  { id: "agencies", label: "Agency vs. Agency" },
] as const;

type Side = (typeof FILTERS)[number]["id"];

const PILL = "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition";
const PILL_OFF = `${PILL} border-[#E5E4E2] bg-transparent text-[#0b0b0b]/65 hover:border-[#4D8CFF]/60 hover:text-[#004AAD] dark:border-[#E5E4E2]/15 dark:text-[#E5E4E2]/65 dark:hover:border-[#4D8CFF]/70 dark:hover:text-[#4D8CFF]`;
const PILL_ON = `${PILL} border-transparent bg-[#004AAD] text-[#FFFFFF] shadow-[0_0_15px_rgba(0,74,173,0.3)] dark:bg-[#4D8CFF] dark:text-[#0b0b0b] dark:font-semibold dark:shadow-[0_0_18px_rgba(77,140,255,0.45)]`;

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
  // Closed on arrival (founder, 2026-11-14): the panel is a detail view, and it only opens by itself when a link
  // from Intake asks for it. The header keeps the count of what is waiting behind one click.
  const [open, setOpen] = useState(false);
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

  // A comparison saved before versions and artists were read is compared again, from the works it kept, rather than shown
  // with a verdict from an older reader (founder, 2026-11-14).
  const reread = useMemo(() => rereadStored(stored, tracks, societies), [stored, tracks, societies]);
  const refreshed = reread !== stored;
  const rows = useMemo(() => buildDifferenceRows({ stored: reread, tracks, societies }), [reread, tracks, societies]);
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
      // Only a song My Catalog holds is written by its id; anything else is created, never sent to Postgres as an id.
      await saveTrack({ ...track.metadata, ...patch }, userId, updateTarget(track.id));
      setTreated((set) => new Set(set).add(row.key));
      toast.success(note);
      onSaved?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save that. Try again.");
    } finally {
      setBusyKey(undefined);
    }
  }

  /** Opens the song in My Catalog at the field the treatment is about, with the agency's code to hand. */
  /**
   * A fix opens My Catalog on that song at the exact field that disagrees — version, title, retired code, release — with the
   * agency's own value to hand (founder, 2026-11-14). Which field and which action come from one rule in the treatment
   * module, so no card can point at the wrong box.
   */
  function fixInCatalog(row: DifferenceRow, field: string = fieldFor(row)) {
    const agency = row.claims.find((c) => c.isrc)?.isrc ?? "";
    const version = row.agencyCodes.find((c) => c.version)?.version ?? row.versions.agency;
    const versions = [...new Set([...row.claims.map((c) => c.version ?? ""), ...row.agencyCodes.map((c) => c.version)].map((v) => v.trim()).filter(Boolean))];
    window.location.assign(catalogHref({
      trackId: row.songId, field, action: actionFor(row),
      ...(agency ? { agencyIsrc: agency } : {}), ...(version ? { agencyVersion: version } : {}),
      ...(versions.length ? { agencyVersions: versions } : {}),
    }));
  }

  return (
    <section id="differences-panel" aria-labelledby="differences-title"
      className={`scroll-mt-6 overflow-hidden rounded-2xl border bg-[#FFFFFF] text-[#0b0b0b] border-[#E5E4E2] dark:border-[#E5E4E2]/15 dark:bg-[#0b0b0b] dark:text-[#FFFFFF] ${className}`}>
      <header className="border-b border-[#E5E4E2] dark:border-[#E5E4E2]/15">
        <div className="flex flex-wrap items-start justify-between gap-3 px-4 py-3.5">
          <div className="flex min-w-0 items-start gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-[#4D8CFF]/40 bg-[#004AAD]/10 text-[#004AAD] shadow-[0_0_12px_rgba(77,140,255,0.2)] dark:border-[#4D8CFF]/45 dark:bg-[#4D8CFF]/20 dark:text-[#4D8CFF] dark:shadow-[0_0_14px_rgba(77,140,255,0.25)]">
              <Stethoscope className="h-4.5 w-4.5" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#004AAD] dark:text-[#4D8CFF]">Music Royalty Doctors · Diagnostics</p>
              <h2 id="differences-title" className="text-lg font-extrabold leading-tight">Differences</h2>
              <p className="mt-0.5 max-w-[70ch] text-xs text-[#0b0b0b]/65 dark:text-[#E5E4E2]/65">
                Your catalog against each agency, and the agencies against each other. Every card names what disagrees and the exact treatment.
              </p>
              {refreshed && (
                <p className="mt-1 text-xs text-[#0b0b0b]/60 dark:text-[#E5E4E2]/60">
                  Read again just now: this comparison was saved before versions and artists were compared. Upload the list again to keep the newer reading.
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!open && counts.open > 0 && (
              <span className="rounded-full border border-[#004AAD]/30 bg-[#004AAD]/10 px-2 py-0.5 font-mono text-[11px] font-bold tabular-nums text-[#004AAD] dark:border-[#4D8CFF]/40 dark:bg-[#4D8CFF]/15 dark:text-[#4D8CFF]">
                {counts.open} to review
              </span>
            )}
            <div className="hidden items-center gap-2 sm:flex" aria-hidden>
              <svg viewBox="0 0 60 24" className="h-6 w-16 text-[#004AAD] dark:text-[#4D8CFF]">
                <path d={EKG} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="font-mono text-[10px] uppercase tracking-widest text-[#0b0b0b]/45 dark:text-[#E5E4E2]/45">12h device read</span>
            </div>
            <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-controls="differences-body"
              className="inline-flex items-center gap-1 rounded-md border border-[#E5E4E2] px-2 py-1 text-xs font-semibold text-[#0b0b0b]/65 transition hover:border-[#4D8CFF]/60 hover:text-[#004AAD] dark:border-[#E5E4E2]/15 dark:text-[#E5E4E2]/65 dark:hover:border-[#4D8CFF]/70 dark:hover:text-[#4D8CFF]">
              {open ? <ChevronDown className="h-3.5 w-3.5" aria-hidden /> : <ChevronRight className="h-3.5 w-3.5" aria-hidden />}
              {open ? "Hide" : "Open"}
            </button>
          </div>
        </div>
        {open && (
          <div className="grid grid-cols-2 gap-2 px-4 pb-3 sm:grid-cols-4">
            {[
              { label: "Needs review", value: counts.open },
              { label: "Catalog vs. agency", value: counts.catalog },
              { label: "Agency vs. agency", value: counts.agencies },
              { label: "Waiting on release", value: counts.waiting },
            ].map((m) => (
              <div key={m.label} className="rounded-lg border border-[#E5E4E2] bg-[#E5E4E2]/20 px-3 py-2 dark:border-[#E5E4E2]/15 dark:bg-[#141414]">
                <div className="font-mono text-xl font-bold tabular-nums leading-none text-[#0b0b0b] dark:text-[#FFFFFF]">{m.value}</div>
                <div className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-[#0b0b0b]/60 dark:text-[#E5E4E2]/60">{m.label}</div>
              </div>
            ))}
          </div>
        )}
      </header>

      {open && (
        <div id="differences-body">
          <div className="flex flex-wrap items-center gap-1.5 border-b border-[#E5E4E2] px-4 py-2.5 dark:border-[#E5E4E2]/15" role="group" aria-label="Difference filters">
            {FILTERS.map((f) => {
              const active = side === f.id;
              const n = f.id === "all" ? rows.length : f.id === "catalog" ? counts.catalog : counts.agencies;
              return (
                <button key={f.id} type="button" aria-pressed={active} onClick={() => setSide(f.id)} className={active ? PILL_ON : PILL_OFF}>
                  {f.label}<span className="font-mono tabular-nums opacity-70">{n}</span>
                </button>
              );
            })}
            <span className="mx-1 hidden h-4 w-px bg-[#E5E4E2] dark:bg-[#E5E4E2]/15 sm:block" aria-hidden />
            {society && (
              <button type="button" onClick={() => setSociety("")} className={PILL_OFF}>All societies ✕</button>
            )}
            {societyList.map((s) => {
              const active = society === s.id;
              return (
                <button key={s.id} type="button" aria-pressed={active} onClick={() => setSociety(active ? "" : s.id)} className={active ? PILL_ON : PILL_OFF}>
                  {s.name}<span className="font-mono tabular-nums opacity-70">{counts.bySociety.get(s.id) ?? 0}</span>
                </button>
              );
            })}
          </div>

          {expired ? (
            <div className="flex flex-col items-start gap-3 px-4 py-8">
              <span className="grid h-10 w-10 place-items-center rounded-xl border border-[#4D8CFF]/40 bg-[#004AAD]/10 text-[#004AAD] dark:border-[#4D8CFF]/45 dark:bg-[#4D8CFF]/20 dark:text-[#4D8CFF]">
                <FileSearch className="h-5 w-5" aria-hidden />
              </span>
              <p className="max-w-[70ch] text-sm text-[#0b0b0b]/70 dark:text-[#E5E4E2]/70">
                Detailed row comparisons expire after 12 hours per device. Re-upload your{society ? ` ${societyName(society, societyList)}` : ""} list in Intake to view exact field differences.
              </p>
              <Button size="sm" onClick={() => window.location.assign("/workspace?tab=health")}
                className="bg-[#004AAD] text-[#FFFFFF] shadow-[0_0_14px_rgba(0,74,173,0.25)] hover:bg-[#4D8CFF] hover:shadow-[0_0_20px_rgba(77,140,255,0.55)] dark:bg-[#4D8CFF] dark:text-[#0b0b0b] dark:font-semibold dark:shadow-[0_0_18px_rgba(77,140,255,0.45)]">
                <RefreshCw className="mr-1 h-3.5 w-3.5" aria-hidden />Re-run Intake Scan →
              </Button>
            </div>
          ) : shown.length === 0 ? (
            <div className="px-4 py-8 text-sm text-[#0b0b0b]/65 dark:text-[#E5E4E2]/65">
              {rows.length === 0
                ? "No differences yet. Upload an agency list in Intake and every row it disagrees on shows here."
                : "Nothing in this filter. Try all societies, or the other comparison."}
            </div>
          ) : (
            <div className="p-3 sm:p-4">
              <DifferencesChart rows={shown} busyKey={busyKey} onFixCatalog={fixInCatalog}
                onAdopt={(row) => {
                  const agency = row.claims.find((c) => c.isrc)?.isrc ?? "";
                  if (agency) void resolve(row, { isrc: agency }, `Adopted ${agency}. The catalog now matches ${row.claims[0]!.name}.`);
                }}
                onSaveAlternate={(row) => {
                  const track = tracks.find((t) => t.id === row.songId);
                  const name = (row.alternateTitle ?? row.claims[0]?.title ?? "").trim();
                  if (!track || !name) return;
                  const saved = (track.metadata.alternateTitles ?? []).map((t) => t.trim()).filter(Boolean);
                  if (saved.some((t) => t.toLowerCase() === name.toLowerCase())) {
                    toast.success(`"${name}" is already an alternate title of this song.`);
                    return;
                  }
                  void resolve(row, { alternateTitles: [...saved, name] }, `Saved "${name}" as an alternate title of ${track.title}.`);
                }}
                onKeepBoth={(row) => {
                  const agency = row.claims.map((c) => c.isrc).find((c) => c && c.toUpperCase() !== row.catalogIsrc.toUpperCase()) ?? "";
                  setPick({ row, current: row.catalogIsrc || agency });
                }} />
            </div>
          )}
          <p className="border-t border-[#E5E4E2] px-4 py-2 text-[11px] text-[#0b0b0b]/55 dark:border-[#E5E4E2]/15 dark:text-[#E5E4E2]/55">
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
                        className={`rounded-xl border p-3 text-left transition ${active
                          ? "border-[#004AAD] bg-[#004AAD]/[0.06] shadow-[0_0_15px_rgba(0,74,173,0.2)] dark:border-[#4D8CFF] dark:bg-[#4D8CFF]/10 dark:shadow-[0_0_18px_rgba(77,140,255,0.3)]"
                          : "border-[#E5E4E2] hover:border-[#4D8CFF]/60 dark:border-[#E5E4E2]/15 dark:hover:border-[#4D8CFF]/70"}`}>
                        <span className="block text-[10px] font-bold uppercase tracking-wide text-[#0b0b0b]/55 dark:text-[#E5E4E2]/55">
                          {claim ? claim.name : pick.row.retiredIscrs.includes(code) ? "Retired today" : "Your catalog"}
                        </span>
                        <span className="mt-1 block font-mono text-sm font-semibold tabular-nums text-[#0b0b0b] dark:text-[#FFFFFF]">{code}</span>
                        {pick.row.release.date && <span className="mt-1 block text-[11px] text-[#0b0b0b]/55 dark:text-[#E5E4E2]/55">Release {pick.row.release.date}</span>}
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-muted-foreground">Suggestion only, from the release date and the code's year digits. You decide.</p>
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" onClick={() => setPick(undefined)}>Cancel</Button>
                  <Button disabled={!pick.current || busyKey === pick.row.key}
                    className="bg-[#004AAD] text-[#FFFFFF] shadow-[0_0_14px_rgba(0,74,173,0.25)] hover:bg-[#4D8CFF] dark:bg-[#4D8CFF] dark:text-[#0b0b0b] dark:font-semibold dark:shadow-[0_0_18px_rgba(77,140,255,0.45)]"
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
