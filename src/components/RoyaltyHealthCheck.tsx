import { useEffect, useState } from "react";
import { Activity, AlertTriangle, CheckCircle2, Hourglass, ExternalLink, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { listTracks, type CatalogTrack } from "@/lib/catalog";
import { QuickSongInspector, MismatchTips } from "@/components/QuickSongInspector";
import { auditCatalog, BMI_SEARCH, PILLARS } from "@/lib/audit";

export function RoyaltyHealthCheck({ onFix, onEmbed }: { onFix: () => void; onEmbed: () => void }) {
  const [tracks, setTracks] = useState<CatalogTrack[]>();
  useEffect(() => { listTracks().then(setTracks).catch(() => setTracks([])); }, []);
  if (!tracks) return <div className="rounded-2xl border border-border p-6 text-muted-foreground">Scanning your catalog…</div>;
  const a = auditCatalog(tracks);
  const book = () => document.getElementById("expert-assistance")?.scrollIntoView({ behavior: "smooth" });

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border-2 border-primary bg-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3"><Activity className="h-8 w-8 text-primary" /><div>
            <h2 className="text-2xl font-bold">Royalty Health Check</h2>
            <p className="text-sm text-muted-foreground">Your catalog checked against ASCAP, BMI, SoundExchange and The MLC requirements.</p>
          </div></div>
          {tracks.length > 0 && <div className="text-right">
            <div className="text-4xl font-extrabold text-primary">{a.score}%</div>
            <div className="text-sm font-semibold">Royalty Ready{a.atRisk ? ` · ${a.atRisk} track${a.atRisk === 1 ? "" : "s"} at risk` : ""}</div>
          </div>}
        </div>
        {tracks.length === 0 ? <p className="mt-4 text-sm">Add songs to My Catalog to run your free audit.</p> : (
          <div className="mt-6 grid gap-3 md:grid-cols-3">
            {PILLARS.map((p) => {
              const ok = a.pillar[p.id];
              return <div key={p.id} className="rounded-xl border border-border p-4">
                <div className="text-xs font-bold uppercase tracking-widest text-primary">{p.registry}</div>
                <div className="font-bold">{p.label}</div>
                <div className="mt-1 text-sm">{ok} of {tracks.length} tracks ready</div>
                <div className="mt-2 h-2 rounded-full bg-muted"><div className="h-2 rounded-full bg-primary" style={{ width: `${(ok / tracks.length) * 100}%` }} /></div>
                <div className="mt-3 flex flex-wrap gap-x-3 text-xs">
                  <a className="inline-flex items-center gap-1 text-primary underline" href={p.search} target="_blank" rel="noreferrer">{p.searchLabel}<ExternalLink className="h-3 w-3" /></a>
                  {p.id === "performance" && <a className="inline-flex items-center gap-1 text-primary underline" href={BMI_SEARCH} target="_blank" rel="noreferrer">BMI Songview<ExternalLink className="h-3 w-3" /></a>}
                </div>
              </div>;
            })}
          </div>
        )}
        {tracks.length > 0 && <div className="mt-4"><MismatchTips /></div>}
      </div>

      <QuickSongInspector onEmbed={onEmbed} onExpert={book} />

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border-2 border-destructive/60 bg-card p-5">
          <AlertTriangle className="h-6 w-6 text-destructive" />
          <h3 className="mt-2 text-lg font-bold">Your distributor only collects part of your money.</h3>
          <p className="mt-1 text-sm text-muted-foreground">TuneCore, CD Baby, Symphonic and other distributors pay your master streams. They do <span className="font-semibold text-foreground">not</span> collect performance royalties (ASCAP/BMI), digital radio royalties (SoundExchange) or streaming mechanicals (The MLC). If those aren't registered, that money goes unclaimed.</p>
        </div>
        <div className="rounded-2xl border-2 border-destructive/60 bg-card p-5">
          <Hourglass className="h-6 w-6 text-destructive" />
          <h3 className="mt-2 text-lg font-bold">Unclaimed royalties don't wait forever.</h3>
          <p className="mt-1 text-sm text-muted-foreground">Songs that can't be matched land in the "black box." After a holding period, unclaimed money can be paid out to other rights holders by market share — usually the biggest labels and publishers.</p>
        </div>
      </div>

      {a.rows.length > 0 && (
        <div className="rounded-2xl border border-border p-6">
          <h3 className="mb-4 text-lg font-bold">Track-by-track results</h3>
          <ul className="space-y-3">
            {a.rows.map(({ t, issues }) => (
              <li key={t.id} className={`rounded-xl border p-4 ${issues.length ? "border-destructive/50" : "border-primary"}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 font-bold">{issues.length ? <XCircle className="h-5 w-5 text-destructive" /> : <CheckCircle2 className="h-5 w-5 text-primary" />}{t.title || "Untitled"}<span className="font-normal text-muted-foreground">· {t.artist}</span></div>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${issues.length ? "bg-destructive/10 text-destructive" : "bg-primary text-primary-foreground"}`}>{issues.length ? `${issues.length} fix${issues.length === 1 ? "" : "es"} needed` : "Repertoire Ready"}</span>
                </div>
                {issues.length > 0 && <ul className="mt-2 grid gap-1 text-sm md:grid-cols-2">
                  {issues.map((i, k) => <li key={k}><span className="font-semibold text-primary">{PILLARS.find((p) => p.id === i.pillar)!.registry}:</span> {i.text}</li>)}
                </ul>}
              </li>
            ))}
          </ul>
          <Button className="mt-4" variant="outline" onClick={onFix}>Fix in My Catalog</Button>
        </div>
      )}

      {a.atRisk > 0 && (
        <div className="flex flex-col items-start gap-3 rounded-2xl bg-primary p-6 text-primary-foreground md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-xl font-bold">One typo can freeze your payouts — with no error message.</h3>
            <p className="text-sm opacity-90">{a.atRisk} of your tracks need attention across 3 separate registries. Get an expert extra set of eyes live on video.</p>
          </div>
          <Button variant="secondary" size="lg" onClick={book}>Get Expert Help</Button>
        </div>
      )}
    </div>
  );
}
