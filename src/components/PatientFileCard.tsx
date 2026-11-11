import { useEffect, useState } from "react";
import { CheckCircle2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InfoTip } from "@/components/InfoTip";
import { ProSelect } from "@/components/ProSelect";
import { loadPatientFile, loadPatientFileFromAccount, savePatientFile, type PatientFile } from "@/components/DoctorsOffice";
import { loadOnboarding, loadProfile, patientFileFromDefaults, type ArtistProfile, type Onboarding } from "@/lib/artist-profile";
import { supabase } from "@/integrations/supabase/client";

/**
 * The patient file (PLAN-royalty-health-hub-v2 §2 Step 1), handed over at the Front Desk the way you give your details
 * to a receptionist before an appointment. Saved on this device per user, so a Free account never retypes it, and the
 * Doctor reads the same file for the intake form's writer defaults. Nothing here writes to the catalog.
 *
 * A first visit starts from what Embed Defaults and Catalog Defaults already say (`patientFileFromDefaults`), so a member
 * with finished defaults only confirms the file instead of typing it again.
 *
 * Redesigned 2026-11-11 as the compact chart: one tight card, the file on a single line, and a pencil in the corner
 * instead of an Edit button. The file stays at the desk because Check In waits for it.
 */
export type { PatientFile };
const blank: PatientFile = { legalName: "", pro: "", ipi: "", publishing: "", publisher: "" };

const PUBLISHING: Record<Exclude<PatientFile["publishing"], "">, string> = {
  publisher: "I have a publisher",
  self: "I'm self-published",
  bmi: "I'm a BMI writer with no publishing company",
};

/** What the desk needs before it can check you in: a name, and who collects the publisher half. */
export const patientFileReady = (f: PatientFile | null | undefined) =>
  !!f && !!f.legalName.trim() && !!f.publishing && (f.publishing !== "publisher" || !!f.publisher.trim());

export const patientSummary = (f: PatientFile) =>
  [f.pro, f.ipi ? `IPI ${f.ipi}` : "", f.publishing === "publisher" ? f.publisher || "publisher" : f.publishing ? PUBLISHING[f.publishing] : ""]
    .filter(Boolean)
    .join(" · ");

export function PatientFileCard({ userId, defaultName, patient, onSaved }: {
  userId: string;
  defaultName: string;
  /** The file the Front Desk already holds, so the card and Check In never disagree about whether you're checked in. */
  patient?: PatientFile | null;
  onSaved?: (f: PatientFile) => void;
}) {
  const [local, setLocal] = useState<PatientFile | null>(() => loadPatientFile(userId));
  const saved = patient ?? local;
  const fromDefaults = (ob: Pick<Onboarding, "legalName"> | null, p: ArtistProfile | null): PatientFile => {
    const f = patientFileFromDefaults(ob, p);
    return { ...blank, ...f, legalName: f.legalName || defaultName };
  };
  const [file, setFile] = useState<PatientFile>(() => saved ?? fromDefaults(loadOnboarding(userId), loadProfile(userId)));
  const [editing, setEditing] = useState(() => !saved);
  /** Once the member types, a late answer from the account never replaces what they wrote. */
  const [touched, setTouched] = useState(false);
  const set = (k: keyof PatientFile, v: string) => { setTouched(true); setFile((x) => ({ ...x, [k]: v })); };
  const ready = patientFileReady(file);

  // A file that arrives from the account, or from the hub, replaces the empty form.
  useEffect(() => {
    if (!saved) return;
    setFile(saved);
    setEditing(false);
  }, [saved]);

  // Nothing on this device: ask the account before asking the patient to type it all again. No file there either: the
  // account's own defaults, which a fresh browser may not have synced yet.
  useEffect(() => {
    if (saved) return;
    let alive = true;
    loadPatientFileFromAccount(userId).then(async (f) => {
      if (!alive) return;
      if (f) { setLocal(f); return; }
      const { data } = await supabase.from("profiles").select("artist_defaults, onboarding").eq("id", userId).maybeSingle();
      const row = data as { artist_defaults?: ArtistProfile | null; onboarding?: Onboarding | null } | null;
      if (alive && row && !touched) setFile(fromDefaults(row.onboarding ?? null, row.artist_defaults ?? null));
    }).catch(() => {});
    return () => { alive = false; };
  }, [userId, saved]); // eslint-disable-line react-hooks/exhaustive-deps

  function keep() {
    savePatientFile(userId, file);
    setLocal(file);
    setEditing(false);
    onSaved?.(file);
  }

  return (
    <div className="rounded-lg border border-border bg-muted/30 px-3 py-2.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">Artist file</p>
          <h4 className="mt-0.5 text-sm font-bold leading-snug">{saved && !editing ? "Your details at the desk" : "First visit? Leave your details"}</h4>
        </div>
        {editing
          ? <span className="shrink-0 pt-0.5 text-[11px] text-muted-foreground">Kept on this device, so you never retype it.</span>
          : <Button size="sm" variant="ghost" title="Edit the artist file"
              className="h-7 shrink-0 gap-1 px-2 text-xs text-muted-foreground hover:text-primary" onClick={() => { setFile(saved ?? file); setEditing(true); }}>
              <Pencil className="h-3.5 w-3.5" />Edit artist file
            </Button>}
      </div>

      {editing ? (
        <div className="mt-2.5 grid gap-2 sm:grid-cols-2">
          <label className="space-y-1 text-xs sm:col-span-2">
            <span className="inline-flex items-center font-semibold">Legal name<InfoTip text="Your full legal name, the way your PRO has it on file. Agencies match writers by legal name." /></span>
            <Input aria-label="Legal name" className="h-8" value={file.legalName} onChange={(e) => set("legalName", e.target.value)} />
          </label>
          <label className="space-y-1 text-xs">
            <span className="inline-flex items-center font-semibold">PRO<InfoTip text="The performing rights organization you joined as a writer, like BMI or ASCAP." /></span>
            <ProSelect value={file.pro} onChange={(v) => set("pro", v)} />
          </label>
          <label className="space-y-1 text-xs">
            <span className="inline-flex items-center font-semibold">IPI number<InfoTip text="Your 9-11 digit writer number. Your PRO gives it to you when you register, so it can wait." /></span>
            <Input aria-label="IPI number" className="h-8" inputMode="numeric" value={file.ipi} onChange={(e) => set("ipi", e.target.value.replace(/[^0-9]/g, ""))} />
          </label>
          <label className="space-y-1 text-xs sm:col-span-2">
            <span className="inline-flex items-center font-semibold">Publisher status<InfoTip text="Who collects the publisher half of your songwriter money. If you don't have a publisher, you're self-published." /></span>
            <select aria-label="Publisher status" className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs" value={file.publishing} onChange={(e) => set("publishing", e.target.value)}>
              <option value="">Choose one...</option>
              <option value="publisher">I have a publisher</option>
              <option value="self">I&apos;m self-published</option>
              <option value="bmi">I&apos;m a BMI writer with no publishing company</option>
            </select>
          </label>
          {file.publishing === "publisher" && (
            <label className="space-y-1 text-xs sm:col-span-2">Publisher name<Input aria-label="Publisher name" className="h-8" value={file.publisher} onChange={(e) => set("publisher", e.target.value)} /></label>
          )}
          <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
            <Button size="sm" disabled={!ready} onClick={keep}><CheckCircle2 />{saved ? "Save my details" : "Submit to Front Desk"}</Button>
            {!ready && <span className="text-[11px] text-muted-foreground">A legal name and your publisher status are all the desk needs.</span>}
          </div>
        </div>
      ) : (
        saved && (
          /* The chart itself: the whole file on one tight line, the way a desk reads it back to you. */
          <p className="mt-1 text-xs leading-relaxed">
            <b className="text-sm text-foreground">{saved.legalName}</b>
            {patientSummary(saved) ? <span className="text-muted-foreground">{` · ${patientSummary(saved)}`}</span> : ""}
          </p>
        )
      )}
    </div>
  );
}
