import type { ReactNode } from "react";
import { ChevronLeft, Stethoscope } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InfoTip } from "@/components/InfoTip";
import { isBmi, type Pillar } from "@/lib/audit";
import type { TrackReport } from "@/lib/health";
import { printKey, registrationPrint, type SongChecklist } from "@/lib/health-checklist";
import { scopeName, type ReportScope } from "@/lib/health-reports";
import type { SongStatus } from "@/lib/health-songs";
import { creditName } from "@/lib/metadata";
import { registrationReadiness } from "@/lib/readiness";

/**
 * Check-in, the step before a Royalty Health Check (PLAN-health-hub-reports §3): which songs, where you get paid, and
 * what's already done. Registration answers are the checklist's own "Registered" ticks, so the two never disagree;
 * the rest are saved as `checkin:*` steps the checkup reads. Nothing here blocks the check.
 */
export type CheckInRow = { r: TrackReport; c: SongChecklist; status?: SongStatus | undefined };
export type Answer = "yes" | "no" | "unsure";
type Value = { answer?: Answer | undefined; locked?: string | undefined };
type Question = { id: string; ask: (rows: CheckInRow[]) => string; tip: string; applies: (x: CheckInRow) => boolean; value: (x: CheckInRow) => Value; set: (x: CheckInRow, a: Answer) => Record<string, string | null> };

const REG_ASK: Record<Pillar, [string, string]> = {
  performance: ["your PRO", "Your PRO (performing rights organization) pays the writer share when the song plays on radio, TV, streaming and live."],
  mechanical: ["your mechanical society", "Mechanical royalties are paid every time the song is streamed or downloaded. In the US, The MLC collects them."],
  digital: ["your recording society", "Internet and satellite radio pay the recording's artist and owner. In the US, SoundExchange collects it."],
};

const now = () => new Date().toISOString();
const step = (x: CheckInRow, pillar: Pillar) => x.c.steps.find((s) => s.stage === "register" && s.pillar === pillar);
const checkin = (x: CheckInRow, k: string) => x.status?.steps[`checkin:${k}`] as Answer | undefined;
const writersOf = (x: CheckInRow) => [...x.r.track.metadata.writers, ...x.r.track.metadata.composers].filter(creditName);

function registration(pillar: Pillar): Question {
  const [fallback, tip] = REG_ASK[pillar];
  return {
    id: pillar, tip,
    ask: (rows) => {
      const names = [...new Set(rows.map((x) => step(x, pillar)?.society?.name).filter(Boolean))];
      return `Registered with ${pillar === "performance" ? `your PRO${names.length ? ` (${names.join(", ")})` : ""}` : names.length ? names.join(" / ") : fallback}?`;
    },
    applies: (x) => !!step(x, pillar)?.society,
    value: (x) => {
      const s = step(x, pillar)!;
      const found = x.c.steps.find((c) => c.stage === "confirm" && c.pillar === pillar)?.done;
      if (found) return { answer: "yes", locked: `found at ${s.society!.name}` };
      return { answer: s.done || s.update ? "yes" : checkin(x, s.society!.id) };
    },
    set: (x, a) => {
      const s = step(x, pillar)!, id = s.society!.id;
      return a === "yes"
        ? { [`registered:${id}`]: x.status?.steps[`registered:${id}`] ?? now(), [printKey(id)]: x.status?.steps[printKey(id)] ?? registrationPrint(x.r.track.metadata, pillar), [`checkin:${id}`]: null }
        : { [`registered:${id}`]: null, [printKey(id)]: null, [`checkin:${id}`]: a };
    },
  };
}

function questions(signedSheets?: Map<string, boolean>): Question[] {
  return [
    registration("performance"), registration("mechanical"), registration("digital"),
    {
      id: "split", ask: () => "Split sheet signed?", tip: "A split sheet is the agreement every co-writer signs, showing each person's share of the song. It's only needed when there's more than one writer.",
      applies: (x) => writersOf(x).length > 1,
      value: (x) => {
        const sheet = signedSheets?.get(x.r.track.id);
        if (sheet !== undefined) return { answer: sheet ? "yes" : "no", locked: sheet ? "signed in Came Through Audio" : "waiting on signatures" };
        return { answer: checkin(x, "split") };
      },
      set: (_x, a) => ({ "checkin:split": a }),
    },
    {
      id: "delivered", ask: () => "Has your distributor delivered it?", tip: "Delivered means your distributor (DistroKid, TuneCore, CD Baby and others) has sent the song to streaming services.",
      applies: () => true,
      value: (x) => (x.r.streaming?.hit ? { answer: "yes", locked: "found on streaming" } : { answer: checkin(x, "delivered") }),
      set: (_x, a) => ({ "checkin:delivered": a }),
    },
  ];
}

/** The publisher question reads the song's own Publisher and Self-published fields rather than a separate answer. */
type PublisherState = { kind: "listed"; names: string[] } | { kind: "self" } | { kind: "ask"; answer?: Answer | undefined; bmi: "all" | "some" | "none" };
function publisherState(x: CheckInRow): PublisherState {
  const m = x.r.track.metadata;
  const names = m.publishers.map(creditName).filter(Boolean);
  if (names.length) return { kind: "listed", names };
  if (m.selfPublished) return { kind: "self" };
  const w = writersOf(x);
  const bmi = w.length && w.every(isBmi) ? "all" : w.some(isBmi) ? "some" : "none";
  return { kind: "ask", answer: checkin(x, "publisher"), bmi };
}

const CHOICES: [Answer, string][] = [["yes", "Yes"], ["no", "No"], ["unsure", "Not sure"]];

type Props = {
  scope: ReportScope;
  /** The scopes this check-in can switch between: the song, its release, the whole catalog. */
  options: ReportScope[];
  onScope: (s: ReportScope) => void;
  rows: CheckInRow[];
  countryPicker: ReactNode;
  signedSheets?: Map<string, boolean> | undefined;
  /** Saves checklist steps for each song (null removes one). */
  onAnswer: (changes: { id: string; steps: Record<string, string | null> }[]) => void;
  /** "No, I'm self-published": ticks Self-published on songs with no publisher listed. */
  onSelfPublished: (ids: string[]) => void;
  onFixField: (trackId: string, field: string) => void;
  onRun: () => void;
  onBack: () => void;
};

export function HealthCheckIn({ scope, options, onScope, rows, countryPicker, signedSheets, onAnswer, onSelfPublished, onFixField, onRun, onBack }: Props) {
  const many = rows.length > 1;
  const list = questions(signedSheets);
  // Missing writer details are shown so they can be fixed, but never hold the check back (Writer Credits rules).
  const warnings = rows.flatMap((x) => registrationReadiness(x.r.track.metadata).missing.slice(0, 2).map((w) => ({ x, w }))).slice(0, 6);
  const noPro = rows.filter((x) => x.r.issues.some((i) => i.field?.endsWith("-pro")));

  function answerAll(q: Question, targets: CheckInRow[], a: Answer) {
    const changes = targets.filter((x) => q.applies(x) && !q.value(x).locked).map((x) => ({ id: x.r.track.id, steps: q.set(x, a) }));
    if (changes.length) onAnswer(changes);
  }

  return (
    <div className="space-y-6">
      <Button variant="ghost" onClick={onBack}><ChevronLeft />Back to the Hub</Button>
      <div className="rounded-3xl border border-border bg-card p-5 md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-xs font-bold uppercase tracking-[2px] text-primary">Royalty Health Check · Check-in · Step 1 of 2</div>
            <h2 className="mt-1 text-3xl font-extrabold tracking-tight">{scopeName(scope)}</h2>
            <p className="mt-1 max-w-[60ch] text-muted-foreground">A few quick questions, so your report knows what's already done. Answers you've given before are filled in.</p>
          </div>
          {countryPicker}
        </div>

        {options.length > 1 && <fieldset className="mt-6">
          <legend className="mb-2 text-sm font-bold">Which songs?</legend>
          <div className="flex flex-wrap gap-2">
            {options.map((o) => {
              const on = o.kind === scope.kind && o.label === scope.label;
              return <button key={o.kind + o.label} type="button" role="radio" aria-checked={on} onClick={() => onScope(o)}
                className={`rounded-full px-4 py-2 text-sm font-semibold ${on ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground hover:text-foreground"}`}>
                {o.kind === "release" ? `Whole release: ${o.label}` : scopeName(o)}{o.kind !== "song" && o.kind !== "outside" ? ` · ${o.refs.length || "all"} songs` : ""}
              </button>;
            })}
          </div>
        </fieldset>}

        <div className="mt-6">
          <h3 className="mb-3 text-sm font-bold">What have you done already?</h3>
          <ul className="divide-y divide-border rounded-2xl border border-border">
            {list.map((q) => {
              const targets = rows.filter(q.applies);
              if (!targets.length) return null;
              const values = targets.map(q.value);
              const same = values.every((v) => v.answer === values[0]!.answer) ? values[0]!.answer : undefined;
              const locked = values.every((v) => v.locked) ? values[0]!.locked : undefined;
              const answered = values.filter((v) => v.answer).length;
              return (
                <li key={q.id} className="p-4">
                  <QuestionRow label={q.ask(targets)} tip={q.tip} value={same} locked={locked && !many ? locked : undefined}
                    note={many && !same && answered ? `Mixed · ${answered} of ${targets.length} answered` : many && values.some((v) => v.locked) ? `${values.filter((v) => v.locked).length} already confirmed` : undefined}
                    onChoose={(a) => answerAll(q, targets, a)} />
                  {q.id === "delivered" && same === "no" && <p className="mt-2 text-sm text-muted-foreground">That's fine. Register the song now; the recording gets registered once it's out.</p>}
                  {many && <details className="mt-2">
                    <summary className="cursor-pointer text-sm font-semibold text-primary">Song by song</summary>
                    <ul className="mt-2 space-y-2">{targets.map((x) => { const v = q.value(x); return (
                      <li key={x.r.track.id}><QuestionRow small label={x.r.track.title || "Untitled"} value={v.answer} locked={v.locked} onChoose={(a) => answerAll(q, [x], a)} /></li>); })}</ul>
                  </details>}
                </li>
              );
            })}
            <PublisherRow rows={rows} many={many} onAnswer={onAnswer} onSelfPublished={onSelfPublished} onFixField={onFixField} />
          </ul>
        </div>

        {(warnings.length > 0 || noPro.length > 0) && <div className="mt-6 space-y-1 rounded-2xl border border-border p-4 text-sm">
          <p className="font-semibold">A few details to fix (these won't stop your check):</p>
          {noPro.slice(0, 3).map((x) => { const f = x.r.issues.find((i) => i.field?.endsWith("-pro"))!; return (
            <button key={`pro-${x.r.track.id}`} type="button" onClick={() => onFixField(x.r.track.id, f.field!)} className="block text-left text-primary underline-offset-2 hover:underline">⚠️ {x.r.track.title}: {f.text}</button>); })}
          {warnings.map(({ x, w }) => <button key={x.r.track.id + w.code + w.field} type="button" onClick={() => w.field && onFixField(x.r.track.id, w.field)} className="block text-left text-primary underline-offset-2 hover:underline">⚠️ {x.r.track.title}: {w.message}</button>)}
        </div>}

        <div className="mt-8 flex flex-wrap justify-end gap-2">
          <Button variant="outline" onClick={onBack}>Back</Button>
          <Button size="lg" onClick={onRun}><Stethoscope />Run my Royalty Health Check</Button>
        </div>
      </div>
    </div>
  );
}

function QuestionRow({ label, tip, value, locked, note, small, onChoose, choices = CHOICES }: { label: string; tip?: string; value?: Answer | undefined; locked?: string | undefined; note?: string | undefined; small?: boolean; onChoose: (a: Answer) => void; choices?: [Answer, string][] }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
      <span className={`min-w-0 flex-1 ${small ? "text-sm" : "font-medium"}`}>
        <span className="inline-flex items-center">{label}{tip && <InfoTip text={tip} />}</span>
        {note && <span className="block text-xs text-muted-foreground">{note}</span>}
      </span>
      {locked ? <span className="text-sm font-semibold text-primary">✓ {locked}</span>
        : <span role="radiogroup" aria-label={label} className="inline-flex flex-wrap gap-1">
          {choices.map(([a, text]) => <button key={a} type="button" role="radio" aria-checked={value === a} onClick={() => onChoose(a)}
            className={`rounded-full px-3 py-1 text-sm font-semibold ${value === a ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground hover:text-foreground"}`}>{text}</button>)}
        </span>}
    </div>
  );
}

/**
 * "Do you have a publisher?" BMI writers with no publisher still get their writer share, and BMI pays them the
 * publisher share too (any role), so for them "No" is simply recorded. Writers at other PROs need a publisher or Self-published.
 */
function PublisherRow({ rows, many, onAnswer, onSelfPublished, onFixField }: { rows: CheckInRow[]; many: boolean; onAnswer: Props["onAnswer"]; onSelfPublished: Props["onSelfPublished"]; onFixField: Props["onFixField"] }) {
  const states = rows.map((x) => ({ x, p: publisherState(x) }));
  const open = states.filter((s): s is { x: CheckInRow; p: Extract<PublisherState, { kind: "ask" }> } => s.p.kind === "ask");
  // "No" on a song whose writers are all with BMI just records it: BMI needs no publisher or Self-published.
  const choose = (targets: typeof open, a: Answer) => {
    const self = a === "no" ? targets.filter((s) => s.p.bmi !== "all") : [];
    if (self.length) onSelfPublished(self.map((s) => s.x.r.track.id));
    const rest = targets.filter((s) => !self.includes(s));
    if (rest.length) onAnswer(rest.map((s) => ({ id: s.x.r.track.id, steps: { "checkin:publisher": a } })));
  };
  const choices: [Answer, string][] = [["yes", "Yes"], ["no", "No, I'm self-published"], ["unsure", "Not sure"]];
  const bmi = open.length && open.every((s) => s.p.bmi === "all") ? "all" : open.some((s) => s.p.bmi !== "none") ? "some" : "none";
  const same = open.length && open.every((s) => s.p.answer === open[0]!.p.answer) ? open[0]!.p.answer : undefined;
  const missingName = open.filter((s) => s.p.answer === "yes");
  const tip = "A publisher collects the publisher half of your songwriting royalties. If you don't have one, you're self-published.";
  const settled = states.length - open.length;

  return (
    <li className="p-4">
      {!open.length
        ? <QuestionRow label="Do you have a publisher?" tip={tip} onChoose={() => {}}
            locked={many ? `${settled} song${settled === 1 ? "" : "s"} set in your catalog` : states[0]?.p.kind === "listed" ? (states[0].p as { names: string[] }).names.join(", ") : "self-published"} />
        : <QuestionRow label="Do you have a publisher?" tip={tip} value={same} choices={choices} onChoose={(a) => choose(open, a)}
            note={many && settled ? `${settled} song${settled === 1 ? " is" : "s are"} already set in your catalog` : undefined} />}
      {bmi !== "none" && open.length > 0 && <p className="mt-2 text-sm text-muted-foreground">
        {bmi === "all" ? "Your writers are with BMI. With no publisher, BMI still pays your writer share, and pays you the publisher share too."
          : "BMI writers with no publisher still get their writer share, and BMI pays them the publisher share too. Writers at other PROs need a publisher, or Self-published."}</p>}
      {missingName.length > 0 && <div className="mt-2 space-y-1 text-sm">{missingName.slice(0, 3).map((s) => (
        <button key={s.x.r.track.id} type="button" onClick={() => onFixField(s.x.r.track.id, "selfPublished")} className="block text-left text-primary underline-offset-2 hover:underline">⚠️ {s.x.r.track.title}: add your publisher's name</button>))}</div>}
      {many && open.length > 1 && <details className="mt-2">
        <summary className="cursor-pointer text-sm font-semibold text-primary">Song by song</summary>
        <ul className="mt-2 space-y-2">{open.map((s) => <li key={s.x.r.track.id}><QuestionRow small label={s.x.r.track.title || "Untitled"} value={s.p.answer} choices={choices} onChoose={(a) => choose([s], a)} /></li>)}</ul>
      </details>}
    </li>
  );
}
