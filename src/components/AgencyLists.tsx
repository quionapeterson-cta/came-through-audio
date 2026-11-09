import { useEffect, useRef, useState } from "react";
import { FileUp, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { confirmAction } from "@/components/ConfirmHost";
import { Button } from "@/components/ui/button";
import { clearIntake, readIntake, writeIntake } from "@/lib/intake-session";
import { compareList, downloadSteps, readTable, readWorks, type ListResult, type SavedListSummary } from "@/lib/agency-lists";
import type { CatalogTrack } from "@/lib/catalog";
import type { Society } from "@/lib/repertoires";

type Props = {
  /** The account this sitting belongs to, so the comparison survives a tab switch, a reload or a second window. */
  userId?: string | undefined;
  societies: Society[];
  /** The songs that should be on each society's list. */
  songsFor: (societyId: string) => CatalogTrack[];
  summaries: Record<string, SavedListSummary | undefined>;
  onApply: (society: Society, result: ListResult, file: string) => Promise<void>;
  /** "Start this list over": removes what the uploaded list added, so the right file can be brought in. */
  onRemove?: ((society: Society) => Promise<void>) | undefined;
};

/** One society's last comparison in this browser: what was shown, and which file it came from. */
type StoredLists = { byId: Record<string, { file: string; result: ListResult }>; shownId?: string | undefined };

const STORE = "agency-lists";

/** "Confirm with your agency lists": upload what each agency has on file, and see what matches. */
export function AgencyLists({ userId, societies, songsFor, summaries, onApply, onRemove }: Props) {
  const [busy, setBusy] = useState<string>();
  const [stored, setStored] = useState<StoredLists>({ byId: {} });
  const [shownId, setShownId] = useState<string>();
  const [restored, setRestored] = useState(false);
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
      const result = compareList(works, songsFor(society.id), society.id === "soundexchange");
      await onApply(society, result, file.name);
      setStored((s) => ({ ...s, byId: { ...s.byId, [society.id]: { file: file.name, result } } }));
      setShownId(society.id);
      toast.success(`${society.name}: ${result.matched.length} matched, ${result.differences.length} different, ${result.notListed.length} not on the list.`);
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

  const shown = shownId ? societies.find((s) => s.id === shownId) : undefined;
  const shownResult = shownId ? stored.byId[shownId]?.result : undefined;

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
          {shownResult.extra.length > 0 && <p className="mt-3 text-xs text-muted-foreground">
            {shownResult.extra.length} work{shownResult.extra.length === 1 ? " is" : "s are"} on your {shown.name} list but not in your catalog ({shownResult.extra.slice(0, 5).map((w) => w.title).join(", ")}{shownResult.extra.length > 5 ? ", …" : ""}). Add them in My Catalog so they're in your report.
          </p>}
          <p className="mt-3 text-xs text-muted-foreground">Differences and missing songs now show in your Royalty Health Report with the steps to fix them.</p>
        </div>
      )}
    </div>
  );
}
