import { useEffect, useMemo, useState } from "react";
import { Calculator, ExternalLink, Repeat } from "lucide-react";
import { UpgradeLock } from "@/components/UpgradeLock";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { listTracks, type CatalogTrack } from "@/lib/catalog";
import { loadOnboarding } from "@/lib/artist-profile";
import { COUNTRIES, countryByCode } from "@/lib/repertoires";
import { MASTER_PORTION, PLATFORMS, PRO_SCALES, RATE_SOURCES, convertBetween, estimateEarnings, songShareRows, yourSongShare, type ProScale } from "@/lib/royalty-calc";

const money = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });
const pct = (n: number) => `${Math.round(n * 100) / 100}%`;
const select = "flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const SCALES = Object.keys(PRO_SCALES) as ProScale[];

export function RoyaltyUtilitySuite({ unlocked, onUpgrade, userId }: { unlocked: boolean; onUpgrade: () => void; userId?: string }) {
  const [tracks, setTracks] = useState<CatalogTrack[]>([]);
  useEffect(() => { if (unlocked) listTracks().then(setTracks).catch(() => {}); }, [unlocked]);
  if (!unlocked) {
    return <UpgradeLock className="" title="Royalty Utility Suite" tier="collaborate" onUpgrade={onUpgrade}
      text="Turn your catalog splits into the numbers BMI, ASCAP and SESAC ask for, and forecast your payouts by platform." />;
  }
  return (
    <div className="space-y-6">
      <Converter tracks={tracks} userId={userId} />
      <Earnings tracks={tracks} userId={userId} />
      <p className="text-xs text-muted-foreground">Every number here is an estimate to help you plan and register. It isn't financial, legal or tax advice, and agencies decide the final amounts.</p>
    </div>
  );
}

function SongPicker({ tracks, value, onChange, id }: { tracks: CatalogTrack[]; value: string; onChange: (id: string) => void; id: string }) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>Choose a song</Label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className={select}>
        <option value="">Enter shares by hand</option>
        {[...tracks].sort((a, b) => a.title.localeCompare(b.title)).map((t) => <option key={t.id} value={t.id}>{t.title}{t.metadata.album ? ` — ${t.metadata.album}` : ""}</option>)}
      </select>
    </div>
  );
}

/** Catalog splits on each PRO's own scale: BMI's 200%, ASCAP's and SESAC's 100%; other countries' societies by name. */
function Converter({ tracks, userId }: { tracks: CatalogTrack[]; userId?: string | undefined }) {
  const [code, setCode] = useState(() => loadOnboarding(userId)?.healthCountry || "US");
  const [songId, setSongId] = useState("");
  const [value, setValue] = useState("100");
  const [from, setFrom] = useState<ProScale>("bmi");
  const country = countryByCode(code) ?? COUNTRIES[0]!;
  const us = country.code === "US";
  const song = tracks.find((t) => t.id === songId);
  const rows = useMemo(() => (song ? songShareRows(song.metadata) : []), [song]);
  const societies = (country.societies.performance ?? []).map((s) => s.name).join(", ") || "your society";
  const n = Number(value) || 0;

  return (
    <section className="space-y-4 rounded-2xl border border-border bg-card p-6">
      <div className="flex items-center gap-2"><Repeat className="h-6 w-6 text-primary" /><h3 className="text-xl font-bold">Royalty Formula Converter</h3></div>
      <p className="text-sm text-muted-foreground">Your catalog keeps each half of the song out of 100%: writer splits, then publisher shares. PROs ask for them differently. <b className="text-foreground">BMI</b> counts out of 200% (100% for writers plus 100% for publishers), so you enter shares as they are. <b className="text-foreground">ASCAP</b> and <b className="text-foreground">SESAC</b> count out of 100% split 50/50, so every share is entered at half.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1"><Label htmlFor="calc-country">Country</Label>
          <select id="calc-country" value={country.code} onChange={(e) => setCode(e.target.value)} className={select}>{COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}</select></div>
        <SongPicker id="calc-song" tracks={tracks} value={songId} onChange={setSongId} />
      </div>
      {!us && <p className="rounded-lg bg-muted p-3 text-sm">Most societies outside the US, including {societies}, count out of 100% and split performance royalties between writers and publishers. The usual split is 50/50, but some societies use their own, so check {societies}'s registration guide before you register.</p>}

      {song ? (
        rows.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[32rem] text-sm">
              <thead><tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="py-2 pr-3">Who</th><th className="py-2 pr-3">Half</th><th className="py-2 pr-3 text-right">Your catalog</th>
                {us ? SCALES.map((k) => <th key={k} className="py-2 pr-3 text-right">{PRO_SCALES[k].name} ({PRO_SCALES[k].total}%)</th>) : <th className="py-2 text-right">{societies} (100%)</th>}
              </tr></thead>
              <tbody>
                {rows.map((r) => <tr key={r.field} className="border-b border-border/60"><td className="py-2 pr-3">{r.label}</td><td className="py-2 pr-3 text-muted-foreground">{r.half}</td><td className="py-2 pr-3 text-right">{pct(r.catalog)}</td>
                  {us ? SCALES.map((k) => <td key={k} className="py-2 pr-3 text-right font-semibold">{pct(r.catalog * PRO_SCALES[k].factor)}</td>) : <td className="py-2 text-right font-semibold">{pct(r.catalog / 2)}</td>}</tr>)}
                <tr className="font-semibold"><td className="py-2 pr-3" colSpan={2}>Total</td><td className="py-2 pr-3 text-right">{pct(rows.reduce((t, r) => t + r.catalog, 0))}</td>
                  {us ? SCALES.map((k) => <td key={k} className="py-2 pr-3 text-right">{pct(rows.reduce((t, r) => t + r.catalog * PRO_SCALES[k].factor, 0))}</td>) : <td className="py-2 text-right">{pct(rows.reduce((t, r) => t + r.catalog / 2, 0))}</td>}</tr>
              </tbody>
            </table>
          </div>
        ) : <p className="text-sm text-muted-foreground">This song has no writer splits yet. Add them in My Catalog, or enter a share by hand.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_2fr]">
          <div className="space-y-1"><Label htmlFor="calc-from">From</Label>
            <select id="calc-from" value={from} onChange={(e) => setFrom(e.target.value as ProScale)} className={select}>{SCALES.map((k) => <option key={k} value={k}>{PRO_SCALES[k].name} ({PRO_SCALES[k].total}%)</option>)}</select></div>
          <div className="space-y-1"><Label htmlFor="calc-value">Share (%)</Label><Input id="calc-value" type="number" min={0} max={PRO_SCALES[from].total} value={value} onChange={(e) => setValue(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-2">{SCALES.filter((k) => k !== from).map((k) => (
            <div key={k} className="rounded-xl bg-muted p-3"><div className="text-xs text-muted-foreground">{PRO_SCALES[k].name} ({PRO_SCALES[k].total}%)</div><div className="text-2xl font-bold text-primary">{pct(convertBetween(n, from, k))}</div></div>
          ))}</div>
        </div>
      )}
    </section>
  );
}

/** Projected earnings by platform from published average rates, with your share of the master and of the song. */
function Earnings({ tracks, userId }: { tracks: CatalogTrack[]; userId?: string | undefined }) {
  const [songId, setSongId] = useState("");
  const [streams, setStreams] = useState<Record<string, string>>({ spotify: "100000" });
  const [rates, setRates] = useState<Record<string, string>>(() => Object.fromEntries(PLATFORMS.map((p) => [p.id, String(p.rate)])));
  const [master, setMaster] = useState("100");
  const [songShare, setSongShare] = useState("100");
  const [radio, setRadio] = useState({ plays: "0", perPlay: "0.10" });

  // A song from the catalog fills your master share and your share of the song (your own writer and publisher rows).
  function pick(id: string) {
    setSongId(id);
    const t = tracks.find((x) => x.id === id);
    if (!t) return;
    const ob = loadOnboarding(userId);
    const names = [ob?.legalName, ob?.stageName].filter((x): x is string => !!x?.trim());
    setMaster(t.metadata.masterShare || "100");
    setSongShare(String(Math.round(yourSongShare(songShareRows(t.metadata), names) * 100) / 100));
  }
  const num = (r: Record<string, string>) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, Number(v) || 0]));
  const r = estimateEarnings({ streams: num(streams), rates: num(rates), masterShare: Number(master) || 0, songShare: Number(songShare) || 0, radioPlays: Number(radio.plays) || 0, perPlay: Number(radio.perPlay) || 0 });

  return (
    <section className="space-y-4 rounded-2xl border border-border bg-card p-6">
      <div className="flex items-center gap-2"><Calculator className="h-6 w-6 text-primary" /><h3 className="text-xl font-bold">Projected Royalty Earnings</h3></div>
      <p className="text-sm text-muted-foreground">Enter expected streams on each platform. Rates start at published 2025 averages (paid to all rights holders together) and you can change any of them. About {Math.round(MASTER_PORTION * 100)}% of a stream's payout goes to the recording (the master) and {Math.round((1 - MASTER_PORTION) * 100)}% to the song, so your cut uses both of your shares.</p>
      <div className="grid gap-3 sm:grid-cols-3">
        <SongPicker id="earn-song" tracks={tracks} value={songId} onChange={pick} />
        <div className="space-y-1"><Label htmlFor="earn-master">Your share of the master (%)</Label><Input id="earn-master" type="number" min={0} max={100} value={master} onChange={(e) => setMaster(e.target.value)} /></div>
        <div className="space-y-1"><Label htmlFor="earn-song-share">Your share of the song (%)</Label><Input id="earn-song-share" type="number" min={0} max={100} value={songShare} onChange={(e) => setSongShare(e.target.value)} /></div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[34rem] text-sm">
          <thead><tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground"><th className="py-2 pr-3">Platform</th><th className="py-2 pr-3">Streams</th><th className="py-2 pr-3">Per stream ($)</th><th className="py-2 text-right">Your estimate</th></tr></thead>
          <tbody>{PLATFORMS.map((p) => {
            const row = r.platforms.find((x) => x.id === p.id)!;
            const src = p.source ? RATE_SOURCES[p.source] : undefined;
            return (
              <tr key={p.id} className="border-b border-border/60 align-top">
                <td className="py-2 pr-3"><div className="font-semibold">{p.name}</div>{(p.note || src) && <div className="text-xs text-muted-foreground">{p.note}{p.note && src ? " " : ""}{src && <a href={src.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 underline">{src.label}<ExternalLink className="h-3 w-3" /></a>}</div>}</td>
                <td className="py-2 pr-3"><Input aria-label={`${p.name} streams`} type="number" min={0} className="h-9 w-32" value={streams[p.id] ?? ""} placeholder="0" onChange={(e) => setStreams({ ...streams, [p.id]: e.target.value })} /></td>
                <td className="py-2 pr-3"><Input aria-label={`${p.name} rate per stream`} type="number" min={0} step="0.0001" className="h-9 w-28" value={rates[p.id] ?? ""} onChange={(e) => setRates({ ...rates, [p.id]: e.target.value })} /></td>
                <td className="py-2 text-right font-semibold">{money(row.yours)}</td>
              </tr>
            );
          })}
            <tr className="border-b border-border/60 align-top">
              <td className="py-2 pr-3"><div className="font-semibold">Radio, SiriusXM and live</div><div className="text-xs text-muted-foreground">Performance royalties: the song side only.</div></td>
              <td className="py-2 pr-3"><Input aria-label="Radio and live plays" type="number" min={0} className="h-9 w-32" value={radio.plays} onChange={(e) => setRadio({ ...radio, plays: e.target.value })} /></td>
              <td className="py-2 pr-3"><Input aria-label="Per play" type="number" min={0} step="0.01" className="h-9 w-28" value={radio.perPlay} onChange={(e) => setRadio({ ...radio, perPlay: e.target.value })} /></td>
              <td className="py-2 text-right font-semibold">{money(r.radio)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div className="rounded-xl bg-primary p-4 text-primary-foreground"><div className="text-sm opacity-90">Your projected total</div><div className="text-3xl font-bold">{money(r.yours)}</div></div>
      <p className="text-xs text-muted-foreground">Estimates only. Real rates vary by platform, country, subscription tier and agreement, and distributors, labels and publishers take their own cut before you're paid.</p>
    </section>
  );
}
