import { useEffect, useState } from "react";
import { CheckCircle2, XCircle, ExternalLink, HelpCircle, ListChecks, Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProSelect } from "@/components/ProSelect";
import type { CatalogTrack } from "@/lib/catalog";
import { auditTrack, BMI_SEARCH, PILLARS, type Issue } from "@/lib/audit";
import { creditName, WRITER_ROLES, writerRole } from "@/lib/metadata";
import type { InspectorFields } from "@/lib/health-songs";
import { capShare } from "@/lib/splits-total";

const blank = { title: "", artist: "", duration: "", isrc: "", iswc: "", writer: "", role: "Author/Composer", pro: "", ipi: "", split: "100", publisher: "", pubIpi: "" };
type Form = typeof blank;

const toFields = (f: Form): InspectorFields => ({
  title: f.title.trim(), artist: f.artist.trim(), duration: f.duration.trim(), isrc: f.isrc.trim(), iswc: f.iswc.trim(),
  writers: f.writer.trim() ? [{ name: "", legalName: f.writer.trim(), role: f.role, pro: f.pro, ipi: f.ipi.trim(), percentage: f.split.trim() }] : [],
  publishers: f.publisher.trim() ? [{ name: f.publisher.trim(), pro: "", ipi: f.pubIpi.trim(), percentage: "" }] : [],
});
const fromTrack = (t: CatalogTrack): Form => {
  const w = t.metadata.writers[0], p = t.metadata.publishers[0];
  return { ...blank, title: t.title, artist: t.artist, duration: t.metadata.duration, isrc: t.metadata.isrc, iswc: t.metadata.iswc,
    writer: w ? creditName(w) : "", role: writerRole(w?.role), pro: w?.pro ?? "", ipi: w?.ipi ?? "", split: w?.percentage || "100", publisher: p?.name ?? "", pubIpi: p?.ipi ?? "" };
};

/**
 * The Royalty Inspector: type in any song's details for an instant check, free and unlimited on every plan.
 * Saved songs join the Song Health Checklist (public.health_songs), so Free accounts can track them to 100%.
 */
export function RoyaltyInspector({ onEmbed, onExpert, onSave, editing, onDoneEditing }: {
  onEmbed: () => void; onExpert: () => void;
  onSave: (fields: InspectorFields, id?: string) => Promise<void>;
  editing?: CatalogTrack | undefined; onDoneEditing: () => void;
}) {
  const [f, setF] = useState(blank);
  const [issues, setIssues] = useState<Issue[]>();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  // One writer here, so the split box simply can't go past 100% (same shared cap as Embed Metadata).
  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const value = k === "split" ? capShare([{ percentage: f.split }], 0, e.target.value).value : e.target.value;
    setF({ ...f, [k]: value }); setSaved(false);
  };
  useEffect(() => { if (editing) { setF(fromTrack(editing)); setIssues(undefined); setSaved(false); } }, [editing?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function run() {
    const v = toFields(f);
    setIssues(auditTrack({ title: v.title, artist: v.artist, metadata: { ...v, composers: [] } } as unknown as CatalogTrack));
  }
  async function save() {
    if (!f.title.trim()) return;
    setSaving(true);
    try { await onSave(toFields(f), editing?.id); setSaved(true); if (editing) onDoneEditing(); } finally { setSaving(false); }
  }
  const reset = () => { setF(blank); setIssues(undefined); setSaved(false); if (editing) onDoneEditing(); };

  const field = (k: keyof Form, label: string, ph = "", help?: string) => (
    <label className="space-y-1 text-sm"><span className="inline-flex items-center gap-1">{label}{help && <span title={help} aria-label={help} role="img"><HelpCircle className="h-3.5 w-3.5 text-muted-foreground" /></span>}</span>
      <Input value={f[k]} placeholder={ph} onChange={set(k)} /></label>
  );
  const score = issues ? Math.round((PILLARS.filter((p) => !issues.some((i) => i.pillar === p.id)).length / 3) * 100) : 0;

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <div className="flex items-center gap-2"><Search className="h-6 w-6 text-primary" /><h3 className="text-xl font-bold">{editing ? `Edit "${editing.title}"` : "Royalty Inspector"}</h3></div>
      <p className="mt-1 text-sm text-muted-foreground">Check any song in seconds, free and unlimited. Save it to your checklist to track every step to 100% health.</p>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {field("title", "Song title")}{field("artist", "Artist")}{field("duration", "Duration", "3:25")}
        {field("isrc", "ISRC", "US-XXX-26-00001", "Your recording's ID. Your distributor usually assigns it for free.")}
        {field("iswc", "ISWC (optional)", "T-123.456.789-0", "Your song's ID. Your PRO assigns it after you register the song, so it's fine to leave blank.")}
        {field("writer", "Writer legal name", "", "The writer's real legal name, used for registration. Not a stage name.")}
        <label className="space-y-1 text-sm"><span className="inline-flex items-center gap-1">Writer role<span title="Author wrote the lyrics, Composer wrote the music, Author/Composer did both." aria-label="Author wrote the lyrics, Composer wrote the music, Author/Composer did both." role="img"><HelpCircle className="h-3.5 w-3.5 text-muted-foreground" /></span></span>
          <select value={f.role} onChange={set("role")} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">{WRITER_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}</select></label>
        <div className="space-y-1 text-sm"><label htmlFor="inspector-pro">Writer PRO</label><ProSelect id="inspector-pro" value={f.pro} onChange={(pro) => { setF({ ...f, pro }); setSaved(false); }} /></div>
        {field("ipi", "Writer IPI #", "", "A 9–11 digit number from your PRO. Leave it blank if you don't have it yet.")}{field("split", "Writer split %")}
        {field("publisher", "Publisher", "", "Self-published? Enter your own publishing name, or leave it blank.")}{field("pubIpi", "Publisher IPI #")}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button onClick={run}>Inspect Song</Button>
        <Button variant="outline" onClick={() => void save()} disabled={!f.title.trim() || saving || saved}>
          {saving ? <Loader2 className="animate-spin" /> : saved ? <CheckCircle2 /> : <ListChecks />}{saved ? "Saved to your checklist" : editing ? "Update song" : "Save to my checklist"}
        </Button>
        {(issues || editing || saved) && <Button variant="ghost" onClick={reset}>{editing ? "Cancel" : "Test Another Song"}</Button>}
      </div>

      {issues && (
        <div className="mt-6 space-y-4">
          <div className="flex items-center gap-3">
            {issues.length ? <XCircle className="h-6 w-6 text-destructive" /> : <CheckCircle2 className="h-6 w-6 text-primary" />}
            <span className="text-2xl font-extrabold text-primary">{score}% Royalty Ready</span>
          </div>
          {issues.length > 0 && <ul className="grid gap-1 text-sm md:grid-cols-2">
            {issues.map((i, k) => <li key={k}><span className="font-semibold text-primary">{PILLARS.find((p) => p.id === i.pillar)!.registry}:</span> {i.text}</li>)}
          </ul>}
          {!saved && <p className="text-sm text-muted-foreground">Save this song to your checklist to get simple, step-by-step instructions for each fix and registration.</p>}
          <MismatchTips />
          <div className="flex flex-col gap-3 rounded-xl bg-primary p-5 text-primary-foreground md:flex-row md:items-center md:justify-between">
            <div>
              <div className="font-bold">{issues.length ? "One typo can freeze your payouts — with no error message." : "Clean data is only half the job."}</div>
              <div className="text-sm opacity-90">Embed this metadata into your master so every platform reads it right, or get an expert extra set of eyes on your registrations.</div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={onEmbed}>Embed This Song's Metadata</Button>
              <Button variant="secondary" onClick={onExpert}>Get Expert Help</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function MismatchTips() {
  return (
    <div className="rounded-xl border border-primary/40 bg-muted p-4 text-sm">
      <div className="font-bold">Already registered but showing as missing?</div>
      <p className="mt-1 text-muted-foreground">We check the details you enter here — we don't read the registries directly. If you registered a song but it shows issues, search for it below and compare: title spelling, artist name, <span className="font-semibold text-foreground">duration</span>, ISRC/ISWC and writer IPI. One small difference (like a wrong duration) can stop a match. Fix it in the registry portal, then update your song details here.</p>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
        {PILLARS.map((p) => <a key={p.id} className="inline-flex items-center gap-1 text-primary underline" href={p.search} target="_blank" rel="noreferrer">{p.searchLabel}<ExternalLink className="h-3 w-3" /></a>)}
        <a className="inline-flex items-center gap-1 text-primary underline" href={BMI_SEARCH} target="_blank" rel="noreferrer">BMI Songview<ExternalLink className="h-3 w-3" /></a>
      </div>
    </div>
  );
}
