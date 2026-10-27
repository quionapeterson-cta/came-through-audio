import { useEffect, useState } from "react";
import { BookUser, Plus, Trash2, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ALL_PROS, CONTRIBUTOR_KINDS, deleteContributor, listContributors, saveContributors, type SavedContributor } from "@/lib/splits";
import { WRITER_ROLES } from "@/lib/metadata";
import { InfoTip } from "@/components/InfoTip";

const blank = (): SavedContributor => ({ name: "", kind: "Writer", email: "", pro: "", ipi: "", publisher: "", label: "", role: "", share: "" });
const isWriter = (c: SavedContributor) => c.kind === "Writer" || c.kind === "Composer";
const field = "w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm";

/**
 * Saved writers, composers, producers, publishers and labels for quick reuse: on split sheets, and as name suggestions in
 * Embed Metadata and My Catalog. Songs you save add their people here automatically (blanks only).
 */
export function ContributorLibrary({ userId, refreshKey, onSaved }: { userId: string; refreshKey: number; onSaved?: () => void }) {
  const [rows, setRows] = useState<SavedContributor[]>([]);
  const [open, setOpen] = useState(false);

  const load = () => listContributors().then(setRows).catch(() => toast.error("Could not load your contributors."));
  useEffect(() => { void load(); }, [userId, refreshKey]);

  const update = (i: number, patch: Partial<SavedContributor>) => setRows((r) => r.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));

  return (
    // In the Split Sheets top row this is a summary card; the editor needs the full width, so it moves below the row.
    <div className={`rounded-2xl border border-border p-5 ${open ? "lg:order-last lg:col-span-full" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10"><BookUser className="h-5 w-5 text-primary" /></span>
          <div>
            <h3 className="font-bold">Contributor Library</h3>
            <p className="mt-0.5 max-w-sm text-sm leading-relaxed text-muted-foreground"><span className="font-semibold text-foreground">{rows.length}</span> saved writers, producers, publishers &amp; labels. They show up as you type names on songs and split sheets, and songs you save add their people here.</p>
          </div>
        </div>
        <Button size="sm" variant="outline" onClick={() => setOpen((o) => !o)}>{open ? "Hide" : "Manage"}</Button>
      </div>
      {open && (
        <div className="mt-4 space-y-2">
          {rows.map((c, i) => (
            <div key={c.id ?? i} className="grid gap-2 rounded-lg border border-border p-3 sm:grid-cols-2 lg:grid-cols-[1.3fr_0.9fr_1.2fr_0.8fr_0.9fr_auto]">
              <input className={field} value={c.name} placeholder="Legal name / company" onChange={(e) => update(i, { name: e.target.value })} />
              <select className={field} value={c.kind} onChange={(e) => update(i, { kind: e.target.value })}>
                {CONTRIBUTOR_KINDS.map((k) => <option key={k}>{k}</option>)}
              </select>
              <input className={field} value={c.email} placeholder="Email" onChange={(e) => update(i, { email: e.target.value })} />
              <select className={field} value={c.pro} onChange={(e) => update(i, { pro: e.target.value })}>
                <option value="">PRO…</option>
                {c.pro && !(ALL_PROS as readonly string[]).includes(c.pro) && <option value={c.pro}>{c.pro}</option>}
                {ALL_PROS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
              <input className={field} value={c.ipi} placeholder="IPI #" onChange={(e) => update(i, { ipi: e.target.value })} />
              {isWriter(c) ? <>
                <select className={field} aria-label="Usual role" value={c.role ?? ""} onChange={(e) => update(i, { role: e.target.value })}>
                  <option value="">Usual role…</option>
                  {WRITER_ROLES.map((r) => <option key={r}>{r}</option>)}
                </select>
                <label className="flex items-center gap-1">
                  <input className={field} type="number" min="0" max="100" step="0.01" value={c.share ?? ""} placeholder="Usual split %" aria-label="Usual split (%)" onChange={(e) => update(i, { share: e.target.value })} />
                  <InfoTip title="Usual split" text="The share this writer usually gets on your songs. It fills in when you add them to a song, and you can change it for that song." />
                </label>
              </> : <span className="hidden lg:block" />}
              <input className={field} value={c.publisher} placeholder="Publisher" onChange={(e) => update(i, { publisher: e.target.value })} />
              <input className={field} value={c.label} placeholder="Label" onChange={(e) => update(i, { label: e.target.value })} />
              <Button size="icon" variant="ghost" aria-label="Remove" onClick={async () => {
                if (c.id) await deleteContributor(c.id).catch(() => toast.error("Could not remove."));
                setRows((r) => r.filter((_, idx) => idx !== i));
              }}><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setRows((r) => [...r, blank()])}><Plus className="h-4 w-4" /> Add</Button>
            <Button size="sm" onClick={async () => {
              try { await saveContributors(userId, rows); toast.success("Contributor library saved."); await load(); onSaved?.(); }
              catch { toast.error("Could not save contributors."); }
            }}><Save className="h-4 w-4" /> Save library</Button>
          </div>
        </div>
      )}
    </div>
  );
}
