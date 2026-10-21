import { useEffect, useMemo, useState } from "react";
import { CalendarClock, Check, Lock, FileSignature } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { listTracks, type CatalogTrack } from "@/lib/catalog";
import { REGISTRATION_AGENCY_LABEL, registrationAgency, registrationChecks, type MissingItem, type RegistrationAgency } from "@/lib/readiness";
import { assistanceFees, assistanceTotal } from "@/lib/plans";
import { openCheckout } from "@/lib/checkout";
import type { Purchase } from "@/hooks/useBilling";

// Public registries only — SESAC is invitation-only and not offered.
const AGENCIES = ["ASCAP", "BMI", "SoundExchange", "The MLC"];

const PRO_CHOICES = ["ASCAP", "BMI"];
/** ASCAP and BMI are mutually exclusive: picking one PRO drops the other. */
export function toggleAgency(list: string[], a: string, on: boolean): string[] {
  if (!on) return list.filter((x) => x !== a);
  const base = PRO_CHOICES.includes(a) ? list.filter((x) => !PRO_CHOICES.includes(x)) : list;
  return [...base, a];
}

/** Every agency's missing items for one song, merged so an item two agencies share shows once, naming both. */
function missingFor(m: CatalogTrack["metadata"], agencies: RegistrationAgency[]): (MissingItem & { agencies: string[] })[] {
  const out = new Map<string, MissingItem & { agencies: string[] }>();
  for (const c of registrationChecks(m, agencies)) for (const i of c.missing) {
    const key = `${i.field}|${i.message}`;
    const seen = out.get(key);
    if (seen) seen.agencies.push(REGISTRATION_AGENCY_LABEL[c.agency]);
    else out.set(key, { ...i, agencies: [REGISTRATION_AGENCY_LABEL[c.agency]] });
  }
  return [...out.values()];
}

export function ExpertAssistance({ userId, purchases, onFix }: { userId: string; purchases: Purchase[]; onFix?: (trackId: string, field: string) => void }) {
  const [tracks, setTracks] = useState<CatalogTrack[]>([]);
  const [type, setType] = useState<"single" | "album">("single");
  const [count, setCount] = useState("1");
  const [agencies, setAgencies] = useState<string[]>([AGENCIES[0]!]);
  const [signed, setSigned] = useState<Record<string, boolean>>({});
  const [sigName, setSigName] = useState("");
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => { listTracks().then(setTracks).catch(() => {}); }, []);
  const session = purchases.find((p) => p.kind === "expert");
  useEffect(() => {
    if (!session) return;
    supabase.from("expert_gateways" as never).select("purchase_id").eq("purchase_id", session.id).then(({ data }) => {
      if ((data ?? []).length) setSigned((s) => ({ ...s, [session.id]: true }));
    });
  }, [session]);

  const songs = Number(count) || 0;
  const total = assistanceTotal(type, songs, agencies.length);
  const sessionAgencies = session ? (session.details["agencies"] ?? "").split(" | ") : agencies;
  const targets = useMemo(() => sessionAgencies.map(registrationAgency).filter((a): a is RegistrationAgency => !!a), [sessionAgencies.join("|")]); // eslint-disable-line react-hooks/exhaustive-deps
  // Each agency's own checklist (shared readiness module); splits must be settled before registering.
  const incomplete = useMemo(() => tracks.map((t) => ({ t, miss: missingFor(t.metadata, targets) })).filter((x) => x.miss.length), [tracks, targets]);
  const readyCount = tracks.length - incomplete.length;
  const paidSongs = Number(session?.details["songs"] ?? 0);
  const catalogReady = !!session && readyCount >= paidSongs && paidSongs > 0;

  async function pay() {
    if (!songs || !agencies.length) { toast.error("Choose your songs and at least one agency."); return; }
    setBusy(true);
    try {
      await openCheckout({ kind: "expert", type, songs, agencies });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Checkout could not open."); }
    finally { setBusy(false); }
  }

  async function sign() {
    if (!session || !sigName.trim() || !agree) { toast.error("Type your legal name and confirm the agreement."); return; }
    const { error } = await supabase.from("expert_gateways" as never).insert({ user_id: userId, purchase_id: session.id, signature_name: sigName.trim(), agencies: (session.details["agencies"] ?? "").split(" | ") } as never);
    if (error) { toast.error(error.message); return; }
    setSigned({ ...signed, [session.id]: true });
    toast.success("Agreement signed.");
  }

  const step = (n: number, label: string, done: boolean, active: boolean) => (
    <li className={`flex items-center gap-2 text-sm ${active ? "font-bold" : ""}`}>
      <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${done ? "bg-primary text-primary-foreground" : "border border-border"}`}>{done ? <Check className="h-3 w-3" /> : n}</span>{label}
    </li>
  );
  const isSigned = !!session && !!signed[session.id];

  return (
    <div className="rounded-2xl border-2 border-primary bg-card p-6">
      <div className="grid gap-8 md:grid-cols-2">
        <div>
          <CalendarClock className="h-8 w-8 text-primary" />
          <p className="mt-3 text-sm font-bold uppercase tracking-widest text-primary">Need help?</p>
          <h2 className="mt-1 text-2xl font-bold">Get Expert Registration Assistance</h2>
          <p className="mt-2 text-sm text-muted-foreground">Live 1-on-1 video guidance so your PRO, SoundExchange and MLC submissions are bulletproof — and you collect every dollar you're owed.</p>
          <ol className="mt-5 space-y-2">
            {step(1, "Pay upfront", !!session, !session)}
            {step(2, "Complete your track data in My Catalog", catalogReady, !!session && !catalogReady)}
            {step(3, "Sign the registry login agreement", isSigned, catalogReady && !isSigned)}
            {step(4, "Schedule your live session", false, isSigned)}
          </ol>
        </div>

        <div>
          {!session && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                {(["single", "album"] as const).map((t) => <Button key={t} variant={type === t ? "default" : "outline"} onClick={() => setType(t)}>{t === "single" ? "Single / EP" : "Full album"}</Button>)}
              </div>
              <label className="block space-y-1 text-sm"><span>Songs {type === "single" ? "(up to 6)" : "(each 20 tracks adds a setup fee)"}</span>
                <Input type="number" min={1} max={type === "single" ? 6 : 200} value={count} onChange={(e) => setCount(e.target.value === "" ? "" : String(Math.max(1, Math.min(type === "single" ? 6 : 200, Number(e.target.value)))))} />
              </label>
              <div className="space-y-2 text-sm">
                <span>Agencies</span>
                <p className="text-xs text-muted-foreground">Songwriters can only belong to one PRO — choose ASCAP or BMI.</p>
                {AGENCIES.map((a) => (
                  <label key={a} className="flex items-center gap-2"><input type="checkbox" className="accent-[var(--primary)]" checked={agencies.includes(a)} onChange={(e) => setAgencies(toggleAgency(agencies, a, e.target.checked))} />{a}</label>
                ))}
              </div>
              {(() => { const fee = assistanceFees(type, songs); return (
                <div className="space-y-1 rounded-lg bg-muted p-3 text-sm">
                  <div className="flex justify-between"><span>Base Fee</span><span>${fee.base.toFixed(2)}</span></div>
                  {fee.extended > 0 && <div className="flex justify-between"><span>Extended Repertoire Fee <span className="text-muted-foreground">(tracks 21+)</span></span><span>${fee.extended.toFixed(2)}</span></div>}
                  <div className="flex justify-between"><span>{fee.n} song{fee.n === 1 ? "" : "s"} × {agencies.length} agenc{agencies.length === 1 ? "y" : "ies"} × $4.99</span><span>${(fee.n * agencies.length * 4.99).toFixed(2)}</span></div>
                </div>); })()}
              {type === "album" && <p className="text-xs text-muted-foreground">After 20 tracks, each extra batch of 1–6 songs adds $14.99 and 7–20 songs adds $29.99.</p>}
              <div className="text-3xl font-bold text-primary">${total.toFixed(2)}</div>
              <Button className="w-full" size="lg" disabled={busy} onClick={pay}>Pay & reserve my session</Button>
            </div>
          )}

          {session && !catalogReady && (
            <div className="space-y-3 text-sm">
              <p className="flex items-center gap-2 font-semibold"><Lock className="h-4 w-4 text-primary" />Scheduling unlocks once {paidSongs} song{paidSongs === 1 ? " is" : "s are"} fully entered in My Catalog.</p>
              <p className="text-muted-foreground">Ready: {readyCount} of {paidSongs}</p>
              {incomplete.slice(0, 6).map(({ t, miss }) => <div key={t.id} className="rounded-md bg-muted px-3 py-2">
                <div className="font-semibold">{t.title || "Untitled"}</div>
                <ul>{miss.map((i) => <li key={i.field + i.message}>
                  {onFix ? <button type="button" className="text-left" onClick={() => onFix(t.id, i.field)}>⚠️ {i.message}</button> : <>⚠️ {i.message}</>}
                  {targets.length > 1 && <span className="text-xs text-muted-foreground"> ({i.agencies.join(", ")})</span>}
                </li>)}</ul>
              </div>)}
            </div>
          )}

          {catalogReady && !isSigned && (
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2 font-bold"><FileSignature className="h-5 w-5 text-primary" />Digital Gateway Agreement</div>
              <p className="text-muted-foreground">I confirm I can successfully log into each registry account for this session ({session?.details["agencies"]}). I understand the live call is used for data audit and confirmation, not account recovery or setup.</p>
              <label className="flex items-start gap-2"><input type="checkbox" className="mt-1 accent-[var(--primary)]" checked={agree} onChange={(e) => setAgree(e.target.checked)} />I agree and have tested my logins.</label>
              <Input placeholder="Type your full legal name to sign" value={sigName} onChange={(e) => setSigName(e.target.value)} />
              <Button className="w-full" onClick={sign}>Sign agreement</Button>
            </div>
          )}

          {isSigned && (
            <div className="space-y-3 text-sm">
              <p className="font-bold text-primary">You're cleared. Pick a time for your live session.</p>
              <Button className="w-full" size="lg" onClick={() => toast.info("Booking calendar is being connected — we'll email you to schedule.")}>Schedule my session</Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
