import { useState } from "react";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CatalogTrack } from "@/lib/catalog";
import { RELEASE_TYPES } from "@/lib/metadata";
import { groupReleaseStatus, releaseDraft, releasePatch, type ReleaseDraft, type ReleasePatch } from "@/lib/release-panel";

/**
 * A release's own row on its catalog header (PLAN-releases-and-roles §4.1): its status in words, its fields, and one
 * Edit dialog that writes them to every song in the group through the catalog's own save. No new table and no
 * migration: the group is the release type and title the songs already hold.
 */
export function ReleaseRow({ name, type, tracks, readOnly, onSave }: {
  name: string;
  type: string;
  tracks: CatalogTrack[];
  readOnly?: boolean | undefined;
  onSave: (patch: ReleasePatch, tracks: CatalogTrack[]) => Promise<void>;
}) {
  const fields = tracks.map((t) => t.metadata);
  const status = groupReleaseStatus(fields);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<ReleaseDraft>(() => releaseDraft(fields));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const first = fields[0];

  const save = async () => {
    const next = releasePatch(draft);
    if ("error" in next) { setError(next.error); return; }
    setBusy(true);
    try {
      await onSave(next.patch, tracks);
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "That didn't save. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-1.5 space-y-1">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        <span className="font-semibold text-foreground">{name}{type ? ` · ${type}` : ""}</span>
        <span className="text-muted-foreground">{tracks.length} song{tracks.length === 1 ? "" : "s"}</span>
        <span className={status.status === "released" ? "text-muted-foreground" : "font-semibold text-primary"}>{status.label}</span>
        {!readOnly && (
          <button type="button" className="font-semibold text-primary underline" aria-label={`Edit ${name}`}
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setDraft(releaseDraft(fields)); setError(""); setOpen(true); }}>
            Edit
          </button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        {first?.releaseDate ? `Release date ${first.releaseDate} · ` : ""}Release type {first?.releaseType || "Single"}
        {first?.album ? ` · Title ${first.album}` : ""}
      </p>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-card text-card-foreground">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Release · {name}</DialogTitle>
            <DialogDescription>These fields are written to all {tracks.length} song{tracks.length === 1 ? "" : "s"} on this release, so it always reads the same everywhere.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-1.5 text-sm">
                <span className="font-medium">Release type</span>
                <select value={draft.releaseType} aria-label="Release type"
                  onChange={(e) => setDraft({ ...draft, releaseType: e.target.value })}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                  {RELEASE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </label>
              <label className="space-y-1.5 text-sm">
                <span className="font-medium">Release title</span>
                <Input value={draft.album} aria-label="Release title" placeholder={draft.releaseType === "Single" ? "The song's own title" : "Bloom"}
                  onChange={(e) => setDraft({ ...draft, album: e.target.value })} />
              </label>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-1.5 text-sm">
                <span className="font-medium">Release date</span>
                <Input type="date" value={draft.releaseDate} aria-label="Release date"
                  onChange={(e) => setDraft({ ...draft, releaseDate: e.target.value, status: e.target.value ? draft.status : "unreleased" })} />
              </label>
              <fieldset className="space-y-1.5 text-sm">
                <legend className="font-medium">Status</legend>
                <div className="space-y-1">
                  {([["unreleased", "Not released yet"], ["scheduled", "Scheduled"], ["released", "Released"]] as const).map(([id, label]) => (
                    <label key={id} className="flex items-center gap-2">
                      <input type="radio" name="release-status" checked={draft.status === id} onChange={() => setDraft({ ...draft, status: id })} className="h-4 w-4 accent-[var(--primary)]" />
                      <span>{label}{id === "scheduled" && draft.releaseDate ? ` for ${draft.releaseDate}` : ""}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            </div>
            {error && <p role="alert" className="rounded-md border border-destructive/50 bg-destructive/10 p-2 text-sm">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="button" disabled={busy} onClick={() => void save()}>{busy ? "Saving…" : `Save to ${tracks.length} song${tracks.length === 1 ? "" : "s"}`}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** The compact pointer in a released group's header: how many of its songs sit in the Unreleased section. */
export function UnreleasedChip({ count }: { count: number }) {
  if (!count) return null;
  return (
    <a href="#unreleased" className="ml-2 inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-xs font-semibold text-primary"
      onClick={(e) => { e.stopPropagation(); const el = document.getElementById("unreleased"); if (el) { e.preventDefault(); el.scrollIntoView({ behavior: "smooth", block: "start" }); } }}>
      {count} unreleased <Pencil className="hidden" aria-hidden />→
    </a>
  );
}
