import { useEffect, useState } from "react";
import { BookUser, Plus, Trash2, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ALL_PROS, CONTRIBUTOR_KINDS, deleteContributor, listContributors, saveContributors, type SavedContributor } from "@/lib/splits";

const blank = (): SavedContributor => ({ name: "", kind: "Writer", email: "", pro: "", ipi: "", publisher: "", label: "" });
const field = "w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm";

/** Saved writers, composers, producers, publishers and labels for quick reuse. */
export function ContributorLibrary({ userId, refreshKey }: { userId: string; refreshKey: number }) {
  const [rows, setRows] = useState<SavedContributor[]>([]);
  const [open, setOpen] = useState(false);

  const load = () => listContributors().then(setRows).catch(() => toast.error("Could not load your contributors."));
  useEffect(() => { void load(); }, [userId, refreshKey]);

  const update = (i: number, patch: Partial<SavedContributor>) => setRows((r) => r.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));

  return (
    <div className="rounded-2xl border border-border p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <BookUser className="h-6 w-6 text-primary" />
          <div>
            <h3 className="font-bold">Contributor Library</h3>
            <p className="text-sm text-muted-foreground">{rows.length} saved writers, producers, publishers &amp; labels — reused automatically.</p>
          </div>
        </div>
        <Button size="sm" variant="outline" onClick={() => setOpen((o) => !o)}>{open ? "Hide" : "Manage"}</Button>
      </div>
      {open && (
        <div className="mt-4 space-y-2">
          {rows.map((c, i) => (
            <div key={c.id ?? i} className="grid gap-2 rounded-lg border border-border p-3 md:grid-cols-[1.3fr_0.9fr_1.2fr_0.7fr_0.9fr_1fr_1fr_auto]">
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
              try { await saveContributors(userId, rows); toast.success("Contributor library saved."); await load(); }
              catch { toast.error("Could not save contributors."); }
            }}><Save className="h-4 w-4" /> Save library</Button>
          </div>
        </div>
      )}
    </div>
  );
}
