import { useState } from "react";
import { Info, Lock, ShieldCheck, Video } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PACKAGES, MAX_PROOF_SECONDS, chainStrength, sha256, videoDuration, type PackageId } from "@/lib/proof";

type Proof = { name: string; hash: string };

export function AIProtectionHub({ userId, paid }: { userId: string; paid: boolean }) {
  const [f, setF] = useState({ title: "", artist: "", writers: "", composers: "", producers: "", isrc: "", upc: "", iswc: "" });
  const [pkg, setPkg] = useState<PackageId>("Single");
  const [attest, setAttest] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [daw, setDaw] = useState<Proof>();
  const [notes, setNotes] = useState<Proof>();
  const [firstDraft, setFirstDraft] = useState("");
  const [lastDraft, setLastDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  async function proof(file: File | undefined, done: (p: Proof) => void) {
    if (!file) return;
    try {
      const d = await videoDuration(file);
      if (d > MAX_PROOF_SECONDS) { toast.error(`Recordings must be ${MAX_PROOF_SECONDS} seconds or shorter (this one is ${Math.round(d)}s).`); return; }
      done({ name: file.name, hash: await sha256(await file.arrayBuffer()) });
    } catch { toast.error("That video could not be read."); }
  }

  function save() {
    if (!f.title || !f.artist || !f.writers || !f.composers || !f.producers) { toast.error("Track title, artist and legal names for writers, composers and producers are required."); return; }
    if (!attest) { toast.error("Check the legal attestation to continue."); return; }
    if (paid) { setUnlocked(true); return; }
    toast.info(`Checkout for the ${pkg} package ($${PACKAGES.find((p) => p.id === pkg)!.price}) is being connected. You'll be able to pay here soon.`);
  }

  async function generate() {
    if (!daw || !notes || !firstDraft || !lastDraft) { toast.error("Add both recordings and the first and latest draft dates."); return; }
    setBusy(true);
    try {
      const strength = chainStrength(new Date(firstDraft), new Date(lastDraft));
      const { data, error } = await supabase.from("ai_protection_certificates").insert({
        user_id: userId, format_type: pkg, track_title: f.title, artist_name: f.artist,
        legal_credits: { writers: f.writers, composers: f.composers, producers: f.producers },
        isrc: f.isrc || null, upc: f.upc || null, iswc: f.iswc || null,
        session_hash: daw.hash, notes_hash: notes.hash, chain_strength: strength, attested: true,
        session_video_url: daw.name, notes_proof_url: notes.name,
      } as never).select("id, issued_at").single();
      if (error) throw error;
      const row = data as { id: string; issued_at: string };
      const [{ jsPDF }, QR] = await Promise.all([import("jspdf"), import("qrcode")]);
      const qr = await QR.toDataURL(`CTA-CERT:${row.id}:${daw.hash}`);
      const pdf = new jsPDF();
      pdf.setFontSize(20); pdf.text("Came Through Audio — Proof Certificate", 15, 22);
      pdf.setFontSize(11);
      [`Certificate ID: ${row.id}`, `Issued: ${new Date(row.issued_at).toUTCString()}`, `Track: ${f.title}`, `Artist: ${f.artist}`,
        `Writers: ${f.writers}`, `Composers: ${f.composers}`, `Producers: ${f.producers}`,
        `ISRC: ${f.isrc || "—"}   UPC: ${f.upc || "—"}   ISWC: ${f.iswc || "—"}`, `Chain: ${strength}`,
        `DAW session SHA-256: ${daw.hash}`, `Draft history SHA-256: ${notes.hash}`].forEach((l, i) => pdf.text(pdf.splitTextToSize(l, 180), 15, 36 + i * 9));
      pdf.addImage(qr, "PNG", 150, 140, 45, 45);
      pdf.save(`${f.title}-proof-certificate.pdf`);
      toast.success("Proof certificate generated.");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not generate certificate."); }
    finally { setBusy(false); }
  }

  return (
    <section className="mx-auto mt-8 max-w-5xl space-y-8 pb-12">
      <div className="flex items-center gap-3"><ShieldCheck className="h-8 w-8 text-primary" /><h1 className="text-2xl font-bold">AI Protection Hub</h1></div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {PACKAGES.map((p) => (
          <button key={p.id} type="button" onClick={() => setPkg(p.id)} className={`rounded-xl border-2 bg-card p-4 text-left ${pkg === p.id ? "border-primary" : "border-border"}`}>
            <div className="font-semibold">{p.label}</div>
            <div className="mt-1 text-2xl font-bold text-primary">${p.price}</div>
            {p.save && <div className="text-xs font-semibold text-primary">{p.save}</div>}
          </button>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-[1fr_260px]">
        <div className="grid gap-4 sm:grid-cols-2">
          <F label="Track title *" v={f.title} on={set("title")} /><F label="Artist name *" v={f.artist} on={set("artist")} />
          <F label="Writers' legal names *" v={f.writers} on={set("writers")} /><F label="Composers' legal names *" v={f.composers} on={set("composers")} />
          <F label="Producers' legal names *" v={f.producers} on={set("producers")} /><F label="ISRC (optional)" v={f.isrc} on={set("isrc")} />
          <F label="UPC (optional)" v={f.upc} on={set("upc")} /><F label="ISWC (optional)" v={f.iswc} on={set("iswc")} />
        </div>
        <div className="h-fit rounded-xl border border-primary bg-card p-4 text-sm"><Info className="mb-2 h-5 w-5 text-primary" />Use real legal names only — not stage names or pseudonyms. Certificates are legal records.</div>
      </div>

      <label className="flex items-start gap-3 rounded-xl border border-border p-4 text-sm">
        <input type="checkbox" className="mt-1 h-4 w-4 accent-[var(--primary)]" checked={attest} onChange={(e) => setAttest(e.target.checked)} />
        <span>I attest under penalty of law that the information and recordings I provide are true and that I (and the listed contributors) created this work. I understand fraudulent misrepresentation may expose me to statutory damages under 17 U.S.C. §504.</span>
      </label>
      <Button size="lg" onClick={save}>{paid ? "Save & continue" : `Save & check out ($${PACKAGES.find((p) => p.id === pkg)!.price})`}</Button>

      <div className={`grid gap-4 md:grid-cols-2 ${unlocked ? "" : "pointer-events-none opacity-50"}`} aria-disabled={!unlocked}>
        <ProofBox title="Form 1 · DAW Session Proof" proof={daw} on={(file) => proof(file, setDaw)} />
        <ProofBox title="Form 2 · Draft History Proof" proof={notes} on={(file) => proof(file, setNotes)}>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1"><Label>First draft</Label><Input type="datetime-local" value={firstDraft} onChange={(e) => setFirstDraft(e.target.value)} /></div>
            <div className="space-y-1"><Label>Latest draft</Label><Input type="datetime-local" value={lastDraft} onChange={(e) => setLastDraft(e.target.value)} /></div>
          </div>
          {firstDraft && lastDraft && <p className="text-sm font-semibold text-primary">{chainStrength(new Date(firstDraft), new Date(lastDraft))}</p>}
        </ProofBox>
      </div>
      {!unlocked && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Lock className="h-4 w-4" />Proof uploads unlock after checkout.</p>}
      {unlocked && <Button size="lg" disabled={busy} onClick={generate}>{busy ? "Generating…" : "Run test & download PDF certificate"}</Button>}

      {!paid && <div className="rounded-xl border-2 border-primary bg-card p-5 font-semibold text-primary">Upgrade to Catalog Plus to permanently embed and submit metadata to your catalog.</div>}
    </section>
  );
}

function F({ label, v, on }: { label: string; v: string; on: (e: React.ChangeEvent<HTMLInputElement>) => void }) {
  return <div className="space-y-1"><Label>{label}</Label><Input value={v} onChange={on} /></div>;
}

function ProofBox({ title, proof, on, children }: { title: string; proof?: Proof | undefined; on: (f?: File) => void; children?: React.ReactNode }) {
  return (
    <div className="space-y-3 rounded-xl border border-border p-4">
      <div className="flex items-center gap-2 font-semibold"><Video className="h-5 w-5 text-primary" />{title}</div>
      <p className="text-xs text-muted-foreground">Screen recording, {MAX_PROOF_SECONDS} seconds max.</p>
      <Input type="file" accept="video/*" onChange={(e) => on(e.target.files?.[0])} />
      {proof && <p className="break-all text-xs">SHA-256: {proof.hash}</p>}
      {children}
    </div>
  );
}
