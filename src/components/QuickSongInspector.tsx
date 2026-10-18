import { useState } from "react";
import { CheckCircle2, XCircle, ExternalLink, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProSelect } from "@/components/ProSelect";
import type { CatalogTrack } from "@/lib/catalog";
import { auditTrack, BMI_SEARCH, PILLARS, type Issue } from "@/lib/audit";

const blank = { title: "", artist: "", duration: "", isrc: "", iswc: "", writer: "", pro: "", ipi: "", split: "100", publisher: "", pubIpi: "" };

/** One-off audit of a single song — nothing is saved, so Free accounts can run it unlimited times. */
export function QuickSongInspector({ onEmbed, onExpert }: { onEmbed: () => void; onExpert: () => void }) {
  const [f, setF] = useState(blank);
  const [issues, setIssues] = useState<Issue[]>();
  const set = (k: keyof typeof blank) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  function run() {
    const track = {
      title: f.title, artist: f.artist,
      metadata: {
        writers: f.writer ? [{ name: f.writer, pro: f.pro, ipi: f.ipi, percentage: f.split }] : [],
        composers: [], publishers: f.publisher ? [{ name: f.publisher, ipi: f.pubIpi }] : [],
        isrc: f.isrc, iswc: f.iswc,
      },
    } as unknown as CatalogTrack;
    setIssues(auditTrack(track));
  }

  const field = (k: keyof typeof blank, label: string, ph = "") => (
    <label className="space-y-1 text-sm"><span>{label}</span><Input value={f[k]} placeholder={ph} onChange={set(k)} /></label>
  );
  const score = issues ? Math.round((PILLARS.filter((p) => !issues.some((i) => i.pillar === p.id)).length / 3) * 100) : 0;

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <div className="flex items-center gap-2"><Search className="h-6 w-6 text-primary" /><h3 className="text-xl font-bold">Quick Song Inspector</h3></div>
      <p className="mt-1 text-sm text-muted-foreground">Check any single song in seconds — free and unlimited, nothing gets saved.</p>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {field("title", "Song title")}{field("artist", "Artist")}{field("duration", "Duration", "3:25")}
        {field("isrc", "ISRC", "US-XXX-26-00001")}{field("iswc", "ISWC (optional)", "T-123.456.789-0")}{field("writer", "Writer name")}
        <div className="space-y-1 text-sm"><label htmlFor="inspector-pro">Writer PRO</label><ProSelect id="inspector-pro" value={f.pro} onChange={(pro) => setF({ ...f, pro })} /></div>{field("ipi", "Writer IPI #")}{field("split", "Writer split %")}
        {field("publisher", "Publisher")}{field("pubIpi", "Publisher IPI #")}
      </div>
      <div className="mt-4 flex gap-2">
        <Button onClick={run}>Inspect Song</Button>
        {issues && <Button variant="outline" onClick={() => { setF(blank); setIssues(undefined); }}>Test Another Song</Button>}
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
