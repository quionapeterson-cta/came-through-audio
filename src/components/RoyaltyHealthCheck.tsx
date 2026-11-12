import { useEffect, useMemo, useRef, useState } from "react";
import { Eye, FileDown, FileText, ListChecks, Search, Stethoscope, Trash2, X } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { confirmAction } from "@/components/ConfirmHost";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { listTracks, type CatalogTrack } from "@/lib/catalog";
import { RoyaltyInspector, MismatchTips } from "@/components/RoyaltyInspector";
import { HealthChecklist } from "@/components/HealthChecklist";
import { deleteInspectorSong, emptyStatus, inspectorChecks, isInspectorSong, listInspectorSongs, listStatuses, saveInspectorSong, saveStatus, type InspectorFields, type SongStatus } from "@/lib/health-songs";
import { CountryPicker, HealthReport } from "@/components/HealthReport";
import { RoyaltyReport } from "@/components/RoyaltyReport";
import { ACCOUNT_REF, songChecklist } from "@/lib/health-checklist";
import { CONFIRM_AFTER_DAYS, ORGAN_NAME, royaltyCheckup, sinceLast, STATE_LABEL, summarize, type StepAction } from "@/lib/royalty-checkup";
import { catalogScope, deleteReport, listReports, listSnapshotIds, loadSnapshot, releaseScope, sameScope, saveReport, saveSnapshot, scopeName, songScope, type ReportScope, type ReportSnapshot, type SavedReport } from "@/lib/health-reports";
import { HealthCheckIn, type IntakeKind } from "@/components/HealthCheckIn";
import { creditName } from "@/lib/metadata";
import { downloadCheckupPdf } from "@/lib/checkup-pdf";
import { burstConfetti } from "@/components/Confetti";
import { claimFirstBurst } from "@/lib/celebrate";
import { AgencyLists } from "@/components/AgencyLists";
import { DifferencesPanel } from "@/components/DifferencesPanel";
import { listKey, type ListResult, type SavedListSummary } from "@/lib/agency-lists";
import type { Society } from "@/lib/repertoires";
import { downloadAgencyExport } from "@/lib/agency-export";
import { listContributors, listSplitSheets, splitStatus as sheetStatus } from "@/lib/splits";
import { AskCowriterDialog, IpiRequestList, type Cowriter } from "@/components/IpiRequests";
import { cowritersMissing, fillWriter, listIpiRequests, nameKey, setIpiRequestStatus, type IpiRequest } from "@/lib/ipi-requests";
import { sendIpiRequest } from "@/lib/ipi-request.functions";
import { saveTrack } from "@/lib/catalog";
import { useServerFn } from "@tanstack/react-start";
import { healthReport, type RepertoireCheck } from "@/lib/health";
import { clearCheck, listChecks, markCheck } from "@/lib/repertoire-checks";
import { runSongLookups } from "@/lib/lookups.functions";
import { INTERNATIONAL, countryByCode, guessCountry } from "@/lib/repertoires";
import { loadOnboarding, saveOnboarding } from "@/lib/artist-profile";
import { WaitingArea } from "@/components/WaitingArea";
import { ClinicArt, DoctorCoat } from "@/components/ClinicArt";
import { ClinicalScan, loadPatientFile, loadPatientFileFromAccount, OfficeSteps } from "@/components/DoctorsOffice";
import { PatientFileCard, patientFileReady, patientSummary } from "@/components/PatientFileCard";
import { UpgradeCards } from "@/components/UpgradeCards";
import { StreamingFastTrack } from "@/components/StreamingFastTrack";
import { clearIntake, readIntake, writeIntake } from "@/lib/intake-session";

// Automatic lookups (MusicBrainz rows saved before its removal stay out of the score and can't be undone by hand).
const AUTO = [INTERNATIONAL.deezer.id, "musicbrainz"];

/** A ready-to-send note for the distributor when streaming shows different details than the catalog. */
function distributorMessage(t: CatalogTrack, differences: string[]) {
  const m = t.metadata;
  return [`Hello, please correct the metadata for "${t.title}" by ${t.artist}${m.isrc ? ` (ISRC ${m.isrc})` : ""}${m.upc ? `, UPC ${m.upc}` : ""}.`, "",
    "What streaming shows doesn't match our records:", ...differences.map((d) => `- ${d}`), "",
    "The correct details are:", `- Title: ${t.title}`, `- Artist: ${t.artist}`, ...(m.isrc ? [`- ISRC: ${m.isrc}`] : []), "", "Thank you."].join("\n");
}

/** Where a Royalty Health Check starts from outside the Hub: a song or its release in My Catalog, or the whole catalog. */
export type HealthStart = { trackId?: string | undefined; release?: boolean | undefined; nonce: number };

/**
 * The Royalties and Registrations (PLAN-health-hub-reports): home base for catalog health, the checklist and every report.
 * A Royalty Health Check runs from here, My Catalog or the Royalty Inspector: check-in first, then the report,
 * which is saved to My reports.
 */
type View = { kind: "hub" } | { kind: "checkin"; scope: ReportScope; from?: string | undefined } | { kind: "scan"; scope: ReportScope; baseline: SavedReport | null } | { kind: "report"; scope: ReportScope; baseline: SavedReport | null };
/** A check-in left mid-visit: the songs it covers, the song it started from, and the intake that was open. */
type SavedVisit = { kind: "checkin"; scope: ReportScope; from?: string | undefined; intake?: IntakeKind | undefined };

export function RoyaltyHealthCheck({ userId, canCatalog, canExport, onUpgrade, onFixField, onEmbed, onExpert, onSplitSheet, start }: { userId: string; canCatalog: boolean; canExport: boolean; onUpgrade: (priceId?: string) => void; onFix?: () => void; onFixField: (trackId: string, field: string) => void; onEmbed: () => void; onExpert?: () => void; onSplitSheet?: ((trackId: string) => void) | undefined; start?: HealthStart | undefined }) {
  const [tracks, setTracks] = useState<CatalogTrack[]>();
  const [checks, setChecks] = useState<RepertoireCheck[]>([]);
  const [code, setCode] = useState(() => loadOnboarding(userId)?.healthCountry);
  const [running, setRunning] = useState<{ done: number; total: number; trackId?: string }>();
  const [loaded, setLoaded] = useState(false);
  const [inspectorSongs, setInspectorSongs] = useState<CatalogTrack[]>([]);
  const [statuses, setStatuses] = useState<SongStatus[]>([]);
  const [editing, setEditing] = useState<CatalogTrack>();
  const autoRan = useRef(false);
  const [reports, setReports] = useState<SavedReport[]>();
  /** Reports whose whole report was kept, so the Front Desk can open and download them again. */
  const [snapshots, setSnapshots] = useState<Set<string>>(() => new Set());
  /** The past report open from the Front Desk, the only place a past report is opened (founder, 2026-11-11). */
  const [pastOpen, setPastOpen] = useState<{ report: SavedReport; snap: ReportSnapshot }>();
  /** Walking up to the Front Desk: it opens on a click, the way you'd step up to a counter (founder, 2026-11-11). */
  const [deskOpen, setDeskOpen] = useState(false);
  const [view, setView] = useState<View>({ kind: "hub" });
  // Set when a check runs; the report is saved once its live lookups finish.
  const [pendingSave, setPendingSave] = useState(false);
  /** The Front Desk panel that is open: the reports already filed, or the checklist to pick back up. */
  const [desk, setDesk] = useState<"reports" | "checklist" | undefined>();
  /** Which intake the visit opened on: Streaming Profile, the agency examination, or the Artist Intake Form. */
  const [intakeWanted, setIntakeWanted] = useState<IntakeKind | undefined>();
  // A check-in is a sitting (streaming pull, an agency list, answers half done): leave the tab, reload or open a
  // second window and it is still here, instead of making the member bring everything in again.
  const [visitReady, setVisitReady] = useState(false);
  const visitRestored = useRef(false);
  useEffect(() => {
    if (visitRestored.current) return;
    visitRestored.current = true;
    const saved = readIntake<SavedVisit>(userId, "visit");
    if (saved?.kind === "checkin") {
      setIntakeWanted(saved.intake);
      setView({ kind: "checkin", scope: saved.scope, from: saved.from });
    }
    setVisitReady(true);
  }, [userId]);
  useEffect(() => {
    if (!visitReady) return;
    if (view.kind === "checkin") writeIntake<SavedVisit>(userId, "visit", { kind: "checkin", scope: view.scope, from: view.from, intake: intakeWanted });
    else clearIntake(userId, "visit");
  }, [visitReady, view, intakeWanted, userId]);
  /** The patient file handed over at the Front Desk. The Music Royalty Doctor reads it for the intake form's writer defaults. */
  const [patient, setPatient] = useState(() => loadPatientFile(userId));
  const patientReady = patientFileReady(patient);
  // A new browser has no local copy: the file on the account is the desk's other copy.
  useEffect(() => {
    if (patientReady) return;
    let alive = true;
    loadPatientFileFromAccount(userId).then((f) => { if (alive && f) setPatient(f); }).catch(() => {});
    return () => { alive = false; };
  }, [userId, patientReady]);

  useEffect(() => {
    Promise.all([
      listTracks().then(setTracks).catch(() => setTracks([])),
      listChecks().then(setChecks).catch(() => toast.error("Couldn't load your saved registration checks.")),
      // Checklist tables arrive with the 20261020120000 migration; until then the checklist simply starts empty.
      listInspectorSongs().then(setInspectorSongs).catch(() => {}),
      listStatuses().then(setStatuses).catch(() => {}),
      // Report history arrives with the 20261024130000 migration; until then there's simply no history.
      listReports().then(setReports).catch(() => setReports([])),
      listSnapshotIds().then(setSnapshots).catch(() => {}),
    ]).then(() => setLoaded(true));
  }, []);

  // Songs that have never been looked up get looked up on their own, so results are there without a click.
  useEffect(() => {
    if (!loaded || autoRan.current || !tracks?.length) return;
    autoRan.current = true;
    const fresh = tracks.filter((t) => !checks.some((c) => c.trackId === t.id && c.society === INTERNATIONAL.deezer.id));
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
      return t;
    } catch (e) { toast.error(e instanceof Error ? e.message : "Couldn't save the song."); throw e; }
  }
  async function removeReport(r: SavedReport) {
    if (!(await confirmAction({ title: "Delete this report?", text: `The ${shortDate(r.createdAt)} report for ${scopeName(r.scope)} is removed from My reports. Your songs and checklist aren't changed.`, action: "Delete" }))) return;
    try { await deleteReport(r.id); setReports((all) => (all ?? []).filter((x) => x.id !== r.id)); } catch { toast.error("Couldn't delete the report. Try again."); }
  }
  async function removeInspector(id: string) {
    try { await deleteInspectorSong(id); setInspectorSongs((all) => all.filter((x) => x.id !== id)); } catch { toast.error("Couldn't remove the song. Try again."); }
  }
  function fixField(trackId: string, field: string) {
    if (!isInspectorSong(trackId)) { onFixField(trackId, field); return; }
    setEditing(inspectorSongs.find((x) => x.id === trackId));
    setView({ kind: "hub" });
    setTimeout(() => document.getElementById("patient-intake-form")?.scrollIntoView({ behavior: "smooth", block: "start" }), 30);
  }

  const [focusRequest, setFocusRequest] = useState<{ id: string; nonce: number }>();
  const [signedSheets, setSignedSheets] = useState<Map<string, boolean>>();
  // Co-writer emails we already know, from split sheets and the Contributor Library, keyed by name.
  const [emails, setEmails] = useState<Map<string, string>>(new Map());
  const [ipiRequests, setIpiRequests] = useState<IpiRequest[]>([]);
  const [askOpen, setAskOpen] = useState(false);
  const sendRequest = useServerFn(sendIpiRequest);
  useEffect(() => {
    if (!canCatalog) return;
    listSplitSheets().then((m) => {
      setSignedSheets(new Map([...m].map(([id, list]) => [id, sheetStatus(list) === "signed"])));
      setEmails((e) => { const n = new Map(e); for (const list of m.values()) for (const c of list) if (c.email && !n.has(nameKey(c.name))) n.set(nameKey(c.name), c.email); return n; });
    }).catch(() => {});
    listContributors().then((list) => setEmails((e) => { const n = new Map(e); for (const c of list) if (c.email) n.set(nameKey(c.name), c.email); return n; })).catch(() => {});
    // Arrives with the 20261024140000 migration; until then there are simply no requests.
    listIpiRequests().then(setIpiRequests).catch(() => {});
  }, [canCatalog]);
  const checkupRows = useMemo(() => report.rows.map((r) => {
    const status = statuses.find((x) => x.songRef === r.track.id);
    return { r, c: songChecklist(r, country, status, statuses.find((x) => x.songRef === ACCOUNT_REF)), status };
  }), [report, country, statuses]);
  /** The songs a check covers: the whole catalog means catalog songs (not Royalty Inspector ones), as they are now. */
  const rowsIn = (scope: ReportScope) => checkupRows.filter(({ r }) => (scope.kind === "catalog" ? !isInspectorSong(r.track.id) : scope.refs.includes(r.track.id)));
  const reportRows = useMemo(() => (view.kind === "report" ? rowsIn(view.scope) : []), [view, checkupRows]); // eslint-disable-line react-hooks/exhaustive-deps
  const checkup = useMemo(() => royaltyCheckup({ rows: reportRows, signedSheets }), [reportRows, signedSheets]);
  const summary = useMemo(() => summarize(checkup), [checkup]);
  const since = sinceLast(summary, view.kind === "report" ? view.baseline?.summary : null);

  // Every check that runs is saved to My reports, once its live lookups have finished.
  useEffect(() => {
    if (!pendingSave || running || view.kind !== "report" || !reportRows.length) return;
    setPendingSave(false);
    // The whole report goes beside its summary, so the Front Desk can open and download it again (founder, 2026-11-11).
    const snap: ReportSnapshot = { checkup, artist: mostCommon(reportRows.map(({ r }) => r.track.artist)), country: country.name };
    saveReport(summary, view.scope).then((r) => {
      setReports((all) => [r, ...(all ?? [])]);
      void saveSnapshot(r.id, snap).then((ok) => { if (ok) setSnapshots((ids) => new Set(ids).add(r.id)); });
    }).catch(() => {});
  }, [pendingSave, running, view, summary, reportRows.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const top = () => setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 30);
  /** Check-in: the song it was opened from can widen to its release or the whole catalog. */
  function startCheck(scope: ReportScope, from = scope.kind === "song" || scope.kind === "outside" ? scope.refs[0] : undefined, intake?: IntakeKind) {
    setIntakeWanted(intake);
    setView({ kind: "checkin", scope, from });
    top();
  }
  function checkSong(trackId: string, release?: boolean) {
    const t = allTracks.find((x) => x.id === trackId);
    if (!t) return;
    const rel = release ? releaseScope(t, allTracks) : undefined;
    startCheck(rel ?? songScope(t), trackId);
  }
  function scopeOptions(from?: string): ReportScope[] {
    const t = from ? allTracks.find((x) => x.id === from) : undefined;
    if (t && isInspectorSong(t.id)) return [songScope(t)];
    const rel = t && releaseScope(t, allTracks);
    return [t && songScope(t), rel, (tracks ?? []).length ? catalogScope(tracks ?? []) : undefined].filter((x): x is ReportScope => !!x);
  }
  /** Runs the check: live lookups for its catalog songs, then the report, compared with the last one on the same songs. */
  function runCheck(scope: ReportScope) {
    // Step 3: the scan runs the live lookups while its vitals tick over, then hands to the diagnosis.
    setView({ kind: "scan", scope, baseline: reports?.find((r) => sameScope(r.scope, scope)) ?? null });
    setPendingSave(true);
    const ids = new Set(rowsIn(scope).map(({ r }) => r.track.id));
    void runAll((tracks ?? []).filter((t) => ids.has(t.id)), false);
    top();
  }
  // A visit opened with nothing catalogued starts on the first song. Once an intake brings songs in, the check must
  // cover them instead of staying on an empty scope (which left "Run my Royalty Health Check" disabled).
  useEffect(() => {
    if (view.kind !== "checkin" || view.scope.kind !== "outside" || !tracks?.length) return;
    setView({ kind: "checkin", scope: catalogScope(tracks) });
  }, [view, tracks]);
  // Opened from My Catalog: straight to that song's (or release's, or the catalog's) check-in.
  useEffect(() => {
    if (!start || !loaded || !tracks) return;
    if (start.trackId) checkSong(start.trackId, start.release);
    else if (tracks.length) startCheck(catalogScope(tracks));
  }, [start?.nonce, loaded]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Check-in answers are checklist steps; null removes one. */
  function answer(changes: { id: string; steps: Record<string, string | null> }[]) {
    for (const { id, steps } of changes) {
      const cur = statusOf(id), next = { ...cur.steps };
      for (const [k, v] of Object.entries(steps)) { if (v === null) delete next[k]; else next[k] = v; }
      void updateStatus({ ...cur, steps: next });
    }
  }
  /**
   * "No, I'm self-published" or "No, I'm a BMI writer with no publishing company": ticks that answer on songs with no
   * publisher listed. Nothing already entered changes.
   */
  async function selfPublish(ids: string[], key: "selfPublished" | "bmiWriterPublishing" = "selfPublished") {
    try {
      for (const id of ids) {
        const t = allTracks.find((x) => x.id === id);
        if (!t || t.metadata[key] || t.metadata.publishers.some(creditName)) continue;
        const m = { ...t.metadata, [key]: true };
        if (isInspectorSong(id)) {
          const saved = await saveInspectorSong({ title: m.title, artist: m.artist, duration: m.duration, isrc: m.isrc, iswc: m.iswc, writers: m.writers, publishers: m.publishers, selfPublished: m.selfPublished, bmiWriterPublishing: m.bmiWriterPublishing }, id);
          setInspectorSongs((all) => all.map((x) => (x.id === id ? saved : x)));
        } else {
          await saveTrack(m, userId, id);
          setTracks((all) => all?.map((x) => (x.id === id ? { ...x, metadata: m } : x)));
        }
      }
    } catch (e) { toast.error(e instanceof Error ? e.message : "Couldn't save that. Try again."); }
  }

  /** Opens one song's checklist in the Hub. */
  function showSong(id?: string) {
    setView({ kind: "hub" });
    setDeskOpen(true);
    setDesk("checklist");
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
    if (a.kind === "upload") return startCheck(catalogScope(tracks ?? []), undefined, "agencies");
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
    // Read the catalog again as the file is built (founder, 2026-11-12): a default applied or a writer removed a moment
    // ago belongs in the export, not in the copy this page loaded.
    let current = catalogOnly;
    try {
      const byId = new Map((await listTracks()).map((t) => [t.id, t]));
      const fresh = catalogOnly.map((t) => byId.get(t.id)).filter((t): t is CatalogTrack => !!t);
      if (fresh.length) current = fresh;
    } catch { /* the copy on screen */ }
    const held = await downloadAgencyExport(a.agency, current, a.agency === "pro" ? "PRO cheat sheet" : a.agency === "mlc" ? "MLC registration" : "SoundExchange registration");
    if (held.length) toast.warning(`${held.length} song${held.length === 1 ? " was" : "s were"} left out until ${held.length === 1 ? "its" : "their"} writer details are complete.`);
  }

  // Agency lists: the societies this catalog registers with, and the songs that belong on each one's list.
  const listSocieties = useMemo(() => {
    const seen = new Map<string, Society>();
    for (const { c } of checkupRows) for (const st of c.steps) if (st.stage === "register" && st.society) seen.set(st.society.id, st.society);
    // With nothing catalogued yet (a Free account, or a member who starts from their agencies) there is still a list to
    // insert: every society the member's country uses, so the check runs from the file itself.
    if (!seen.size) for (const group of Object.values(country.societies)) for (const x of group ?? []) seen.set(x.id, x);
    return [...seen.values()];
  }, [checkupRows, country]);
  const songsFor = (sid: string) => checkupRows.filter(({ c }) => c.steps.some((st) => st.stage === "register" && st.society?.id === sid)).map(({ r }) => r.track);
  const listSummaries = Object.fromEntries(listSocieties.map((x) => {
    try { const v = statusOf(ACCOUNT_REF).steps[listKey(x.id)]; return [x.id, v ? (JSON.parse(v) as SavedListSummary) : undefined]; } catch { return [x.id, undefined]; }
  }));

  /** Saves an uploaded list's comparison: matches confirm the song, differences and missing songs go to the report. */
  async function applyList(society: Society, result: ListResult, file: string) {
    const at = new Date().toISOString(), key = listKey(society.id);
    const found = new Map([...result.matched, ...result.differences].map((m) => [m.trackId, m]));
    for (const t of songsFor(society.id)) {
      const m = found.get(t.id), cur = statusOf(t.id), steps = { ...cur.steps };
      if (m && !isInspectorSong(t.id)) await mark(t.id, society.id, "found", m.work?.workId || undefined);
      if (m && isInspectorSong(t.id)) { delete steps[`not_listed:${society.id}`]; steps[`found:${society.id}`] = at; }
      if (m && !m.issues.length) delete steps[key];
      else steps[key] = JSON.stringify(m ? { at, issues: m.issues } : { at, missing: true });
      if (JSON.stringify(steps) !== JSON.stringify(cur.steps)) await updateStatus({ ...cur, steps });
    }
    const account = statusOf(ACCOUNT_REF);
    const summary: SavedListSummary = { at, file, works: result.works, matched: result.matched.length, differences: result.differences.length, notListed: result.notListed.length };
    await updateStatus({ ...account, steps: { ...account.steps, [key]: JSON.stringify(summary) } });
  }

  /**
   * "Start this list over" for one society: removes what an uploaded list added — its per-song notes and the
   * confirmations it made — so the right file can replace the wrong one. The catalog and the member's own marks on
   * other societies are untouched.
   */
  async function removeList(society: Society) {
    const key = listKey(society.id);
    const account = statusOf(ACCOUNT_REF);
    const accountSteps = { ...account.steps };
    delete accountSteps[key];
    await updateStatus({ ...account, steps: accountSteps });
    for (const { r } of checkupRows) {
      const cur = statusOf(r.track.id), steps = { ...cur.steps };
      const had = steps[key] !== undefined || (isInspectorSong(r.track.id) && steps[`found:${society.id}`] !== undefined);
      delete steps[key];
      if (isInspectorSong(r.track.id)) delete steps[`found:${society.id}`];
      if (had) await updateStatus({ ...cur, steps });
    }
    // The list's own "found" confirmations live in the repertoire checks; they go with the file that made them.
    for (const c of checks.filter((x) => x.society === society.id && x.status === "found")) {
      try {
        await clearCheck(c.trackId, society.id);
        setChecks((all) => all.filter((x) => !(x.trackId === c.trackId && x.society === society.id)));
      } catch { /* leave it: the next visit can still clear it */ }
    }
  }

  const catalogTracks = useMemo(() => (tracks ?? []).filter((t) => !isInspectorSong(t.id)), [tracks]);
  const artistName = mostCommon(catalogTracks.map((t) => t.artist));
  const cowriters: Cowriter[] = useMemo(() => cowritersMissing(catalogTracks, loadOnboarding(userId)?.legalName ?? "").map((c) => ({ ...c, email: emails.get(nameKey(c.name)) })), [catalogTracks, emails, userId]);
  const answered = ipiRequests.filter((r) => r.status === "answered").length;
  const waiting = ipiRequests.filter((r) => r.status === "pending").length;
  const askCowriter = () => (canCatalog ? setAskOpen(true) : onUpgrade());

  /** Approving a co-writer's answer fills their blank PRO and IPI on each song; nothing already entered changes. */
  async function applyAnswer(r: IpiRequest) {
    if (!r.answer) return;
    let n = 0;
    try {
      for (const s of r.songs) {
        const t = catalogTracks.find((x) => x.id === s.catalog_id);
        const next = t && fillWriter(t.metadata, r.writerName, r.answer);
        if (!t || !next) continue;
        await saveTrack(next, userId, t.id);
        setTracks((all) => all?.map((x) => (x.id === t.id ? { ...x, metadata: next } : x)));
        n++;
      }
      await setIpiRequestStatus(r.id, "applied");
      setIpiRequests((all) => all.map((x) => (x.id === r.id ? { ...x, status: "applied" } : x)));
      toast.success(n ? `Added to ${n} song${n === 1 ? "" : "s"}. Now update the registrations.` : "Those songs already had their PRO and IPI.");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Couldn't update the songs. Try again."); }
  }
  async function dismissRequest(r: IpiRequest) {
    try { await setIpiRequestStatus(r.id, "dismissed"); setIpiRequests((all) => all.map((x) => (x.id === r.id ? { ...x, status: "dismissed" } : x))); }
    catch { toast.error("Couldn't update that request. Try again."); }
  }
  async function resendRequest(r: IpiRequest) {
    try { await sendRequest({ data: { id: r.id, origin: window.location.origin } }); setIpiRequests((all) => all.map((x) => (x.id === r.id ? { ...x, sentAt: new Date().toISOString() } : x))); toast.success(`Sent to ${r.writerName}.`); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Couldn't send it. Try again."); }
  }

  /**
   * A reminder to confirm registrations, six weeks out (new registrations take a few weeks to show). Google Calendar
   * gets its free "add event" link; Apple and Outlook take a calendar file.
   */
  function reminder(calendar: "google" | "ics") {
    const start = new Date(Date.now() + CONFIRM_AFTER_DAYS * 86_400_000);
    const ymd = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, "");
    const end = new Date(start.getTime() + 86_400_000);
    const title = "Confirm your song registrations showed up";
    const details = `Open your Royalty Health Report and run a new checkup: ${window.location.origin}/workspace`;
    if (calendar === "google") {
      const url = `https://calendar.google.com/calendar/render?${new URLSearchParams({ action: "TEMPLATE", text: title, dates: `${ymd(start)}/${ymd(end)}`, details })}`;
      window.open(url, "_blank", "noopener,noreferrer");
      return;
    }
    const ics = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Came Through Audio//Royalty Health Report//EN", "BEGIN:VEVENT",
      `UID:rhr-${Date.now()}@camethroughaudio.com`, `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").slice(0, 15)}Z`,
      `DTSTART;VALUE=DATE:${ymd(start)}`, `DTEND;VALUE=DATE:${ymd(end)}`, `SUMMARY:${title}`, `DESCRIPTION:${details}`, "END:VEVENT", "END:VCALENDAR"].join("\r\n");
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
  }

  async function runOne(trackId: string) {
    setRunning({ done: 0, total: 1, trackId });
    try { await lookup(trackId); } catch { toast.error("The lookup didn't finish. Try again in a moment."); } finally { setRunning(undefined); }
  }

  /** One song at a time, so a big catalog doesn't flood the streaming lookup. */
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
    runningId={running?.trackId} canCatalog={canCatalog} onUpgrade={onUpgrade} onEditInspector={(id) => fixField(id, "")} onDeleteInspector={(id) => void removeInspector(id)} focusRequest={focusRequest} onCheck={checkSong} />;
  const inspector = <div id="quick-check" className="scroll-mt-4 space-y-4">
    {/* Songs checked here, in one clear list (founder: they felt hidden): open, check or remove each. */}
    {inspectorSongs.length > 0 && <div className="rounded-2xl border border-border p-4">
      <div className="mb-2 text-sm font-bold uppercase tracking-widest text-primary">Songs you've inspected · {inspectorSongs.length}</div>
      <ul className="divide-y divide-border">{[...inspectorSongs].sort((a, b) => a.title.localeCompare(b.title)).map((t) => (
        <li key={t.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
          <span className="min-w-0 flex-1 truncate font-semibold">{t.title || "Untitled"}<span className="font-normal text-muted-foreground">{t.artist ? ` · ${t.artist}` : ""}</span></span>
          <Button size="sm" variant="ghost" onClick={() => setEditing(t)}>Edit</Button>
          <Button size="sm" variant="outline" onClick={() => checkSong(t.id)}><Stethoscope />Check</Button>
          <Button size="icon" variant="ghost" aria-label={`Remove ${t.title}`} onClick={() => void confirmAction({ title: `Remove "${t.title || "Untitled"}"?`, text: "It's removed from the Artist Intake Form and your Song Health Checklist. Saved reports stay in Past Royalty Health Reports.", action: "Remove" }).then((ok) => { if (ok) void removeInspector(t.id); })}><Trash2 /></Button>
        </li>
      ))}</ul>
    </div>}
    <RoyaltyInspector onEmbed={onEmbed} onExpert={book} onSave={saveInspector} onRunCheck={(id) => checkSong(id)} editing={editing} onDoneEditing={() => setEditing(undefined)}
      defaults={patient ? { writer: patient.legalName, pro: patient.pro, ipi: patient.ipi } : undefined} />
  </div>;
  const why = (
    <div className="space-y-4">
      {tracks.length > 0 && <MismatchTips />}
    </div>
  );
  const askDialog = <AskCowriterDialog open={askOpen} cowriters={cowriters} artistName={artistName} existing={ipiRequests} onClose={() => setAskOpen(false)}
    onCreated={(r) => setIpiRequests((all) => [r, ...all.filter((x) => x.id !== r.id)])} />;
  const countryPicker = <CountryPicker country={country} onCountry={chooseCountry} />;
  /** Check-in asks the same question in its own words: where the patient is checking in from. */
  const checkinCountry = <CountryPicker country={country} onCountry={chooseCountry} label="Your country" />;

  if (view.kind === "checkin") {
    const rows = rowsIn(view.scope);
    return (
      <HealthCheckIn scope={view.scope} options={scopeOptions(view.from)} onScope={(scope) => setView({ ...view, scope })} rows={rows} countryPicker={checkinCountry}
        signedSheets={signedSheets} onAnswer={answer} onSelfPublished={(ids) => void selfPublish(ids)} onBmiWriter={(ids) => void selfPublish(ids, "bmiWriterPublishing")} onFixField={fixField}
        initialIntake={intakeWanted} onRun={() => runCheck(view.scope)} onBack={() => setView({ kind: "hub" })}
        patient={patient ? { legalName: patient.legalName, summary: patientSummary(patient) } : undefined}
        intake={{
          streaming: <StreamingFastTrack userId={userId} canCatalog={canCatalog} onUpgrade={onUpgrade}
            onUploadAudio={(id) => { if (id) onFixField(id, "audio"); }}
            onSaved={() => { void listTracks().then(setTracks).catch(() => {}); }} />,
          agencies: <AgencyLists allTracks={tracks} userId={userId} societies={listSocieties} songsFor={songsFor} summaries={listSummaries} onApply={applyList} onRemove={removeList} canCatalog={canCatalog}
            onUpgrade={() => onUpgrade()} onExpert={onExpert} onFilled={() => { void listTracks().then(setTracks).catch(() => {}); }} />,
          single: inspector,
        }} />
    );
  }
  if (view.kind === "scan") return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <ClinicArt name="stethoscope" className="hidden h-20 w-36 shrink-0 object-cover sm:block" />
        <div className="min-w-0 flex-1"><OfficeSteps at={2} /></div>
      </div>
      <ClinicalScan busy={!!running} progress={running ? `Looked up ${running.done} of ${running.total} songs on streaming…` : undefined}
        onDone={() => setView({ kind: "report", scope: view.scope, baseline: view.baseline })} />
    </div>
  );
  if (view.kind === "report" && reportRows.length) return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <ClinicArt name="stethoscope" className="hidden h-20 w-36 shrink-0 object-cover sm:block" />
        <div className="min-w-0 flex-1"><OfficeSteps at={3} /></div>
      </div>
      {/* The Music Royalty Doctor is introduced with the report it has ready, and says how to take it home (founder, 2026-11-11). */}
      <div className="flex items-center gap-4 rounded-2xl border border-border bg-card px-4 py-3">
        <DoctorCoat className="h-20 w-20 shrink-0" />
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">Music Royalty Doctor</p>
          <p className="text-lg font-bold">The Music Royalty Doctor has your report ready.</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            See it below. To take it with you, use <b className="text-foreground">Download PDF</b> at the top of the report. It's also filed at the
            Front Desk under <b className="text-foreground">Past Royalty Health Reports</b>, where you can view or download it again.
          </p>
        </div>
      </div>
      <RoyaltyReport checkup={checkup} since={since} prerelease={reportRows.filter(({ c }) => c.prerelease).map(({ r, c }) => ({ id: r.track.id, title: r.track.title || "Untitled", pct: c.pct,
        items: c.steps.filter((s) => s.stage === "release" || (s.stage === "register" && s.id !== "intl")).map((s) => ({ title: s.title, done: s.done, optional: s.optional })) }))} scope={scopeName(view.scope)} onBack={() => setView({ kind: "hub" })} date={new Date().toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })} country={country.name}
        countryPicker={countryPicker} running={!!running} canExport={canExport} onRunCheckup={() => runCheck(view.scope)}
        onPdf={() => { const first = claimFirstBurst("health_report"); void downloadCheckupPdf(checkup, mostCommon(reportRows.map(({ r }) => r.track.artist)), country.name).then(() => { if (first) burstConfetti(); }).catch(() => toast.error("Couldn't create the PDF. Try again.")); }} onAction={(a) => void act(a)} onExpert={book} onReminder={reminder}
        onAskCowriter={canCatalog && cowriters.length ? askCowriter : undefined} />
      {/* Step 4: treatment. Registrations need every writer's PRO and IPI, so the requests live with the prescriptions. */}
      {(ipiRequests.length > 0 || cowriters.length > 0) && canCatalog && (
        <section className="space-y-4 rounded-2xl border border-border bg-card p-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[2px] text-primary">Before you register</p>
            <h3 className="mt-1 text-lg font-bold">Co-writer details</h3>
            <p className="mt-1 max-w-[68ch] text-sm text-muted-foreground">Every registration needs each writer's PRO and IPI. Ask the ones we're missing, and approve what comes back.</p>
          </div>
          <IpiRequestList requests={ipiRequests} onApply={applyAnswer} onDismiss={dismissRequest} onResend={resendRequest} />
          {cowriters.length > 0 && <Button variant="outline" onClick={askCowriter}><Search />Ask a co-writer for their PRO and IPI</Button>}
        </section>
      )}
      {/* PLAN-royalty-health-hub-v2 section 3: the tier cards come after the diagnosis, never before the visit. */}
      {!canCatalog && <UpgradeCards onUpgrade={(id) => onUpgrade(id)} />}
      {askDialog}
      {running && <p className="text-sm text-muted-foreground">Looking up song {running.done + 1} of {running.total} on streaming…</p>}
    </div>
  );

  /** Check In: the whole catalog when there is one; with nothing cataloged yet the visit still opens, on the form. */
  function beginVisit(intake?: IntakeKind) {
    if (tracks?.length) return startCheck(catalogScope(tracks), undefined, intake);
    setIntakeWanted(intake ?? "single");
    setView({ kind: "checkin", scope: { kind: "outside", refs: [], label: "Your first song" } });
    top();
  }

  const runButton = (
    <Button size="lg" variant="secondary" onClick={() => beginVisit()} disabled={!patientReady}>
      <Stethoscope />Run a Royalty Health Check
    </Button>
  );
  // Where you get paid is one of the check-in questions, so the Hub no longer offers it (founder, 2026-11-03).
  // The banner carries its title only (founder, 2026-11-11): its numbers read out in the nurse's vitals, and checking in
  // happens at the Front Desk, so it no longer offers a run button that would walk past the desk.
  const hub = <HealthReport {...actions} report={report} country={country} running={running} canCatalog={canCatalog} onEmbed={onEmbed} pickCountry={false} showScore={false} />;

  async function openPast(r: SavedReport) {
    const snap = await loadSnapshot(r.id).catch(() => null);
    if (snap) setPastOpen({ report: r, snap });
    else toast.error("Couldn't open that report. Try again.");
  }
  async function downloadPast(r: SavedReport, snap?: ReportSnapshot) {
    const s = snap ?? await loadSnapshot(r.id).catch(() => null);
    if (!s) return void toast.error("Couldn't load that report. Try again.");
    // Its own date, so a report downloaded later still says the day it ran (founder, 2026-11-11).
    await downloadCheckupPdf(s.checkup, s.artist, s.country, r.createdAt).catch(() => toast.error("Couldn't create the PDF. Try again."));
  }
  /** A past report, opened from the Front Desk: the same report as the day it ran, with its own Download PDF. */
  const pastDialog = (
    <Dialog open={!!pastOpen} onOpenChange={(o) => { if (!o) setPastOpen(undefined); }}>
      <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto">
        <DialogTitle className="sr-only">Past Royalty Health Report</DialogTitle>
        {pastOpen && <RoyaltyReport checkup={pastOpen.snap.checkup} since={null} date={shortDate(pastOpen.report.createdAt)} country={pastOpen.snap.country}
          scope={scopeName(pastOpen.report.scope)} canExport={canExport}
          onRunCheckup={() => { const scope = pastOpen.report.scope; setPastOpen(undefined); startCheck(scope); }}
          onPdf={() => void downloadPast(pastOpen.report, pastOpen.snap)}
          onAction={(a) => { setPastOpen(undefined); void act(a); }} onExpert={() => { setPastOpen(undefined); book(); }} onReminder={reminder} />}
      </DialogContent>
    </Dialog>
  );

  // Front Desk: the reports already on file, and the checklist to pick back up. Both open in place, not in a dropdown.
  const scoreNow = (scope: ReportScope) => { const rows = rowsIn(scope); return rows.length ? Math.round(rows.reduce((n, { c }) => n + (c.total ? c.done / c.total : 0), 0) / rows.length * 100) : undefined; };
  const latest = reports?.[0];
  const reportsPanel = reports?.length ? (
    <div className="space-y-3">
      {latest && <p className="text-sm text-muted-foreground">Latest: {shortDate(latest.createdAt)} · {scopeName(latest.scope)} · {latest.score}%</p>}
      <ul className="divide-y divide-border">{reports.map((r) => {
        const now = scoreNow(r.scope);
        return (
          <li key={r.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3 text-sm">
            <span className="w-28 shrink-0 font-semibold">{shortDate(r.createdAt)}</span>
            <span className="min-w-0 flex-1"><b className="block">{scopeName(r.scope)}</b><span className="text-muted-foreground">{r.summary.lead ?? "Clean bill of health. Strong pulse."}</span></span>
            <span className="flex gap-1" aria-label="Organ states">{Object.entries(r.summary.organs).map(([id, o]) => <span key={id} title={`${ORGAN_NAME[id as keyof typeof ORGAN_NAME]}: ${STATE_LABEL[o!.state]}`} className={`rr-pill rr-pill-${o!.state} px-2 py-0.5`}>{ORGAN_NAME[id as keyof typeof ORGAN_NAME][0]}</span>)}</span>
            <span className="w-24 text-right"><b>{r.score}%</b>{now !== undefined && now !== r.score && <span className="block text-xs text-muted-foreground">now {now}%</span>}</span>
            {/* View and Download live here and nowhere else (founder, 2026-11-11). Older reports kept only their summary. */}
            {snapshots.has(r.id) ? <>
              <Button size="sm" variant="outline" onClick={() => void openPast(r)}><Eye />View</Button>
              <Button size="sm" variant="outline" onClick={() => void downloadPast(r)}><FileDown />Download PDF</Button>
            </> : <span className="text-xs text-muted-foreground" title="Reports saved before full reports were kept show their summary only.">Summary only</span>}
            <Button size="sm" variant="outline" disabled={now === undefined} onClick={() => startCheck(r.scope)}>Run it again</Button>
            <Button size="icon" variant="ghost" aria-label={`Delete the ${shortDate(r.createdAt)} report`} onClick={() => void removeReport(r)}><Trash2 /></Button>
          </li>
        );
      })}</ul>
    </div>
  ) : (
    <div className="space-y-3 text-sm text-muted-foreground"><p>No reports yet. Check in with the Music Royalty Doctor and every diagnosis is kept here.</p>{runButton}</div>
  );

  /**
   * The Front Desk (founder, 2026-11-11): a picture of the desk until the member walks up to it. Clicking it opens the
   * counter, where everything lives: the Artist File (first-visit intake form, or Edit artist file), Check In, Past Royalty
   * Health Reports and Continue Song Checklist. Check In still waits for the Artist File.
   */
  const deskLink = (on: boolean, onClick: () => void, icon: React.ReactNode, label: string, count: number) => (
    <button type="button" aria-expanded={on} onClick={onClick}
      className={`group inline-flex items-center gap-1.5 text-xs font-semibold hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${on ? "text-primary" : ""}`}>
      <span className="text-muted-foreground group-hover:text-primary">{icon}</span>
      <span className="underline decoration-border underline-offset-4 group-hover:decoration-primary">{label}</span>
      <span className="rounded-full border border-border bg-card px-1.5 py-px text-[10px] font-bold tabular-nums text-muted-foreground">{count}</span>
    </button>
  );
  // Spans, never div/p: a button may only hold phrasing content, and the whole picture is the thing you click.
  const frontDesk = !deskOpen ? (
    <button type="button" onClick={() => setDeskOpen(true)} aria-expanded={false} aria-controls="front-desk-panel" aria-label="Walk up to the Front Desk"
      className="group block w-full overflow-hidden rounded-2xl border border-border bg-card text-left shadow-sm transition hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <span className="block bg-[#F4F5F7]"><ClinicArt name="frontDesk" className="mx-auto h-56 w-auto rounded-none border-0 sm:h-72" /></span>
      <span className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3">
        <span className="block">
          <span className="block text-[10px] font-bold uppercase tracking-[0.18em] text-primary">Front Desk</span>
          <span className="block text-sm font-bold">{patientReady ? "Walk up to the Front Desk" : "First visit? Walk up to the Front Desk"}</span>
          <span className="block text-xs text-muted-foreground">Check In, your Artist File, past reports and your song checklist are all at the desk.</span>
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground group-hover:opacity-90">Go to the desk →</span>
      </span>
    </button>
  ) : (
    <section id="front-desk-panel" aria-labelledby="front-desk" className="overflow-hidden rounded-2xl border border-primary/40 bg-card shadow-sm">
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        <ClinicArt name="frontDesk" className="hidden h-14 w-20 shrink-0 object-cover sm:block" />
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">Front Desk</p>
          <h3 id="front-desk" className="text-base font-bold">Welcome in. Check in here.</h3>
        </div>
        <Button size="icon" variant="ghost" aria-label="Step away from the desk" onClick={() => setDeskOpen(false)}><X /></Button>
      </div>
      <div className="space-y-3 p-4">
        {/* Step 1 of the visit, at the desk where you would hand it over. */}
        <PatientFileCard userId={userId} defaultName={loadOnboarding(userId)?.legalName ?? ""} patient={patient} onSaved={setPatient} />
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <Button className="rounded-full" onClick={() => beginVisit()} disabled={!patientReady}><Stethoscope />Check In</Button>
          {!patientReady && <span className="text-xs text-muted-foreground">Submit your Artist File to check in.</span>}
          {deskLink(desk === "reports", () => setDesk(desk === "reports" ? undefined : "reports"), <FileText className="h-3.5 w-3.5" />, "Past Royalty Health Reports", reports?.length ?? 0)}
          {deskLink(desk === "checklist", () => setDesk(desk === "checklist" ? undefined : "checklist"), <ListChecks className="h-3.5 w-3.5" />, "Continue Song Checklist", report.rows.length)}
        </div>
      </div>
      {desk === "reports" && <div id="past-reports" className="scroll-mt-4 border-t border-border p-4">{reportsPanel}</div>}
      {desk === "checklist" && <div id="song-by-song" className="scroll-mt-4 border-t border-border p-4">
        <p className="mb-3 text-xs text-muted-foreground">{songsLabel(report.rows.length)} · every step, agency by agency · checked against {country.name}.</p>
        {checklist}
      </div>}
      {pastDialog}
    </section>
  );

  const waitingRoom = <div className="space-y-4"><WaitingArea />{why}</div>;

  return (
    <div className="space-y-5">
      {/* The Royalties and Registrations box, score ring and all, opens the screen (founder, 2026-11-03). */}
      {hub}
      {askDialog}
      {frontDesk}
      {/* Music Royalty Doctors: the differences panel lives with the report, open by default (founder, 2026-11-13). */}
      <DifferencesPanel userId={userId} tracks={tracks} societies={listSocieties.map((s) => ({ id: s.id, name: s.name, url: s.url }))} summaries={listSummaries} />
      {waitingRoom}
      {running && <p className="text-sm text-muted-foreground">Looking up song {running.done + 1} of {running.total} on streaming…</p>}
      {editing && (
        <section id="patient-intake-form" className="scroll-mt-4 rounded-2xl border border-border bg-card p-5">
          <p className="text-xs font-semibold uppercase tracking-[2px] text-primary">Artist Intake Form</p>
          <h3 className="mt-1 text-xl font-bold">Edit this song</h3>
          <p className="mt-1 text-sm text-muted-foreground">Saved songs join the Song Health Checklist at the Front Desk.</p>
          <div className="mt-3">{inspector}</div>
        </section>
      )}
    </div>
  );
}

const mostCommon = (values: string[]) => {
  const counts = new Map<string, number>();
  for (const v of values.filter(Boolean)) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
};
const shortDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
const songsLabel = (n: number) => `${n} song${n === 1 ? "" : "s"}`;
