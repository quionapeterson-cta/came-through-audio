import { hasPro, isIpi, publisherCovered } from "@/lib/audit";
import type { TrackReport } from "@/lib/health";
import type { SongChecklist } from "@/lib/health-checklist";
import type { SongStatus } from "@/lib/health-songs";
import { creditName, type Contributor, type Metadata } from "@/lib/metadata";
import { registrationCheck } from "@/lib/readiness";
import type { Society } from "@/lib/repertoires";
import { splitStatus } from "@/lib/splits-total";

/**
 * The Royalty Health Report: the catalog read as a body, one organ per way music gets paid (PLAN-royalty-health-report §2).
 * Pure: it only reads the song reports, their checklists (the shared registrationCheck lives behind those) and the
 * signed split sheets, then words each finding as Diagnosis → Cause → Treatment. Every treatment ends at the agency.
 */
export type OrganId = "heart" | "lungs" | "kidneys" | "brain" | "spine" | "pulse";
export type OrganState = "healthy" | "watch" | "treat" | "noflow";
export type ConditionId =
  | "noheart" | "broken" | "artery-left" | "artery-right"
  | "lungs-hold" | "lungs-one" | "kidney-none" | "kidney-one"
  | "brain-fog" | "brain-mixed" | "brain-double" | "brain-tag"
  | "spine-align" | "spine-back" | "pulse-skip" | "pulse-faint";

/** What a treatment step's button does. `agency` picks the one-click file: the PRO cheat sheet, The MLC or SoundExchange. */
export type StepAction =
  | { kind: "field"; trackId: string; field: string }
  | { kind: "download"; agency: "pro" | "mlc" | "soundexchange" }
  | { kind: "portal"; url: string; name: string }
  | { kind: "tick" }
  | { kind: "split"; trackId: string }
  | { kind: "join" }
  | { kind: "distributor"; trackId: string }
  | { kind: "changes"; trackId: string }
  | { kind: "upload" };
export type TreatmentStep = { title: string; text: string; action?: StepAction | undefined };
export type AffectedSong = { id: string; title: string; why: string; field?: string | undefined; registration?: boolean };
export type Finding = {
  id: ConditionId;
  organ: OrganId;
  severity: "treat" | "watch";
  songs: AffectedSong[];
  dx: string;
  what: string;
  symptom: string;
  cause: string;
  steps: TreatmentStep[];
  note?: string;
  /** A short label for the scan picture's caption and the songs list. */
  scan: ConditionId;
};
export type Organ = { id: OrganId; name: string; system: string; state: OrganState; findings: Finding[]; checks: string[]; broken: boolean };
export type Checkup = { score: number; songs: number; organs: Organ[]; lead: Finding | null; rhythm: OrganState };

export const ORGAN_ORDER: OrganId[] = ["heart", "lungs", "kidneys", "brain", "spine", "pulse"];
export const ORGAN_NAME: Record<OrganId, string> = { heart: "Heart", lungs: "Lungs", kidneys: "Kidneys", brain: "Brain", spine: "Spine", pulse: "Pulse" };
export const STATE_LABEL: Record<OrganState, string> = { healthy: "Healthy", watch: "Watch", treat: "Needs treatment", noflow: "No flow" };

/** Agency portals for the "Register at …" step. Other societies use their own site. */
const PORTAL: Record<string, { name: string; url: string }> = {
  ascap: { name: "ASCAP Member Access", url: "https://www.ascap.com/" },
  bmi: { name: "BMI Online Services", url: "https://www.bmi.com/" },
  mlc: { name: "The MLC Portal", url: "https://portal.themlc.com/" },
  soundexchange: { name: "SoundExchange Direct", url: "https://www.soundexchange.com/" },
};
const portal = (s: Society) => PORTAL[s.id] ?? { name: `your ${s.name} account`, url: s.url };

/** Most serious first; ties in the lead go to the finding touching the most songs, then this order. */
const PRIORITY: ConditionId[] = ["noheart", "broken", "artery-left", "artery-right", "spine-align", "brain-double", "lungs-hold", "kidney-none",
  "pulse-skip", "lungs-one", "kidney-one", "brain-mixed", "brain-tag", "brain-fog", "spine-back", "pulse-faint"];
const SEVERITY: Record<ConditionId, "treat" | "watch"> = {
  noheart: "treat", broken: "treat", "artery-left": "treat", "artery-right": "treat", "spine-align": "treat", "brain-double": "treat", "lungs-hold": "treat", "kidney-none": "treat",
  "pulse-skip": "watch", "lungs-one": "watch", "kidney-one": "watch", "brain-mixed": "watch", "brain-tag": "watch", "brain-fog": "watch", "spine-back": "watch", "pulse-faint": "watch",
};
const ORGAN_OF: Record<ConditionId, OrganId> = {
  noheart: "heart", broken: "heart", "artery-left": "heart", "artery-right": "heart", "lungs-hold": "lungs", "lungs-one": "lungs", "kidney-none": "kidneys", "kidney-one": "kidneys",
  "brain-fog": "brain", "brain-mixed": "brain", "brain-double": "brain", "brain-tag": "brain", "spine-align": "spine", "spine-back": "spine", "pulse-skip": "pulse", "pulse-faint": "pulse",
};
/** New registrations usually show up within a few weeks; after six, an unconfirmed one is worth a look. */
export const CONFIRM_AFTER_DAYS = 42;

export type CheckupInput = {
  rows: { r: TrackReport; c: SongChecklist; status?: SongStatus | undefined }[];
  /** Catalog id → whether every named collaborator on its split sheet has signed. Missing = no sheet. */
  signedSheets?: Map<string, boolean> | undefined;
  today?: string;
};

const songs = (n: number) => `${n} song${n === 1 ? "" : "s"}`;
const recs = (n: number) => `${n} recording${n === 1 ? "" : "s"}`;
const names = (list: AffectedSong[]) => list.map((s) => `"${s.title}"`);
const plain = (list: string[]) => (list.length < 3 ? list.join(" and ") : `${list.slice(0, -1).join(", ")} and ${list.at(-1)}`);
const named = (rows: Contributor[]) => rows.filter((w) => creditName(w));
const writersOf = (m: Metadata) => named([...m.writers, ...m.composers]);
const key = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
/** The society most of these songs point at for one pillar, from their checklist steps. */
function societyFor(list: CheckupInput["rows"], ids: Set<string>, pillar: string): Society | undefined {
  const count = new Map<string, { s: Society; n: number }>();
  for (const { r, c } of list) {
    if (!ids.has(r.track.id)) continue;
    const s = c.steps.find((x) => x.stage === "register" && x.pillar === pillar)?.society ?? c.steps.find((x) => x.pillar === pillar)?.society;
    if (s) count.set(s.id, { s, n: (count.get(s.id)?.n ?? 0) + 1 });
  }
  return [...count.values()].sort((a, b) => b.n - a.n)[0]?.s;
}

export function royaltyCheckup({ rows, signedSheets, today = new Date().toISOString() }: CheckupInput): Checkup {
  const hits = new Map<ConditionId, AffectedSong[]>();
  const hit = (id: ConditionId, s: AffectedSong) => hits.set(id, [...(hits.get(id) ?? []), s]);
  const allWriters = rows.flatMap(({ r }) => writersOf(r.track.metadata));
  const noPro = allWriters.length > 0 && !allWriters.some((w) => hasPro(w.pro));
  const registered = { performance: 0, mechanical: 0, digital: 0 };
  const pillarSongs = { performance: 0, mechanical: 0, digital: 0 };
  const ageDays = (iso: string) => (Date.parse(today) - Date.parse(iso)) / 86_400_000;

  for (const { r, c, status } of rows) {
    const t = r.track, m = t.metadata, id = t.id, title = t.title || "Untitled";
    const song = (why: string, field?: string, registration = false): AffectedSong => ({ id, title, why, field, registration });
    const step = (stage: string, pillar: string) => c.steps.find((s) => s.stage === stage && s.pillar === pillar);
    const writers = writersOf(m);
    const pubs = named(m.publishers);
    for (const p of r.pillars) {
      pillarSongs[p.pillar]++;
      if (step("register", p.pillar)?.done || step("register", p.pillar)?.update) registered[p.pillar]++;
    }

    // Heart: both halves (writer and publisher) must be there; BMI writers with no publisher are covered by BMI.
    const noWriter = !writers.length;
    const noPublisher = !pubs.length && !publisherCovered(m);
    if (noWriter || noPublisher) hit("broken", song(noWriter ? "no writer" : "no publisher", noWriter ? "writers-0-legalName" : "selfPublished"));
    if (!noPro && writers.length) {
      const why: string[] = [];
      const missingIpi = [...m.writers.map((w, i) => ({ w, f: `writers-${i}-ipi` })), ...m.composers.map((w, i) => ({ w, f: `composers-${i}-ipi` }))]
        .find(({ w }) => creditName(w) && hasPro(w.pro) && !isIpi(w.ipi ?? ""));
      if (missingIpi) why.push("IPI missing");
      const reg = step("register", "performance");
      if (reg && !reg.done && !reg.update) why.push(`not registered with ${reg.society?.name ?? "your PRO"}`);
      if (why.length) hit("artery-left", song(why.join(", "), missingIpi?.f, !missingIpi));
    }
    const pubIpi = m.publishers.findIndex((p) => creditName(p) && !isIpi(p.ipi ?? ""));
    if (pubIpi >= 0) hit("artery-right", song(`${creditName(m.publishers[pubIpi]!)}: IPI missing`, `publishers-${pubIpi}-ipi`));

    // Lungs (mechanicals) and kidneys (the recording's digital performance), when the country has those agencies.
    const mech = step("register", "mechanical");
    if (mech && !mech.done && !mech.update) hit("lungs-hold", song(`not registered with ${mech.society?.name}`, undefined, true));
    else if (mech && !m.isrc.trim()) hit("lungs-one", song("no ISRC", "isrc"));
    const dig = step("register", "digital");
    if (dig && !dig.done && !dig.update) hit("kidney-none", song(`not registered with ${dig.society?.name}`, undefined, true));
    if (dig && dig.society?.id === "soundexchange" && m.isrc.trim()) {
      const owner = registrationCheck(m, "soundexchange").missing.filter((x) => x.code !== "isrc");
      if (owner.length) hit("kidney-one", song(owner.map((x) => (x.code === "upc" ? "UPC missing" : "master share missing")).join(", "), owner[0]!.field));
    }

    // Brain: the codes agencies recognise a song by. The ISWC only counts once the song is registered with a PRO.
    const codes = [!m.isrc.trim() && "ISRC", step("register", "performance")?.done && !m.iswc.trim() && "ISWC"].filter(Boolean) as string[];
    if (codes.length) hit("brain-fog", song(`${plain(codes)} missing`, codes[0] === "ISRC" ? "isrc" : "iswc"));
    for (const f of r.findings) if (f.level === "warn") hit("brain-tag", song(f.text, f.field === "writers" ? "writers-0-legalName" : f.field));

    // Spine: splits that add up, and a signed split sheet whenever there's more than one writer.
    const split = splitStatus(writers);
    const pubSplit = splitStatus(pubs);
    if (split.state === "over" || (split.state === "under" && split.total > 0) || (split.state === "empty" && writers.length > 1)) hit("spine-align", song(split.state === "empty" ? "no shares entered" : `writers total ${split.total}%`, "writers-0-share"));
    else if (pubSplit.state === "over" || (pubSplit.state === "under" && pubSplit.total > 0)) hit("spine-align", song(`publishers total ${pubSplit.total}%`, "publishers-0-share"));
    if (signedSheets && writers.length > 1 && !signedSheets.get(id)) hit("spine-back", song(signedSheets.has(id) ? "split sheet not signed by everyone" : "no split sheet"));

    // Pulse: registrations that went stale (edited since) or were never confirmed.
    const stale = c.steps.filter((s) => s.update).map((s) => s.society?.name).filter(Boolean) as string[];
    if (stale.length) hit("pulse-skip", song(`changed since registering with ${plain(stale)}`));
    const faint = c.steps.filter((s) => s.stage === "register" && s.done && s.society).filter((s) => {
      const at = status?.steps[`registered:${s.society!.id}`];
      const confirmed = c.steps.find((x) => x.stage === "confirm" && x.pillar === s.pillar)?.done;
      return at && !confirmed && ageDays(at) > CONFIRM_AFTER_DAYS;
    });
    if (faint.length) hit("pulse-faint", song(`not confirmed at ${plain(faint.map((s) => s.society!.name))}`));
  }
  if (noPro) for (const { r } of rows) if (writersOf(r.track.metadata).length) hit("noheart", { id: r.track.id, title: r.track.title || "Untitled", why: "no PRO", field: "writers-0-pro" });

  // Catalog-wide brain checks: one writer entered two ways, and one ISRC on two songs.
  const people = new Map<string, { names: Set<string>; ipis: Set<string>; songs: Map<string, string> }>();
  for (const { r } of rows) for (const w of writersOf(r.track.metadata)) {
    const k = key(creditName(w));
    const p = people.get(k) ?? { names: new Set(), ipis: new Set(), songs: new Map() };
    p.names.add(creditName(w)); if (w.ipi?.trim()) p.ipis.add(w.ipi.trim()); p.songs.set(r.track.id, r.track.title || "Untitled");
    people.set(k, p);
  }
  for (const p of people.values()) {
    if (p.ipis.size < 2 && p.names.size < 2) continue;
    const who = [...p.names][0]!;
    const why = p.ipis.size > 1 ? `${who}: two different IPI numbers` : `${who}: spelled ${plain([...p.names].map((n) => `"${n}"`))}`;
    for (const [id, title] of p.songs) hit("brain-mixed", { id, title, why, field: "writers-0-ipi" });
  }
  const byIsrc = new Map<string, AffectedSong[]>();
  for (const { r } of rows) {
    const k = r.track.metadata.isrc.replace(/-/g, "").toUpperCase();
    if (k) byIsrc.set(k, [...(byIsrc.get(k) ?? []), { id: r.track.id, title: r.track.title || "Untitled", why: `ISRC ${k} on more than one song`, field: "isrc" }]);
  }
  for (const list of byIsrc.values()) if (list.length > 1) list.forEach((s) => hit("brain-double", s));

  const findings = PRIORITY.filter((id) => hits.get(id)?.length).map((id) => word(id, hits.get(id)!, rows));
  const organs = ORGAN_ORDER.map((id): Organ => {
    const mine = findings.filter((f) => f.organ === id);
    const pillar = id === "heart" ? "performance" : id === "lungs" ? "mechanical" : id === "kidneys" ? "digital" : undefined;
    // No flow: nothing registered for this stream yet, and nothing wrong in the data itself (a broken heart still shows broken).
    const dataTreat = mine.some((f) => f.severity === "treat" && f.songs.some((s) => !s.registration));
    const noflow = !!pillar && pillarSongs[pillar] > 0 && registered[pillar] === 0 && !dataTreat;
    const state: OrganState = noflow ? "noflow" : mine.some((f) => f.severity === "treat") ? "treat" : mine.length ? "watch" : "healthy";
    return { id, name: ORGAN_NAME[id], system: SYSTEM[id], state, findings: mine, checks: CHECKS[id], broken: mine.some((f) => f.id === "broken") };
  }).filter((o) => o.id !== "kidneys" || pillarSongs.digital > 0).filter((o) => o.id !== "lungs" || pillarSongs.mechanical > 0);
  const lead = [...findings].sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "treat" ? -1 : 1) || b.songs.length - a.songs.length || PRIORITY.indexOf(a.id) - PRIORITY.indexOf(b.id))[0] ?? null;
  const score = rows.length ? Math.round(rows.reduce((n, { c }) => n + (c.total ? c.done / c.total : 0), 0) / rows.length * 100) : 0;
  const rank: OrganState[] = ["treat", "noflow", "watch", "healthy"];
  const rhythm = rank.find((s) => organs.some((o) => o.state === s)) ?? "healthy";
  return { score, songs: rows.length, organs, lead, rhythm };
}

const SYSTEM: Record<OrganId, string> = {
  heart: "Performance royalties", lungs: "Mechanical royalties", kidneys: "Digital performance",
  brain: "Codes and names", spine: "Splits and paperwork", pulse: "Follow-through",
};
/** What each organ examines, listed as "what we examined" when it's healthy. */
const CHECKS: Record<OrganId, string[]> = {
  heart: ["Every song has a writer and a publisher side (or Self-published)", "Writers in a PRO have their IPI", "Publishers have their IPI", "Songs are registered with your PRO"],
  lungs: ["Songs are registered for mechanicals", "Registered songs have an ISRC to link the recording"],
  kidneys: ["Recordings are registered for digital performance", "Recordings have a UPC and master share"],
  brain: ["Every song has an ISRC", "Registered songs have their ISWC", "No writer has two different IPIs or spellings", "No ISRC is used twice", "Streaming matches your titles and artist name"],
  spine: ["Writer splits total 100%", "Publisher shares total 100%", "Songs with co-writers have a signed split sheet"],
  pulse: ["Registrations match your latest details", `Registrations are confirmed within ${CONFIRM_AFTER_DAYS / 7} weeks`],
};

/** The approved wording (PLAN-royalty-health-report §2), filled in from the songs. */
function word(id: ConditionId, list: AffectedSong[], rows: CheckupInput["rows"]): Finding {
  const n = list.length, ids = new Set(list.map((s) => s.id)), first = list[0]!;
  const fix = (title: string, text: string): TreatmentStep => ({ title, text, action: first.field ? { kind: "field", trackId: first.id, field: first.field } : undefined });
  const pro = societyFor(rows, ids, "performance");
  const proName = pro?.name ?? "your PRO";
  const mech = societyFor(rows, ids, "mechanical"), dig = societyFor(rows, ids, "digital");
  const mechName = mech?.name ?? "your mechanical society", digName = dig?.name ?? "your recording society";
  const at = (s: Society | undefined, title: string, text: string): TreatmentStep => ({ title, text, action: s ? { kind: "portal", ...portal(s) } : undefined });
  const dl = (agency: "pro" | "mlc" | "soundexchange", title: string, text: string): TreatmentStep => ({ title, text, action: { kind: "download", agency } });
  const tick = (title = "Tick Registered", text = "New registrations take a few weeks to show up. We'll remind you to confirm."): TreatmentStep => ({ title, text, action: { kind: "tick" } });
  const total = rows.length;
  const base = { id, organ: ORGAN_OF[id], severity: SEVERITY[id], songs: list, scan: id };
  switch (id) {
    case "broken": {
      const half = list.every((s) => s.why === "no publisher") ? "the publisher half" : list.every((s) => s.why === "no writer") ? "the writer half" : "half";
      return { ...base, dx: "Your heart is broken in two.", what: `${songs(n)} ${n === 1 ? "has" : "have"} only one half set up, so ${half} of the money has nowhere to go.`,
        symptom: "Performance royalties for that half can't be paid to anyone, even when the song plays.",
        cause: list.some((s) => s.why === "no publisher") ? "No publisher is listed and Self-published isn't checked." : "No writer is listed.",
        steps: [fix("Fill the gap", "Add the missing half in the song's Writer or Publisher section, or check Self-published."), dl("pro", "Download your PRO cheat sheet", "Every field your PRO asks for, filled in."),
          at(pro, `Register at ${proName}`, `Register or update the ${n === 1 ? "song" : "songs"} in ${pro ? portal(pro).name : "your PRO's member portal"}.`), tick()],
        note: "A heart needs both halves to beat." };
    }
    case "artery-left": {
      const ipi = list.some((s) => s.why.includes("IPI"));
      const reg = list.some((s) => s.why.includes("not registered"));
      return { ...base, dx: "Blockage in the left heart artery.", what: `${n} of ${total} songs can't pay your writer share from ${proName}.`,
        symptom: `No writer royalties from ${proName} for these songs, even when they play on radio, TV or streaming.`,
        cause: [ipi && "Your IPI number is missing", reg && `${ipi ? "those" : "Those"} songs aren't registered with ${proName} yet`].filter(Boolean).join(", and ") + ".",
        steps: [...(ipi ? [fix("Add your IPI", `Add it once in Catalog Profile. It fills all ${n === 1 ? "of them" : n}.`)] : []), dl("pro", `Download your ${proName} cheat sheet`, `Every field ${proName} asks for, filled in.`),
          at(pro, `Register at ${proName}`, `Register the ${songs(n)} in ${pro ? portal(pro).name : "your PRO's member portal"}.`), tick()],
        note: "Strong, even breaths: one song at a time." };
    }
    case "artery-right":
      return { ...base, dx: "Blockage in the right heart artery.", what: `${songs(n)} can't pay the publisher share.`,
        symptom: "The publisher half of the performance royalties can't be matched to the publisher.",
        cause: `${first.why.split(":")[0]} has no IPI on file, or isn't on the registration.`,
        steps: [fix("Add the publisher IPI", "Find it in the publisher's PRO account."), dl("pro", "Download the cheat sheet", "With the publisher filled in."), at(pro, `Update at ${proName}`, `Add the publisher to each song at ${proName}.`)] };
    case "noheart":
      return { ...base, dx: "No heartbeat yet.", what: "None of your songs can collect performance royalties.", symptom: "Radio, TV, live and streaming performances of your songs pay nothing to you.",
        cause: "You haven't joined a PRO.",
        steps: [{ title: "Join a PRO", text: "Pick and join one: BMI, ASCAP and more from the worldwide list.", action: { kind: "join" } }, fix("Add it to your profile", "Add your PRO and IPI in Catalog Profile."), dl("pro", "Register your songs", "Use the cheat sheet to register every song.")] };
    case "lungs-hold":
      return { ...base, dx: "You're holding your breath.", what: `${songs(n)} earn a mechanical royalty on every stream, but ${mechName} doesn't have them.`,
        symptom: "Streams and downloads of these songs pay you no mechanical royalties.", cause: `Not registered with ${mechName}.`,
        steps: [dl("mlc", `Download the ${mechName} file`, "Your songs, filled in for bulk registration."), at(mech, `Upload it at ${mechName}`, `Upload it in ${mech ? portal(mech).name : mechName} (bulk work registration).`), tick()] };
    case "lungs-one":
      return { ...base, dx: "Your lungs are only breathing on one side.", what: `${songs(n)} ${n === 1 ? "is" : "are"} registered with ${mechName} but ${n === 1 ? "isn't" : "aren't"} linked to ${n === 1 ? "its recording" : "their recordings"}.`,
        symptom: "Streams can't be matched to the song, so the mechanical royalty from each stream may sit unpaid.", cause: "No ISRC on file.",
        steps: [fix("Add the ISRC", "Your distributor gives you one for every recording."), dl("mlc", `Download the ${mechName} file`, "With the ISRCs filled in."), at(mech, `Update at ${mechName}`, `Upload it in ${mech ? portal(mech).name : mechName} to update ${n === 1 ? "the song" : `those ${n} songs`}.`), tick("Tick Updated", "We'll remind you to confirm the link.")] };
    case "kidney-none":
      return { ...base, dx: "Your kidneys aren't filtering.", what: `${recs(n)} ${n === 1 ? "isn't" : "aren't"} with ${digName}, so internet and satellite radio plays can't reach you.`,
        symptom: "Nothing from internet and satellite radio, even when these recordings play there.", cause: `Not registered with ${digName}.`,
        steps: [dl("soundexchange", `Download the ${digName} file`, "Your recordings, filled in."), at(dig, `Upload it at ${digName}`, `Upload it in ${dig ? portal(dig).name : digName}, as the artist and as the rights owner if you own your masters.`), tick()] };
    case "kidney-one":
      return { ...base, dx: "Only one kidney is working.", what: `You're paid as the artist, but nobody collects the master owner's share on ${recs(n)}.`,
        symptom: "The master owner's half of digital radio royalties goes uncollected.", cause: `${first.why.replace(/^./, (c) => c.toUpperCase())}.`,
        steps: [fix("Add it", "Add the UPC and the share of the master you own."), dl("soundexchange", `Download the ${digName} file`, "With the rights owner details."), at(dig, "Register as the rights owner too", `In ${dig ? portal(dig).name : digName}.`)],
        note: "If you own your masters, that's you twice." };
    case "brain-fog": {
      const codes = [...new Set(list.flatMap((s) => s.why.replace(" missing", "").split(" and ")))];
      return { ...base, dx: "A little foggy.", what: `${songs(n)} ${n === 1 ? "is" : "are"} missing codes agencies use to recognize them: ${plain(codes)}.`,
        symptom: "Agencies may not recognize these songs when plays come in.", cause: "Codes not entered yet.",
        steps: [fix("Add the codes", "The ISRC comes from your distributor. The ISWC appears after your PRO registers the song."), { title: "Update each agency", text: "Download the agency files again and update your registrations.", action: { kind: "download", agency: "pro" } }] };
    }
    case "brain-mixed": {
      const who = first.why.split(":")[0]!;
      return { ...base, dx: "Mixed signals from the brain.", what: `${who} ${first.why.includes("IPI") ? "has two different IPI numbers" : "is spelled different ways"} across your songs.`,
        symptom: "Agencies can split one writer into two people, and pay neither in full.", cause: "Entered differently on different songs.",
        steps: [{ title: "Check the right one", text: `Look it up in ${who}'s PRO account.` }, fix("Correct it here", "Fix every song that has it wrong."), dl("pro", "Update the registrations", "Update the songs registered with the wrong one.")] };
    }
    case "brain-double": {
      const [a, b] = names(list);
      return { ...base, dx: "Double vision.", what: `${a} and ${b ?? "another song"} share one ISRC, so plays can be paid to the wrong song.`,
        symptom: "Plays of one song can be counted for the other.", cause: "The same code was entered twice.",
        steps: [{ title: "Check with your distributor", text: "Ask for the right ISRC for each recording." }, fix("Fix it here", "Each recording gets its own ISRC."), dl("soundexchange", "Update the agencies", `Update ${digName} and ${mechName}.`)] };
    }
    case "brain-tag":
      return { ...base, dx: "You're wearing someone else's name tag.", what: `${names(list).slice(0, 1)[0]} shows up on streaming differently: ${first.why.replace(/\.$/, "")}.`,
        symptom: "Agencies match plays by what streaming shows, so the wrong details can send money elsewhere.", cause: "Your distributor sent different details.",
        steps: [{ title: "Ask your distributor to fix it", text: "Copy our ready-made correction message to their support.", action: { kind: "distributor", trackId: first.id } }, { title: "Then update the agencies", text: "Once streaming shows the right details.", action: { kind: "download", agency: "pro" } }] };
    case "spine-align":
      return { ...base, dx: "Your spine is out of alignment.", what: n > 1 ? `${songs(n)} have splits that don't add up to 100%.` : first.why.startsWith("no shares") ? `${names(list)[0]} has co-writers but no shares entered.` : `${names(list)[0]} splits total ${first.why.replace(/^\w+ total /, "")}.`,
        symptom: "Agencies can hold every payment for the song until the splits add up.", cause: "Shares don't add up to 100%.",
        steps: [fix("Make it 100%", "Lower or raise a share until they add up."), dl("pro", "Update your PRO", "Update the registration with the new splits."), dl("mlc", `Update ${mechName}`, "Update the shares there too.")] };
    case "spine-back":
      return { ...base, dx: "Nothing's holding your back up.", what: `${songs(n)} with co-writers ${n === 1 ? "has" : "have"} no signed split sheet, so splits can be disputed and payments frozen.`,
        symptom: "A disagreement over shares can freeze every payment for the song.", cause: "No signed agreement on file.",
        steps: [{ title: "Send a split sheet", text: "Everyone signs the shares you agreed.", action: { kind: "split", trackId: first.id } }, dl("pro", "Register with the agreed splits", "At your PRO and every agency.")] };
    case "pulse-skip":
      return { ...base, dx: "Your pulse skipped a beat.", what: `${songs(n)} changed after you registered ${n === 1 ? "it" : "them"}. The agencies still have the old details.`,
        symptom: "Royalties can be paid on old details, or held while the agency and your catalog disagree.", cause: "Changes made here haven't reached the agencies.",
        steps: [{ title: "See what changed", text: "The song's checklist shows which registrations need updating.", action: { kind: "changes", trackId: first.id } }, dl("pro", "Download the updated file", "For each agency the song is registered with."), { title: "Update each registration", text: "Change the same details in each agency's portal." }, tick("Tick Updated", "The pulse steadies once every agency has the new details.")] };
    case "pulse-faint":
      return { ...base, dx: "Your pulse is faint.", what: `${songs(n)} ${n === 1 ? "was" : "were"} registered over ${CONFIRM_AFTER_DAYS / 7} weeks ago but ${n === 1 ? "hasn't" : "haven't"} been confirmed.`,
        symptom: "If a registration didn't go through, you won't know until the money doesn't come.", cause: "Not confirmed yet.",
        steps: [{ title: "Search for them", text: "Use the search links in each song's checklist.", action: { kind: "changes", trackId: first.id } }, { title: "Or upload your agency lists", text: "Confirm them all at once.", action: { kind: "upload" } }] };
  }
  throw new Error(`Unknown condition ${id as string}`);
}

/** The headline when nothing is wrong. */
export const CLEAR_DX = "Clean bill of health. Strong pulse.";
export const CLEAR_WHAT = "Every song is registered and confirmed, so every royalty it earns can reach you. Came Through Audio came through for your catalog.";

/** What a saved report keeps: enough to compare the next checkup and to list it under Past reports. */
export type CheckupSummary = { score: number; songs: number; lead: string | null; organs: Partial<Record<OrganId, { state: OrganState; findings: { id: ConditionId; songs: number }[] }>> };
export const summarize = (c: Checkup): CheckupSummary => ({
  score: c.score, songs: c.songs, lead: c.lead?.dx ?? null,
  organs: Object.fromEntries(c.organs.map((o) => [o.id, { state: o.state, findings: o.findings.map((f) => ({ id: f.id, songs: f.songs.length })) }])),
});

/** "Since last checkup": organs that healed, and findings that are new. */
export function sinceLast(now: CheckupSummary, before?: CheckupSummary | null) {
  if (!before) return null;
  const healed = ORGAN_ORDER.filter((id) => before.organs[id] && before.organs[id]!.state !== "healthy" && now.organs[id]?.state === "healthy").map((id) => ORGAN_NAME[id]);
  const was = new Set(Object.values(before.organs).flatMap((o) => o?.findings.map((f) => f.id) ?? []));
  const fresh = Object.values(now.organs).flatMap((o) => o?.findings ?? []).filter((f) => !was.has(f.id)).length;
  return { healed, fresh, delta: now.score - before.score };
}
