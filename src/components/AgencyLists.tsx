import { useEffect, useRef, useState } from "react";
import { Activity, ArrowRight, FileUp, LifeBuoy, ListPlus, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { confirmAction } from "@/components/ConfirmHost";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { fillPlan, listPeople, withPeople, type FillPlan, type Person, type PersonChoice } from "@/lib/agency-fill";
import { RELEASE_TYPES, WRITER_ROLES } from "@/lib/metadata";
import { loadOnboarding, loadProfile } from "@/lib/artist-profile";
import { saveTrack } from "@/lib/catalog";
import { clearIntake, readIntake, writeIntake } from "@/lib/intake-session";
import { buildDifferenceRows, openDifferenceCount, STORED_LISTS_KEY } from "@/lib/discrepancy-treatments";
import { DifferencesPanel } from "@/components/DifferencesPanel";
import { combinedHalves, compareList, downloadSteps, listGaps, listShareTotal, readTable, readWorks, type ListResult, type ListWork, type SavedListSummary } from "@/lib/agency-lists";
import type { CatalogTrack } from "@/lib/catalog";
import type { Society } from "@/lib/repertoires";

type Props = {
  /** The account this sitting belongs to, so the comparison survives a tab switch, a reload or a second window. */
  userId?: string | undefined;
  societies: Society[];
  /** The songs that should be on each society's list. */
  songsFor: (societyId: string) => CatalogTrack[];
  summaries: Record<string, SavedListSummary | undefined>;
  /** Every song in the account, so the Differences panel can compare agencies as well as the catalog. */
  allTracks?: CatalogTrack[] | undefined;
  onApply: (society: Society, result: ListResult, file: string) => Promise<void>;
  /** "Start this list over": removes what the uploaded list added, so the right file can be brought in. */
  onRemove?: ((society: Society) => Promise<void>) | undefined;
  /** Called after songs are added to the catalog, so the visit's own song list picks them up. */
  onFilled?: (() => void) | undefined;
  /** Adding songs needs a catalog (Catalog Plus); without it the fill button becomes the upgrade offer. */
  canCatalog?: boolean | undefined;
  /** The plans, opened from the offer shown when the member can't save songs to their catalog yet. */
  onUpgrade?: (() => void) | undefined;
  /** Expert registration help, offered when the member keeps a version the agency still has to match. */
  onExpert?: (() => void) | undefined;
};

/** One society's last comparison in this browser: what was shown, and which file it came from. */
type StoredLists = { byId: Record<string, { file: string; result: ListResult }>; shownId?: string | undefined };

/** The stored comparison, shared with the Differences panel so both read one key. */
const STORE = STORED_LISTS_KEY;

/** One work's own key: the same one the panel lists it under, so a pick survives a re-render. */
const workKey = (w: ListWork) => w.workId || w.iswc || w.isrc || w.title;

/** "Confirm with your agency lists": upload what each agency has on file, and see what matches. */
export function AgencyLists({ userId, societies, songsFor, summaries, allTracks, onApply, onRemove, onFilled, canCatalog = true, onUpgrade, onExpert }: Props) {
  const [busy, setBusy] = useState<string>();
  const [stored, setStored] = useState<StoredLists>({ byId: {} });
  const [shownId, setShownId] = useState<string>();
  const [restored, setRestored] = useState(false);
  // Filling the catalog from the list: the plan shown in the dialog, and the member's choice for each duplicate.
  const [fill, setFill] = useState<{ society: Society; plan: FillPlan }>();
  const [choices, setChoices] = useState<Record<string, "keep" | "agency">>({});
  const [filling, setFilling] = useState(false);
  /** The Differences panel opened in place, for a member who wants to fix a conflict without leaving Intake. */
  const [preview, setPreview] = useState(false);
  /** Which of the new works to add: every one is ticked until the member unticks it. */
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  /** Where the ticked new songs go: each its own single, or one EP/album they all belong to. */
  const [release, setRelease] = useState<{ one: boolean; type: string; title: string }>({ one: false, type: "", title: "" });
  /** Everyone the songs being added name as a writer, with the one answer the member gives per person. */
  const [people, setPeople] = useState<Person[]>([]);
  const [roles, setRoles] = useState<Record<string, string>>({});
  const [names, setNames] = useState<Record<string, string>>({});
  const inputs = useRef<Record<string, HTMLInputElement | null>>({});

  // Leaving the check-in (or opening the workspace in another window) used to empty this panel. The comparison is the
  // member's own reading of their file, so it stays with the account on this device.
  useEffect(() => {
    const saved = readIntake<StoredLists>(userId, STORE);
    if (saved?.byId) {
      setStored(saved);
      if (saved.shownId && saved.byId[saved.shownId]) setShownId(saved.shownId);
    }
    setRestored(true);
  }, [userId]);
  useEffect(() => {
    if (!restored || !userId) return;
    if (!Object.keys(stored.byId).length && !shownId) { clearIntake(userId, STORE); return; }
    writeIntake(userId, STORE, { byId: stored.byId, shownId });
  }, [restored, userId, stored, shownId]);

  async function upload(society: Society, file: File) {
    setBusy(society.id);
    try {
      const works = readWorks(await readTable(file));
      const result = compareList(works, songsFor(society.id), society.id === "soundexchange", society.name);
      await onApply(society, result, file.name);
      setStored((s) => ({ ...s, byId: { ...s.byId, [society.id]: { file: file.name, result } } }));
      setShownId(society.id);
      toast.success(`${society.name}: ${result.matched.length} matched, ${result.differences.length} different${result.clashes.length ? `, ${result.clashes.length} same title but different writers` : ""}, ${result.notListed.length} not on the list.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't read that file.");
    } finally {
      setBusy(undefined);
      const el = inputs.current[society.id];
      if (el) el.value = "";
    }
  }

  /** Start this society over: the comparison and the confirmations it made go, so the right file can replace it. */
  async function startOver(society: Society) {
    if (!(await confirmAction({
      title: `Start the ${society.name} list over?`,
      text: `The uploaded ${society.name} list's comparison and the confirmations it added are removed, for every song. Your catalog, your own marks and every other agency's list are unchanged. Upload the right file whenever you have it.`,
      action: "Start over",
    }))) return;
    setBusy(society.id);
    try {
      await onRemove?.(society);
      setStored((s) => {
        const byId = { ...s.byId };
        delete byId[society.id];
        return { ...s, byId };
      });
      setShownId((id) => (id === society.id ? undefined : id));
      toast.success(`${society.name}: list cleared. Upload the right file whenever you're ready.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't clear that list. Try again.");
    } finally {
      setBusy(undefined);
    }
  }

  /** "Fill my catalog": start an entry for every work on the list the catalog doesn't have yet. */
  function openFill(society: Society) {
    const result = stored.byId[society.id]?.result;
    if (!result || !userId) return;
    const artist = loadOnboarding(userId)?.stageName?.trim() || loadProfile(userId)?.artist?.trim() || "";
    setChoices({});
    const plan = fillPlan(result, songsFor(society.id), artist);
    setPicked(Object.fromEntries(plan.creates.map((c) => [workKey(c.work), true])));
    setRelease({ one: false, type: "", title: "" });
    setPeople(listPeople(plan.creates.map((c) => c.work)));
    setRoles({});
    setNames({});
    setFill({ society, plan });
  }
  /**
   * Adds the new works and, only for the duplicates the member picked, writes the agency's version over the catalog's.
   * Nothing else is touched: a song left on "keep mine" is not saved at all.
   */
  async function runFill() {
    if (!fill || !userId) return;
    setFilling(true);
    try {
      const adding = fill.plan.creates.filter((c) => picked[workKey(c.work)] !== false);
      // The release the member picked is written with each song, so My Catalog files them together straight away.
      const placing = release.one && !!release.type;
      // The answers given per person are written into every song that person is on; a person left unanswered stays blank.
      const chosen: Record<string, PersonChoice> = {};
      for (const p of people) {
        const role = (roles[p.key] ?? "").trim();
        const name = names[p.key]?.trim();
        if (role || name) chosen[p.key] = { ...(role ? { role } : {}), ...(name ? { name } : {}) };
      }
      for (const c of adding) {
        const withRoles = withPeople(c.metadata, people, chosen);
        const m = placing ? { ...withRoles, releaseType: release.type, album: release.title.trim() || withRoles.album } : withRoles;
        await saveTrack(m, userId);
      }
      let replaced = 0;
      for (const d of fill.plan.duplicates) if (choices[d.track.id] === "agency") { await saveTrack(d.agency, userId, d.track.id); replaced += 1; }
      const added = adding.length;
      const kept = fill.plan.duplicates.filter((d) => choices[d.track.id] !== "agency").length;
      toast.success(
        `${added ? `${added} song${added === 1 ? "" : "s"} added to My Catalog` : "No new songs added"}${replaced ? `, ${replaced} replaced with the agency's version` : ""}. ` +
        (kept ? `${kept} kept as yours, so ${fill.society.name} still needs updating to match. ` : "") +
        placing
          ? `File them under ${release.title.trim() || release.type}${release.title.trim() ? ` (${release.type})` : ""}; the list still leaves the release date, genre and duration for you in My Catalog.`
          : "Each new entry starts as a single. Change its release type in My Catalog if it belongs to an EP or album.",
        { duration: 12000 },
      );
      // The works just added are no longer "on the list but not in the catalog", so the offer can't run twice; a song
      // replaced with the agency's version is no longer different either, so the report stops naming it.
      const justAdded = new Set(adding.map((c) => c.work));
      const settled = new Set(fill.plan.duplicates.filter((d) => choices[d.track.id] === "agency").map((d) => d.track.id));
      setStored((state) => {
        const entry = state.byId[fill.society.id];
        if (!entry) return state;
        const result = entry.result;
        const fixed = result.differences.filter((m) => settled.has(m.trackId)).map((m) => ({ ...m, issues: [] }));
        return { ...state, byId: { ...state.byId, [fill.society.id]: { ...entry, result: {
          ...result,
          extra: result.extra.filter((w) => !justAdded.has(w)),
          matched: [...result.matched, ...fixed],
          differences: result.differences.filter((m) => !settled.has(m.trackId)),
        } } } };
      });
      setFill(undefined);
      onFilled?.();
    } catch (e) {
      const message = e instanceof Error ? e.message : "";
      toast.error(/row-level security|permission denied/i.test(message) ? "Adding songs to My Catalog needs Catalog Plus. Upgrade, then try again." : message || "Couldn't add those songs. Try again.");
    } finally {
      setFilling(false);
    }
  }

  const shown = shownId ? societies.find((s) => s.id === shownId) : undefined;
  const shownResult = shownId ? stored.byId[shownId]?.result : undefined;
  // The list read on its own, without needing a catalog: what each work's agency record is missing.
  const chosenCreates = fill ? fill.plan.creates.filter((c) => picked[workKey(c.work)] !== false) : [];
  const gaps = shownResult
    ? [...shownResult.matched, ...shownResult.differences].map((m) => m.work).concat(shownResult.extra)
      .filter((w): w is ListWork => !!w)
      .map((w) => ({ work: w, gaps: listGaps(w, shown?.id === "soundexchange", shown?.id) }))
      .filter((x) => x.gaps.length)
    : [];

  return (
    <div className="space-y-4">
      <p className="max-w-[68ch] text-sm text-muted-foreground">
        In your agency account, download your list of registered songs (or recordings, for SoundExchange) as a spreadsheet, then add it here.
        We match it to your catalog and show what's confirmed, what's different and what's missing. Your file is read on this device and isn't uploaded; only the comparison is saved.
        When an agency's own lookup isn't available (The MLC's is sometimes down), the list you download from them is how you confirm what they have.
      </p>
      <div className="grid gap-3 md:grid-cols-2">
        {societies.map((s) => {
          const sum = summaries[s.id];
          const last = stored.byId[s.id];
          return (
            <div key={s.id} className={`rounded-2xl border-2 p-3 ${sum ? "border-primary bg-card" : "border-dashed border-border bg-muted/40"}`}>
              <div className="flex min-h-20 flex-col items-start gap-1">
                <b className="text-sm">{s.name} list</b>
                {sum ? <span className="text-xs text-primary">Uploaded {new Date(sum.at).toLocaleDateString(undefined, { month: "short", day: "numeric" })} · {sum.matched} matched{sum.differences ? ` · ⚠️ ${sum.differences} different` : ""}</span>
                  : <span className="text-xs text-muted-foreground">CSV, Excel (.xlsx) or BMI PDF</span>}
                <div className="mt-1 flex flex-wrap items-center gap-1">
                  <input ref={(el) => { inputs.current[s.id] = el; }} type="file" accept=".csv,.tsv,.txt,.xlsx,.xls,.pdf,application/pdf" className="hidden" aria-label={`Upload your ${s.name} list`}
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(s, f); }} />
                  <Button size="sm" variant={sum ? "outline" : "default"} disabled={!!busy} onClick={() => inputs.current[s.id]?.click()}>
                    {busy === s.id ? <Loader2 className="animate-spin" /> : <FileUp />}{sum ? "Upload a new list" : "Choose file"}
                  </Button>
                  {last && <Button size="sm" variant="ghost" onClick={() => setShownId(s.id)}>Show comparison</Button>}
                  {(sum || last) && onRemove && <Button size="sm" variant="ghost" disabled={!!busy} onClick={() => void startOver(s)}><Trash2 />Start over</Button>}
                  {last && userId && (last.result.extra.length > 0 || last.result.differences.length > 0) && (canCatalog
                    ? <Button size="sm" variant="outline" disabled={!!busy} onClick={() => openFill(s)}><ListPlus />Fill my catalog</Button>
                    : onUpgrade && <Button size="sm" variant="outline" disabled={!!busy} onClick={onUpgrade}><ListPlus />Save to my catalog</Button>)}
                </div>
              </div>
              {/* The directions sit under the list they belong to, so nobody has to guess where the file comes from. */}
              <details className="mt-2 rounded-lg border border-border/70 bg-background/40 p-2 text-xs">
                <summary className="cursor-pointer font-semibold text-primary">How to find and download this list</summary>
                <ol className="mt-1 list-decimal space-y-1 pl-4 text-muted-foreground">
                  {downloadSteps(s.id).map((step) => <li key={step}>{step}</li>)}
                </ol>
              </details>
            </div>
          );
        })}
      </div>

      {shown && shownResult && (
        <div className="rounded-2xl border border-border p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h4 className="font-bold">{shown.name}: {shownResult.works} work{shownResult.works === 1 ? "" : "s"} on your list</h4>
            <span className="text-xs text-muted-foreground">{stored.byId[shown.id]?.file}</span>
          </div>
          <div className="mt-3 grid gap-4 md:grid-cols-3">
            <div><div className="text-sm font-semibold text-primary">✓ Confirmed · {shownResult.matched.length}</div>
              <ul className="mt-1 text-sm text-muted-foreground">{shownResult.matched.slice(0, 12).map((m) => <li key={m.trackId}>{m.title}</li>)}</ul></div>
            <div><div className="text-sm font-semibold">⚠️ Different · {shownResult.differences.length}</div>
              <ul className="mt-1 space-y-1 text-sm">{shownResult.differences.map((m) => <li key={m.trackId}><b>{m.title}</b><span className="block text-xs text-muted-foreground">{m.issues.join(" · ")}</span></li>)}</ul></div>
            <div><div className="text-sm font-semibold">Not on the list · {shownResult.notListed.length}</div>
              <ul className="mt-1 text-sm text-muted-foreground">{shownResult.notListed.slice(0, 12).map((m) => <li key={m.trackId}>{m.title}</li>)}</ul></div>
          </div>
          {shownResult.clashes.length > 0 && <div className="mt-4 rounded-lg border border-primary/40 bg-accent/30 p-3">
            <h5 className="text-sm font-semibold">⚠️ Same title, different writers · {shownResult.clashes.length}</h5>
            <p className="mt-1 text-xs text-muted-foreground">
              {shown.name} has {shownResult.clashes.length === 1 ? "a work" : "works"} under these titles, but not one writer matches your song.
              {" "}They aren&apos;t counted as not on the list, and the agency&apos;s writers are never copied over yours: here is what each one is and what to do.
            </p>
            <ul className="mt-2 space-y-3 text-sm">
              {shownResult.clashes.map((c) => <li key={c.trackId}>
                <b>{c.title}</b>
                <ul className="mt-1 space-y-1 text-xs text-muted-foreground">
                  {c.issues.map((issue) => <li key={issue}>{issue}</li>)}
                </ul>
              </li>)}
            </ul>
          </div>}
          {shownResult.extra.length > 0 && <p className="mt-3 text-xs text-muted-foreground">
            {shownResult.extra.length} work{shownResult.extra.length === 1 ? " is" : "s are"} on your {shown.name} list but not in your catalog ({shownResult.extra.slice(0, 5).map((w) => w.title).join(", ")}{shownResult.extra.length > 5 ? ", …" : ""}). Add them in My Catalog so they're in your report.
          </p>}
          {gaps.length > 0 && <div className="mt-4 rounded-lg border border-border p-3">
            <h5 className="text-sm font-semibold">What the list itself shows</h5>
            <p className="mt-1 text-xs text-muted-foreground">Read from the file you uploaded: the details each agency matches a work by.</p>
            <ul className="mt-2 space-y-1 text-sm">
              {gaps.slice(0, 8).map((g) => <li key={g.work.workId || g.work.iswc || g.work.isrc || g.work.title}>
                <b>{g.work.title || "Untitled work"}</b><span className="block text-xs text-muted-foreground">{g.gaps.join(" · ")}</span>
              </li>)}
              {gaps.length > 8 && <li className="text-xs text-muted-foreground">and {gaps.length - 8} more</li>}
            </ul>
          </div>}
          {!canCatalog && onUpgrade && <div className="mt-4 rounded-lg border border-primary/40 bg-accent/30 p-3 text-sm">
            <p className="font-semibold">Save these songs to your catalog and start embedding</p>
            <p className="mt-1 text-muted-foreground">Catalog Plus saves the list's songs into My Catalog, where you finish them, embed the files and download them, and the check stays with the songs.</p>
            <Button size="sm" className="mt-2" onClick={onUpgrade}><ListPlus />See the plans</Button>
          </div>}
        </div>
      )}

      {/* Music Royalty Doctors handoff (founder, 2026-11-13): the callout that used to be a sentence is now the way in. */}
      {(() => {
        const ids = Object.keys(stored.byId);
        if (!ids.length) return null;
        const tracks = allTracks ?? [...new Map(societies.flatMap((s) => songsFor(s.id)).map((t) => [t.id, t])).values()];
        const rows = buildDifferenceRows({ stored, tracks, societies });
        const open = openDifferenceCount(rows);
        const society = shownId ?? ids[0];
        const href = `/workspace?tab=health&panel=differences${society ? `&society=${encodeURIComponent(society)}` : ""}#differences-panel`;
        const agencies = rows.filter((r) => r.side === "agencies").length;
        return (
          <div className="rounded-2xl border border-teal-600/30 bg-teal-50/60 p-3 dark:border-cyan-400/30 dark:bg-cyan-400/5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-teal-600/30 bg-white text-teal-700 dark:border-cyan-400/30 dark:bg-slate-900 dark:text-cyan-300">
                  <Activity className="h-4 w-4" aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-teal-700 dark:text-cyan-300">Music Royalty Doctors · Diagnostic handoff</p>
                  <p className="text-sm font-semibold">
                    {open} difference{open === 1 ? "" : "s"} ready for review
                    {agencies > 0 && <span className="font-normal text-muted-foreground"> · {agencies} where two agencies disagree</span>}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" aria-pressed={preview} onClick={() => setPreview((v) => !v)}
                  className="text-xs font-semibold text-muted-foreground underline decoration-border underline-offset-4 hover:text-primary">
                  {preview ? "Hide preview" : "Preview differences here"}
                </button>
                <a href={href}
                  className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90">
                  Open in Differences Panel <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                </a>
              </div>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Every row says what disagrees, your value, the agency&apos;s value and the exact treatment. Comparisons stay on this device for 12 hours.
            </p>
          </div>
        );
      })()}
      {preview && <DifferencesPanel userId={userId} tracks={allTracks ?? [...new Map(societies.flatMap((s) => songsFor(s.id)).map((t) => [t.id, t])).values()]}
        societies={societies.map((s) => ({ id: s.id, name: s.name, url: s.url }))} summaries={summaries} defaultSociety={shownId} className="mt-3" />}

      <Dialog open={!!fill} onOpenChange={(o) => { if (!o && !filling) setFill(undefined); }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto bg-card text-card-foreground sm:max-w-2xl">
          <DialogHeader><DialogTitle>Fill your catalog with your {fill?.society.name} list songs?</DialogTitle></DialogHeader>
          {fill && <>
            <p className="text-sm text-muted-foreground">
              {fill.plan.creates.length
                ? `${fill.plan.creates.length} work${fill.plan.creates.length === 1 ? " is" : "s are"} on the agency's list and not in your catalog yet. Tick the ones you want; each entry starts with the title, codes, writers, IPI numbers and shares the list carries, and the roles you choose below.`
                : "Every work on this list is already in your catalog."}
              {" "}You finish the rest — album, release date, genre, duration — in My Catalog.
            </p>
            {fill.plan.creates.length > 0 && <div className="rounded-lg border border-border">
              <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2 text-xs">
                <span className="text-muted-foreground">{chosenCreates.length} of {fill.plan.creates.length} selected</span>
                <span className="flex gap-3">
                  <button type="button" className="font-semibold text-primary" onClick={() => setPicked(Object.fromEntries(fill.plan.creates.map((c) => [workKey(c.work), true])))}>Select all</button>
                  <button type="button" className="font-semibold text-primary" onClick={() => setPicked(Object.fromEntries(fill.plan.creates.map((c) => [workKey(c.work), false])))}>Clear</button>
                </span>
              </div>
              <ul className="max-h-64 divide-y divide-border/60 overflow-y-auto scroll-pt-2 py-1 [overflow-anchor:none]">
                {fill.plan.creates.map((c, i) => {
                  const key = workKey(c.work);
                  return <li key={key} className="flex items-center gap-2 px-3 py-2 text-sm">
                    <input id={`fill-pick-${i}`} type="checkbox" checked={picked[key] !== false} onChange={(e) => setPicked((p) => ({ ...p, [key]: e.target.checked }))} />
                    <label htmlFor={`fill-pick-${i}`} className="flex min-w-0 flex-1 cursor-pointer items-center justify-between gap-3">
                      <span className="truncate">{c.metadata.title}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">{c.metadata.isrc || c.metadata.iswc || "no code on the list"}</span>
                    </label>
                  </li>;
                })}
              </ul>
            </div>}
            {fill.plan.creates.length > 0 && people.length > 0 && <fieldset className="space-y-2 rounded-xl border border-border p-3">
              <legend className="px-1 text-sm font-bold">Who wrote what?</legend>
              <p className="text-xs text-muted-foreground">
                The list names every writer but never says who wrote the words and who wrote the music. Choose once per person and it
                applies to every song they&apos;re on. Someone can be both, and the artist often is. Anything left blank stays blank, and the
                song says it still needs it.
              </p>
              <ul className="space-y-2">
                {people.map((p) => {
                  const role = roles[p.key] ?? "";
                  const shown = names[p.key] ?? p.names[0];
                  return <li key={p.key} className="rounded-lg border border-border/70 p-2">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                      <span className="text-sm font-semibold">{shown}</span>
                      <span className="text-xs text-muted-foreground">
                        {p.works} song{p.works === 1 ? "" : "s"}{p.ipi ? ` · IPI ${p.ipi}` : ""}{p.pro ? ` · ${p.pro}` : ""}
                      </span>
                    </div>
                    {p.names.length > 1 && <div className="mt-1 flex flex-wrap items-center gap-1">
                      <span className="text-xs text-muted-foreground">Same writer, spelled:</span>
                      {p.names.map((n) => <button key={n} type="button" aria-pressed={shown === n} onClick={() => setNames((x) => ({ ...x, [p.key]: n }))}
                        className={`rounded-full border px-2 py-0.5 text-xs ${shown === n ? "border-primary bg-accent/40 font-semibold text-primary" : "border-border text-muted-foreground"}`}>{n}</button>)}
                    </div>}
                    <div className="mt-1 flex flex-wrap gap-1">
                      {WRITER_ROLES.map((r) => <button key={r} type="button" aria-pressed={role === r} onClick={() => setRoles((x) => ({ ...x, [p.key]: role === r ? "" : r }))}
                        className={`rounded-full border px-2.5 py-0.5 text-xs ${role === r ? "border-primary bg-primary font-semibold text-primary-foreground" : "border-border"}`}>
                        {r === "Author/Composer" ? "Both" : r}
                      </button>)}
                    </div>
                  </li>;
                })}
              </ul>
            </fieldset>}
            {fill.plan.creates.length > 0 && <fieldset className="space-y-2 rounded-xl border border-border p-3">
              <legend className="px-1 text-sm font-bold">Where do these songs belong?</legend>
              <label className="flex items-start gap-2 text-sm">
                <input type="radio" name="fill-release" className="mt-1 h-4 w-4 accent-[var(--primary)]" checked={!release.one} onChange={() => setRelease((r) => ({ ...r, one: false }))} />
                <span><span className="font-semibold">Each one is its own single</span><span className="block text-xs text-muted-foreground">They show under Singles in My Catalog. An agency list names works, not the release they came out on, so this is the safe default.</span></span>
              </label>
              <label className="flex items-start gap-2 text-sm">
                <input type="radio" name="fill-release" className="mt-1 h-4 w-4 accent-[var(--primary)]" checked={release.one} onChange={() => setRelease((r) => ({ ...r, one: true }))} />
                <span><span className="font-semibold">They all belong to one release</span><span className="block text-xs text-muted-foreground">Choose the type and title now, so My Catalog files every ticked song under that EP or album.</span></span>
              </label>
              {release.one && <div className="grid gap-2 pl-6 sm:grid-cols-[11rem_1fr]">
                <select aria-label="Release type" value={release.type} onChange={(e) => setRelease((r) => ({ ...r, type: e.target.value }))} className="h-9 rounded-md border border-input bg-background px-2 text-sm">
                  <option value="">Release type…</option>
                  {RELEASE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
                <input aria-label="Release title" value={release.title} onChange={(e) => setRelease((r) => ({ ...r, title: e.target.value }))} placeholder="Album or EP title" className="h-9 rounded-md border border-input bg-background px-3 text-sm" />
                <p className="text-xs text-muted-foreground sm:col-span-2">One release per fill. Songs from another EP or album: fill again from that list, or change the one that's left out in My Catalog.</p>
              </div>}
            </fieldset>}
            {fill.plan.duplicates.length > 0 && <div className="space-y-2">
              <h4 className="text-sm font-bold">Already in your catalog: which version is official?</h4>
              <p className="text-xs text-muted-foreground">
                These songs match the list by name or code, but the details don't. The agency's copy is what {fill.society.name} pays on, so check
                that it is the correct version: using it copies their codes and writers into your catalog in one click, while keeping yours means updating the registration at {fill.society.name} instead.
              </p>
              {fill.plan.duplicates.map((d) => {
                const choice = choices[d.track.id] ?? "keep";
                return <div key={d.track.id} className="rounded-lg border border-border p-3 text-sm">
                  <p className="font-semibold">{d.track.title}</p>
                  {d.changes.length > 0 && <div className="mt-2 grid grid-cols-[4.5rem_1fr_1fr] gap-x-2 gap-y-1 text-xs">
                    <span />
                    <span className="font-semibold">Your catalog</span>
                    <span className="font-semibold">The agency ({fill.society.name})</span>
                    {d.changes.map((ch) => <div key={ch.field} className="contents">
                      <span className="text-muted-foreground">{ch.field}</span>
                      <span>{ch.catalog}</span>
                      <span>{ch.agency}</span>
                    </div>)}
                  </div>}
                  {combinedHalves(d.work) && <p className="mt-2 text-xs text-muted-foreground">
                    {fill.society.name} prints the writer's half and the publisher's half together, so {listShareTotal(d.work)}% there is 100% of the composition. The share above is shown on the 100% scale.
                  </p>}
                  {d.issues.length > 0 && <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">
                    {d.issues.map((i) => <li key={i}>⚠️ {i}</li>)}
                  </ul>}
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <label className={`flex cursor-pointer items-start gap-2 rounded-lg border p-2 ${choice === "agency" ? "border-primary bg-accent/40" : "border-border"}`}>
                      <input type="radio" className="mt-0.5" name={`fill-${d.track.id}`} checked={choice === "agency"} onChange={() => setChoices((c) => ({ ...c, [d.track.id]: "agency" }))} />
                      <span><b>Use the agency's version</b><span className="block text-xs text-muted-foreground">Check that it's correct: your catalog then matches what {fill.society.name} has registered.</span></span>
                    </label>
                    <label className={`flex cursor-pointer items-start gap-2 rounded-lg border p-2 ${choice === "keep" ? "border-primary bg-accent/40" : "border-border"}`}>
                      <input type="radio" className="mt-0.5" name={`fill-${d.track.id}`} checked={choice === "keep"} onChange={() => setChoices((c) => ({ ...c, [d.track.id]: "keep" }))} />
                      <span><b>Keep my catalog version</b><span className="block text-xs text-muted-foreground">Nothing changes here, so update your registration at {fill.society.name} to match it.</span></span>
                    </label>
                  </div>
                  {choice === "keep" && <p className="mt-2 text-xs text-muted-foreground">
                    Keeping this one leaves the difference in place at {fill.society.name}.
                  </p>}
                  {choice === "agency" && !!(d.track.metadata.audioPath || d.track.metadata.artPath || d.track.metadata.coverThumb) && <p className="mt-2 text-xs text-muted-foreground">
                    Your master and artwork stay attached. Re-embed this song in My Catalog afterwards, so the file itself carries the corrected credits, ISRC and ISWC.
                  </p>}
                </div>;
              })}
            </div>}
            {onExpert && fill.plan.duplicates.some((d) => (choices[d.track.id] ?? "keep") !== "agency") && <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-primary/40 bg-accent/30 p-3 text-sm">
              <span>We can update those registrations for you, so the agency matches the version you kept.</span>
              <Button type="button" size="sm" variant="outline" disabled={filling} onClick={onExpert}><LifeBuoy />Get expert help</Button>
            </div>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" disabled={filling} onClick={() => setFill(undefined)}>Cancel</Button>
              <Button type="button" disabled={filling || (release.one && !release.type) || (!chosenCreates.length && !fill.plan.duplicates.some((d) => choices[d.track.id] === "agency"))} onClick={() => void runFill()}>
                {filling ? <Loader2 className="animate-spin" /> : <ListPlus />}
                {chosenCreates.length ? `Add ${chosenCreates.length} song${chosenCreates.length === 1 ? "" : "s"}` : "Update songs"}
              </Button>
            </div>
          </>}
        </DialogContent>
      </Dialog>
    </div>
  );
}
