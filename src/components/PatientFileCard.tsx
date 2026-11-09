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
    <div className="rounded-2xl border border-border bg-muted/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[2px] text-primary">Artist file</p>
          <h4 className="mt-0.5 font-bold">{saved && !editing ? "Your details at the desk" : "First visit? Leave your details"}</h4>
        </div>
        {editing
          ? <span className="text-xs text-muted-foreground">Kept on this device, so you never retype it.</span>
          : <Button size="sm" variant="outline" onClick={() => { setFile(saved ?? file); setEditing(true); }}><Pencil />Edit</Button>}
      </div>

      {editing ? (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="space-y-1 text-sm sm:col-span-2">
            <span className="inline-flex items-center">Legal name<InfoTip text="Your full legal name, the way your PRO has it on file. Agencies match writers by legal name." /></span>
            <Input aria-label="Legal name" value={file.legalName} onChange={(e) => set("legalName", e.target.value)} />
          </label>
          <label className="space-y-1 text-sm">
            <span className="inline-flex items-center">PRO<InfoTip text="The performing rights organization you joined as a writer, like BMI or ASCAP." /></span>
            <ProSelect value={file.pro} onChange={(v) => set("pro", v)} />
          </label>
          <label className="space-y-1 text-sm">
            <span className="inline-flex items-center">IPI number<InfoTip text="Your 9-11 digit writer number. Your PRO gives it to you when you register, so it can wait." /></span>
            <Input aria-label="IPI number" inputMode="numeric" value={file.ipi} onChange={(e) => set("ipi", e.target.value.replace(/[^0-9]/g, ""))} />
          </label>
          <label className="space-y-1 text-sm sm:col-span-2">
            <span className="inline-flex items-center">Publisher status<InfoTip text="Who collects the publisher half of your songwriter money. If you don't have a publisher, you're self-published." /></span>
            <select aria-label="Publisher status" className="w-full rounded-md border border-input bg-background px-3 py-2" value={file.publishing} onChange={(e) => set("publishing", e.target.value)}>
              <option value="">Choose one...</option>
              <option value="publisher">I have a publisher</option>
              <option value="self">I&apos;m self-published</option>
              <option value="bmi">I&apos;m a BMI writer with no publishing company</option>
            </select>
          </label>
          {file.publishing === "publisher" && (
            <label className="space-y-1 text-sm sm:col-span-2">Publisher name<Input aria-label="Publisher name" value={file.publisher} onChange={(e) => set("publisher", e.target.value)} /></label>
          )}
          <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
            <Button size="sm" disabled={!ready} onClick={keep}><CheckCircle2 />{saved ? "Save my details" : "Submit to Front Desk"}</Button>
            {!ready && <span className="text-xs text-muted-foreground">A legal name and your publisher status are all the desk needs.</span>}
          </div>
        </div>
      ) : (
        saved && (
          <p className="mt-2 text-sm text-muted-foreground">
            <b className="text-foreground">{saved.legalName}</b>
            {patientSummary(saved) ? ` · ${patientSummary(saved)}` : ""}
          </p>
        )
      )}
    </div>
  );
}
