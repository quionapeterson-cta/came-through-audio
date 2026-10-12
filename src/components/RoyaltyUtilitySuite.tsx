import { useState } from "react";
import { Calculator, Lock, Repeat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { convertShare, projectEarnings } from "@/lib/plans";

const money = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });

export function RoyaltyUtilitySuite({ unlocked, onUpgrade }: { unlocked: boolean; onUpgrade: () => void }) {
  if (!unlocked) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-primary bg-card p-8 text-center">
        <Lock className="h-8 w-8 text-primary" />
        <h2 className="text-2xl font-bold">Royalty Utility Suite</h2>
        <p className="max-w-md text-muted-foreground">Convert BMI and ASCAP splits and forecast your future payouts. Included with Catalog and Collaborate.</p>
        <Button onClick={onUpgrade}>Upgrade to unlock</Button>
      </div>
    );
  }
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Converter />
      <Earnings />
    </div>
  );
}

function Converter() {
  const [value, setValue] = useState("100");
  const [from, setFrom] = useState<"100" | "200">("200");
  const to = from === "200" ? "100" : "200";
  const out = convertShare(Number(value) || 0, from, to);
  return (
    <div className="space-y-4 rounded-2xl border border-border bg-card p-6">
      <div className="flex items-center gap-2"><Repeat className="h-6 w-6 text-primary" /><h3 className="text-xl font-bold">Royalty Formula Converter</h3></div>
      <p className="text-sm text-muted-foreground">BMI counts writer + publisher shares out of 200%. ASCAP, SoundExchange and the MLC count out of 100%.</p>
      <div className="grid grid-cols-2 gap-2">
        <Button variant={from === "200" ? "default" : "outline"} onClick={() => setFrom("200")}>BMI → ASCAP</Button>
        <Button variant={from === "100" ? "default" : "outline"} onClick={() => setFrom("100")}>ASCAP → BMI</Button>
      </div>
      <div className="space-y-1"><Label>Share on the {from}% scale</Label><Input type="number" min={0} max={Number(from)} value={value} onChange={(e) => setValue(e.target.value)} /></div>
      <div className="rounded-xl bg-muted p-4">
        <div className="text-sm text-muted-foreground">Equals on the {to}% scale</div>
        <div className="text-3xl font-bold text-primary">{out.toFixed(2)}%</div>
      </div>
    </div>
  );
}

function Earnings() {
  const [v, setV] = useState({ streams: "100000", perStream: "0.004", radioSpins: "0", perSpin: "0.10", mechanicalUnits: "100000", perMechanical: "0.0008", share: "100" });
  const n = Object.fromEntries(Object.entries(v).map(([k, x]) => [k, Number(x) || 0])) as Record<keyof typeof v, number>;
  const r = projectEarnings(n);
  const field = (k: keyof typeof v, label: string) => (
    <div className="space-y-1"><Label className="text-xs">{label}</Label><Input type="number" min={0} value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value })} /></div>
  );
  return (
    <div className="space-y-4 rounded-2xl border border-border bg-card p-6">
      <div className="flex items-center gap-2"><Calculator className="h-6 w-6 text-primary" /><h3 className="text-xl font-bold">Projected Royalty Earnings</h3></div>
      <div className="grid grid-cols-2 gap-3">
        {field("streams", "Expected streams")}{field("perStream", "Per-stream rate ($)")}
        {field("radioSpins", "Radio / live plays")}{field("perSpin", "Per-play performance ($)")}
        {field("mechanicalUnits", "Mechanical units")}{field("perMechanical", "Per-unit mechanical ($)")}
        {field("share", "Your ownership share (%)")}
      </div>
      <div className="grid grid-cols-3 gap-2 text-center text-sm">
        <div className="rounded-lg bg-muted p-2"><div className="text-muted-foreground">Streaming</div><div className="font-bold">{money(r.streaming)}</div></div>
        <div className="rounded-lg bg-muted p-2"><div className="text-muted-foreground">Performance</div><div className="font-bold">{money(r.performance)}</div></div>
        <div className="rounded-lg bg-muted p-2"><div className="text-muted-foreground">Mechanical</div><div className="font-bold">{money(r.mechanical)}</div></div>
      </div>
      <div className="rounded-xl bg-primary p-4 text-primary-foreground"><div className="text-sm opacity-90">Projected total</div><div className="text-3xl font-bold">{money(r.total)}</div></div>
      <p className="text-xs text-muted-foreground">Estimates only. Real rates vary by platform, country and agreement.</p>
    </div>
  );
}
