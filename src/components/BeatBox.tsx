import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InfoTip } from "@/components/InfoTip";
import { beatMasterLine, DEAL_TYPES, isBeat, isSoldBeat, masterOfBeat } from "@/lib/beats";
import type { CatalogTrack } from "@/lib/catalog";
import type { Metadata } from "@/lib/metadata";

const selectClass = "flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/**
 * The beat box on a producer's instrumental (§4.5). Unsold, it explains what a beat can honestly be asked for; sold,
 * it points at the song made from it. Nothing here appears on a song that hasn't been marked as a beat.
 */
export function BeatBox({ metadata, update, tracks, beatId, disabled, onLink, onCreateMaster }: {
  metadata: Metadata;
  update: <K extends keyof Metadata>(key: K, value: Metadata[K]) => void;
  tracks: CatalogTrack[];
  beatId?: string | undefined;
  disabled?: boolean;
  onLink: (master: CatalogTrack) => void | Promise<void>;
  onCreateMaster: () => void;
}) {
  const sold = isSoldBeat(metadata);
  const master = beatId ? masterOfBeat(beatId, tracks) : undefined;
  const candidates = tracks.filter((t) => t.id !== beatId && !isBeat(t.metadata) && t.metadata.beatMasterId.trim() !== (beatId ?? ""));
  return <div className="rounded-xl border border-primary/50 bg-primary/5 p-4">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <span className="text-sm font-extrabold uppercase tracking-[2px] text-primary">Beat</span>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant={sold ? "outline" : "default"} aria-pressed={!sold} disabled={disabled} onClick={() => update("beatState", "unsold")}>This beat is unsold</Button>
        <Button type="button" size="sm" variant={sold ? "default" : "outline"} aria-pressed={sold} disabled={disabled} onClick={() => update("beatState", "sold")}>This beat is sold</Button>
      </div>
    </div>
    {!sold ? <div className="mt-3 space-y-3 text-sm">
      <p className="text-muted-foreground">The beat stays in Unreleased and is never scored. Its checklist asks only for what a beat can honestly have: your composer credit, the splits, a signed split sheet and a signed beat contract.</p>
      <div className="rounded-lg border border-border bg-card p-3">
        <p className="text-xs font-bold uppercase tracking-[1.5px]">When this beat is sold</p>
        <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-muted-foreground">
          <li>The artist's distributor creates the ISRC for that release. You don't need one now, and nothing here is late.</li>
          <li>The artist registers the song with their PRO and the recording with SoundExchange. The PRO assigns the ISWC when the work is registered.</li>
          <li>They credit you as the <b className="text-foreground">composer under your legal name</b>, so your PRO and The MLC can pay you. A stage name on the registration is what stops the money finding you.</li>
          <li>Your split sheet and a beat contract record what you're owed and what the artist may do with the beat. Fill and sign both, then send the signature requests from <b className="text-foreground">Split Sheets</b> and <b className="text-foreground">Contracts &amp; Blueprints</b>.</li>
        </ul>
      </div>
    </div> : <div className="mt-3 space-y-3">
      <p className="text-sm"><b>This beat is sold.</b> The song made from it is a separate entry in your catalog, and it usually has a different title.</p>
      <p className="text-sm font-semibold text-primary">{beatMasterLine(master)}</p>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" disabled={disabled || !beatId} onClick={onCreateMaster}>Create the master recording</Button>
        <select aria-label="Link a song already in my catalog as the master" disabled={disabled || !beatId || !candidates.length} className={`${selectClass} sm:w-64`} value=""
          onChange={(e) => { const t = tracks.find((x) => x.id === e.target.value); if (t) void onLink(t); }}>
          <option value="">{candidates.length ? "It's already in my catalog…" : "No other songs yet"}</option>
          {candidates.map((t) => <option key={t.id} value={t.id}>{t.title || "Untitled"}</option>)}
        </select>
      </div>
      {!beatId && <p className="text-xs text-muted-foreground">Save the beat first, then link or create the master.</p>}
    </div>}
  </div>;
}

/** The other side of the link, on the master: the beat it came from and the four deal answers (§4.5). */
export function DealBox({ metadata, update, beatTitle, disabled }: {
  metadata: Metadata;
  update: <K extends keyof Metadata>(key: K, value: Metadata[K]) => void;
  beatTitle: string;
  disabled?: boolean;
}) {
  return <div className="rounded-xl border border-border p-4">
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm font-extrabold uppercase tracking-[2px] text-primary">From {beatTitle || "a beat"}</span>
      <InfoTip text="This song was made from a beat in your catalog. The deal stays on the song, so it travels with the recording that earns." />
    </div>
    <div className="mt-3 grid gap-4 sm:grid-cols-3">
      <div className="min-w-0 space-y-2">
        <Label htmlFor="dealType">Deal type</Label>
        <select id="dealType" className={selectClass} value={metadata.dealType} disabled={disabled} onChange={(e) => update("dealType", e.target.value as Metadata["dealType"])}>
          <option value="">Choose the deal…</option>
          {DEAL_TYPES.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>
      <div className="min-w-0 space-y-2">
        <Label htmlFor="dealDate">Deal date</Label>
        <Input id="dealDate" type="date" value={metadata.dealDate} disabled={disabled} onChange={(e) => update("dealDate", e.target.value)} />
      </div>
      <div className="min-w-0 space-y-2">
        <Label htmlFor="dealStreams">Streams at which it changes<InfoTip text="A lease often ends at a stream count. Leave it blank if the deal doesn't change with streams." /></Label>
        <Input id="dealStreams" inputMode="numeric" value={metadata.dealStreams} disabled={disabled} placeholder="50000" onChange={(e) => update("dealStreams", e.target.value.replace(/\D/g, "").slice(0, 12))} />
      </div>
    </div>
  </div>;
}
