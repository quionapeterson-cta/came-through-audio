import { useEffect, useMemo, useRef, useState } from "react";
import { Activity, ArrowRight, ChevronDown, ChevronUp, FileUp, LifeBuoy, ListPlus, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { confirmAction } from "@/components/ConfirmHost";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { fillPlan, listPeople, personFor, withPeople, type FillPlan, type Person, type PersonChoice } from "@/lib/agency-fill";
import { WRITER_ROLES, type Metadata } from "@/lib/metadata";
import { albumKey, catalogReleases } from "@/lib/release-routing";
import { FILL_RELEASE_TYPES, cacheReleases, mergeRelease, readCachedReleases, releaseKey, withoutCatalog, withoutKeystrokes, type FillRelease } from "@/lib/fill-releases";
import { listFillReleases, rememberFillRelease as saveFillRelease } from "@/lib/fill-releases.functions";
import { loadOnboarding, loadProfile } from "@/lib/artist-profile";
import { saveTrack } from "@/lib/catalog";
import { updateTarget } from "@/lib/ids";
import { clearIntake, readIntake, writeIntake } from "@/lib/intake-session";
import { buildDifferenceRows, issueCase, openDifferenceCount, STORED_LISTS_KEY, STORED_READER } from "@/lib/discrepancy-treatments";
import { agencyKind } from "@/lib/agency-kind";
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
type StoredLists = { byId: Record<string, { file: string; result: ListResult; reader?: number | undefined }>; shownId?: string | undefined };

/** The stored comparison, shared with the Differences panel so both read one key. */
const STORE = STORED_LISTS_KEY;

/** The answers that aren't a catalog release: a work nobody has released yet, and the two instrumental answers (founder, 2026-11-16). */
const UNRELEASED = "unreleased";
const INSTRUMENTAL = "instrumental";
const UNRELEASED_INSTRUMENTAL = "unreleased-instrumental";
/** The release kinds the dropdown groups by, in the order My Catalog lists them. */
const RELEASE_KINDS = ["Single", "EP", "Album"] as const;
/** The answer that opens the type-and-name fields, for a release that isn't in the catalog yet. */
const NEW = "new";
/** A catalogued song's own release: the option that leaves it where it is. */
const CURRENT = "current";

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
  /**
   * Where each ticked song goes (founder, 2026-11-16): a release already in the catalog, Unreleased, or Instrumental.
   * Unanswered is Unreleased, which is where a work that isn't out yet belongs.
   */
  const [placements, setPlacements] = useState<Record<string, string>>({});
  /** The release a catalogued song keeps or moves to when the agency's version is taken (founder, 2026-11-16). */
  const [versionReleases, setVersionReleases] = useState<Record<string, string>>({});
  /** A release typed by hand for one song, before it exists anywhere else. */
  const [drafts, setDrafts] = useState<Record<string, FillRelease>>({});
  /** Releases typed before, kept with the account (founder, 2026-11-16) and copied here for the moments it can't be read. */
  const [remembered, setRemembered] = useState<FillRelease[]>(() => (userId ? readCachedReleases(userId) : []));
  /** Everyone the songs being added name as a writer. The spelling is theirs everywhere; the role is asked per song. */
  const [people, setPeople] = useState<Person[]>([]);
  /** Roles by song, then by person: a co-writer can be the author of one song and the composer of another. */
  const [roles, setRoles] = useState<Record<string, Record<string, string>>>({});
  const [names, setNames] = useState<Record<string, string>>({});
  /** Songs folded away in the "who wrote what" list. It opens with every song showing. */
  const [folded, setFolded] = useState<ReadonlySet<string>>(new Set());
  const inputs = useRef<Record<string, HTMLInputElement | null>>({});
  /** The pending write of a hand-typed release, so a title is saved once it is finished rather than on every keystroke. */
  const remembering = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    if (!userId) return;
    let live = true;
    void listFillReleases()
      .then((list) => { if (!live) return; const clean = withoutKeystrokes(list); setRemembered(clean); cacheReleases(userId, clean); })
      .catch(() => undefined);
    return () => { live = false; };
  }, [userId]);
  useEffect(() => () => { if (remembering.current) clearTimeout(remembering.current); }, []);

  /** The albums and EPs already in this account, offered in the dropdown under each new song. */
  const catalogReleaseList = useMemo(() => catalogReleases(allTracks ?? [], (t) => t.metadata, (t) => t.id), [allTracks]);

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
      const result = compareList(works, songsFor(society.id), agencyKind(society.id), society.name);
      await onApply(society, result, file.name);
      setStored((s) => ({ ...s, byId: { ...s.byId, [society.id]: { file: file.name, result, reader: STORED_READER } } }));
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
    const plan = fillPlan(result, songsFor(society.id), artist, agencyKind(society.id));
    setPicked(Object.fromEntries(plan.creates.map((c) => [workKey(c.work), true])));
    setPlacements({});
    setVersionReleases({});
    setDrafts({});
    // The browser's copy is read through `withoutKeystrokes`, so a list poisoned by half-typed names is cleaned as it is read,
    // and the cleaned copy is written back rather than left in storage (founder, 2026-11-16).
    const cachedReleases = userId ? readCachedReleases(userId) : [];
    setRemembered(cachedReleases);
    if (userId && cachedReleases.length) cacheReleases(userId, cachedReleases);
    // Every song in the dialog is asked about, catalogued ones included, so their writers get the same boxes.
    setPeople(listPeople([...plan.creates.map((c) => c.work), ...plan.duplicates.map((d) => d.work)]));
    setRoles({});
    setNames({});
    setFolded(new Set());
    setFill({ society, plan });
  }
  /** Opens or closes one box in the "who wrote what" list; every box starts open. */
  function toggleFolded(id: string) {
    setFolded((f) => {
      const next = new Set(f);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  /** The metadata a remembered or hand-typed release writes into the song. */
  function releaseMeta(entry: FillRelease): { album?: string; releaseType?: string; instrumental?: boolean } {
    const name = entry.name.trim();
    // An instrumental leaves the album empty: it isn't on the album it was cut from, and filling it in would have the routing
    // treat a version as a release of its own (founder, 2026-11-16).
    if (entry.type === "Instrumental") return { instrumental: true };
    // A named unreleased release keeps its title and claims no release type, so My Catalog still shows it as not out.
    if (entry.type === "Unreleased") return { album: name, releaseType: "" };
    return { album: name, releaseType: entry.type };
  }

  /** The dropdown value for a release typed by hand, so the same entry can be picked again on another song. */
  const customValue = (entry: FillRelease) => (entry.id ? `custom:${entry.id}` : `custom:${releaseKey(entry)}`);

  /** Where one new song goes, from its own dropdown: a catalog release, a typed one, Unreleased, or Instrumental. */
  function placementFor(key: string): { album?: string; releaseType?: string; instrumental?: boolean; unreleased?: boolean; releaseDate?: string } | undefined {
    const value = placements[key] ?? UNRELEASED;
    if (value === UNRELEASED) return undefined;
    // An instrumental is out; an unreleased instrumental has not come out yet, so it carries the flag and claims no date.
    if (value === INSTRUMENTAL) return { instrumental: true, unreleased: false };
    if (value === UNRELEASED_INSTRUMENTAL) return { instrumental: true, unreleased: true, releaseDate: "" };
    if (value === NEW) {
      const draft = drafts[key];
      return draft && draft.name.trim() ? releaseMeta(draft) : undefined;
    }
    if (value.startsWith("custom:")) {
      const wanted = value.slice("custom:".length);
      const entry = remembered.find((r) => (r.id ? r.id === wanted : releaseKey(r) === wanted));
      return entry ? releaseMeta(entry) : undefined;
    }
    const rel = catalogReleaseList.find((r) => `rel:${r.album}` === value);
    return rel ? { album: rel.album, releaseType: rel.kind } : undefined;
  }

  /**
   * Types a release by hand. The song can use it straight away through its draft; the name is remembered, here and on the
   * account, only once typing stops — otherwise "A", "Af", "Aft" each become a release of their own (founder, 2026-11-16).
   */
  function editDraft(key: string, patch: Partial<FillRelease>) {
    const next: FillRelease = { ...(drafts[key] ?? { type: "Single", name: "" }), ...patch };
    setDrafts((all) => ({ ...all, [key]: next }));
    if (remembering.current) clearTimeout(remembering.current);
    if (!next.name.trim() || !userId) return;
    const finished = { type: next.type, name: next.name.trim() } as FillRelease;
    remembering.current = setTimeout(() => {
      // Nothing is remembered until the name settles: the half-typed titles never reach the list or the account.
      setRemembered((list) => { const merged = mergeRelease(list, finished); cacheReleases(userId, merged); return merged; });
      void saveFillRelease({ data: { type: finished.type, name: finished.name } })
        .then((saved) => setRemembered((list) => { const merged = mergeRelease(list, saved); cacheReleases(userId, merged); return merged; }))
        .catch(() => undefined);
    }, 900);
  }

  /**
   * The member's answer for one catalogued song. Nothing is preselected (founder, 2026-11-16): a box with no answer is
   * never written, and the dialog refuses to submit until every catalogued song has one.
   */
  const answerFor = (d: FillPlan["duplicates"][number]) => choices[d.track.id];
  /** The catalogued songs this click writes the agency's version over. */
  const chosenDuplicates = fill ? fill.plan.duplicates.filter((d) => answerFor(d) === "agency") : [];
  /** Catalogued songs still waiting for "keep mine" or "the agency's". */
  const unanswered = fill ? fill.plan.duplicates.filter((d) => !answerFor(d)).length : 0;

  /** The role and spelling answers given for one song, in the shape `withPeople` wants. */
  const chosenFor = (songKey: string): Record<string, PersonChoice> => {
    const chosen: Record<string, PersonChoice> = {};
    for (const p of people) {
      const role = ((roles[songKey] ?? {})[p.key] ?? "").trim();
      const name = names[p.key]?.trim();
      if (role || name) chosen[p.key] = { ...(role ? { role } : {}), ...(name ? { name } : {}) };
    }
    return chosen;
  };

  /** What the agency's version writes for a catalogued song's release: nothing unless the member moved it. */
  function releaseWriteFor(d: FillPlan["duplicates"][number]): Partial<Metadata> {
    const value = versionReleases[d.track.id] ?? CURRENT;
    if (value === CURRENT) return {};
    // An instrumental leaves the release fields empty, as a new instrumental does: it isn't on the album it was cut from.
    if (value === INSTRUMENTAL) return { instrumental: true, unreleased: false, album: "", releaseType: "" };
    // The unreleased pair clears the date too: a flagged song with a past date still reads as released everywhere else.
    if (value === UNRELEASED_INSTRUMENTAL) return { instrumental: true, unreleased: true, album: "", releaseType: "", releaseDate: "" };
    const rel = catalogReleaseList.find((r) => `rel:${r.album}` === value);
    return rel ? { album: rel.album, releaseType: rel.kind } : {};
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
      for (const c of adding) {
        const key = workKey(c.work);
        // The role answers are this song's own, so one person can be the author here and the composer there. The spelling
        // a member picked for a person is theirs on every song.
        const withRoles = withPeople(c.metadata, people, chosenFor(key));
        // The release each song was given is written with it, so My Catalog files it where the member put it.
        await saveTrack({ ...withRoles, ...(placementFor(key) ?? {}) }, userId);
      }
      let replaced = 0;
      // Only a catalogued song the member answered with the agency's version is written, and the roles they verified
      // and the release they chose travel with it (founder, 2026-11-16).
      for (const d of fill.plan.duplicates) {
        if (answerFor(d) !== "agency") continue;
        await saveTrack({ ...withPeople(d.agency, people, chosenFor(d.track.id)), ...releaseWriteFor(d) }, userId, updateTarget(d.track.id));
        replaced += 1;
      }
      const added = adding.length;
      const placedAny = adding.some((c) => workKey(c.work) in placements);
      const kept = fill.plan.duplicates.filter((d) => answerFor(d) === "keep").length;
      toast.success(
        `${added ? `${added} song${added === 1 ? "" : "s"} added to My Catalog` : "No new songs added"}${replaced ? `, ${replaced} replaced with the agency's version` : ""}. ` +
        (kept ? `${kept} kept as yours, so ${fill.society.name} still needs updating to match. ` : "") +
        (placedAny
          ? "Each song was filed where you put it; the list still leaves the release date, genre and duration for you in My Catalog."
          : "Each new entry is Unreleased. Give it a release in My Catalog when it is out."),
        { duration: 12000 },
      );
      // The works just added are no longer "on the list but not in the catalog", so the offer can't run twice; a song
      // replaced with the agency's version is no longer different either, so the report stops naming it.
      const justAdded = new Set(adding.map((c) => c.work));
      const settled = new Set(fill.plan.duplicates.filter((d) => answerFor(d) === "agency").map((d) => d.track.id));
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
  /** A hand-typed release with no name can't be filed, so the add button waits for it. */
  const newReleaseUntitled = chosenCreates.some((c) => {
    const key = workKey(c.work);
    return (placements[key] ?? UNRELEASED) === NEW && !(drafts[key]?.name ?? "").trim();
  });
  /**
   * Every song the dialog is filling, in one list (founder, 2026-11-16): the works the catalog doesn't have yet, and
   * the catalogued songs a difference puts in front of the member. Each one carries every question it asks.
   */
  type FillSong = { key: string; work: ListWork; metadata: Metadata; duplicate?: FillPlan["duplicates"][number] };
  const songs: FillSong[] = fill ? [
    ...fill.plan.creates.map((c) => ({ key: workKey(c.work), work: c.work, metadata: c.metadata })),
    ...fill.plan.duplicates.map((d) => ({ key: d.track.id, work: d.work, metadata: d.track.metadata, duplicate: d })),
  ] : [];
  const listWriters = (c: FillSong) => c.work.writers.filter((w) => w.name.trim());
  /** The answer key for a writer name: the person, whichever spelling the list used, or the name itself. */
  const keyOfName = (name: string) => personFor(people, name)?.key ?? name;
  /** How many of these songs each writer is on, counted once per song however the list repeats them. */
  const songCount = new Map<string, number>();
  for (const c of songs) {
    const seen = new Set<string>();
    for (const w of listWriters(c)) {
      const key = keyOfName(w.name);
      if (seen.has(key)) continue;
      seen.add(key);
      songCount.set(key, (songCount.get(key) ?? 0) + 1);
    }
  }
  /** A writer credited on two or more songs gets a box of their own, holding every song they are on. */
  const coWriters = people.filter((p) => (songCount.get(p.key) ?? 0) >= 2);
  const sharesAWriter = (c: FillSong) => listWriters(c).some((w) => (songCount.get(keyOfName(w.name)) ?? 0) >= 2);
  /** Which box asks the release for each new song: the first writer box that lists it, so a song never shows two dropdowns. */
  const releaseHome = new Map<string, string>();
  for (const p of coWriters) {
    for (const c of songs) {
      if (releaseHome.has(c.key)) continue;
      if (listWriters(c).some((w) => keyOfName(w.name) === p.key)) releaseHome.set(c.key, p.key);
    }
  }
  /** Songs with no repeat writer still show every role, so they are listed by song instead. */
  const loneSongs = songs.filter((c) => !sharesAWriter(c));
  /** A catalogued song asks its writer and release questions only once the member takes the agency's version. */
  const questionsOpen = (c: FillSong) => !c.duplicate || answerFor(c.duplicate) === "agency";
  const answeredIn = (list: FillSong[]) => list.filter(questionsOpen).reduce((n, c) => {
    const answers = roles[c.key] ?? {};
    return n + listWriters(c).filter((w) => (answers[keyOfName(w.name)] ?? "").trim()).length;
  }, 0);
  const writersIn = (list: FillSong[]) => list.filter(questionsOpen).reduce((n, c) => n + listWriters(c).length, 0);

  /**
   * One writer's answer on one song. Every song shows all of its writers, so the member answering a co-writer can see who
   * else is on that song and give each of them a role without leaving it (founder, 2026-11-16).
   */
  const roleRow = (c: FillSong, name: string, ipi = "", pro = "", share?: number, owner = false) => {
    const songKey = c.key;
    const who = keyOfName(name);
    const role = (roles[songKey] ?? {})[who] ?? "";
    const shown = names[who] ?? name;
    const facts = [share !== undefined ? `${share}%` : "", ipi ? `IPI ${ipi}` : "", pro].filter(Boolean).join(" · ");
    return <li key={`${songKey}:${name}`} className={`flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-md px-2 py-1 ${owner ? "bg-accent/30" : ""}`}>
      <span className="min-w-0">
        <span className="text-sm">{shown}</span>
        {facts && <span className="ml-2 text-[11px] text-muted-foreground">{facts}</span>}
      </span>
      <span className="flex shrink-0 flex-wrap gap-1">
        {WRITER_ROLES.map((r) => <button key={r} type="button" aria-pressed={role === r}
          aria-label={`${shown} on ${c.metadata.title}: ${r === "Author/Composer" ? "Both" : r}`}
          onClick={() => setRoles((x) => ({ ...x, [songKey]: { ...(x[songKey] ?? {}), [who]: role === r ? "" : r } }))}
          className={`rounded-full border px-2.5 py-0.5 text-xs ${role === r ? "border-primary bg-primary font-semibold text-primary-foreground" : "border-border"}`}>
          {r === "Author/Composer" ? "Both" : r}
        </button>)}
      </span>
    </li>;
  };

  /**
   * A song's release, asked in the same card as its writers (founder, 2026-11-16). One dropdown holds every answer: the
   * instruction line while nothing is picked, then Unreleased, the instrumentals and Add a release, then the catalog's own
   * releases (founder, 2026-11-16).
   */
  const releaseControl = (c: FillSong, show = true, owner?: string) => {
    const key = c.key;
    const value = placements[key] ?? UNRELEASED;
    const draft = drafts[key] ?? { type: "Single" as const, name: "" };
    // A release the catalog already lists is offered from the catalog, so a remembered title can't appear twice.
    const typed = withoutCatalog(remembered, catalogReleaseList);
    const single = value.startsWith("rel:") ? catalogReleaseList.find((r) => `rel:${r.album}` === value && r.kind === "Single") : undefined;
    if (!show) {
      // The same song in a second writer's box: the answer stays visible, but the question is asked once.
      const home = (owner && (names[owner] ?? people.find((p) => p.key === owner)?.names[0])) || "the first box";
      return <p className="mt-1 border-t border-border/60 px-1 pt-1.5 text-[11px] text-muted-foreground">
        Release: <span className="font-semibold">{releaseLabel(value, draft, single)}</span> · set in {home}'s box
      </p>;
    }
    return <div className="mt-1 space-y-1 border-t border-border/60 px-1 pt-1.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Release</span>
        <select aria-label={`Release for ${c.metadata.title}`} value={placements[key] ?? ""}
          onChange={(e) => {
            const next = e.target.value;
            setPlacements((p) => ({ ...p, [key]: next }));
            if (next === NEW) setDrafts((d) => ({ ...d, [key]: d[key] ?? { type: "Single", name: "" } }));
          }}
          className="h-8 max-w-[16rem] rounded-md border border-input bg-background px-2 text-xs">
          <option value="">Choose a release…</option>
          <option value={UNRELEASED}>Unreleased</option>
          <optgroup label="Not in my catalog">
            <option value={INSTRUMENTAL}>Instrumental</option>
            <option value={UNRELEASED_INSTRUMENTAL}>Unreleased Instrumental</option>
          </optgroup>
          <option value={NEW}>Add a release…</option>
          {RELEASE_KINDS.map((k) => {
            const list = catalogReleaseList.filter((r) => r.kind === k);
            if (!list.length) return null;
            return <optgroup key={k} label={`${k}s`}>
              {list.map((r) => <option key={r.album} value={`rel:${r.album}`}>{r.album}</option>)}
            </optgroup>;
          })}
          {typed.length > 0 && <optgroup label="You added">
            {typed.map((r) => <option key={customValue(r)} value={customValue(r)}>{r.name} · {r.type}</option>)}
          </optgroup>}
        </select>
      </div>
      {single && <p className="text-[11px] text-muted-foreground">
        A single holds one song: adding this to {single.album} makes it a two-song release, which My Catalog reads as an EP.
      </p>}
      {value === NEW && <div className="grid gap-1 sm:grid-cols-[8.5rem_1fr]">
        <select aria-label={`Release type for ${c.metadata.title}`} value={draft.type} onChange={(e) => editDraft(key, { type: e.target.value as FillRelease["type"] })}
          className="h-8 rounded-md border border-input bg-background px-2 text-xs">
          {FILL_RELEASE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <input aria-label={`Release name for ${c.metadata.title}`} value={draft.name} placeholder="Name it once, then reuse it on the next song"
          onChange={(e) => editDraft(key, { name: e.target.value })}
          className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs" />
      </div>}
    </div>;
  };

  /** How a song's release reads in the box that doesn't ask the question. */
  function releaseLabel(value: string, draft: FillRelease, single: { album: string } | undefined): string {
    if (value === UNRELEASED) return "Unreleased";
    if (value === INSTRUMENTAL) return "Instrumental";
    if (value === UNRELEASED_INSTRUMENTAL) return "Unreleased Instrumental";
    if (value === NEW) return draft.name.trim() ? `${draft.name.trim()} · ${draft.type}` : "no release named yet";
    if (single) return single.album;
    const rel = catalogReleaseList.find((r) => `rel:${r.album}` === value);
    if (rel) return `${rel.album} · ${rel.kind}`;
    const custom = remembered.find((r) => customValue(r) === value);
    return custom ? `${custom.name} · ${custom.type}` : "Unreleased";
  }

  /**
   * One song, in one box (founder, 2026-11-16). A new work shows its writers and release. A catalogued song shows the whole
   * comparison and the two answers first; only the agency's version opens the writers and the release for verification.
   */
  const songBlock = (c: FillSong, owner?: string, askRelease = true) => {
    const d = c.duplicate;
    const answer = d ? answerFor(d) : undefined;
    const answers = roles[c.key] ?? {};
    const writers = listWriters(c);
    const done = writers.filter((w) => (answers[keyOfName(w.name)] ?? "").trim()).length;
    return <li key={c.key} className="rounded-md border border-border/60 p-1.5">
      <div className="flex flex-wrap items-baseline justify-between gap-2 px-1">
        <span className="min-w-0 truncate text-sm font-semibold">{d ? d.track.title : c.metadata.title}</span>
        <span className="shrink-0 text-[11px] text-muted-foreground">
          {d ? "Already in your catalog" : `${done}/${writers.length} answered`}
        </span>
      </div>
      {d && <>
        {/* The whole comparison, never trimmed: the answer is made from the record itself. */}
        <div className="mt-1 border-t border-border/60 px-1 pt-1.5 text-xs">
          {/* Side by side from sm up; on a phone each field stacks, and both values say which side they are. */}
          <div className="hidden grid-cols-[4.5rem_minmax(0,1fr)_minmax(0,1fr)] items-start gap-x-2 sm:grid">
            <span />
            <span className="font-semibold leading-snug">Your catalog</span>
            <span className="flex flex-wrap items-center gap-1.5 font-semibold leading-snug">The agency
              <span className="rounded-full border border-primary/30 bg-accent/50 px-1.5 py-px text-[10px] font-semibold">{fill?.society.name}</span>
            </span>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-[4.5rem_minmax(0,1fr)_minmax(0,1fr)] sm:items-start sm:gap-x-2 sm:gap-y-1.5">
            {d.changes.map((ch) => <div key={ch.field} className="flex flex-col gap-0.5 sm:contents">
              <span className="text-muted-foreground">{ch.field}</span>
              <span className="flex flex-wrap gap-x-1 leading-snug">
                <span className="text-muted-foreground sm:hidden">Your catalog:</span>
                <span className="min-w-0 break-words">{ch.catalog}</span>
              </span>
              <span className="flex flex-wrap gap-x-1 leading-snug">
                <span className="text-muted-foreground sm:hidden">The agency:</span>
                <span className="min-w-0 break-words">{ch.agency}</span>
              </span>
            </div>)}
          </div>
          {combinedHalves(d.work) && <p className="mt-2 text-xs text-muted-foreground">
            {fill?.society.name} prints the writer's half and the publisher's half together, so {listShareTotal(d.work)}% there is 100% of the composition. The share above is shown on the 100% scale.
          </p>}
          {d.issues.length > 0 && <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">
            {d.issues.map((i) => <li key={i}>⚠️ {i}</li>)}
          </ul>}
        </div>
        {/* The answer, with nothing preselected: keep yours, or take the agency's. */}
        <div className="mt-1 space-y-1.5 border-t border-border/60 px-1 pt-1.5">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <label className={`flex cursor-pointer items-start gap-2 rounded-lg border p-2 text-xs ${answer === "keep" ? "border-primary bg-accent/40" : "border-border"}`}>
              <input type="radio" className="mt-0.5" name={`fill-${d.track.id}`} aria-label="Keep my catalog version"
                checked={answer === "keep"} onChange={() => setChoices((x) => ({ ...x, [d.track.id]: "keep" }))} />
              <span>
                <b>Keep my catalog version</b>
                <span className="block text-muted-foreground">Nothing changes here, so update your registration at {fill?.society.name} to match it.</span>
              </span>
            </label>
            <label className={`flex cursor-pointer items-start gap-2 rounded-lg border p-2 text-xs ${answer === "agency" ? "border-primary bg-accent/40" : "border-border"}`}>
              <input type="radio" className="mt-0.5" name={`fill-${d.track.id}`} aria-label="Use the agency's version"
                checked={answer === "agency"} onChange={() => setChoices((x) => ({ ...x, [d.track.id]: "agency" }))} />
              <span>
                <b>Use the agency's version</b>
                <span className="block text-muted-foreground">Check that it's correct: your catalog then matches what {fill?.society.name} has registered.</span>
              </span>
            </label>
          </div>
          {answer === "keep" && <p className="text-xs text-muted-foreground">
            Keeping this one leaves the difference in place at {fill?.society.name}.
          </p>}
          {!answer && <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span aria-hidden>🔒</span> Who wrote what and the release open once you choose the agency's version.
          </p>}
        </div>
      </>}
      {(!d || answer === "agency") && <>
        <div className="mt-1 border-t border-border/60 px-1 pt-1.5">
          <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Who wrote what</span>
        </div>
        <ul className="mt-0.5 space-y-0.5">{writers.map((w) => roleRow(c, w.name, w.ipi, w.pro, w.share, keyOfName(w.name) === owner))}</ul>
        {d ? versionReleaseControl(d) : releaseControl(c, askRelease, owner)}
        {d && !!(d.track.metadata.audioPath || d.track.metadata.artPath || d.track.metadata.coverThumb) && <p className="mt-1 px-1 text-[11px] text-muted-foreground">
          Your master and artwork stay attached. Re-embed this song in My Catalog afterwards, so the file itself carries the corrected credits, ISRC and ISWC.
        </p>}
      </>}
    </li>;
  };

  /** A catalogued song's release, shown once the agency's version is chosen: it stays where it is unless moved. */
  const versionReleaseControl = (d: FillPlan["duplicates"][number]) => {
    const value = versionReleases[d.track.id] ?? CURRENT;
    const album = d.track.metadata.album.trim();
    const kind = d.track.metadata.releaseType.trim();
    return <div className="mt-1 flex flex-wrap items-center justify-between gap-2 border-t border-border/60 px-1 pt-1.5">
      <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Release</span>
      <select aria-label={`Release for ${d.track.title}`} value={value}
        onChange={(e) => setVersionReleases((r) => ({ ...r, [d.track.id]: e.target.value }))}
        className="h-8 max-w-[16rem] rounded-md border border-input bg-background px-2 text-xs">
        <option value={CURRENT}>{album ? `${album}${kind ? ` · ${kind}` : ""}` : "Unreleased"} · stays as it is</option>
        {RELEASE_KINDS.map((k) => {
          const list = catalogReleaseList.filter((r) => r.kind === k);
          if (!list.length) return null;
          return <optgroup key={k} label={`${k}s`}>{list.map((r) => <option key={r.album} value={`rel:${r.album}`}>{r.album}</option>)}</optgroup>;
        })}
        <optgroup label="Not in my catalog">
          <option value={INSTRUMENTAL}>Instrumental</option>
          <option value={UNRELEASED_INSTRUMENTAL}>Unreleased Instrumental</option>
        </optgroup>
      </select>
    </div>;
  };

  /** The registered spellings of a writer who appears under two names; one choice covers every song they are on. */
  const spellingRow = (p: Person) => p.names.length < 2 ? null : <div className="mb-1 flex flex-wrap items-center gap-1">
    <span className="text-[11px] text-muted-foreground">Same writer, spelled:</span>
    {p.names.map((n) => <button key={n} type="button" aria-pressed={(names[p.key] ?? p.names[0]) === n} onClick={() => setNames((x) => ({ ...x, [p.key]: n }))}
      className={`rounded-full border px-2 py-0.5 text-[11px] ${(names[p.key] ?? p.names[0]) === n ? "border-primary bg-accent/40 font-semibold text-primary" : "border-border text-muted-foreground"}`}>{n}</button>)}
  </div>;

  /** A box per writer credited on two or more songs, open by default, holding each of those songs. */
  const writerBox = (p: Person) => {
    const held = songs.filter((c) => listWriters(c).some((w) => keyOfName(w.name) === p.key));
    const id = `w:${p.key}`;
    const open = !folded.has(id);
    const openWriters = writersIn(held);
    return <li key={id} className="rounded-lg border border-border/70">
      <button type="button" aria-expanded={open} aria-label={`${open ? "Hide" : "Show"} the songs ${p.names[0]} is on`} onClick={() => toggleFolded(id)}
        className="flex w-full flex-wrap items-center justify-between gap-x-2 gap-y-0.5 px-2 py-1.5 text-left">
        <span className="min-w-0">
          <span className="truncate text-sm font-semibold">{names[p.key] ?? p.names[0]}</span>
          <span className="ml-1.5 whitespace-nowrap text-[11px] text-muted-foreground">{held.length} songs</span>
        </span>
        <span className="flex shrink-0 items-center gap-2 whitespace-nowrap text-[11px] text-muted-foreground">
          {openWriters > 0 && `${answeredIn(held)}/${openWriters} answered`}
          {open ? <ChevronUp className="h-3.5 w-3.5" aria-hidden /> : <ChevronDown className="h-3.5 w-3.5" aria-hidden />}
        </span>
      </button>
      {open && <div className="px-2 pb-2">
        {spellingRow(p)}
        <ul className="space-y-1.5">{held.map((c) => songBlock(c, p.key, releaseHome.get(c.key) === p.key))}</ul>
      </div>}
    </li>;
  };

  /** Everyone credited on a single song, still answered song by song with all of that song's writers showing. */
  const loneBox = (() => {
    if (!loneSongs.length) return null;
    const id = "w:lone";
    const open = !folded.has(id);
    return <li key={id} className="rounded-lg border border-border/70">
      <button type="button" aria-expanded={open} aria-label={`${open ? "Hide" : "Show"} the songs with no shared writer`} onClick={() => toggleFolded(id)}
        className="flex w-full flex-wrap items-center justify-between gap-x-2 gap-y-0.5 px-2 py-1.5 text-left">
        <span className="min-w-0">
          <span className="truncate text-sm font-semibold">{people.length > 0 ? "Songs with no shared writer" : "Recordings on this list"}</span>
          <span className="ml-1.5 whitespace-nowrap text-[11px] text-muted-foreground">{loneSongs.length} songs</span>
        </span>
        <span className="flex shrink-0 items-center gap-2 whitespace-nowrap text-[11px] text-muted-foreground">
          {writersIn(loneSongs) > 0 && `${answeredIn(loneSongs)}/${writersIn(loneSongs)} answered`}
          {open ? <ChevronUp className="h-3.5 w-3.5" aria-hidden /> : <ChevronDown className="h-3.5 w-3.5" aria-hidden />}
        </span>
      </button>
      {open && <ul className="space-y-1.5 px-2 pb-2">{loneSongs.map((c) => songBlock(c))}</ul>}
    </li>;
  })();


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
              <ul className="mt-1 space-y-1 text-sm">{shownResult.differences.map((m) => <li key={m.trackId}><b>{m.title}</b><span className="block text-xs text-muted-foreground">{m.issues.map(issueCase).join(" · ")}</span></li>)}</ul></div>
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
                  {[...new Set(c.issues.map(issueCase))].map((issue) => <li key={issue}>{issue}</li>)}
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
          <div className="rounded-2xl border border-[#004AAD]/25 bg-[#004AAD]/[0.04] p-3 dark:border-[#4D8CFF]/30 dark:bg-[#4D8CFF]/[0.08]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-[#4D8CFF]/40 bg-white text-[#004AAD] dark:border-[#4D8CFF]/45 dark:bg-[#141414] dark:text-[#4D8CFF]">
                  <Activity className="h-4 w-4" aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#004AAD] dark:text-[#4D8CFF]">Music Royalty Doctors · Diagnostic handoff</p>
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
              {fill.plan.duplicates.length > 0 && ` ${fill.plan.duplicates.length} catalogued song${fill.plan.duplicates.length === 1 ? " matches" : "s match"} the list with different details; each box asks which version is official.`}
              {" "}You finish the rest — release date, genre, duration — in My Catalog.
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
            {/* Every agency's list fills the same way (founder, 2026-11-16): one box per song, holding every question that
                song asks — the writers' roles, its release, and, for a song already catalogued, which version is official. */}
            {songs.length > 0 && <fieldset className="space-y-2 rounded-xl border border-border p-3">
              <legend className="px-1 text-sm font-bold">Who wrote what, where each song belongs, and which version is official</legend>
              <p className="text-xs text-muted-foreground">
                The list names every writer but never says who wrote the words and who wrote the music, or which release each work
                came out on. A writer credited on two or more songs has a box of their own, open with every song they are on, and every
                question about a song sits in that song's box. A song already in your catalog shows the whole comparison first: answer
                keep yours or take the agency's, and only the agency's version opens the writers and the release for checking. A
                release that isn't in your catalog yet can be typed under a new song: name it once and the next song offers it back.
                Anything left blank stays blank, and the song says it still needs it.
              </p>
              {!people.length && <p className="text-xs text-muted-foreground">
                This agency registers the recording, so its list names no writers. Each one still gets the same release answer as a
                list that does.
              </p>}
              {fill.plan.duplicates.length > 0 && <div className="flex flex-wrap items-center gap-2 rounded-lg border border-primary/40 bg-accent/30 p-2">
                <span className="mr-auto text-[11px] text-muted-foreground">Every catalogued song needs an answer — or give them all the same one:</span>
                <button type="button" onClick={() => setChoices(Object.fromEntries(fill.plan.duplicates.map((d) => [d.track.id, "keep" as const])))}
                  className="rounded-full border border-border bg-background px-3 py-1 text-[11px] font-semibold">
                  Keep my version for all {fill.plan.duplicates.length}
                </button>
                <button type="button" onClick={() => setChoices(Object.fromEntries(fill.plan.duplicates.map((d) => [d.track.id, "agency" as const])))}
                  className="rounded-full border border-primary/40 bg-accent/40 px-3 py-1 text-[11px] font-semibold text-primary">
                  Use the agency's version for all {fill.plan.duplicates.length}
                </button>
              </div>}
              <ul className="space-y-2">
                {coWriters.map(writerBox)}
                {loneBox}
              </ul>
            </fieldset>}
            {onExpert && fill.plan.duplicates.some((d) => answerFor(d) === "keep") && <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-primary/40 bg-accent/30 p-3 text-sm">
              <span>We can update those registrations for you, so the agency matches the version you kept.</span>
              <Button type="button" size="sm" variant="outline" disabled={filling} onClick={onExpert}><LifeBuoy />Get expert help</Button>
            </div>}
            <div className="flex flex-wrap items-center justify-end gap-2">
              {unanswered > 0 && <p className="mr-auto text-xs text-muted-foreground">
                {unanswered} catalogued song{unanswered === 1 ? " still needs" : "s still need"} an answer: keep yours or take the agency&apos;s.
              </p>}
              <Button type="button" variant="ghost" disabled={filling} onClick={() => setFill(undefined)}>Cancel</Button>
              {/* One button does both, and names both (founder, 2026-11-16): the same click adds the new songs and
                  writes the agency's version over the catalogued ones. It waits for every catalogued song's answer. */}
              <Button type="button" disabled={filling || newReleaseUntitled || unanswered > 0 || (!chosenCreates.length && !chosenDuplicates.length)} onClick={() => void runFill()}>
                {filling ? <Loader2 className="animate-spin" /> : <ListPlus />}
                {chosenCreates.length && chosenDuplicates.length
                  ? `Add ${chosenCreates.length} and update ${chosenDuplicates.length}`
                  : chosenCreates.length ? `Add ${chosenCreates.length} song${chosenCreates.length === 1 ? "" : "s"}`
                    : chosenDuplicates.length ? `Update ${chosenDuplicates.length} song${chosenDuplicates.length === 1 ? "" : "s"}`
                      : "Add or update songs"}
              </Button>
            </div>
          </>}
        </DialogContent>
      </Dialog>
    </div>
  );
}
