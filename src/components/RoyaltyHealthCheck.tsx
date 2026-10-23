import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, ChevronRight, Hourglass } from "lucide-react";
import { toast } from "sonner";
import { listTracks, type CatalogTrack } from "@/lib/catalog";
import { RoyaltyInspector, MismatchTips } from "@/components/RoyaltyInspector";
import { HealthChecklist } from "@/components/HealthChecklist";
import { deleteInspectorSong, emptyStatus, inspectorChecks, isInspectorSong, listInspectorSongs, listStatuses, saveInspectorSong, saveStatus, type InspectorFields, type SongStatus } from "@/lib/health-songs";
import { CountryPicker, HealthReport } from "@/components/HealthReport";
import { RoyaltyReport } from "@/components/RoyaltyReport";
import { ACCOUNT_REF, releaseGroups, SINGLES_KEY, songChecklist } from "@/lib/health-checklist";
import { CONFIRM_AFTER_DAYS, royaltyCheckup, type StepAction } from "@/lib/royalty-checkup";
import { downloadAgencyExport } from "@/lib/agency-export";
import { listSplitSheets, splitStatus as sheetStatus } from "@/lib/splits";
import { healthReport, type RepertoireCheck } from "@/lib/health";
import { clearCheck, listChecks, markCheck } from "@/lib/repertoire-checks";
import { runSongLookups } from "@/lib/lookups.functions";
import { INTERNATIONAL, countryByCode, guessCountry } from "@/lib/repertoires";
import { loadOnboarding, saveOnboarding } from "@/lib/artist-profile";

const AUTO = [INTERNATIONAL.deezer.id, INTERNATIONAL.musicbrainz.id];

/** A ready-to-send note for the distributor when streaming shows different details than the catalog. */
function distributorMessage(t: CatalogTrack, differences: string[]) {
  const m = t.metadata;
  return [`Hello, please correct the metadata for "${t.title}" by ${t.artist}${m.isrc ? ` (ISRC ${m.isrc})` : ""}${m.upc ? `, UPC ${m.upc}` : ""}.`, "",
    "What streaming shows doesn't match our records:", ...differences.map((d) => `- ${d}`), "",
    "The correct details are:", `- Title: ${t.title}`, `- Artist: ${t.artist}`, ...(m.isrc ? [`- ISRC: ${m.isrc}`] : []), "", "Thank you."].join("\n");
}

export function RoyaltyHealthCheck({ userId, canCatalog, canExport, onUpgrade, onFixField, onEmbed, onExpert, onSplitSheet }: { userId: string; canCatalog: boolean; canExport: boolean; onUpgrade: () => void; onFix?: () => void; onFixField: (trackId: string, field: string) => void; onEmbed: () => void; onExpert?: () => void; onSplitSheet?: ((trackId: string) => void) | undefined }) {
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

  const [focusRequest, setFocusRequest] = useState<{ id: string; nonce: number }>();
  const [songsOpen, setSongsOpen] = useState(false);
  const [signedSheets, setSignedSheets] = useState<Map<string, boolean>>();
  useEffect(() => {
    if (!canCatalog) return;
    listSplitSheets().then((m) => setSignedSheets(new Map([...m].map(([id, list]) => [id, sheetStatus(list) === "signed"])))).catch(() => {});
  }, [canCatalog]);
  const checkupRows = useMemo(() => report.rows.map((r) => {
    const status = statuses.find((x) => x.songRef === r.track.id);
    return { r, c: songChecklist(r, country, status, statuses.find((x) => x.songRef === ACCOUNT_REF)), status };
  }), [report, country, statuses]);
  const checkup = useMemo(() => royaltyCheckup({ rows: checkupRows, signedSheets }), [checkupRows, signedSheets]);

  /** Opens one song's checklist in "Song by song". */
  function showSong(id?: string) {
    setSongsOpen(true);
    if (id) setFocusRequest({ id, nonce: Date.now() });
    else setTimeout(() => document.getElementById("song-by-song")?.scrollIntoView({ behavior: "smooth", block: "start" }), 30);
  }

  /** A treatment step's button: every step ends at the agency, so most of these leave Came Through Audio on purpose. */
  async function act(a: StepAction) {
    if (a.kind === "field") return fixField(a.trackId, a.field);
    if (a.kind === "tick" || a.kind === "changes") return showSong(a.kind === "changes" ? a.trackId : checkup.lead?.songs[0]?.id);
    if (a.kind === "portal") return void window.open(a.url, "_blank", "noopener,noreferrer");
    if (a.kind === "split") return onSplitSheet ? onSplitSheet(a.trackId) : onUpgrade();
    if (a.kind === "join") return void window.open("/docs/royalty-health-suite", "_blank", "noopener");
    if (a.kind === "upload") return showSong();
    if (a.kind === "distributor") {
      const t = allTracks.find((x) => x.id === a.trackId);
      const r = report.rows.find((x) => x.track.id === a.trackId);
      if (!t || !r) return;
      const text = distributorMessage(t, r.findings.filter((f) => f.level === "warn").map((f) => f.text));
      try { await navigator.clipboard.writeText(text); toast.success("Copied. Paste it into your distributor's support form."); } catch { toast.error("Couldn't copy. Try again."); }
      return;
    }
    if (!canExport) return onUpgrade();
    const catalogOnly = (tracks ?? []).filter((t) => !isInspectorSong(t.id));
    const held = await downloadAgencyExport(a.agency, catalogOnly, a.agency === "pro" ? "PRO cheat sheet" : a.agency === "mlc" ? "MLC registration" : "SoundExchange registration");
    if (held.length) toast.warning(`${held.length} song${held.length === 1 ? " was" : "s were"} left out until ${held.length === 1 ? "its" : "their"} writer details are complete.`);
  }

  /** A calendar reminder to confirm registrations, six weeks out (new registrations take a few weeks to show). */
  function reminder() {
    const d = new Date(Date.now() + CONFIRM_AFTER_DAYS * 86_400_000);
    const day = d.toISOString().slice(0, 10).replace(/-/g, "");
    const ics = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Came Through Audio//Royalty Health Report//EN", "BEGIN:VEVENT",
      `UID:rhr-${Date.now()}@camethroughaudio.com`, `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").slice(0, 15)}Z`, `DTSTART;VALUE=DATE:${day}`,
      "SUMMARY:Confirm your song registrations showed up", "DESCRIPTION:Open your Royalty Health Report and run a new checkup.", "END:VEVENT", "END:VCALENDAR"].join("\r\n");
    const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
    const link = Object.assign(document.createElement("a"), { href: url, download: "Confirm registrations.ics" });
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
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

  const checklist = <HealthChecklist rows={report.rows} country={country} statuses={statuses} onStatus={(x) => void updateStatus(x)} actions={actions} bare={report.rows.length > 0}
    runningId={running?.trackId} canCatalog={canCatalog} onUpgrade={onUpgrade} onEditInspector={(id) => fixField(id, "")} onDeleteInspector={(id) => void removeInspector(id)} focusRequest={focusRequest} />;
  const inspector = <div id="quick-check" className="scroll-mt-4"><RoyaltyInspector onEmbed={onEmbed} onExpert={book} onSave={saveInspector} editing={editing} onDoneEditing={() => setEditing(undefined)} /></div>;
  const why = (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-5">
          <AlertTriangle className="h-6 w-6 text-primary" />
          <h4 className="mt-2 text-lg font-bold">Your distributor only collects part of your money.</h4>
          <p className="mt-1 text-sm text-muted-foreground">TuneCore, CD Baby, Symphonic and other distributors pay your master streams. They do <span className="font-semibold text-foreground">not</span> collect your songwriter performance royalties, recording performance royalties or mechanicals. If those aren't registered with your societies, that money goes unclaimed.</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5">
          <Hourglass className="h-6 w-6 text-primary" />
          <h4 className="mt-2 text-lg font-bold">Unclaimed royalties don't wait forever.</h4>
          <p className="mt-1 text-sm text-muted-foreground">Songs that can't be matched land in the "black box." After a holding period, unclaimed money can be paid out to other rights holders by market share — usually the biggest labels and publishers.</p>
        </div>
      </div>
      {tracks.length > 0 && <MismatchTips />}
    </div>
  );

  // Free accounts with no songs yet: the Royalty Inspector is the way in.
  if (!report.rows.length) return (
    <div className="space-y-6">
      <HealthReport {...actions} report={report} country={country} running={running} canCatalog={canCatalog} onEmbed={onEmbed} />
      {inspector}
      <Section title="Why this matters" summary="Your distributor only collects part of your money · unclaimed royalties don't wait forever">{why}</Section>
    </div>
  );

  const kinds = releaseGroups(report.rows.map((r) => ({ r, c: songChecklist(r, country, statusOf(r.track.id), statusOf(ACCOUNT_REF)) })), "az");
  const attention = checkupRows.filter((x) => x.c.group === "attention").length;
  return (
    <div className="space-y-6">
      <RoyaltyReport checkup={checkup} since={null} date={new Date().toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })} country={country.name}
        countryPicker={<CountryPicker country={country} onCountry={chooseCountry} />} running={!!running} canExport={canExport}
        onRunCheckup={() => void runAll()} onAction={(a) => void act(a)} onExpert={book} onReminder={reminder} />
      {running && <p className="text-sm text-muted-foreground">Looking up song {running.done + 1} of {running.total} on streaming and MusicBrainz…</p>}

      <div className="space-y-3">
        <h3 className="pt-4 text-2xl font-extrabold">Your songs and records</h3>
        <Section id="song-by-song" title="Song by song" open={songsOpen} onToggle={setSongsOpen}
          summary={`${songsLabel(report.rows.length)} · ${kinds.filter((g) => g.key !== SINGLES_KEY && !g.key.startsWith("~")).length} albums & EPs · ${kinds.find((g) => g.key === SINGLES_KEY)?.songs.length ?? 0} singles · ${attention ? `⚠️ ${attention} need attention` : "✓ all on track"}`}>
          {checklist}
        </Section>
        <Section title="Check a song that isn't in your catalog" summary={`Royalty Inspector · ${songsLabel(inspectorSongs.length)} checked`}>{inspector}</Section>
        <Section title="Why this matters" summary="Your distributor only collects part of your money · unclaimed royalties don't wait forever · common mismatches">{why}</Section>
      </div>
    </div>
  );
}

const songsLabel = (n: number) => `${n} song${n === 1 ? "" : "s"}`;

/** One collapsible section of the report page, with a one-line summary when closed (BRANDING.md §3). */
function Section({ id, title, summary, open, onToggle, children }: { id?: string; title: string; summary: string; open?: boolean; onToggle?: (open: boolean) => void; children: ReactNode }) {
  return (
    <details id={id} open={open} onToggle={(e) => onToggle?.((e.currentTarget as HTMLDetailsElement).open)} className="rr rr-section scroll-mt-4 rounded-2xl border border-border bg-card">
      <summary className="flex min-h-16 items-center gap-3 rounded-2xl px-5 py-4">
        <ChevronRight className="rr-chev h-5 w-5 shrink-0 transition-transform" />
        <span className="min-w-0 flex-1"><b className="block text-lg">{title}</b><span className="block text-sm text-muted-foreground">{summary}</span></span>
      </summary>
      <div className="px-5 pb-5">{children}</div>
    </details>
  );
}
