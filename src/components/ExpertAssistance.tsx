import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Check, ChevronDown, ClipboardCheck, Copy, ExternalLink, FileSignature, Lock, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { useArtistName } from "@/hooks/useArtistName";
import { listTracks, type CatalogTrack } from "@/lib/catalog";
import { assistanceFees, assistanceTotal, assistanceType } from "@/lib/plans";
import { openCheckout } from "@/lib/checkout";
import { creditName } from "@/lib/metadata";
import { isBmi } from "@/lib/audit";
import {
  ACCESS_STEPS, ASSISTANCE_AGENCIES, MAX_NEW_SONGS, REPRESENTATIVE, SONG_STATUS_LABEL, intakeStep, missingFor, orderAgencies, writerLine,
  type NewSong, type RegistrationOrder, type RegistrationSong,
} from "@/lib/registration";
import {
  confirmRegistrationAccess, ensureRegistrationOrder, linkRegistrationSong, previewRegistrationAgreement, signRegistrationAgreement, submitRegistrationSongs,
} from "@/lib/registration.functions";
import type { Purchase } from "@/hooks/useBilling";

const PRO_CHOICES = ["ASCAP", "BMI"];
/** ASCAP and BMI are mutually exclusive: picking one PRO drops the other. */
export function toggleAgency(list: string[], a: string, on: boolean): string[] {
  if (!on) return list.filter((x) => x !== a);
  const base = PRO_CHOICES.includes(a) ? list.filter((x) => !PRO_CHOICES.includes(x)) : list;
  return [...base, a];
}

const GROUPS = ["Single", "EP", "Album"] as const;
const groupOf = (t: CatalogTrack) => {
  const r = t.metadata.releaseType;
  return r === "EP" ? "EP" : r === "Album" || r === "Compilation" ? "Album" : "Single";
};
const day = (d: string) => new Date(d).toLocaleDateString();
const errText = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);

type FixFn = (trackId: string, field: string) => void;

export function ExpertAssistance({ purchases, justPaid, onFix, onCatalog, onAddSong }: { userId: string; purchases: Purchase[]; justPaid?: boolean; onFix?: FixFn; onCatalog?: () => void; onAddSong?: (title: string, artist?: string) => void }) {
  const [tracks, setTracks] = useState<CatalogTrack[]>([]);
  useEffect(() => { listTracks().then(setTracks).catch(() => {}); }, []);
  const orders = useMemo(() => purchases.filter((p) => p.kind === "expert"), [purchases]);
  const [picked, setPicked] = useState<string>();
  const [ordering, setOrdering] = useState(false);
  const current = orders.find((o) => o.id === picked) ?? orders[0];

  return (
    <div className="rounded-2xl border-2 border-primary bg-card p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-bold uppercase tracking-widest text-primary">Done-for-you</p>
          <h2 className="mt-1 text-2xl font-bold">Expert Registration Assistance</h2>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">Our agents register your songs with ASCAP or BMI, The MLC and SoundExchange for you, straight from My Catalog. No calls to book: you complete the checklist and we take it from there.</p>
        </div>
        {current && !ordering && <Button variant="outline" onClick={() => setOrdering(true)}><Plus className="h-4 w-4" />New order</Button>}
      </div>

      {orders.length > 1 && !ordering && (
        <div className="mt-4 flex flex-wrap gap-2">
          {orders.map((o) => <Button key={o.id} size="sm" variant={o.id === current?.id ? "default" : "outline"} onClick={() => setPicked(o.id)}>Order {day(o.created_at)} · {o.details["songs"]} song{o.details["songs"] === "1" ? "" : "s"}</Button>)}
        </div>
      )}

      <div className="mt-6">
        {!current || ordering
          ? <OrderForm tracks={tracks} onCancel={current ? () => setOrdering(false) : undefined} />
          : <Checklist key={current.id} purchase={current} tracks={tracks} justPaid={!!justPaid} onFix={onFix} onCatalog={onCatalog} onAddSong={onAddSong} />}
      </div>
    </div>
  );
}

// ── Order form (§1–2) ────────────────────────────────────────────────────────

function OrderForm({ tracks, onCancel }: { tracks: CatalogTrack[]; onCancel?: (() => void) | undefined }) {
  const { user } = useAuth();
  const { artist } = useArtistName(user);
  const [ids, setIds] = useState<string[]>([]);
  const [extra, setExtra] = useState<NewSong[]>([]);
  const [agencies, setAgencies] = useState<string[]>(["ASCAP"]);
  const [busy, setBusy] = useState(false);
  const targets = orderAgencies(agencies);
  const songs = ids.length + extra.filter((s) => s.title.trim()).length;
  const type = assistanceType(songs);
  const fee = assistanceFees(type, songs);
  const total = assistanceTotal(type, songs, agencies.length);
  const toggle = (id: string, on: boolean) => setIds((l) => (on ? [...l, id] : l.filter((x) => x !== id)));

  async function pay() {
    const newSongs = extra.filter((s) => s.title.trim()).map((s) => ({ title: s.title.trim(), artist: s.artist.trim() }));
    if (!songs || !agencies.length) { toast.error("Choose your songs and at least one agency."); return; }
    setBusy(true);
    try { await openCheckout({ kind: "expert", trackIds: ids, newSongs, agencies: agencies as (typeof ASSISTANCE_AGENCIES)[number][] }); }
    catch (e) { toast.error(errText(e, "Checkout could not open.")); }
    finally { setBusy(false); }
  }

  return (
    <div className="grid gap-6 md:grid-cols-[1fr_320px]">
      <div className="space-y-3">
        <h3 className="font-semibold">1. Pick your songs</h3>
        {!tracks.length && <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">Registration runs from your catalog. You can pay now and add the songs to My Catalog right after.</p>}
        {GROUPS.map((g) => {
          const list = tracks.filter((t) => groupOf(t) === g);
          if (!list.length) return null;
          const chosen = list.filter((t) => ids.includes(t.id)).length;
          return (
            <Section key={g} title={`${g === "Album" ? "Albums" : `${g}s`} · ${list.length}`} summary={chosen ? `${chosen} picked` : "None picked"} open={g === "Single"}>
              <ul className="space-y-2">
                {list.map((t) => {
                  const miss = targets.length ? missingFor(t.metadata, targets) : [];
                  return (
                    <li key={t.id}>
                      <label className="flex items-center justify-between gap-3 text-sm">
                        <span className="flex items-center gap-2"><input type="checkbox" className="accent-[var(--primary)]" checked={ids.includes(t.id)} onChange={(e) => toggle(t.id, e.target.checked)} />{t.title || "Untitled"}<span className="text-muted-foreground">{t.metadata.album}</span></span>
                        <span className={`shrink-0 text-xs ${miss.length ? "text-muted-foreground" : "text-primary"}`}>{miss.length ? `⚠️ ${miss.length} item${miss.length === 1 ? "" : "s"} to complete` : "✓ Ready to submit"}</span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </Section>
          );
        })}
        {extra.map((s, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2">
            <Input className="min-w-40 flex-1" placeholder="Song title" maxLength={120} value={s.title} onChange={(e) => setExtra(extra.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} />
            <Input className="min-w-32 flex-1" placeholder="Artist" maxLength={80} value={s.artist} onChange={(e) => setExtra(extra.map((x, j) => (j === i ? { ...x, artist: e.target.value } : x)))} />
            <Button size="icon" variant="ghost" aria-label="Remove this song" onClick={() => setExtra(extra.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
          </div>
        ))}
        {extra.length < MAX_NEW_SONGS && <Button variant="outline" size="sm" onClick={() => setExtra([...extra, { title: "", artist }])}><Plus className="h-4 w-4" />A song that isn't in my catalog yet</Button>}
        {extra.length > 0 && <p className="text-xs text-muted-foreground">You'll add these to My Catalog after paying, so we register them with the right details.</p>}
      </div>

      <div className="space-y-4">
        <div className="space-y-2 text-sm">
          <h3 className="font-semibold">2. Choose the organizations</h3>
          <p className="text-xs text-muted-foreground">Songwriters can only belong to one PRO: choose ASCAP or BMI. You need your own membership with each one; we register inside your account.</p>
          {ASSISTANCE_AGENCIES.map((a) => (
            <label key={a} className="flex items-center gap-2"><input type="checkbox" className="accent-[var(--primary)]" checked={agencies.includes(a)} onChange={(e) => setAgencies(toggleAgency(agencies, a, e.target.checked))} />{a}</label>
          ))}
        </div>
        <div className="space-y-1 rounded-lg bg-muted p-3 text-sm">
          <div className="flex justify-between"><span>Base Fee <span className="text-muted-foreground">({type === "single" ? "Single / EP" : "album"})</span></span><span>${fee.base.toFixed(2)}</span></div>
          {fee.extended > 0 && <div className="flex justify-between"><span>Extended Repertoire Fee <span className="text-muted-foreground">(tracks 21+)</span></span><span>${fee.extended.toFixed(2)}</span></div>}
          <div className="flex justify-between"><span>{songs} song{songs === 1 ? "" : "s"} × {agencies.length} agenc{agencies.length === 1 ? "y" : "ies"} × $4.99</span><span>${(songs * agencies.length * 4.99).toFixed(2)}</span></div>
        </div>
        <div className="text-3xl font-bold text-primary">${total.toFixed(2)}</div>
        <Button className="w-full" size="lg" disabled={busy || !songs || !agencies.length} onClick={pay}>Pay & start registration</Button>
        <p className="text-xs text-muted-foreground">Refundable for 30 days, until our team starts work (when you submit your songs and sign).</p>
        {onCancel && <Button variant="ghost" className="w-full" onClick={onCancel}>Back to my order</Button>}
      </div>
    </div>
  );
}

// ── Intake checklist (§3) ────────────────────────────────────────────────────

function Checklist({ purchase, tracks, justPaid, onFix, onCatalog, onAddSong }: { purchase: Purchase; tracks: CatalogTrack[]; justPaid: boolean; onFix?: FixFn | undefined; onCatalog?: (() => void) | undefined; onAddSong?: ((title: string, artist?: string) => void) | undefined }) {
  const [order, setOrder] = useState<RegistrationOrder | null>();
  const [songs, setSongs] = useState<RegistrationSong[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [o, s] = await Promise.all([
      supabase.from("registration_orders" as never).select("*").eq("purchase_id", purchase.id).maybeSingle(),
      supabase.from("registration_songs" as never).select("*").eq("purchase_id", purchase.id).order("position"),
    ]);
    if (o.error) { setOrder(null); return; }
    if (!o.data) {
      // Paid before the intake existed, or the payment webhook couldn't set it up: set it up now.
      try { await ensureRegistrationOrder({ data: { purchaseId: purchase.id } }); } catch (e) { console.error(e); setOrder(null); return; }
      return load();
    }
    setOrder(o.data as RegistrationOrder);
    setSongs((s.data ?? []) as RegistrationSong[]);
  }, [purchase.id]);
  useEffect(() => { void load(); }, [load]);

  const byId = useMemo(() => new Map(tracks.map((t) => [t.id, t])), [tracks]);
  const targets = useMemo(() => orderAgencies(order?.agencies ?? []), [order]);
  const rows = songs.map((s) => {
    const t = s.track_id ? byId.get(s.track_id) : undefined;
    const m = s.snapshot ?? t?.metadata;
    return { s, t, m, title: m?.title || s.pending_title || "Untitled", miss: s.submitted_at || !m ? [] : missingFor(m, targets) };
  });
  const todo = rows.filter((r) => !r.s.submitted_at && (!r.m || r.miss.length));
  const allReady = rows.length > 0 && !todo.length;

  if (order === undefined) return <p className="text-sm text-muted-foreground">Loading your order…</p>;
  if (order === null) return <p className="text-sm text-muted-foreground">⚠️ Your order is paid, and we're setting up your checklist. Refresh in a minute, or contact support if this stays.</p>;

  const step = intakeStep(order, songs, allReady);
  const free = tracks.filter((t) => !songs.some((s) => s.track_id === t.id));
  async function run(fn: () => Promise<unknown>, done: string) {
    setBusy(true);
    try { await fn(); toast.success(done); await load(); }
    catch (e) { toast.error(errText(e, "Something went wrong. Try again.")); }
    finally { setBusy(false); }
  }
  const link = (songId: string, trackId: string) => run(() => linkRegistrationSong({ data: { songId, trackId } }), "Song linked.");

  return (
    <ol className="space-y-3">
      <Step n={1} title="Payment confirmed" state="done" summary={`${day(purchase.created_at)} · ${rows.length} song${rows.length === 1 ? "" : "s"} · ${order.agencies.join(", ")}`} />

      <Step n={2} title="Readiness check" state={step > 2 ? "done" : "active"}
        summary={allReady || step > 2 ? `All ${rows.length} songs are ready ✓` : `⚠️ ${todo.length} of ${rows.length} song${rows.length === 1 ? "" : "s"} need${todo.length === 1 ? "s" : ""} a few details`}>
        {justPaid && todo.length > 0 && <p className="rounded-lg border border-primary bg-primary/5 p-3 text-sm font-semibold">Payment confirmed. {todo.length} of {rows.length} songs need a few details before our agents can register them. We've emailed you this list too.</p>}
        <ul className="space-y-2 text-sm">
          {todo.map(({ s, t, m, title, miss }) => (
            <li key={s.id} className="rounded-md bg-muted px-3 py-2">
              <div className="font-semibold">{title}</div>
              {!m ? (
                <div className="mt-1 space-y-2">
                  <button type="button" className="text-left text-primary underline-offset-2 hover:underline" onClick={() => {
                    // Opens Add song with the title they typed at checkout; once saved, they pick it here.
                    if (onAddSong && s.pending_title) onAddSong(s.pending_title, s.pending_artist ?? undefined); else onCatalog?.();
                    toast.info(`Finish "${title}" in My Catalog and save it, then come back and pick it here.`);
                  }}>⚠️ Add this song to My Catalog →</button>
                  <SongPicker label="Already added? Pick it" tracks={free} disabled={busy} onPick={(id) => link(s.id, id)} />
                </div>
              ) : (
                <ul className="mt-1">{miss.map((i) => (
                  <li key={i.field + i.message}>
                    {onFix && t ? <button type="button" className="text-left hover:underline" onClick={() => onFix(t.id, i.field)}>⚠️ {i.message} →</button> : <>⚠️ {i.message}</>}
                    {targets.length > 1 && <span className="text-xs text-muted-foreground"> ({i.agencies.join(", ")})</span>}
                  </li>
                ))}</ul>
              )}
            </li>
          ))}
        </ul>
        {todo.length > 0 && <p className="text-xs text-muted-foreground">Each song turns ✓ as soon as you save it in My Catalog. Your 30-day refund window keeps running until you submit.</p>}
      </Step>

      <Step n={3} title="Confirm and submit your songs" state={step > 3 ? "done" : step === 3 ? "active" : "locked"}
        summary={step > 3 ? "Submitted ✓" : step === 3 ? "Review each song, then submit" : "Unlocks when every song is ready"}>
        <div className="grid gap-3 md:grid-cols-2">
          {rows.map(({ s, m, title }) => m && (
            <div key={s.id} className="rounded-lg border border-border p-3 text-sm">
              <div className="flex items-center justify-between gap-2"><span className="font-semibold">{title}</span>{!s.submitted_at && <SongPicker label="Swap" tracks={free} disabled={busy} onPick={(id) => link(s.id, id)} compact />}</div>
              <p className="mt-1 text-muted-foreground">Writers: {writerLine(m) || "—"}</p>
              <p className="text-muted-foreground">Publishers: {m.selfPublished ? "Self-published" : m.publishers.filter(creditName).map((p) => `${creditName(p)}${p.percentage ? ` (${p.percentage}%)` : ""}`).join(", ") || ([...m.writers, ...m.composers].some((w) => creditName(w) && isBmi(w)) ? "None, BMI pays the writers" : "—")}</p>
              <p className="text-muted-foreground">ISRC: {m.isrc || "—"} · {order.agencies.join(", ")}</p>
            </div>
          ))}
        </div>
        {step === 3 && <>
          <Button className="w-full" size="lg" disabled={busy} onClick={() => run(() => submitRegistrationSongs({ data: { purchaseId: order.purchase_id } }), "Songs submitted.")}>Submit for registration</Button>
          <p className="text-xs text-muted-foreground">This is when our work starts, so the 30-day refund window ends here. Need a change after submitting? Contact support and we'll unlock the song.</p>
        </>}
      </Step>

      <Step n={4} title="Sign the Registration Authorization" state={step > 4 ? "done" : step === 4 ? "active" : "locked"}
        summary={order.agreement_signed_at ? `Signed by ${order.agreement_name} · ${day(order.agreement_signed_at)}` : "Lets our agents register in your accounts"}>
        {step === 4 ? <Agreement purchaseId={order.purchase_id} onSigned={load} /> : order.agreement_body && <AgreementText purchaseId={order.purchase_id} />}
      </Step>

      <Step n={5} title="Add Came Through Audio as your representative" state={step > 5 ? "done" : step === 5 ? "active" : "locked"}
        summary={`${order.agencies.filter((a) => order.access_confirmed[a]).length} of ${order.agencies.length} done`}>
        <p className="text-sm text-muted-foreground">In each account, add us as a user with these details. Never share your password; you can remove our access any time.</p>
        <Representative />
        <div className="grid gap-3 md:grid-cols-2">
          {order.agencies.map((a) => {
            const info = ACCESS_STEPS[a];
            const done = !!order.access_confirmed[a];
            return (
              <div key={a} className="rounded-lg border border-border p-3 text-sm">
                <div className="flex items-center justify-between"><span className="font-semibold">{a}</span>{done && <span className="text-primary">✓ Done</span>}</div>
                {info && <>
                  <p className="mt-1 text-xs text-muted-foreground">{info.where} · Permission: {info.permission}</p>
                  <ol className="mt-2 list-decimal space-y-1 pl-5">{info.steps.map((x) => <li key={x}>{x}</li>)}</ol>
                </>}
                <div className="mt-3 flex flex-wrap gap-2">
                  {!done && <Button size="sm" disabled={busy || step !== 5} onClick={() => run(() => confirmRegistrationAccess({ data: { purchaseId: order.purchase_id, agency: a } }), `${a} marked done.`)}>Done</Button>}
                  {info && <Button size="sm" variant="outline" asChild><a href={info.help} target="_blank" rel="noreferrer">Need help?<ExternalLink className="h-3 w-3" /></a></Button>}
                </div>
              </div>
            );
          })}
        </div>
      </Step>

      <Step n={6} title="Status" state={step === 6 ? "active" : "locked"} summary={step === 6 ? "Pending: we register songs in the order they're submitted" : "Starts once the steps above are done"}>
        <p className="text-sm text-muted-foreground">We register songs in the order they're submitted and email you as each one is filed.</p>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted text-left"><tr><th className="px-3 py-2">Song</th>{order.agencies.map((a) => <th key={a} className="px-3 py-2">{a}</th>)}</tr></thead>
            <tbody>{rows.map(({ s, title }) => (
              <tr key={s.id} className="border-t border-border"><td className="px-3 py-2">{title}</td>
                {order.agencies.map((a) => <td key={a} className="px-3 py-2">{s.status[a] ? SONG_STATUS_LABEL[s.status[a]!] : "Waiting on you"}</td>)}</tr>
            ))}</tbody>
          </table>
        </div>
      </Step>
    </ol>
  );
}

function Step({ n, title, state, summary, children }: { n: number; title: string; state: "done" | "active" | "locked"; summary: string; children?: ReactNode }) {
  const badge = <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs ${state === "done" ? "bg-primary text-primary-foreground" : state === "active" ? "border-2 border-primary font-bold text-primary" : "border border-border text-muted-foreground"}`}>{state === "done" ? <Check className="h-3 w-3" /> : state === "locked" ? <Lock className="h-3 w-3" /> : n}</span>;
  if (!children) return <li className="flex items-center gap-3 rounded-xl border border-border p-4">{badge}<span className="font-semibold">{title}</span><span className="ml-auto text-sm text-muted-foreground">{summary}</span></li>;
  return (
    <li>
      <details open={state === "active"} className="group rounded-xl border border-border open:border-primary/60">
        <summary className="flex cursor-pointer list-none items-center gap-3 p-4 [&::-webkit-details-marker]:hidden">
          {badge}<span className="font-semibold">{title}</span>
          <span className="ml-auto flex min-w-0 items-center gap-2 text-sm text-muted-foreground"><span className="truncate">{summary}</span><ChevronDown className="h-4 w-4 shrink-0 transition group-open:rotate-180" aria-hidden /></span>
        </summary>
        <div className="space-y-3 border-t border-border p-4">{state === "locked" && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Lock className="h-4 w-4" />Finish the steps above first.</p>}{children}</div>
      </details>
    </li>
  );
}

function Section({ title, summary, open, children }: { title: string; summary: string; open?: boolean; children: ReactNode }) {
  return (
    <details open={open} className="group rounded-xl border border-border open:border-primary/60">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-3 [&::-webkit-details-marker]:hidden">
        <span className="font-semibold">{title}</span>
        <span className="flex items-center gap-2 text-sm text-muted-foreground">{summary}<ChevronDown className="h-4 w-4 transition group-open:rotate-180" aria-hidden /></span>
      </summary>
      <div className="border-t border-border p-3">{children}</div>
    </details>
  );
}

function SongPicker({ label, tracks, onPick, disabled, compact }: { label: string; tracks: CatalogTrack[]; onPick: (id: string) => void; disabled?: boolean; compact?: boolean }) {
  if (!tracks.length) return null;
  return (
    <select aria-label={label} disabled={disabled} value="" onChange={(e) => e.target.value && onPick(e.target.value)}
      className={`rounded-md border border-input bg-background px-2 text-sm ${compact ? "h-8" : "h-9 w-full"}`}>
      <option value="">{label}…</option>
      {tracks.map((t) => <option key={t.id} value={t.id}>{t.title || "Untitled"}</option>)}
    </select>
  );
}

function Representative() {
  const rows: [string, string][] = [["Email", REPRESENTATIVE.email], ["First name", REPRESENTATIVE.firstName], ["Last name", REPRESENTATIVE.lastName]];
  const copy = (v: string) => { void navigator.clipboard?.writeText(v).then(() => toast.success("Copied.")); };
  return (
    <div className="grid gap-2 rounded-lg bg-muted p-3 text-sm sm:grid-cols-3">
      {rows.map(([k, v]) => (
        <button key={k} type="button" onClick={() => copy(v)} className="flex items-center justify-between gap-2 rounded-md bg-background px-3 py-2 text-left" aria-label={`Copy ${k}`}>
          <span><span className="block text-xs text-muted-foreground">{k}</span><span className="font-semibold">{v}</span></span><Copy className="h-4 w-4 shrink-0 text-muted-foreground" />
        </button>
      ))}
    </div>
  );
}

function AgreementText({ purchaseId, name = "" }: { purchaseId: string; name?: string }) {
  const [body, setBody] = useState("");
  useEffect(() => {
    const t = setTimeout(() => { previewRegistrationAgreement({ data: { purchaseId, legalName: name } }).then((r) => setBody(r.body)).catch(() => setBody("")); }, 300);
    return () => clearTimeout(t);
  }, [purchaseId, name]);
  return <pre className="max-h-80 overflow-y-auto whitespace-pre-wrap rounded-lg bg-muted p-4 font-sans text-xs leading-relaxed">{body || "Loading the agreement…"}</pre>;
}

function Agreement({ purchaseId, onSigned }: { purchaseId: string; onSigned: () => void }) {
  const [name, setName] = useState("");
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  async function sign() {
    if (name.trim().length < 2 || !agree) { toast.error("Type your full legal name and confirm you agree."); return; }
    setBusy(true);
    try { await signRegistrationAgreement({ data: { purchaseId, legalName: name.trim() } }); toast.success("Agreement signed."); onSigned(); }
    catch (e) { toast.error(errText(e, "Couldn't sign. Try again.")); }
    finally { setBusy(false); }
  }
  return (
    <div className="space-y-3 text-sm">
      <div className="flex items-center gap-2 font-semibold"><FileSignature className="h-5 w-5 text-primary" />Registration Authorization</div>
      <AgreementText purchaseId={purchaseId} name={name} />
      <Input placeholder="Type your full legal name to sign" value={name} maxLength={200} onChange={(e) => setName(e.target.value)} />
      <label className="flex items-start gap-2"><input type="checkbox" className="mt-1 accent-[var(--primary)]" checked={agree} onChange={(e) => setAgree(e.target.checked)} />I've read the Registration Authorization and agree to it. My typed name is my signature.</label>
      <Button className="w-full" disabled={busy} onClick={sign}><ClipboardCheck className="h-4 w-4" />Sign agreement</Button>
    </div>
  );
}
