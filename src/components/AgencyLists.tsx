import { useRef, useState } from "react";
import { FileUp, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { compareList, readTable, readWorks, type ListResult, type SavedListSummary } from "@/lib/agency-lists";
import type { CatalogTrack } from "@/lib/catalog";
import type { Society } from "@/lib/repertoires";

type Props = {
  societies: Society[];
  /** The songs that should be on each society's list. */
  songsFor: (societyId: string) => CatalogTrack[];
  summaries: Record<string, SavedListSummary | undefined>;
  onApply: (society: Society, result: ListResult, file: string) => Promise<void>;
};

/** "Confirm with your agency lists": upload what each agency has on file, and see what matches. */
export function AgencyLists({ societies, songsFor, summaries, onApply }: Props) {
  const [busy, setBusy] = useState<string>();
  const [shown, setShown] = useState<{ society: Society; result: ListResult }>();
  const inputs = useRef<Record<string, HTMLInputElement | null>>({});

  async function upload(society: Society, file: File) {
    setBusy(society.id);
    try {
      const works = readWorks(await readTable(file));
      const result = compareList(works, songsFor(society.id), society.id === "soundexchange");
      await onApply(society, result, file.name);
      setShown({ society, result });
      toast.success(`${society.name}: ${result.matched.length} matched, ${result.differences.length} different, ${result.notListed.length} not on the list.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't read that file.");
    } finally {
      setBusy(undefined);
      const el = inputs.current[society.id];
      if (el) el.value = "";
    }
  }

  return (
    <div className="space-y-4">
      <p className="max-w-[68ch] text-sm text-muted-foreground">
        In your agency account, download your list of registered songs (or recordings, for SoundExchange) as a spreadsheet, then add it here.
        We match it to your catalog and show what's confirmed, what's different and what's missing. Your file is read on this device and isn't uploaded; only the comparison is saved.
      </p>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {societies.map((s) => {
          const sum = summaries[s.id];
          return (
            <div key={s.id} className={`flex min-h-28 flex-col items-center justify-center gap-1 rounded-2xl border-2 p-3 text-center ${sum ? "border-primary bg-card" : "border-dashed border-border bg-muted/40"}`}>
              <b className="text-sm">{s.name} list</b>
              {sum ? <span className="text-xs text-primary">Uploaded {new Date(sum.at).toLocaleDateString(undefined, { month: "short", day: "numeric" })} · {sum.matched} matched{sum.differences ? ` · ⚠️ ${sum.differences} different` : ""}</span>
                : <span className="text-xs text-muted-foreground">CSV, Excel (.xlsx) or BMI PDF</span>}
              <input ref={(el) => { inputs.current[s.id] = el; }} type="file" accept=".csv,.tsv,.txt,.xlsx,.xls,.pdf,application/pdf" className="hidden" aria-label={`Upload your ${s.name} list`}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(s, f); }} />
              <Button size="sm" variant={sum ? "outline" : "default"} className="mt-1" disabled={!!busy} onClick={() => inputs.current[s.id]?.click()}>
                {busy === s.id ? <Loader2 className="animate-spin" /> : <FileUp />}{sum ? "Upload a new list" : "Choose file"}
              </Button>
            </div>
          );
        })}
      </div>

      {shown && (
        <div className="rounded-2xl border border-border p-4">
          <h4 className="font-bold">{shown.society.name}: {shown.result.works} work{shown.result.works === 1 ? "" : "s"} on your list</h4>
          <div className="mt-3 grid gap-4 md:grid-cols-3">
            <div><div className="text-sm font-semibold text-primary">✓ Confirmed · {shown.result.matched.length}</div>
              <ul className="mt-1 text-sm text-muted-foreground">{shown.result.matched.slice(0, 12).map((m) => <li key={m.trackId}>{m.title}</li>)}</ul></div>
            <div><div className="text-sm font-semibold">⚠️ Different · {shown.result.differences.length}</div>
              <ul className="mt-1 space-y-1 text-sm">{shown.result.differences.map((m) => <li key={m.trackId}><b>{m.title}</b><span className="block text-xs text-muted-foreground">{m.issues.join(" · ")}</span></li>)}</ul></div>
            <div><div className="text-sm font-semibold">Not on the list · {shown.result.notListed.length}</div>
              <ul className="mt-1 text-sm text-muted-foreground">{shown.result.notListed.slice(0, 12).map((m) => <li key={m.trackId}>{m.title}</li>)}</ul></div>
          </div>
          {shown.result.extra.length > 0 && <p className="mt-3 text-xs text-muted-foreground">
            {shown.result.extra.length} work{shown.result.extra.length === 1 ? " is" : "s are"} on your {shown.society.name} list but not in your catalog ({shown.result.extra.slice(0, 5).map((w) => w.title).join(", ")}{shown.result.extra.length > 5 ? ", …" : ""}). Add them in My Catalog so they're in your report.
          </p>}
          <p className="mt-3 text-xs text-muted-foreground">Differences and missing songs now show in your Royalty Health Report with the steps to fix them.</p>
        </div>
      )}
    </div>
  );
}
