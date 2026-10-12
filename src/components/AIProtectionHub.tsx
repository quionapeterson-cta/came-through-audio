import { useEffect, useState } from "react";
import type { CatalogTrack } from "@/lib/catalog";
import { Info, Lock, Plus, Trash2, ShieldCheck, Video, Fingerprint, Link2, Gavel } from "lucide-react";

const EXPLAINERS = [
  { icon: Fingerprint, title: "DAW & Draft Hashing (SHA-256)", tag: "Your song's tamper-proof digital fingerprint",
    plain: "When you upload a short screen recording of your DAW session (Logic, FL Studio, Ableton, Pro Tools) or lyric drafts, we create a unique 64-character fingerprint of that file.",
    why: "Change even one detail and the fingerprint changes completely — proving your session and arrangement existed in your hands first." },
  { icon: Link2, title: "Bitcoin Blockchain Anchored", tag: "Permanent, public proof of when",
    plain: "Your song's fingerprint is recorded on the public Bitcoin blockchain through OpenTimestamps. Your actual music is never uploaded there.",
    why: "No company, platform or label can alter, backdate or delete it. Anyone — a lawyer, distributor or judge — can verify the date at opentimestamps.org." },
  { icon: Gavel, title: "17 U.S.C. §504 Attestation", tag: "Your sworn human-creation record",
    plain: "A formal statement, made under penalty of law, that you and your listed contributors created this work as humans.",
    why: "U.S. copyright law allows statutory damages of up to $150,000 per work for willful infringement. A sworn, time-stamped record strengthens takedowns, PRO disputes and AI claims." },
];
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PACKAGES, MAX_PROOF_SECONDS, chainStrength, sha256, videoDuration, type PackageId } from "@/lib/proof";
import { useServerFn } from "@tanstack/react-start";
import { openCheckout } from "@/lib/paddle";
import { stampDigest } from "@/lib/ots.functions";
import { buildOtsFile, download, proofManifest } from "@/lib/ots";

type WriterRole = "author" | "composer" | "both" | "producer";
type WriterRow = { name: string; role: WriterRole };
type Proof = { name: string; hash: string };

export function AIProtectionHub({ userId, paid, track, email }: { userId: string; paid: boolean; track?: CatalogTrack | undefined; email?: string | undefined }) {
  const stamp = useServerFn(stampDigest);
  const [otsFile, setOtsFile] = useState<{ name: string; bytes: Uint8Array }>();
  const [f, setF] = useState({ title: "", artist: "", isrc: "", upc: "", iswc: "" });
  const [pkg, setPkg] = useState<PackageId>("Single");
  const [attest, setAttest] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [daw, setDaw] = useState<Proof>();
  const [notes, setNotes] = useState<Proof>();
  const [firstDraft, setFirstDraft] = useState("");
  const [lastDraft, setLastDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [writerRows, setWriterRows] = useState<WriterRow[]>([{ name: "", role: "both" }]);
  const named = writerRows.filter((w) => w.name.trim());
  const pick = (roles: WriterRole[]) => named.filter((w) => roles.includes(w.role)).map((w) => w.name.trim()).join(", ");
  const writers = pick(["author", "both"]);
  const composers = pick(["composer", "both"]);
  const producers = pick(["producer"]);
  useEffect(() => {
    if (!track) return;
    const m = track.metadata;
    setF({ title: track.title, artist: track.artist, isrc: m.isrc ?? "", upc: m.upc ?? "", iswc: m.iswc ?? "" });
    const rows: WriterRow[] = [];
    const add = (list: { name: string }[] | undefined, role: WriterRole) => (list ?? []).forEach((c) => {
      const name = c.name.trim(); if (!name) return;
      const hit = rows.find((r) => r.name.toLowerCase() === name.toLowerCase());
      if (hit && ((hit.role === "author" && role === "composer") || (hit.role === "composer" && role === "author"))) hit.role = "both";
      else if (!hit || hit.role !== role) rows.push({ name, role });
    });
    add(m.writers, "author"); add(m.composers, "composer"); add(m.producers, "producer");
    setWriterRows(rows.length ? rows : [{ name: "", role: "both" }]);
  }, [track]);
  const editRow = (i: number, patch: Partial<WriterRow>) => setWriterRows(writerRows.map((w, j) => (j === i ? { ...w, ...patch } : w)));
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  async function proof(file: File | undefined, done: (p: Proof) => void) {
    if (!file) return;
    try {
      const d = await videoDuration(file);
      if (d > MAX_PROOF_SECONDS) { toast.error(`Recordings must be ${MAX_PROOF_SECONDS} seconds or shorter (this one is ${Math.round(d)}s).`); return; }
      done({ name: file.name, hash: await sha256(await file.arrayBuffer()) });
    } catch { toast.error("That video could not be read."); }
  }

  const active = paid || unlocked;
  async function checkout() {
    try {
      await openCheckout({
        items: [{ priceId: `ai_protection_${pkg.toLowerCase()}`, quantity: 1 }], email,
        customData: { userId, kind: "ai", package: pkg, ...(track ? { trackId: track.id } : {}) },
        successUrl: `${window.location.origin}/workspace?tab=protect&checkout=success`,
      });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Checkout could not open."); }
  }

  async function generate() {
    if (!f.title || !f.artist || !named.some((w) => w.role !== "producer")) { toast.error("Track title, artist and at least one writer are required."); return; }
    if (!daw || !notes || !firstDraft || !lastDraft) { toast.error("Add both recordings and the first and latest draft dates."); return; }
    if (!attest) { toast.error("Check the legal attestation to continue."); return; }
    setBusy(true);
    try {
      const strength = chainStrength(new Date(firstDraft), new Date(lastDraft));
      const manifest = proofManifest({
        Track: f.title, Artist: f.artist, Writers: writers, Composers: composers, Producers: producers || "-",
        ISRC: f.isrc || "-", UPC: f.upc || "-", ISWC: f.iswc || "-", Chain: strength,
        "DAW session SHA-256": daw.hash, "Draft history SHA-256": notes.hash,
      });
      const manifestBytes = new TextEncoder().encode(manifest);
      const digest = await sha256(manifestBytes.buffer as ArrayBuffer);
      let ots: { calendar: string; receipt: string } | null = null;
      try { ots = await stamp({ data: { digest } }); } catch { toast.warning("Blockchain timestamp unavailable right now — certificate issued without it."); }
      const { data, error } = await supabase.from("ai_protection_certificates").insert({
        user_id: userId, format_type: pkg, track_title: f.title, artist_name: f.artist,
        legal_credits: { writers: writers, composers: composers, producers },
        isrc: f.isrc || null, upc: f.upc || null, iswc: f.iswc || null,
        session_hash: daw.hash, notes_hash: notes.hash, chain_strength: strength, attested: true,
        session_video_url: daw.name, notes_proof_url: notes.name,
        proof_digest: digest, ots_receipt: ots?.receipt ?? null, ots_calendar: ots?.calendar ?? null,
        blockchain_status: ots ? "pending_bitcoin" : "none",
      } as never).select("id, issued_at").single();
      if (error) throw error;
      const row = data as { id: string; issued_at: string };
      const [{ jsPDF }, QR] = await Promise.all([import("jspdf"), import("qrcode")]);
      const qr = await QR.toDataURL(`CTA-CERT:${row.id}:${digest}`);
      const pdf = new jsPDF();
      pdf.setFontSize(20); pdf.text("Came Through Audio — Proof Certificate", 15, 22);
      pdf.setFontSize(11);
      const lines = [`Certificate ID: ${row.id}`, `Issued: ${new Date(row.issued_at).toUTCString()}`, `Track: ${f.title}`, `Artist: ${f.artist}`,
        `Writers: ${writers}`, `Composers: ${composers}`, `Producers: ${producers || "—"}`,
        `ISRC: ${f.isrc || "—"}   UPC: ${f.upc || "—"}   ISWC: ${f.iswc || "—"}`, `Chain: ${strength}`,
        `DAW session SHA-256: ${daw.hash}`, `Draft history SHA-256: ${notes.hash}`,
        `Proof manifest SHA-256: ${digest}`,
        ots ? `Bitcoin timestamp: submitted via OpenTimestamps (${ots.calendar}); anchors within a few hours.` : "Bitcoin timestamp: not available",
        ots ? "Verify: upload the manifest .txt and .ots files at opentimestamps.org" : ""];
      let y = 36;
      lines.forEach((l) => { const s = pdf.splitTextToSize(l, 130); pdf.text(s, 15, y); y += 6 * s.length + 3; });
      pdf.addImage(qr, "PNG", 150, 36, 45, 45);
      const base = f.title.replace(/[^\w-]+/g, "_");
      pdf.save(`${base}-proof-certificate.pdf`);
      download(`${base}-proof-manifest.txt`, manifestBytes, "text/plain");
      if (ots) {
        const file = buildOtsFile(digest, ots.receipt);
        setOtsFile({ name: `${base}-proof-manifest.txt.ots`, bytes: file });
        download(`${base}-proof-manifest.txt.ots`, file, "application/octet-stream");
      }
      toast.success(ots ? "Certificate generated and submitted to the Bitcoin blockchain." : "Proof certificate generated.");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not generate certificate."); }
    finally { setBusy(false); }
  }

  return (
    <section className="mx-auto mt-8 max-w-5xl space-y-8 pb-12">
      <div className="flex items-center gap-3"><ShieldCheck className="h-8 w-8 text-primary" /><h1 className="text-2xl font-bold">AI Protection Hub</h1></div>

      <div className="space-y-4 rounded-2xl border-2 border-primary bg-card p-6">
        <span className="inline-flex items-center gap-2 rounded-full border border-primary px-3 py-1 text-xs font-bold tracking-widest text-primary"><ShieldCheck className="h-4 w-4" />CERTIFICATE OF HUMAN ORIGIN · BITCOIN BLOCKCHAIN ANCHORED</span>
        <h2 className="text-3xl font-extrabold leading-tight">Prove Human Origin — <span className="text-primary">And That You Made It First.</span></h2>
        <p className="max-w-3xl text-muted-foreground">Before your master hits DSPs or social media, lock in proof that a human made it. Get a tamper-proof Certificate of Human Origin, timestamped on the Bitcoin blockchain — shielding your sound from AI scrapers, voice cloning and false ownership claims.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {PACKAGES.map((p) => (
          <button key={p.id} type="button" onClick={() => setPkg(p.id)} className={`rounded-xl border-2 bg-card p-4 text-left transition ${pkg === p.id ? "border-primary shadow-lg" : "border-border hover:border-primary/50"}`}>
            <div className="font-semibold">{p.label}</div>
            <div className="mt-1 text-2xl font-bold text-primary">${p.price}</div>
            {p.save && <div className="text-xs font-semibold text-primary">{p.save}</div>}
          </button>
        ))}
      </div>

      {!active && (
        <div className="space-y-2 text-center">
          <Button size="lg" className="h-14 w-full text-lg font-bold sm:w-auto sm:px-12" onClick={checkout}>
            <Lock className="h-5 w-5" />Lock In Protection · ${PACKAGES.find((p) => p.id === pkg)!.price}
          </Button>
          <p className="text-xs text-muted-foreground">Instant activation · Publicly verifiable on Bitcoin · Add your track details after checkout</p>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        {EXPLAINERS.map((x) => (
          <div key={x.title} className="space-y-2 rounded-xl border border-primary/40 bg-card p-4 text-sm">
            <x.icon className="h-6 w-6 text-primary" />
            <div className="font-bold">{x.title}</div>
            <div className="text-xs font-semibold text-primary">{x.tag}</div>
            <p><span className="font-semibold">In plain English: </span>{x.plain}</p>
            <p className="text-muted-foreground"><span className="font-semibold text-foreground">Why you need it: </span>{x.why}</p>
          </div>
        ))}
      </div>

      {active && (<>
      <div className="rounded-xl border-2 border-primary bg-card p-4 font-semibold text-primary">Protection active — complete these steps to generate your certificate.</div>
      <h3 className="text-xl font-bold">Step 1 · Track details</h3>
      <div className="grid gap-6 md:grid-cols-[1fr_260px]">
        <div className="grid gap-4 sm:grid-cols-2">
          <F label="Track title *" v={f.title} on={set("title")} /><F label="Artist name *" v={f.artist} on={set("artist")} />
          <div className="space-y-3 rounded-xl border border-border p-4 sm:col-span-2">
            <div className="font-semibold">Contributors & Writers *</div>
            {writerRows.map((w, i) => (
              <div key={i} className="grid gap-2 sm:grid-cols-[1fr_15rem_auto]">
                <Input aria-label={`Writer ${i + 1} legal name`} placeholder="Full legal name" value={w.name} onChange={(e) => editRow(i, { name: e.target.value })} />
                <select aria-label={`Writer ${i + 1} role`} value={w.role} onChange={(e) => editRow(i, { role: e.target.value as WriterRole })} className="rounded-md border border-input bg-background px-3 py-2 text-sm">
                  <option value="both">Both (Author & Composer)</option>
                  <option value="author">Author (Lyrics)</option>
                  <option value="composer">Composer (Music / Beat)</option>
                  <option value="producer">Producer</option>
                </select>
                <Button type="button" variant="ghost" size="icon" aria-label="Remove contributor" disabled={writerRows.length === 1} onClick={() => setWriterRows(writerRows.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={() => setWriterRows([...writerRows, { name: "", role: "both" }])}><Plus className="h-4 w-4" />Add another contributor</Button>
          </div>
          <F label="ISRC (optional)" v={f.isrc} on={set("isrc")} />
          <F label="UPC (optional)" v={f.upc} on={set("upc")} /><F label="ISWC (optional)" v={f.iswc} on={set("iswc")} />
        </div>
        <div className="h-fit rounded-xl border border-primary bg-card p-4 text-sm"><Info className="mb-2 h-5 w-5 text-primary" />Use real legal names only — not stage names or pseudonyms. Certificates are legal records.</div>
      </div>

      <h3 className="text-xl font-bold">Step 2 · Record your proof</h3>
      <div className="grid gap-4 md:grid-cols-2">
        <ProofBox title="DAW Session Proof" proof={daw} on={(file) => proof(file, setDaw)}
          tip="Screen-record 5–15 seconds of your open project (FL Studio, Logic, Ableton, Pro Tools, etc.). Scroll through your tracks, stems, MIDI or automation. This shows you own the raw session — not just a finished bounce." />
        <ProofBox title="Draft History Proof" proof={notes} on={(file) => proof(file, setNotes)}
          tip="Screen-record 5–15 seconds of earlier versions: voice memos, rough mixes, lyric notes or a folder showing file dates. Then pick the date of your first idea and your latest version below.">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1"><Label>First idea / draft</Label><Input type="datetime-local" value={firstDraft} onChange={(e) => setFirstDraft(e.target.value)} /></div>
            <div className="space-y-1"><Label>Latest version</Label><Input type="datetime-local" value={lastDraft} onChange={(e) => setLastDraft(e.target.value)} /></div>
          </div>
          {firstDraft && lastDraft && <p className="text-sm font-semibold text-primary">{chainStrength(new Date(firstDraft), new Date(lastDraft))}</p>}
          <p className="text-xs text-muted-foreground">Drafts days apart earn a Strong Chain (Human Creation) rating.</p>
        </ProofBox>
      </div>

      <h3 className="text-xl font-bold">Step 3 · Confirm & generate</h3>
      <label className="flex items-start gap-3 rounded-xl border border-border p-4 text-sm">
        <input type="checkbox" className="mt-1 h-4 w-4 accent-[var(--primary)]" checked={attest} onChange={(e) => setAttest(e.target.checked)} />
        <span>I attest under penalty of law that the information and recordings I provide are true and that I (and the listed contributors) created this work. I understand fraudulent misrepresentation may expose me to statutory damages under 17 U.S.C. §504.</span>
      </label>
      <Button size="lg" disabled={busy} onClick={generate}>{busy ? "Generating…" : "Generate & download PDF certificate"}</Button>
      </>)}
      {otsFile && (
        <div className="space-y-2 rounded-xl border-2 border-primary bg-card p-4 text-sm">
          <p className="font-semibold text-primary">OpenTimestamps calendar submitted · Pending Bitcoin block confirmation</p>
          <p className="text-muted-foreground">Keep the manifest .txt and .ots files together. Anyone can verify them at opentimestamps.org.</p>
          <Button variant="outline" size="sm" onClick={() => download(otsFile.name, otsFile.bytes, "application/octet-stream")}>Download .ots proof again</Button>
        </div>
      )}

      {!paid && <div className="rounded-xl border-2 border-primary bg-card p-5 font-semibold text-primary">Upgrade to Catalog Plus to permanently embed and submit metadata to your catalog.</div>}
    </section>
  );
}

function F({ label, v, on }: { label: string; v: string; on: (e: React.ChangeEvent<HTMLInputElement>) => void }) {
  return <div className="space-y-1"><Label>{label}</Label><Input value={v} onChange={on} /></div>;
}

function ProofBox({ title, tip, proof, on, children }: { title: string; tip: string; proof?: Proof | undefined; on: (f?: File) => void; children?: React.ReactNode }) {
  return (
    <div className="space-y-3 rounded-xl border border-border p-4">
      <div className="flex items-center gap-2 font-semibold"><Video className="h-5 w-5 text-primary" />{title}</div>
      <p className="text-sm">{tip}</p>
      <p className="text-xs text-muted-foreground">Video file, {MAX_PROOF_SECONDS} seconds max. Only a fingerprint is saved, never your music.</p>
      <Input type="file" accept="video/*" onChange={(e) => on(e.target.files?.[0])} />
      {proof && <p className="break-all text-xs">SHA-256: {proof.hash}</p>}
      {children}
    </div>
  );
}
