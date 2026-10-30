import { useEffect, useState, type ReactNode } from "react";
import { CheckCircle2, Loader2, Stethoscope } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProSelect } from "@/components/ProSelect";
import { InfoTip } from "@/components/InfoTip";

/**
 * The Doctor's Office: the Royalty Health Hub's one guided consultation, in order:
 * Patient Check-in → Patient Intake Form or agency records → clinical scan → diagnosis.
 */
export type PatientFile = { legalName: string; pro: string; ipi: string; publishing: "" | "publisher" | "self" | "bmi"; publisher: string };
const blankFile: PatientFile = { legalName: "", pro: "", ipi: "", publishing: "", publisher: "" };
const fileKey = (userId: string) => `cta_patient_file:${userId}`;
export function loadPatientFile(userId: string): PatientFile | null {
  try { const v = localStorage.getItem(fileKey(userId)); return v ? { ...blankFile, ...(JSON.parse(v) as PatientFile) } : null; } catch { return null; }
}
export const savePatientFile = (userId: string, f: PatientFile) => { try { localStorage.setItem(fileKey(userId), JSON.stringify(f)); } catch { /* private mode */ } };

export const OFFICE_STEPS = ["Patient Check-in", "Intake & records", "Clinical scan", "Diagnosis"] as const;

export function OfficeSteps({ at }: { at: number }) {
  return (
    <ol className="mx-auto flex max-w-3xl flex-wrap justify-center gap-2 text-xs font-semibold" aria-label="Doctor's Office steps">
      {OFFICE_STEPS.map((s, i) => (
        <li key={s} aria-current={i === at ? "step" : undefined}
          className={`rounded-full border px-3 py-1 ${i === at ? "border-primary bg-primary text-primary-foreground" : i < at ? "border-primary text-primary" : "border-border text-muted-foreground"}`}>
          {i < at ? "✓ " : `${i + 1}. `}{s}
        </li>
      ))}
    </ol>
  );
}

export function OfficeShell({ step, title, onBack, children }: { step: number; title: string; onBack: () => void; children: ReactNode }) {
  return (
    <section className="space-y-5 rounded-2xl border-2 border-primary/40 bg-card p-6" aria-label={title}>
      <div className="flex items-center justify-between gap-2">
        <Button variant="ghost" size="sm" onClick={onBack}>← Back</Button>
        <p className="text-xs font-semibold uppercase tracking-[2px] text-primary">Doctor's Office</p>
        <span className="w-16" />
      </div>
      <OfficeSteps at={step} />
      <h2 className="text-center text-2xl font-bold">{title}</h2>
      {children}
    </section>
  );
}

/** Step 1: the patient file (saved on this device) and the kind of visit. */
export function PatientCheckIn({ userId, defaultName, hasCatalog, onVisit }: { userId: string; defaultName: string; hasCatalog: boolean; onVisit: (kind: "single" | "catalog", file: PatientFile) => void }) {
  const saved = loadPatientFile(userId);
  const [f, setF] = useState<PatientFile>(saved ?? { ...blankFile, legalName: defaultName });
  const [editing, setEditing] = useState(!saved);
  const set = (k: keyof PatientFile, v: string) => setF((x) => ({ ...x, [k]: v }));
  const ready = !!f.legalName.trim() && !!f.publishing && (f.publishing !== "publisher" || !!f.publisher.trim());
  const keep = () => { savePatientFile(userId, f); setEditing(false); };
  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="rounded-xl border border-border p-4">
        <div className="mb-3 flex items-center justify-between"><b>{saved && !editing ? "Your patient file" : "First visit? Start your patient file"}</b>
          {!editing && <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>Edit</Button>}</div>
        {editing ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-sm sm:col-span-2"><span className="inline-flex items-center">Legal name<InfoTip text="Your full legal name, the way your PRO has it on file. Agencies match writers by legal name." /></span>
              <Input value={f.legalName} onChange={(e) => set("legalName", e.target.value)} /></label>
            <label className="space-y-1 text-sm"><span className="inline-flex items-center">PRO<InfoTip text="The performing rights organization you joined as a writer, like BMI or ASCAP." /></span>
              <ProSelect value={f.pro} onChange={(v) => set("pro", v)} /></label>
            <label className="space-y-1 text-sm"><span className="inline-flex items-center">IPI number<InfoTip text="Your 9–11 digit writer number. Your PRO gives it to you when you register." /></span>
              <Input inputMode="numeric" value={f.ipi} onChange={(e) => set("ipi", e.target.value.replace(/\D/g, ""))} /></label>
            <label className="space-y-1 text-sm sm:col-span-2"><span className="inline-flex items-center">Publisher status<InfoTip text="Who collects the publisher half of your songwriter money." /></span>
              <select className="w-full rounded-md border border-input bg-background px-3 py-2" value={f.publishing} onChange={(e) => set("publishing", e.target.value)}>
                <option value="">Choose one…</option>
                <option value="publisher">I have a publisher</option>
                <option value="self">I'm self-published</option>
                <option value="bmi">I'm a BMI writer with no publishing company</option>
              </select></label>
            {f.publishing === "publisher" && <label className="space-y-1 text-sm sm:col-span-2">Publisher name<Input value={f.publisher} onChange={(e) => set("publisher", e.target.value)} /></label>}
            <div className="sm:col-span-2"><Button disabled={!ready} onClick={keep}>Save my patient file</Button>
              <span className="ml-2 text-xs text-muted-foreground">Saved on this device, so you won't retype it.</span></div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground"><b className="text-foreground">{f.legalName}</b>{f.pro ? ` · ${f.pro}` : ""}{f.ipi ? ` · IPI ${f.ipi}` : ""} · {f.publishing === "publisher" ? f.publisher : f.publishing === "bmi" ? "BMI writer, no publisher" : "Self-published"}</p>
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <button type="button" disabled={editing} onClick={() => onVisit("single", f)} className="rounded-xl border-2 border-border p-4 text-left transition hover:border-primary disabled:opacity-50">
          <b className="block">Single Track Checkup</b><span className="text-sm text-muted-foreground">Fill in one song's chart for a quick diagnosis.</span></button>
        <button type="button" disabled={editing} onClick={() => onVisit("catalog", f)} className="rounded-xl border-2 border-border p-4 text-left transition hover:border-primary disabled:opacity-50">
          <b className="block">Catalog Examination</b><span className="text-sm text-muted-foreground">{hasCatalog ? "Your whole catalog, plus" : "Bring"} your agency records for every song.</span></button>
      </div>
    </div>
  );
}

export const SCAN_PHASES = [
  "🫀 Checking pulse and song vitals…",
  "📋 Cross-referencing PRO performance splits…",
  "💿 Verifying streaming distribution & SoundExchange…",
  "🩺 Formulating diagnosis…",
] as const;

/** Step 3: the active scan. Each vital runs in turn; the last waits for the live lookups to finish. */
export function ClinicalScan({ busy, progress, onDone }: { busy: boolean; progress?: string | undefined; onDone: () => void }) {
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    if (phase < SCAN_PHASES.length - 1) { const t = setTimeout(() => setPhase((p) => p + 1), 1400); return () => clearTimeout(t); }
    if (busy) return;
    const t = setTimeout(onDone, 1200);
    return () => clearTimeout(t);
  }, [phase, busy]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="mx-auto max-w-lg space-y-3" role="status" aria-live="polite">
      {SCAN_PHASES.map((p, i) => (
        <div key={p} className={`flex items-center gap-3 rounded-xl border p-3 text-sm transition ${i === phase ? "border-primary bg-primary/5 font-semibold" : i < phase ? "border-border" : "border-border opacity-40"}`}>
          {i < phase ? <CheckCircle2 className="h-5 w-5 text-primary" /> : i === phase ? <Loader2 className="h-5 w-5 animate-spin text-primary" /> : <Stethoscope className="h-5 w-5 text-muted-foreground" />}
          <span>{p}</span>
        </div>
      ))}
      {progress && <p className="text-center text-xs text-muted-foreground">{progress}</p>}
    </div>
  );
}
