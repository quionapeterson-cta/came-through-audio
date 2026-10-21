import { useEffect, useMemo, useState } from "react";
import { confirmAction } from "@/components/ConfirmHost";
import { FileSignature, Plus, Trash2, Download, Lock, PenLine, Check, ChevronLeft, Loader2, Mail, Copy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ContributorLibrary } from "@/components/ContributorLibrary";
import { ProSelect } from "@/components/ProSelect";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { UpgradeLock } from "@/components/UpgradeLock";
import { Badge } from "@/components/ui/badge";
import { listTracks, saveTrack, type CatalogTrack } from "@/lib/catalog";
import { useServerFn } from "@tanstack/react-start";
import { sendSplitInvite } from "@/lib/splits-email.functions";
import { InfoTip } from "@/components/InfoTip";
import { splitSummary } from "@/lib/splits-total";
import { NextBadgeHint } from "@/components/Badges";
import {
  SPLIT_ROLES,
  catalogWithSplits,
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

export function SplitSheets({ userId, canSplit, canCollect, prefillTrackId, onUpgrade }: { userId: string; canSplit: boolean; canCollect: boolean; prefillTrackId: string | undefined; onUpgrade: () => void }) {
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
      <UpgradeLock title="Split sheets start with Catalog Plus" tier="plus" onUpgrade={onUpgrade}
        text="Generate unlimited split sheets from your catalog. Collaborator e-signature requests come with Catalog & Collaborate. Split sheets someone sends you are always free to sign." />
    );
  }

  if (editing) {
    return (
      <SplitEditor
        userId={userId}
        track={editing}
        initial={sheets.get(editing.id)}
        canCollect={canCollect}
        onUpgrade={onUpgrade}
        onClose={() => setEditing(null)}
        onSaved={async () => {
          setEditing(null);
          await load();
        }}
      />
    );
  }

  const isSigned = (t: CatalogTrack) => splitStatus(sheets.get(t.id)!) === "signed";
  const pendingTracks = tracks.filter((t) => sheets.has(t.id) && !isSigned(t));
  const signedTracks = tracks.filter((t) => sheets.has(t.id) && isSigned(t));
  const waitingAll = pendingTracks.flatMap((t) => sheets.get(t.id)!.filter((c) => c.name && !c.signedAt).map((c) => ({ name: c.name, track: t.title })));

  return (
    <div className="mt-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-2xl font-bold">Split Sheets</h2>
            <NextBadgeHint userId={userId} collections={["splits"]} />
          </div>
          <p className="text-sm text-muted-foreground">Create industry-standard split sheets from your catalog songs and sign as the owner. Collaborators receive an email invitation to review and sign, plus a free 30-day trial of the Catalog & Collaborate account.</p>
        </div>
      </div>

      {/* One glance row: the library you draw from on the left, what needs attention and what's done on the right.
          Opening the library's editor moves it below the row, full width, so the status cards never jump away. */}
      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr_1fr]">
        <ContributorLibrary userId={userId} refreshKey={libKey} />
        <a href="#split-pending" className="group flex flex-col rounded-2xl border border-border p-5 transition hover:border-primary">
          <div className="flex items-center justify-between">
            <h3 className="font-bold">Pending Signatures</h3>
            <span className="text-3xl font-extrabold leading-none text-primary">{pendingTracks.length}</span>
          </div>
          {waitingAll.length === 0
            ? <p className="mt-2 text-sm text-muted-foreground">{pendingTracks.length ? "Everyone listed has signed." : "Nothing waiting on signatures."}</p>
            : <ul className="mt-3 max-h-28 space-y-1 overflow-y-auto pr-1 text-sm">
                {waitingAll.map((w, i) => <li key={i} className="truncate"><span className="font-semibold">{w.name}</span> <span className="text-muted-foreground">· {w.track}</span></li>)}
              </ul>}
          <span className="mt-auto pt-3 text-xs font-semibold text-primary opacity-0 transition group-hover:opacity-100">See all ↓</span>
        </a>
        <a href="#split-signed" className="group flex flex-col rounded-2xl border border-border p-5 transition hover:border-primary">
          <div className="flex items-center justify-between">
            <h3 className="font-bold">Signed Vault</h3>
            <span className="text-3xl font-extrabold leading-none text-primary">{signedTracks.length}</span>
          </div>
          {signedTracks.length === 0
            ? <p className="mt-2 text-sm text-muted-foreground">Fully signed split sheets are stored here.</p>
            : <ul className="mt-3 max-h-28 space-y-1 overflow-y-auto pr-1 text-sm">
                {signedTracks.map((t) => <li key={t.id} className="flex items-center gap-1.5 truncate"><Check className="h-3.5 w-3.5 shrink-0 text-primary" />{t.title}</li>)}
              </ul>}
          <span className="mt-auto pt-3 text-xs font-semibold text-primary opacity-0 transition group-hover:opacity-100">See all ↓</span>
        </a>
      </div>

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
          return (
            <section key={heading} id={signedGroup ? "split-signed" : "split-pending"} className="scroll-mt-4 rounded-2xl border border-border p-5">
              <h3 className="mb-3 text-sm font-bold uppercase tracking-widest text-primary">{heading} <span className="opacity-70">{list.length}</span></h3>
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
                          if (!(await confirmAction({ title: "Delete this split sheet?", text: "Signatures already collected on it are deleted too." }))) return;
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

function SplitEditor({ userId, track, initial, canCollect, onUpgrade, onClose, onSaved }: { userId: string; track: CatalogTrack; initial: SplitCollaborator[] | undefined; canCollect: boolean; onUpgrade: () => void; onClose: () => void; onSaved: () => void }) {
  const [collaborators, setCollaborators] = useState<SplitCollaborator[]>(initial?.length ? initial : collaboratorsFromTrack(track));
  const [signingIndex, setSigningIndex] = useState<number | null>(null);
  const [typedName, setTypedName] = useState("");
  const [saving, setSaving] = useState(false);
  const [sendingIndex, setSendingIndex] = useState<number | null>(null);
  const sendInvite = useServerFn(sendSplitInvite);
  const [ownerName, setOwnerName] = useState("");
  const [library, setLibrary] = useState<SavedContributor[]>([]);

  useEffect(() => {
    void Promise.all([
      supabase.from("profiles").select("legal_name").eq("id", userId).maybeSingle(),
      supabase.auth.getUser(),
    ]).then(([{ data }, { data: auth }]) => {
      const legal = data?.legal_name ?? "";
      const accountEmail = auth.user?.email ?? "";
      setOwnerName(legal);
      setCollaborators((rows) => {
        let next = rows.some((r) => r.isOwner) || !legal ? rows : rows.map((r) => r.name.trim().toLowerCase() === legal.trim().toLowerCase() ? { ...r, isOwner: true } : r);
        if (accountEmail) next = next.map((r) => (r.isOwner && !r.email.trim() ? { ...r, email: accountEmail } : r));
        return next;
      });
      setAccountEmail(accountEmail);
    });
    void listContributors().then(setLibrary).catch(() => {});
  }, [userId]);
  const [accountEmail, setAccountEmail] = useState("");
  const [notes, setNotes] = useState(initial?.find((c) => c.notes)?.notes ?? "");
  const anySigned = collaborators.some((c) => c.signedAt);

  const fillFromLibrary = (i: number, name: string) => {
    const match = library.find((l) => l.name.toLowerCase() === name.trim().toLowerCase());
    const row = collaborators[i];
    if (!match || !row) return;
    update(i, { email: row.email || match.email, pro: row.pro || match.pro, ipi: row.ipi || match.ipi, publisherName: row.publisherName || match.publisher });
  };

  const markOwner = (i: number) => setCollaborators((rows) => rows.map((r, idx) => ({ ...r, isOwner: idx === i, email: idx === i && !r.email.trim() ? accountEmail : r.email })));

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
      // "Requested" only shows once the email really went out (the server records invited_at after sending).
      const saved = await saveSplitSheet(track.id, collaborators.map((r) => ({ ...r, notes })));
      setCollaborators(saved);
      // saveSplitSheet returns the named rows in order, so this row is found by position, not by name/email
      // (a trailing space in either used to make the lookup miss and the invite silently never sent).
      const row = saved[collaborators.slice(0, i).filter((r) => r.name.trim()).length];
      if (!row?.rowId) throw new Error("Save the split sheet first, then send the invite.");
      setSendingIndex(i);
      await sendInvite({ data: { rowId: row.rowId, origin: window.location.origin } });
      const sentAt = new Date().toISOString();
      setCollaborators((rows) => rows.map((r) => (r.rowId === row.rowId ? { ...r, invitedAt: sentAt } : r)));
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
      await saveSplitSheet(track.id, collaborators.map((c) => ({ ...c, notes })));
      await saveContributors(userId, collaborators.map((c) => ({ name: c.name, kind: c.role, email: c.email, pro: c.pro, ipi: c.ipi, publisher: c.publisherName, label: "" }))).catch(() => {});
      toast.success("Split sheet saved.");
      // Splits change over time: offer to carry the new percentages back to the catalog, never automatically.
      const updated = catalogWithSplits(track, collaborators);
      if (updated && (await confirmAction({ title: "Update My Catalog too?", text: `These splits differ from "${track.title}" in My Catalog. Update the catalog's split percentages to match? Names, roles and everything else stay as they are.`, action: "Update catalog" }))) {
        await saveTrack(updated, userId, track.id).then(() => toast.success("My Catalog updated.")).catch(() => toast.error("Split sheet saved, but My Catalog could not be updated."));
      }
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
        {!anySigned && <p className="mt-3 text-sm text-muted-foreground">Splits filled in from My Catalog. Things change: edit any split here.</p>}

        <div className="mt-6 space-y-3">
          {collaborators.map((c, i) => (
            <div key={i} className="rounded-xl border border-border p-4">
              <div className="grid gap-3 md:grid-cols-[1.4fr_1.4fr_1fr_0.6fr_auto]">
                <label className="space-y-1 text-sm">
                  <span className="inline-flex items-center font-medium">Legal name<InfoTip term="legalName" /></span>
                  <input list="contributor-library" value={c.name} onChange={(e) => update(i, { name: e.target.value })} onBlur={(e) => fillFromLibrary(i, e.target.value)} disabled={!!c.signedAt}
                    className="w-full rounded-md border border-input bg-background px-3 py-2" placeholder="Full legal name" />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="font-medium">Email</span>
                  <input type="email" value={c.email} onChange={(e) => update(i, { email: e.target.value })} disabled={!!c.signedAt}
                    className="w-full rounded-md border border-input bg-background px-3 py-2" placeholder={c.isOwner ? "Your account email" : "collaborator@email.com"} />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="font-medium">Role</span>
                  <select value={c.role} onChange={(e) => update(i, { role: e.target.value as SplitCollaborator["role"] })} disabled={!!c.signedAt}
                    className="w-full rounded-md border border-input bg-background px-3 py-2">
                    {SPLIT_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </label>
                <label className="space-y-1 text-sm">
                  <span className="inline-flex items-center font-medium">Split %<InfoTip term="split" /></span>
                  <input type="number" min={0} max={100} value={c.percentage || ""} disabled={!!c.signedAt}
                    onChange={(e) => update(i, { percentage: Math.min(100, Math.max(0, Number(e.target.value) || 0)) })}
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
                  <span className="inline-flex flex-wrap items-center font-medium">PRO affiliation<InfoTip term="pro" /> <span className="ml-1 font-normal text-muted-foreground">(optional — they can add it too)</span></span>
                  <ProSelect value={c.pro} onChange={(v) => update(i, { pro: v })} disabled={!!c.signedAt} />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="inline-flex items-center font-medium">IPI / CAE number<InfoTip term="ipi" /></span>
                  <input value={c.ipi} onChange={(e) => update(i, { ipi: e.target.value })} disabled={!!c.signedAt}
                    className="w-full rounded-md border border-input bg-background px-3 py-2" placeholder="Optional — they can add it too" />
                </label>
              </div>

              <details className="mt-3 rounded-lg border border-border p-3" open={!!c.publisherName}>
                <summary className="cursor-pointer text-sm font-semibold">Publishing <span className="font-normal text-muted-foreground">— optional</span></summary>
                <div className="mt-3 grid gap-3 md:grid-cols-[1.4fr_1fr_1fr_0.6fr]">
                  <label className="space-y-1 text-sm">
                    <span className="inline-flex items-center font-medium">Publisher name<InfoTip term="publisher" /></span>
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
                ) : !canCollect ? (
                  <Button size="sm" variant="outline" onClick={onUpgrade} title="Collaborator e-signature requests are included with Catalog & Collaborate">
                    <Lock className="h-4 w-4" /> Request e-signature
                  </Button>
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
        {!totalOk && <p className="mt-2 text-sm text-destructive">{splitSummary(collaborators.map((c) => ({ percentage: String(c.percentage || "") })))}<span className="block">Splits must add up to exactly 100% before saving.</span></p>}

        <label className="mt-6 block space-y-1 text-sm">
          <span className="font-semibold">Notes <span className="font-normal text-muted-foreground">— optional</span></span>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} disabled={anySigned} rows={4}
            className="w-full rounded-md border border-input bg-background px-3 py-2" />
          <span className="block text-xs text-muted-foreground">Shown right above the signatures on the split sheet.</span>
        </label>

        <div className="mt-6 flex flex-wrap gap-2">
          <Button onClick={() => void save()} disabled={saving || !totalOk}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSignature className="h-4 w-4" />} Save split sheet
          </Button>
          <Button variant="outline" onClick={() => void downloadSplitPdf(track, collaborators.map((c) => ({ ...c, notes })))} disabled={!collaborators.some((c) => c.name)}>
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

  const notes = t(rawCollaborators.find((c) => c.notes)?.notes).trim();
  if (notes) {
    const lines = pdf.splitTextToSize(notes, w - 36) as string[];
    y = ensureSpace(pdf, y, 14 + lines.length * 4.5);
    y = sectionTitle(pdf, y, "Notes");
    pdf.setFont("helvetica", "normal").setFontSize(9.5).setTextColor(...INK).text(lines, 18, y);
    y += lines.length * 4.5 + 8;
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

