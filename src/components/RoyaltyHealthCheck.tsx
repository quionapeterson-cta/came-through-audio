import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Hourglass } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { listTracks, type CatalogTrack } from "@/lib/catalog";
import { RoyaltyInspector, MismatchTips } from "@/components/RoyaltyInspector";
import { HealthChecklist } from "@/components/HealthChecklist";
import { deleteInspectorSong, emptyStatus, inspectorChecks, isInspectorSong, listInspectorSongs, listStatuses, saveInspectorSong, saveStatus, type InspectorFields, type SongStatus } from "@/lib/health-songs";
import { HealthReport } from "@/components/HealthReport";
import { healthReport, type RepertoireCheck } from "@/lib/health";
import { clearCheck, listChecks, markCheck } from "@/lib/repertoire-checks";
import { runSongLookups } from "@/lib/lookups.functions";
import { INTERNATIONAL, countryByCode, guessCountry } from "@/lib/repertoires";
import { loadOnboarding, saveOnboarding } from "@/lib/artist-profile";
import { NextBadgeHint } from "@/components/Badges";

const AUTO = [INTERNATIONAL.deezer.id, INTERNATIONAL.musicbrainz.id];

export function RoyaltyHealthCheck({ userId, canCatalog, onUpgrade, onFix, onFixField, onEmbed, onExpert }: { userId: string; canCatalog: boolean; onUpgrade: () => void; onFix: () => void; onFixField: (trackId: string, field: string) => void; onEmbed: () => void; onExpert?: () => void }) {
  const [tracks, setTracks] = useState<CatalogTrack[]>();
  const [checks, setChecks] = useState<RepertoireCheck[]>([]);
  const [code, setCode] = useState(() => loadOnboarding(userId)?.healthCountry);
  const [running, setRunning] = useState<{ done: number; total: number; trackId?: string }>();
  const [loaded, setLoaded] = useState(false);
  const [inspectorSongs, setInspectorSongs] = useState<CatalogTrack[]>([]);
  const [statuses, setStatuses] = useState<SongStatus[]>([]);
  const [editing, setEditing] = useState<CatalogTrack>();
  const autoRan = useRef(false);

  useEffect(() => {
    Promise.all([
      listTracks().then(setTracks).catch(() => setTracks([])),
      listChecks().then(setChecks).catch(() => toast.error("Couldn't load your saved registration checks.")),
      // Checklist tables arrive with the 20261020120000 migration; until then the checklist simply starts empty.
      listInspectorSongs().then(setInspectorSongs).catch(() => {}),
      listStatuses().then(setStatuses).catch(() => {}),
    ]).then(() => setLoaded(true));
  }, []);

  // Songs that have never been looked up get looked up on their own, so results are there without a click.
  useEffect(() => {
    if (!loaded || autoRan.current || !tracks?.length) return;
    autoRan.current = true;
    const fresh = tracks.filter((t) => !checks.some((c) => c.trackId === t.id && AUTO.includes(c.society)));
    if (fresh.length) void runAll(fresh, false);
  }, [loaded]); // eslint-disable-line react-hooks/exhaustive-deps

  // First visit: guess the country from the writers' PROs, falling back to the US.
  const country = countryByCode(code ?? guessCountry((tracks ?? []).flatMap((t) => [...t.metadata.writers, ...t.metadata.composers].map((w) => w.pro)))) ?? countryByCode("US")!;
  // Catalog songs and Royalty Inspector songs share one report; inspector marks live in their checklist status.
  const allTracks = useMemo(() => [...(tracks ?? []), ...inspectorSongs], [tracks, inspectorSongs]);
  const allChecks = useMemo(() => [...checks, ...inspectorChecks(statuses)], [checks, statuses]);
  const report = useMemo(() => healthReport(allTracks, country, allChecks), [allTracks, country, allChecks]);
  const statusOf = (id: string) => statuses.find((x) => x.songRef === id) ?? emptyStatus(id);

  async function updateStatus(next: SongStatus) {
    const prev = statuses;
    setStatuses((all) => [...all.filter((x) => x.songRef !== next.songRef), next]);
    try { await saveStatus(next); } catch { setStatuses(prev); toast.error("Couldn't save that step. Try again."); }
  }
  async function saveInspector(fields: InspectorFields, id?: string) {
    try {
      const t = await saveInspectorSong(fields, id);
      setInspectorSongs((all) => [t, ...all.filter((x) => x.id !== t.id)]);
      toast.success(id ? "Song updated." : "Saved to your Song Health Checklist.");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Couldn't save the song."); throw e; }
  }
  async function removeInspector(id: string) {
    try { await deleteInspectorSong(id); setInspectorSongs((all) => all.filter((x) => x.id !== id)); } catch { toast.error("Couldn't remove the song. Try again."); }
  }
  function fixField(trackId: string, field: string) {
    if (!isInspectorSong(trackId)) { onFixField(trackId, field); return; }
    setEditing(inspectorSongs.find((x) => x.id === trackId));
    document.getElementById("quick-check")?.scrollIntoView({ behavior: "smooth" });
  }

  const upsert = (c: RepertoireCheck) => setChecks((all) => [...all.filter((x) => !(x.trackId === c.trackId && x.society === c.society)), c]);

  function chooseCountry(next: string) {
    setCode(next);
    const ob = loadOnboarding(userId);
    if (ob) saveOnboarding(userId, { ...ob, healthCountry: next });
  }

  async function lookup(trackId: string) {
    const r = await runSongLookups({ data: { trackId } });
    const at = new Date().toISOString();
    upsert({ trackId, society: INTERNATIONAL.deezer.id, status: r.streaming ? "found" : "not_listed", source: "auto", details: r.streaming ?? {}, checkedAt: at });
    upsert({ trackId, society: INTERNATIONAL.musicbrainz.id, status: r.work ? "found" : "not_listed", source: "auto", details: r.work ?? {}, checkedAt: at });
  }

  async function runOne(trackId: string) {
    setRunning({ done: 0, total: 1, trackId });
    try { await lookup(trackId); } catch { toast.error("The lookup didn't finish. Try again in a moment."); } finally { setRunning(undefined); }
  }

  /** One song at a time: MusicBrainz allows about one request per second, so a catalog takes a little while. */
  async function runAll(list: CatalogTrack[] = tracks ?? [], announce = true) {
    let failed = 0;
    for (const [i, t] of list.entries()) {
      setRunning({ done: i, total: list.length, trackId: t.id });
      try { await lookup(t.id); } catch { failed++; }
    }
    setRunning(undefined);
    if (failed) toast.error(`${failed} lookup${failed === 1 ? "" : "s"} didn't finish. Try those songs again.`);
    else if (announce) toast.success("Live lookups finished.");
  }

  async function mark(trackId: string, society: string, status: RepertoireCheck["status"], workId?: string) {
    if (isInspectorSong(trackId)) {
      const cur = statusOf(trackId), steps = { ...cur.steps };
      delete steps[`found:${society}`]; delete steps[`not_listed:${society}`];
      steps[`${status}:${society}`] = new Date().toISOString();
      return updateStatus({ ...cur, steps });
    }
    try { upsert(await markCheck(userId, trackId, society, status, workId)); } catch { toast.error("Couldn't save that. Try again."); }
  }
  async function clear(trackId: string, society: string) {
    if (isInspectorSong(trackId)) {
      const cur = statusOf(trackId), steps = { ...cur.steps };
      delete steps[`found:${society}`]; delete steps[`not_listed:${society}`];
      return updateStatus({ ...cur, steps });
    }
    if (AUTO.includes(society)) return;
    try { await clearCheck(trackId, society); setChecks((all) => all.filter((x) => !(x.trackId === trackId && x.society === society))); } catch { toast.error("Couldn't undo that. Try again."); }
  }

  const book = () => onExpert ? onExpert() : document.getElementById("expert-assistance")?.scrollIntoView({ behavior: "smooth" });
  const actions = {
    onCountry: chooseCountry, onRunAll: () => void runAll(), onExpert: book, onRunOne: (id: string) => void runOne(id),
    onMark: (...a: Parameters<typeof mark>) => void mark(...a), onClear: (...a: Parameters<typeof clear>) => void clear(...a), onFixField: fixField,
  };
  if (!tracks) return <div className="rounded-3xl bg-ink p-8 text-ink-muted">Scanning your catalog…</div>;

  return (
    <div className="space-y-6">
      <NextBadgeHint userId={userId} collections={["health"]} />
      <HealthReport {...actions} report={report} country={country} running={running} canCatalog={canCatalog} onEmbed={onEmbed} />

      <HealthChecklist rows={report.rows} country={country} statuses={statuses} onStatus={(x) => void updateStatus(x)} actions={actions}
        runningId={running?.trackId} canCatalog={canCatalog} onUpgrade={onUpgrade} onEditInspector={(id) => fixField(id, "")} onDeleteInspector={(id) => void removeInspector(id)} />

      {tracks.length > 0 && <MismatchTips />}

      <div id="quick-check" className="scroll-mt-4">
        <RoyaltyInspector onEmbed={onEmbed} onExpert={book} onSave={saveInspector} editing={editing} onDoneEditing={() => setEditing(undefined)} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border-2 border-destructive/60 bg-card p-5">
          <AlertTriangle className="h-6 w-6 text-destructive" />
          <h3 className="mt-2 text-lg font-bold">Your distributor only collects part of your money.</h3>
          <p className="mt-1 text-sm text-muted-foreground">TuneCore, CD Baby, Symphonic and other distributors pay your master streams. They do <span className="font-semibold text-foreground">not</span> collect your songwriter performance royalties, recording performance royalties or mechanicals. If those aren't registered with your societies, that money goes unclaimed.</p>
        </div>
        <div className="rounded-2xl border-2 border-destructive/60 bg-card p-5">
          <Hourglass className="h-6 w-6 text-destructive" />
          <h3 className="mt-2 text-lg font-bold">Unclaimed royalties don't wait forever.</h3>
          <p className="mt-1 text-sm text-muted-foreground">Songs that can't be matched land in the "black box." After a holding period, unclaimed money can be paid out to other rights holders by market share — usually the biggest labels and publishers.</p>
        </div>
      </div>

      {report.needsAction > 0 && (
        <div className="flex flex-col items-start gap-3 rounded-2xl bg-primary p-6 text-primary-foreground md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-xl font-bold">One typo can freeze your payouts — with no error message.</h3>
            <p className="text-sm opacity-90">{report.needsAction} of your songs need attention. Get an expert extra set of eyes live on video.</p>
          </div>
          <div className="flex gap-2"><Button variant="secondary" size="lg" onClick={book}>Get Expert Help</Button><Button variant="outline" size="lg" className="border-primary-foreground/40 bg-transparent text-primary-foreground hover:bg-primary-foreground/10" onClick={onFix}>Open My Catalog</Button></div>
        </div>
      )}
    </div>
  );
}
