import { useState } from "react";
import { BookOpen, Check, ChevronDown, FileSignature, FolderOpen, Pin, PinOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { Guide } from "@/lib/guides";
import type { Contract } from "@/lib/contracts";
import { progressLabel, savedGuides, sortByProgress, type ChecklistProgress } from "@/lib/workbench";
import type { Workbench } from "@/hooks/useWorkbench";

/** "3 of 8 · 38%" over a bar in the primary colour. */
export function ProgressMeter({ progress, title, className = "" }: { progress: ChecklistProgress; title: string; className?: string }) {
  return (
    <div className={className}>
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>{progress.finished ? <span className="inline-flex items-center gap-1 font-semibold text-primary"><Check className="h-3.5 w-3.5" strokeWidth={3} />Complete</span> : "Checklist"}</span>
        <span>{progressLabel(progress)}</span>
      </div>
      <Progress value={progress.pct} aria-label={`${title} checklist: ${progressLabel(progress)}`} className="mt-1 h-1.5" />
    </div>
  );
}

/**
 * Working On (founder, 2026-11-06): quick access to the blueprints the member started or saved and the contracts they
 * are still working on. Drafts and contracts out for signature are listed on their own; a saved contract stays here
 * after everyone signs.
 */
export function WorkingOn({ workbench, contracts, loading, statusBadge, onOpenGuide, onOpenContract, onBrowse }: {
  workbench: Workbench;
  contracts: Contract[];
  loading: boolean;
  statusBadge: (c: Contract) => React.ReactNode;
  onOpenGuide: (g: Guide) => void;
  onOpenContract: (c: Contract) => void;
  onBrowse: () => void;
}) {
  const [closed, setClosed] = useState<Set<string>>(new Set());
  const { inProgress, finished } = sortByProgress(savedGuides(workbench.entries));
  const isPinned = (c: Contract) => !!c.id && workbench.get("contract", c.id).pinned;
  const abc = (a: Contract, b: Contract) => a.title.localeCompare(b.title);
  const openContracts = contracts.filter((c) => c.status !== "signed").sort(abc);
  const savedSigned = contracts.filter((c) => c.status === "signed" && isPinned(c)).sort(abc);
  const guideCount = inProgress.length + finished.length;
  const contractCount = openContracts.length + savedSigned.length;

  if (!loading && workbench.loaded && guideCount === 0 && contractCount === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border p-8 text-center">
        <FolderOpen className="h-10 w-10 text-primary" />
        <p className="mt-3 max-w-md text-muted-foreground">Nothing here yet. Tick an item on any blueprint, or save one to Working On, and it shows up here. Drafts and contracts out for signature appear on their own.</p>
        <Button className="mt-4" size="sm" onClick={onBrowse}><BookOpen className="h-4 w-4" />Browse blueprints</Button>
      </div>
    );
  }

  const remove = (g: Guide) => {
    workbench.setPinned("blueprint", g.id, false);
    toast.success(`${g.title} removed from Working On. Your ticks are kept.`);
  };
  const section = (id: string, title: string, summary: string, body: React.ReactNode) => {
    const open = !closed.has(id);
    return (
      <div className="rounded-2xl border border-border">
        <button type="button" aria-expanded={open} onClick={() => setClosed((x) => { const n = new Set(x); if (n.has(id)) n.delete(id); else n.add(id); return n; })} className="flex w-full items-center gap-2 p-4 text-left">
          <span className="text-lg font-bold">{title}</span>
          <span className="truncate text-sm text-muted-foreground">· {summary}</span>
          <ChevronDown className={`ml-auto h-5 w-5 shrink-0 transition ${open ? "rotate-180" : ""}`} />
        </button>
        {open && <div className="p-4 pt-0">{body}</div>}
      </div>
    );
  };
  const guideCard = ({ guide: g, progress }: { guide: Guide; progress: ChecklistProgress }) => (
    <li key={g.id} className={`flex flex-col rounded-xl border p-4 transition ${progress.finished ? "border-border bg-muted/40" : "border-border hover:border-primary"}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className={`truncate font-bold ${progress.finished ? "text-muted-foreground" : ""}`}>{g.title}</div>
          <div className="text-xs text-muted-foreground">{g.kind}</div>
        </div>
      </div>
      {progress.total > 0 && <ProgressMeter progress={progress} title={g.title} className="mt-3" />}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" variant={progress.finished ? "outline" : "default"} onClick={() => onOpenGuide(g)}>Open</Button>
        <Button size="sm" variant="ghost" onClick={() => remove(g)}><PinOff className="h-4 w-4" />Remove</Button>
      </div>
    </li>
  );
  const contractRow = (c: Contract) => {
    const pinned = isPinned(c);
    const signed = c.parties.filter((p) => p.signedAt).length;
    return (
      <li key={c.id} className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4 transition ${c.status === "signed" ? "border-border bg-muted/40" : "border-border hover:border-primary"}`}>
        <div className="min-w-0">
          <div className="truncate font-bold">{c.title}</div>
          <div className="text-xs text-muted-foreground">{c.status === "draft" ? "Draft" : `${signed}/${c.parties.length} signed`} · {new Date(c.completedAt ?? c.updatedAt).toLocaleDateString()}</div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {statusBadge(c)}
          {c.id && (
            <Button size="sm" variant="ghost" aria-pressed={pinned} title={pinned ? "Remove from Working On" : "Keep it in Working On after everyone signs"} onClick={() => workbench.setPinned("contract", c.id!, !pinned)}>
              {pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}{pinned ? "Remove" : "Save"}
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => onOpenContract(c)}>{c.status === "draft" ? "Edit" : "Open"}</Button>
        </div>
      </li>
    );
  };

  return (
    <section className="space-y-4">
      <p className="text-sm text-muted-foreground">Everything in progress, in one place. Blueprints you start or save stay here, with your checklist progress.</p>
      {section("blueprints", "Blueprints", guideCount ? `${inProgress.length} in progress${finished.length ? ` · ${finished.length} complete` : ""}` : "none saved yet", guideCount === 0
        ? <p className="text-sm text-muted-foreground">Tick a checklist item or tap Save to Working On on any blueprint. <button type="button" className="font-semibold text-primary underline" onClick={onBrowse}>Browse blueprints</button></p>
        : (
          <div className="space-y-4">
            {inProgress.length > 0 && <ul className="grid gap-3 md:grid-cols-2">{inProgress.map(guideCard)}</ul>}
            {finished.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Complete <span className="opacity-70">{finished.length}</span></h4>
                <ul className="grid gap-3 md:grid-cols-2">{finished.map(guideCard)}</ul>
              </div>
            )}
          </div>
        ))}
      {section("contracts", "Contracts", loading ? "loading…" : contractCount ? `${openContracts.length} waiting${savedSigned.length ? ` · ${savedSigned.length} signed, saved` : ""}` : "none in progress", loading
        ? <p className="text-sm text-muted-foreground">Loading…</p>
        : contractCount === 0
          ? <p className="flex items-center gap-2 text-sm text-muted-foreground"><FileSignature className="h-4 w-4 text-primary" />Drafts and contracts out for signature show up here on their own.</p>
          : (
            <div className="space-y-4">
              {openContracts.length > 0 && <ul className="grid gap-3">{openContracts.map(contractRow)}</ul>}
              {savedSigned.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Fully signed <span className="opacity-70">{savedSigned.length}</span></h4>
                  <ul className="grid gap-3">{savedSigned.map(contractRow)}</ul>
                </div>
              )}
            </div>
          ))}
    </section>
  );
}
