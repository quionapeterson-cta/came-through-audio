import { useEffect, useMemo, useState } from "react";
import { FileSignature, Plus, Trash2, Download, Lock, PenLine, Check, ChevronLeft, Loader2, Mail, Copy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ContributorLibrary } from "@/components/ContributorLibrary";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { listTracks, type CatalogTrack } from "@/lib/catalog";
import { useServerFn } from "@tanstack/react-start";
import { sendSplitInvite } from "@/lib/splits-email.functions";
import {
  SPLIT_ROLES,
  ALL_PROS,
  collaboratorsFromTrack,
  deleteSplitSheet,
  emptySplitCollaborator,
  listSplitSheets,
  saveSplitSheet,
  signCollaborator,
  signLink,
  splitStatus,
  splitTotal,
  listContributors,
  saveContributors,
  type SavedContributor,
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
  const [libKey, setLibKey] = useState(0);
  const [pick, setPick] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const [t, s] = await Promise.all([listTracks(), listSplitSheets()]);
      setTracks(t);
      setSheets(s);
      // Keep catalog writers, composers, producers and publishers in the contributor library.
      const fromCatalog = t.flatMap((tr) => collaboratorsFromTrack(tr).filter((c) => c.name.trim()).map((c) => ({ name: c.name, kind: c.role, email: "", pro: c.pro ?? "", ipi: c.ipi ?? "", publisher: "", label: "" })));
      await saveContributors(userId, fromCatalog).catch(() => {});
      setLibKey((k) => k + 1);
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
        userId={userId}
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
          <p className="text-sm text-muted-foreground">Create industry-standard split sheets from your catalog songs and sign as the owner. Collaborators receive an email invitation to review and sign, plus a free 30-day trial of the Catalog & Collaborate account.</p>
        </div>
      </div>

      <ContributorLibrary userId={userId} refreshKey={libKey} />

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
      ) : tracks.length === 0 ? (
        <div className="flex min-h-60 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border p-10 text-center">
          <FileSignature className="h-10 w-10 text-primary" />
          <p className="mt-4 max-w-md text-muted-foreground">Add a song to My Catalog first — every split sheet is tied to one of your tracks.</p>
        </div>
      ) : (
        <>
        <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-primary p-5">
          <div className="min-w-60 flex-1 space-y-2">
            <label htmlFor="split-song" className="text-sm font-semibold">Choose a song for a split sheet</label>
            <select id="split-song" value={pick} onChange={(e) => setPick(e.target.value)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <option value="">Select a song…</option>
              {[...tracks].sort((a, b) => a.title.localeCompare(b.title)).map((t) => <option key={t.id} value={t.id}>{t.title}{t.metadata.album ? ` — ${t.metadata.album}` : ""}{sheets.has(t.id) ? " (has split sheet)" : ""}</option>)}
            </select>
          </div>
          <Button disabled={!pick} onClick={() => { const t = tracks.find((x) => x.id === pick); if (t) { setEditing(t); setPick(""); } }}><PenLine className="h-4 w-4" /> Generate</Button>
        </div>
        {([["Pending Signatures", false], ["Signed Split Sheet Vault", true]] as const).map(([heading, signedGroup]) => {
          const list = tracks.filter((t) => { const c = sheets.get(t.id); return c && (splitStatus(c) === "signed") === signedGroup; });
          const groups = new Map<string, CatalogTrack[]>();
          for (const t of list) { const k = t.metadata.album?.trim() || ""; groups.set(k, [...(groups.get(k) ?? []), t]); }
          const ordered = [...groups.entries()].sort(([a], [b]) => (a === "" ? 1 : b === "" ? -1 : a.localeCompare(b)));
          const waiting = signedGroup ? [] : list.flatMap((t) => sheets.get(t.id)!.filter((c) => c.name && !c.signedAt).map((c) => ({ name: c.name, track: t.title })));
          return (
            <section key={heading} className="rounded-2xl border border-border p-5">
              <h3 className="mb-3 text-sm font-bold uppercase tracking-widest text-primary">{heading} <span className="opacity-70">{list.length}</span></h3>
              {!signedGroup && waiting.length > 0 && (
                <div className="mb-4 rounded-xl border border-primary/40 bg-primary/5 p-3 text-sm">
                  <div className="mb-1.5 font-semibold">Who hasn't signed yet</div>
                  <div className="flex flex-wrap gap-2">
                    {waiting.map((w, i) => <Badge key={i} variant="outline" className="border-primary/50">{w.name} <span className="ml-1 text-muted-foreground">· {w.track}</span></Badge>)}
                  </div>
                </div>
              )}
              {list.length === 0 ? <p className="text-sm text-muted-foreground">{signedGroup ? "No fully signed split sheets in your vault yet." : "No split sheets waiting on signatures."}</p> : (
                <div className="space-y-3">
                  {ordered.map(([album, items]) => (
                    <details key={album || "singles"} open className="rounded-xl border border-border">
                      <summary className="flex cursor-pointer items-center justify-between gap-2 px-4 py-3 font-semibold">
                        <span>{album || "Singles"}</span><span className="text-xs text-muted-foreground">{items.length} {items.length === 1 ? "song" : "songs"}</span>
                      </summary>
        <div className="grid gap-4 p-4 pt-0 md:grid-cols-2">
          {[...items].sort((a, b) => a.title.localeCompare(b.title)).map((track) => {
            const collaborators = sheets.get(track.id)!;
            const badge = statusBadge[splitStatus(collaborators)];
            return (
              <div key={track.id} className="rounded-2xl border border-border p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-bold">{track.title}</div>
                    <div className="text-sm text-muted-foreground">{track.artist}</div>
                  </div>
                  {badge && <Badge variant="outline" className={badge.className}>{badge.label}</Badge>}
                </div>
                  <div className="mt-4 space-y-1.5 text-sm">
                    {collaborators.filter((c) => c.name).map((c, i) => (
                      <div key={i} className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-2">
                          {c.signedAt ? <Check className="h-3.5 w-3.5 text-primary" /> : <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />}
                          {c.name} <span className="text-muted-foreground">· {c.role}</span>
                          {!c.signedAt && <span className="text-xs text-destructive">Not signed</span>}
                        </span>
                        <span className="font-semibold">{c.percentage}%</span>
                      </div>
                    ))}
                    <div className="flex items-center justify-between border-t border-border pt-1.5 font-semibold">
                      <span>Total</span><span className={splitTotal(collaborators) === 100 ? "text-primary" : "text-destructive"}>{splitTotal(collaborators)}%</span>
                    </div>
                  </div>
                <div className="mt-4 flex gap-2">
                  <Button size="sm" className="flex-1" onClick={() => setEditing(track)}>
                    <PenLine className="h-4 w-4" /> {signedGroup ? "View split sheet" : "Edit split sheet"}
                  </Button>
                      <Button size="sm" variant="outline" onClick={() => void downloadSplitPdf(track, collaborators)} aria-label="Download PDF"><Download className="h-4 w-4" /></Button>
                      <Button size="sm" variant="outline" aria-label="Delete split sheet"
                        onClick={async () => {
                          if (!confirm("Delete this split sheet?")) return;
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
                </div>
              </div>
            );
          })}
        </div>
                    </details>
                  ))}
                </div>
              )}
            </section>
          );
        })}
        </>
      )}
    </div>
  );
}

function SplitEditor({ userId, track, initial, onClose, onSaved }: { userId: string; track: CatalogTrack; initial: SplitCollaborator[] | undefined; onClose: () => void; onSaved: () => void }) {
  const [collaborators, setCollaborators] = useState<SplitCollaborator[]>(initial?.length ? initial : collaboratorsFromTrack(track));
  const [signingIndex, setSigningIndex] = useState<number | null>(null);
  const [typedName, setTypedName] = useState("");
  const [saving, setSaving] = useState(false);
  const [sendingIndex, setSendingIndex] = useState<number | null>(null);
  const sendInvite = useServerFn(sendSplitInvite);
  const [ownerName, setOwnerName] = useState("");
  const [library, setLibrary] = useState<SavedContributor[]>([]);

  useEffect(() => {
    void supabase.from("profiles").select("legal_name").eq("id", userId).maybeSingle().then(({ data }) => {
      const legal = data?.legal_name ?? "";
      setOwnerName(legal);
      if (legal) setCollaborators((rows) => rows.some((r) => r.isOwner) ? rows : rows.map((r) => r.name.trim().toLowerCase() === legal.trim().toLowerCase() ? { ...r, isOwner: true } : r));
    });
    void listContributors().then(setLibrary).catch(() => {});
  }, [userId]);

  const fillFromLibrary = (i: number, name: string) => {
    const match = library.find((l) => l.name.toLowerCase() === name.trim().toLowerCase());
    const row = collaborators[i];
    if (!match || !row) return;
    update(i, { email: row.email || match.email, pro: row.pro || match.pro, ipi: row.ipi || match.ipi, publisherName: row.publisherName || match.publisher });
  };

  const markOwner = (i: number) => setCollaborators((rows) => rows.map((r, idx) => ({ ...r, isOwner: idx === i })));

  const requestSignature = async (i: number) => {
    const c = collaborators[i];
    if (!c) return;
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(c.email.trim())) {
      toast.error("Add a valid email for this collaborator first.");
      return;
    }
    if (!totalOk) {
      toast.error("Splits must add up to exactly 100% before requesting signatures.");
      return;
    }
    try {
      const next = collaborators.map((r, idx) => (idx === i ? { ...r, invitedAt: new Date().toISOString() } : r));
      const saved = await saveSplitSheet(track.id, next);
      setCollaborators(saved);
      const row = saved.find((r) => r.name === c.name && r.email === c.email);
      if (!row?.rowId) return;
      setSendingIndex(i);
      await sendInvite({ data: { rowId: row.rowId, origin: window.location.origin } });
      toast.success(`Signature request emailed to ${c.email}.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not send the signature request.");
    } finally {
      setSendingIndex(null);
    }
  };

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
      await saveContributors(userId, collaborators.map((c) => ({ name: c.name, kind: c.role, email: c.email, pro: c.pro, ipi: c.ipi, publisher: c.publisherName, label: "" }))).catch(() => {});
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
    if (!c.isOwner) {
      toast.error("Only the account owner signs here. Collaborators sign from their email request.");
      return;
    }
    if (typedName.trim().toLowerCase() !== c.name.trim().toLowerCase()) {
      toast.error("Type your full legal name exactly as listed to sign.");
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
                  <input list="contributor-library" value={c.name} onChange={(e) => update(i, { name: e.target.value })} onBlur={(e) => fillFromLibrary(i, e.target.value)} disabled={!!c.signedAt}
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
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                <label className="space-y-1 text-sm">
                  <span className="font-medium">Performer Name (Stage Name)</span>
                  <input value={c.performerName} onChange={(e) => update(i, { performerName: e.target.value })} disabled={!!c.signedAt}
                    className="w-full rounded-md border border-input bg-background px-3 py-2" placeholder="Optional — artist or stage name" />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="font-medium">PRO affiliation</span>
                  <ProSelect value={c.pro} onChange={(v) => update(i, { pro: v })} disabled={!!c.signedAt} />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="font-medium">IPI / CAE number</span>
                  <input value={c.ipi} onChange={(e) => update(i, { ipi: e.target.value })} disabled={!!c.signedAt}
                    className="w-full rounded-md border border-input bg-background px-3 py-2" placeholder="Optional — they can add it too" />
                </label>
              </div>

              <details className="mt-3 rounded-lg border border-border p-3" open={!!c.publisherName}>
                <summary className="cursor-pointer text-sm font-semibold">Publishing <span className="font-normal text-muted-foreground">— optional</span></summary>
                <div className="mt-3 grid gap-3 md:grid-cols-[1.4fr_1fr_1fr_0.6fr]">
                  <label className="space-y-1 text-sm">
                    <span className="font-medium">Publisher name</span>
                    <input value={c.publisherName} onChange={(e) => update(i, { publisherName: e.target.value })} disabled={!!c.signedAt}
                      className="w-full rounded-md border border-input bg-background px-3 py-2" placeholder="Publishing company or self-published" />
                  </label>
                  <label className="space-y-1 text-sm">
                    <span className="font-medium">Publisher PRO</span>
                    <ProSelect value={c.publisherPro} onChange={(v) => update(i, { publisherPro: v })} disabled={!!c.signedAt || !c.publisherName.trim()} />
                  </label>
                  <label className="space-y-1 text-sm">
                    <span className="font-medium">Publisher IPI #</span>
                    <input value={c.publisherIpi} onChange={(e) => update(i, { publisherIpi: e.target.value })} disabled={!!c.signedAt || !c.publisherName.trim()}
                      className="w-full rounded-md border border-input bg-background px-3 py-2" placeholder="Optional" />
                  </label>
                  <label className="space-y-1 text-sm">
                    <span className="font-medium">Publisher %</span>
                    <input type="number" min={0} max={100} value={c.publisherPercentage || ""} disabled={!!c.signedAt || !c.publisherName.trim()}
                      onChange={(e) => update(i, { publisherPercentage: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })}
                      className="w-full rounded-md border border-input bg-background px-3 py-2" placeholder="0" />
                  </label>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">Publisher share is the publishing side of this writer's split — it doesn't change the 100% writer total.</p>
              </details>

              <div className="mt-3 flex flex-wrap items-center gap-3">
                {c.signedAt ? (
                  <p className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-primary" />
                    <span className="font-serif text-lg italic text-foreground">{c.signatureName}</span>
                    <span className="text-muted-foreground">signed {new Date(c.signedAt).toLocaleDateString()}</span>
                  </p>
                ) : c.isOwner ? (
                  signingIndex === i ? (
                    <div className="flex flex-1 flex-wrap items-center gap-2 rounded-lg bg-muted p-3">
                      <input value={typedName} onChange={(e) => setTypedName(e.target.value)} placeholder={`Type "${c.name}" to sign`}
                        className="min-w-56 flex-1 rounded-md border border-input bg-background px-3 py-2 font-serif text-lg italic text-foreground" />
                      <Button size="sm" onClick={() => void sign(i)}>Sign</Button>
                      <Button size="sm" variant="ghost" onClick={() => { setSigningIndex(null); setTypedName(""); }}>Cancel</Button>
                    </div>
                  ) : (
                    <Button size="sm" disabled={!c.name.trim()} onClick={() => { setSigningIndex(i); setTypedName(""); }}>
                      <PenLine className="h-4 w-4" /> Sign as account owner
                    </Button>
                  )
                ) : c.invitedAt && c.rowId ? (
                  <>
                    <Badge variant="outline" className="border-primary text-primary"><Mail className="mr-1 h-3.5 w-3.5" /> Requested {new Date(c.invitedAt).toLocaleDateString()} · awaiting signature</Badge>
                    <Button size="sm" variant="ghost" onClick={() => { void navigator.clipboard.writeText(signLink(c.rowId!)); toast.success("Signing link copied."); }}><Copy className="h-4 w-4" /> Copy link</Button>
                    <Button size="sm" variant="ghost" disabled={sendingIndex === i} onClick={() => void requestSignature(i)}>{sendingIndex === i ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />} Resend invite</Button>
                  </>
                ) : (
                  <Button size="sm" variant="outline" disabled={!c.name.trim() || sendingIndex === i} onClick={() => void requestSignature(i)}>
                    {sendingIndex === i ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />} Send invite
                  </Button>
                )}
                {!c.signedAt && !c.isOwner && !collaborators.some((r) => r.isOwner && r.signedAt) && (
                  <button type="button" className="text-xs text-muted-foreground underline" onClick={() => markOwner(i)}>This is me</button>
                )}
                {c.isOwner && <Badge variant="outline">Account owner{ownerName ? "" : ""}</Badge>}
              </div>
            </div>
          ))}
        </div>

        <datalist id="contributor-library">
          {library.map((l) => <option key={`${l.name}-${l.kind}`} value={l.name}>{l.kind}</option>)}
        </datalist>
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
  const id = toast.loading("Preparing your split sheet PDF…");
  try {
    await buildSplitPdf(track, collaborators);
    toast.success("Split sheet downloaded.", { id });
  } catch (e) {
    console.error("Split sheet PDF failed", e);
    toast.error("Could not create the PDF. Please try again.", { id });
  }
}

async function buildSplitPdf(track: CatalogTrack, rawCollaborators: SplitCollaborator[]) {
  const t = (v: unknown) => (v === null || v === undefined ? "" : String(v));
  const collaborators = rawCollaborators.map((c) => ({ ...c, name: t(c.name), role: t(c.role) as SplitCollaborator["role"], pro: t(c.pro), ipi: t(c.ipi), performerName: t(c.performerName), publisherName: t(c.publisherName), publisherPro: t(c.publisherPro), publisherIpi: t(c.publisherIpi), signatureName: t(c.signatureName) || t(c.name), signatureHash: t(c.signatureHash), percentage: Number(c.percentage) || 0 }));
  track = { ...track, title: t(track.title) || "Untitled", artist: t(track.artist), metadata: { ...track.metadata, isrc: t(track.metadata?.isrc), iswc: t(track.metadata?.iswc) } };
  const { newBrandedPdf, brandHeader, brandFooter, infoGrid, sectionTitle, ensureSpace, COBALT, INK, MUTED, RULE } = await import("@/lib/brand-pdf");
  const pdf = await newBrandedPdf();
  const w = pdf.internal.pageSize.getWidth();
  const rows = collaborators.filter((c) => c.name);
  const status = splitStatus(collaborators);
  let y = brandHeader(pdf, "Split Sheet Agreement", `${track.title} — ${track.artist}`);
  y = infoGrid(pdf, y, [
    ["Song title", track.title], ["Artist", track.artist],
    ["ISRC", track.metadata.isrc], ["ISWC", track.metadata.iswc],
    ["Status", status === "signed" ? "Fully signed" : status === "partial" ? "Partially signed" : "Draft"], ["Agreement ID", track.id.slice(0, 8).toUpperCase()],
  ]);

  y = sectionTitle(pdf, y, "Ownership splits");
  const cols = [18, 80, 115, 145, 175];
  pdf.setFillColor(...COBALT).rect(18, y, w - 36, 8, "F");
  pdf.setFont("helvetica", "bold").setFontSize(8).setTextColor(255, 255, 255);
  ["NAME", "ROLE", "PRO", "IPI", "SHARE"].forEach((h, i) => pdf.text(h, cols[i]! + 3, y + 5.5));
  y += 8;
  rows.forEach((c, i) => {
    if (i % 2) pdf.setFillColor(245, 247, 251).rect(18, y, w - 36, 9, "F");
    pdf.setFont("helvetica", "normal").setFontSize(10).setTextColor(...INK);
    pdf.text(c.name, cols[0]! + 3, y + 6);
    if (c.performerName) pdf.setFontSize(7).setTextColor(...MUTED).text(`p/k/a ${c.performerName}`, cols[0]! + 3, y + 9.5).setFontSize(10).setTextColor(...INK);
    pdf.text(c.role, cols[1]! + 3, y + 6);
    pdf.text(c.pro || "—", cols[2]! + 3, y + 6);
    pdf.text(c.ipi || "—", cols[3]! + 3, y + 6);
    pdf.setFont("helvetica", "bold").text(`${c.percentage}%`, cols[4]! + 3, y + 6);
    y += c.performerName ? 11 : 9;
  });
  pdf.setDrawColor(...COBALT).setLineWidth(0.6).line(18, y, w - 18, y);
  pdf.setFont("helvetica", "bold").setFontSize(10).setTextColor(...INK).text("TOTAL", cols[0]! + 3, y + 6);
  pdf.setTextColor(...COBALT).text(`${splitTotal(collaborators)}%`, cols[4]! + 3, y + 6);
  y += 18;

  const pubs = rows.filter((c) => c.publisherName);
  if (pubs.length) {
    y = ensureSpace(pdf, y, 20 + pubs.length * 9);
    y = sectionTitle(pdf, y, "Publishing");
    pdf.setFillColor(...COBALT).rect(18, y, w - 36, 8, "F");
    pdf.setFont("helvetica", "bold").setFontSize(8).setTextColor(255, 255, 255);
    ["PUBLISHER", "FOR WRITER", "PRO", "IPI", "SHARE"].forEach((h, i) => pdf.text(h, cols[i]! + 3, y + 5.5));
    y += 8;
    pubs.forEach((c, i) => {
      if (i % 2) pdf.setFillColor(245, 247, 251).rect(18, y, w - 36, 9, "F");
      pdf.setFont("helvetica", "normal").setFontSize(9).setTextColor(...INK);
      pdf.text(c.publisherName, cols[0]! + 3, y + 6);
      pdf.text(c.name, cols[1]! + 3, y + 6);
      pdf.text(c.publisherPro || "—", cols[2]! + 3, y + 6);
      pdf.text(c.publisherIpi || "—", cols[3]! + 3, y + 6);
      pdf.text(`${Number(c.publisherPercentage) || 0}%`, cols[4]! + 3, y + 6);
      y += 9;
    });
    y += 10;
  }

  y = ensureSpace(pdf, y, 40);
  y = sectionTitle(pdf, y, "Signatures");
  pdf.setFont("helvetica", "normal").setFontSize(8.5).setTextColor(...MUTED);
  const agreement = pdf.splitTextToSize("By signing, each party confirms the ownership percentages above are accurate and agrees to them for this composition. Each electronic signature is recorded with a timestamp and a SHA-256 verification hash.", w - 36) as string[];
  pdf.text(agreement, 18, y); y += agreement.length * 4 + 6;
  const boxW = (w - 36 - 6) / 2;
  rows.forEach((c, i) => {
    const x = 18 + (i % 2) * (boxW + 6);
    if (i % 2 === 0) y = ensureSpace(pdf, y, 36);
    pdf.setDrawColor(...RULE).setLineWidth(0.3).roundedRect(x, y, boxW, 32, 2, 2, "S");
    if (c.signedAt) {
      pdf.setFont("times", "italic").setFontSize(18).setTextColor(...INK).text(c.signatureName, x + 5, y + 12);
    } else {
      pdf.setFont("helvetica", "italic").setFontSize(10).setTextColor(...MUTED).text(c.invitedAt ? "Awaiting signature" : "Not yet requested", x + 5, y + 12);
    }
    pdf.setDrawColor(...INK).line(x + 5, y + 15, x + boxW - 5, y + 15);
    pdf.setFont("helvetica", "bold").setFontSize(9).setTextColor(...INK).text(`${c.name}${c.isOwner ? "  (Account owner)" : ""}`, x + 5, y + 20);
    pdf.setFont("helvetica", "normal").setFontSize(7.5).setTextColor(...MUTED);
    pdf.text(c.signedAt ? `Signed ${new Date(c.signedAt).toLocaleString()}` : `${c.role} · ${c.percentage}%`, x + 5, y + 24.5);
    if (c.signedAt && c.signatureHash) pdf.setTextColor(...COBALT).text(`Hash ${c.signatureHash.slice(0, 32)}…`, x + 5, y + 28.5);
    if (i % 2 === 1 || i === rows.length - 1) y += 36;
  });
  brandFooter(pdf);
  pdf.save(`${track.title.replace(/[^a-z0-9]+/gi, "-") || "split-sheet"}-split-sheet.pdf`);
}

function ProSelect({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled?: boolean }) {
  const known = !value || (ALL_PROS as readonly string[]).includes(value);
  const [custom, setCustom] = useState(!known);
  return (
    <div className="space-y-2">
      <select value={custom ? "Other" : value} disabled={disabled}
        onChange={(e) => { const v = e.target.value; setCustom(v === "Other"); onChange(v === "Other" ? "" : v); }}
        className="w-full rounded-md border border-input bg-background px-3 py-2">
        <option value="">Select PRO…</option>
        {ALL_PROS.map((p) => <option key={p} value={p}>{p}</option>)}
      </select>
      {custom && <input value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} placeholder="Type society name"
        className="w-full rounded-md border border-input bg-background px-3 py-2" />}
    </div>
  );
}
