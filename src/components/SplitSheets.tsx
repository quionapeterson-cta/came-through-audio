import { useEffect, useMemo, useState } from "react";
import { FileSignature, Plus, Trash2, Download, Lock, PenLine, Check, ChevronLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { listTracks, type CatalogTrack } from "@/lib/catalog";
import {
  SPLIT_ROLES,
  collaboratorsFromTrack,
  deleteSplitSheet,
  emptySplitCollaborator,
  listSplitSheets,
  saveSplitSheet,
  signCollaborator,
  splitStatus,
  splitTotal,
  type SplitCollaborator,
} from "@/lib/splits";

const statusBadge: Record<string, { label: string; className: string }> = {
  draft: { label: "Draft", className: "border-border text-muted-foreground" },
  partial: { label: "Partially signed", className: "border-primary text-primary" },
  signed: { label: "Fully signed", className: "border-primary bg-primary text-primary-foreground" },
};

export function SplitSheets({ userId, canSplit, prefillTrackId, onUpgrade }: { userId: string; canSplit: boolean; prefillTrackId: string | undefined; onUpgrade: () => void }) {
  const [tracks, setTracks] = useState<CatalogTrack[]>([]);
  const [sheets, setSheets] = useState<Map<string, SplitCollaborator[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<CatalogTrack | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [t, s] = await Promise.all([listTracks(), listSplitSheets()]);
      setTracks(t);
      setSheets(s);
    } catch {
      toast.error("Could not load your split sheets.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [userId]);

  useEffect(() => {
    if (prefillTrackId && !loading) {
      const track = tracks.find((t) => t.id === prefillTrackId);
      if (track) setEditing(track);
    }
  }, [prefillTrackId, loading]);

  if (!canSplit) {
    return (
      <div className="mt-6 flex min-h-72 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border p-10 text-center">
        <Lock className="h-10 w-10 text-primary" />
        <h2 className="mt-4 text-2xl font-bold">Split Sheets are a Catalog &amp; Collaborate feature</h2>
        <p className="mt-2 max-w-md text-muted-foreground">Upgrade and Get Unlimited Split Sheets and E-Signatures.</p>
        <Button className="mt-6" onClick={onUpgrade}>View Plans</Button>
      </div>
    );
  }

  if (editing) {
    return (
      <SplitEditor
        track={editing}
        initial={sheets.get(editing.id)}
        onClose={() => setEditing(null)}
        onSaved={async () => {
          setEditing(null);
          await load();
        }}
      />
    );
  }

  return (
    <div className="mt-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">Split Sheets</h2>
          <p className="text-sm text-muted-foreground">Create industry-standard split sheets from your catalog songs and collect typed e-signatures.</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
      ) : tracks.length === 0 ? (
        <div className="flex min-h-60 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border p-10 text-center">
          <FileSignature className="h-10 w-10 text-primary" />
          <p className="mt-4 max-w-md text-muted-foreground">Add a song to My Catalog first — every split sheet is tied to one of your tracks.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {tracks.map((track) => {
            const collaborators = sheets.get(track.id);
            const status = collaborators ? splitStatus(collaborators) : null;
            const badge = status ? statusBadge[status] : null;
            return (
              <div key={track.id} className="rounded-2xl border border-border p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-bold">{track.title}</div>
                    <div className="text-sm text-muted-foreground">{track.artist}</div>
                  </div>
                  {badge && <Badge variant="outline" className={badge.className}>{badge.label}</Badge>}
                </div>
                {collaborators ? (
                  <div className="mt-4 space-y-1.5 text-sm">
                    {collaborators.filter((c) => c.name).map((c, i) => (
                      <div key={i} className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-2">
                          {c.signedAt ? <Check className="h-3.5 w-3.5 text-primary" /> : <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />}
                          {c.name} <span className="text-muted-foreground">· {c.role}</span>
                        </span>
                        <span className="font-semibold">{c.percentage}%</span>
                      </div>
                    ))}
                    <div className="flex items-center justify-between border-t border-border pt-1.5 font-semibold">
                      <span>Total</span><span className={splitTotal(collaborators) === 100 ? "text-primary" : "text-destructive"}>{splitTotal(collaborators)}%</span>
                    </div>
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-muted-foreground">No split sheet yet for this song.</p>
                )}
                <div className="mt-4 flex gap-2">
                  <Button size="sm" className="flex-1" onClick={() => setEditing(track)}>
                    <PenLine className="h-4 w-4" /> {collaborators ? "Edit split sheet" : "Create split sheet"}
                  </Button>
                  {collaborators && (
                    <>
                      <Button size="sm" variant="outline" onClick={() => void downloadSplitPdf(track, collaborators)} aria-label="Download PDF"><Download className="h-4 w-4" /></Button>
                      <Button size="sm" variant="outline" aria-label="Delete split sheet"
                        onClick={async () => {
                          try {
                            await deleteSplitSheet(track.id);
                            toast.success("Split sheet deleted.");
                            await load();
                          } catch {
                            toast.error("Could not delete the split sheet.");
                          }
                        }}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SplitEditor({ track, initial, onClose, onSaved }: { track: CatalogTrack; initial: SplitCollaborator[] | undefined; onClose: () => void; onSaved: () => void }) {
  const [collaborators, setCollaborators] = useState<SplitCollaborator[]>(initial?.length ? initial : collaboratorsFromTrack(track));
  const [signingIndex, setSigningIndex] = useState<number | null>(null);
  const [typedName, setTypedName] = useState("");
  const [saving, setSaving] = useState(false);

  const total = useMemo(() => splitTotal(collaborators), [collaborators]);
  const totalOk = total === 100;
  const status = splitStatus(collaborators);

  const update = (i: number, patch: Partial<SplitCollaborator>) =>
    setCollaborators((rows) => rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const save = async () => {
    if (!totalOk) {
      toast.error("Splits must add up to exactly 100%.");
      return;
    }
    setSaving(true);
    try {
      await saveSplitSheet(track.id, collaborators);
      toast.success("Split sheet saved.");
      onSaved();
    } catch {
      toast.error("Could not save the split sheet.");
    } finally {
      setSaving(false);
    }
  };

  const sign = async (i: number) => {
    const c = collaborators[i];
    if (!c) return;
    if (typedName.trim().toLowerCase() !== c.name.trim().toLowerCase()) {
      toast.error("Type the collaborator's full legal name exactly as listed to sign.");
      return;
    }
    const signed = await signCollaborator(c, typedName);
    update(i, signed);
    setSigningIndex(null);
    setTypedName("");
    toast.success(`${c.name} signed.`);
  };

  return (
    <div className="mt-6 space-y-6">
      <Button variant="ghost" size="sm" onClick={onClose}><ChevronLeft className="h-4 w-4" /> Back to split sheets</Button>

      <div className="rounded-2xl border border-border p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold">{track.title}</h2>
            <p className="text-sm text-muted-foreground">{track.artist}{track.metadata.isrc ? ` · ISRC ${track.metadata.isrc}` : ""}</p>
          </div>
          <Badge variant="outline" className={statusBadge[status]!.className}>{statusBadge[status]!.label}</Badge>
        </div>

        <div className="mt-6 space-y-3">
          {collaborators.map((c, i) => (
            <div key={i} className="rounded-xl border border-border p-4">
              <div className="grid gap-3 md:grid-cols-[1.4fr_1.4fr_1fr_0.6fr_auto]">
                <label className="space-y-1 text-sm">
                  <span className="font-medium">Legal name</span>
                  <input value={c.name} onChange={(e) => update(i, { name: e.target.value })} disabled={!!c.signedAt}
                    className="w-full rounded-md border border-input bg-background px-3 py-2" placeholder="Full legal name" />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="font-medium">Email</span>
                  <input type="email" value={c.email} onChange={(e) => update(i, { email: e.target.value })} disabled={!!c.signedAt}
                    className="w-full rounded-md border border-input bg-background px-3 py-2" placeholder="collaborator@email.com" />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="font-medium">Role</span>
                  <select value={c.role} onChange={(e) => update(i, { role: e.target.value as SplitCollaborator["role"] })} disabled={!!c.signedAt}
                    className="w-full rounded-md border border-input bg-background px-3 py-2">
                    {SPLIT_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </label>
                <label className="space-y-1 text-sm">
                  <span className="font-medium">Split %</span>
                  <input type="number" min={0} max={100} value={c.percentage || ""} disabled={!!c.signedAt}
                    onChange={(e) => update(i, { percentage: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })}
                    className="w-full rounded-md border border-input bg-background px-3 py-2" placeholder="0" />
                </label>
                <div className="flex items-end gap-1">
                  {!c.signedAt && collaborators.length > 1 && (
                    <Button variant="ghost" size="icon" aria-label="Remove collaborator" onClick={() => setCollaborators((rows) => rows.filter((_, idx) => idx !== i))}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <label className="space-y-1 text-sm">
                  <span className="font-medium">PRO affiliation</span>
                  <input value={c.pro} onChange={(e) => update(i, { pro: e.target.value })} disabled={!!c.signedAt}
                    className="w-full rounded-md border border-input bg-background px-3 py-2" placeholder="ASCAP, BMI…" />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="font-medium">IPI / CAE number</span>
                  <input value={c.ipi} onChange={(e) => update(i, { ipi: e.target.value })} disabled={!!c.signedAt}
                    className="w-full rounded-md border border-input bg-background px-3 py-2" placeholder="Optional" />
                </label>
              </div>

              <div className="mt-3">
                {c.signedAt ? (
                  <p className="flex items-center gap-2 text-sm text-primary">
                    <Check className="h-4 w-4" /> Signed by {c.signatureName} on {new Date(c.signedAt).toLocaleDateString()}
                  </p>
                ) : signingIndex === i ? (
                  <div className="flex flex-wrap items-center gap-2 rounded-lg bg-muted p-3">
                    <input value={typedName} onChange={(e) => setTypedName(e.target.value)} placeholder={`Type "${c.name}" to sign`}
                      className="min-w-56 flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm" />
                    <Button size="sm" onClick={() => void sign(i)}>Sign</Button>
                    <Button size="sm" variant="ghost" onClick={() => { setSigningIndex(null); setTypedName(""); }}>Cancel</Button>
                  </div>
                ) : (
                  <Button size="sm" variant="outline" disabled={!c.name.trim()} onClick={() => { setSigningIndex(i); setTypedName(""); }}>
                    <PenLine className="h-4 w-4" /> Collect signature
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>

        <Button variant="outline" className="mt-4" onClick={() => setCollaborators((rows) => [...rows, emptySplitCollaborator()])}>
          <Plus className="h-4 w-4" /> Add collaborator
        </Button>

        <div className={`mt-6 flex items-center justify-between rounded-xl border p-4 ${totalOk ? "border-primary" : "border-destructive"}`}>
          <span className="font-semibold">Total ownership</span>
          <span className={`text-2xl font-bold ${totalOk ? "text-primary" : "text-destructive"}`}>{total}%</span>
        </div>
        {!totalOk && <p className="mt-2 text-sm text-destructive">Splits must add up to exactly 100% before saving.</p>}

        <div className="mt-6 flex flex-wrap gap-2">
          <Button onClick={() => void save()} disabled={saving || !totalOk}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSignature className="h-4 w-4" />} Save split sheet
          </Button>
          <Button variant="outline" onClick={() => void downloadSplitPdf(track, collaborators)} disabled={!collaborators.some((c) => c.name)}>
            <Download className="h-4 w-4" /> Download PDF
          </Button>
        </div>
      </div>
    </div>
  );
}

async function downloadSplitPdf(track: CatalogTrack, collaborators: SplitCollaborator[]) {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF();
  let y = 20;
  pdf.setFontSize(18);
  pdf.text("Split Sheet — Came Through Audio", 14, y);
  y += 10;
  pdf.setFontSize(12);
  pdf.text(`Song: ${track.title}`, 14, y); y += 7;
  pdf.text(`Artist: ${track.artist}`, 14, y); y += 7;
  if (track.metadata.isrc) { pdf.text(`ISRC: ${track.metadata.isrc}`, 14, y); y += 7; }
  y += 4;
  pdf.setFontSize(11);
  for (const c of collaborators.filter((x) => x.name)) {
    const line = `${c.name} (${c.role}) — ${c.percentage}%${c.pro ? ` — PRO: ${c.pro}` : ""}${c.ipi ? ` — IPI: ${c.ipi}` : ""}`;
    pdf.text(line, 14, y); y += 6;
    pdf.setFontSize(9);
    pdf.text(c.signedAt ? `Signed: ${c.signatureName} · ${new Date(c.signedAt).toLocaleString()} · Hash: ${c.signatureHash.slice(0, 24)}…` : "Signature: pending", 18, y);
    pdf.setFontSize(11);
    y += 8;
    if (y > 270) { pdf.addPage(); y = 20; }
  }
  pdf.text(`Total: ${splitTotal(collaborators)}%`, 14, y + 4);
  pdf.save(`${track.title.replace(/[^a-z0-9]+/gi, "-") || "split-sheet"}-split-sheet.pdf`);
}
