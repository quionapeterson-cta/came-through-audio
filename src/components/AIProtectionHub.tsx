import { useEffect, useMemo, useRef, useState } from "react";
import { listTracks, type CatalogTrack } from "@/lib/catalog";
import { Check, ChevronDown, Download, Loader2, Lock, Music2, Plus, Trash2, ShieldCheck, Video, Fingerprint, Link2, Gavel, AlertTriangle } from "lucide-react";

const EXPLAINERS = [
  { icon: Fingerprint, title: "DAW & Draft Hashing (SHA-256)", tag: "Your song's tamper-proof digital fingerprint",
    plain: "When you upload a short screen recording of your DAW session (Logic, FL Studio, Ableton, Pro Tools) or lyric drafts, we create a unique 64-character fingerprint of that file.",
    why: "Change even one detail and the fingerprint changes completely — showing your session and arrangement existed, exactly as recorded, by that date." },
  { icon: Link2, title: "Bitcoin Blockchain Anchored", tag: "Permanent, public proof of when",
    plain: "Your song's fingerprint is recorded on the public Bitcoin blockchain through OpenTimestamps. Your actual music is never uploaded there.",
    why: "No company, platform or label can alter, backdate or delete it. Anyone — a lawyer, distributor or judge — can verify the date at opentimestamps.org." },
  { icon: Gavel, title: "17 U.S.C. §504 Attestation", tag: "Your sworn human-creation record",
    plain: "A formal statement, made under penalty of law, that you and your listed contributors created this work as humans.",
    why: "U.S. copyright law allows statutory damages of up to $150,000 per work for willful infringement of registered works. A sworn, time-stamped record supports takedowns, PRO disputes and AI claims." },
];
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { NoteGuide, RecordGuide } from "@/components/ProofGuides";
import { PACKAGES, MIN_PROOF_SECONDS, MAX_PROOF_SECONDS, MAX_PROOF_BYTES, sha256, videoDuration, proofFileError, proofVideoType, PROOF_VIDEO_TYPES, packageFor, packagePrice, certificateCredits, paidTrackIds, DEVICE_ONLY, type PackageId } from "@/lib/proof";
import { useServerFn } from "@tanstack/react-start";
import { openCheckout, getPaymentsEnvironment } from "@/lib/checkout";
import { stampDigest } from "@/lib/ots.functions";
import { compressTo720p } from "@/lib/draft-chain";
import { proofManifest } from "@/lib/ots";
import { saveBitcoinProof, saveCertificatePdf, type Certificate } from "@/lib/certificate";
import { registrationWriters } from "@/lib/readiness";
import { requestBadgeCheck } from "@/lib/badge-events";
import type { Purchase } from "@/hooks/useBilling";

type WriterRole = "author" | "composer" | "both" | "producer";
type WriterRow = { name: string; role: WriterRole };
/** A fingerprinted proof video. The backup copy uploads in the background; the fingerprint never waits for it. */
type Proof = { name: string; hash: string; path?: string; size: number; created: number; backup: "saving" | "saved" | "device"; progress?: number | undefined };
type Kind = "daw" | "drafts";
/** What a proof box is doing right now, shown inline under its file picker. */
type Status = { busy?: string; progress?: number; error?: string };

const MANUAL = "manual";
const blankWriters = (): WriterRow[] => [{ name: "", role: "both" }];

export function AIProtectionHub({ userId, purchases, justPaid, track }: { userId: string; purchases: Purchase[]; justPaid: boolean; track?: CatalogTrack | undefined }) {
  const stamp = useServerFn(stampDigest);
  const [tracks, setTracks] = useState<CatalogTrack[]>([]);
  const [certs, setCerts] = useState<Certificate[]>();
  const [unlocked, setUnlocked] = useState(false);

  async function loadCerts() {
    const { data } = await supabase.from("ai_protection_certificates").select("*").eq("user_id", userId).order("issued_at", { ascending: false });
    setCerts((data ?? []) as Certificate[]);
  }
  useEffect(() => { listTracks().then(setTracks).catch(() => setTracks([])); void loadCerts(); }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Credits: one certificate per song in each package; the database enforces the same count.
  const credits = certificateCredits(purchases);
  const left = certs ? Math.max(0, credits - certs.length) : 0;
  const active = left > 0 || unlocked;
  const protectedIds = new Set((certs ?? []).map((c) => c.catalog_id).filter(Boolean));
  // Paid-for catalog songs that don't have a certificate yet (songs deleted from the catalog drop out).
  const waiting = useMemo(() => paidTrackIds(purchases).filter((id) => !protectedIds.has(id) && tracks.some((t) => t.id === id)), [purchases, certs, tracks]); // eslint-disable-line react-hooks/exhaustive-deps
  const trackById = (id: string) => tracks.find((t) => t.id === id);
  // Songs picked at checkout vs. extra room left in an EP/Album package (any song can use it).
  const paidSongs = paidTrackIds(purchases).length;
  const openSlots = Math.max(0, left - waiting.length);
  const creditLine = [
    paidSongs > 0 && `${paidSongs} song${paidSongs === 1 ? "" : "s"} paid`,
    waiting.length > 0 && `${waiting.length} waiting for proof`,
    openSlots > 0 && `${openSlots} open slot${openSlots === 1 ? "" : "s"} for any song`,
  ].filter(Boolean).join(" · ") || "All paid certificates used";

  // ---- Buying -------------------------------------------------------------------------------------------------
  const [picked, setPicked] = useState<string[]>(track ? [track.id] : []);
  const [pkg, setPkg] = useState<PackageId>("Single");
  // Open/closed is the user's choice once they toggle it; until then it starts open only before the first purchase.
  const [buyOpen, setBuyOpen] = useState<boolean>();
  const [certsOpen, setCertsOpen] = useState(true);
  useEffect(() => { if (track) { setPicked((p) => (p.includes(track.id) ? p : [...p, track.id])); setTarget(track.id); } }, [track]);
  const togglePick = (id: string) => {
    const next = picked.includes(id) ? picked.filter((x) => x !== id) : [...picked, id];
    if (next.length > PACKAGES[PACKAGES.length - 1]!.songs) return;
    setPicked(next); setPkg(packageFor(Math.max(1, next.length)));
  };
  const price = packagePrice(pkg, picked.length);
  const needsSong = tracks.length > 0 && picked.length === 0;
  async function checkout() {
    try { await openCheckout({ kind: "ai", package: pkg, trackIds: picked }); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Checkout could not open."); }
  }

  // ---- After paying: confirm, then lead straight into the steps ---------------------------------------------------
  const [timedOut, setTimedOut] = useState(false);
  const [welcomed, setWelcomed] = useState(false);
  const steps = useRef<HTMLDivElement>(null);
  const confirming = justPaid && !!certs && left === 0 && !timedOut;
  useEffect(() => { if (!justPaid) return; const t = setTimeout(() => setTimedOut(true), 90_000); return () => clearTimeout(t); }, [justPaid]);
  useEffect(() => {
    if (!justPaid || welcomed || left === 0) return;
    setWelcomed(true);
    setTimeout(() => steps.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 150);
  }, [justPaid, left, welcomed]);

  // ---- The song being protected -----------------------------------------------------------------------------------
  const [target, setTarget] = useState<string>(track?.id ?? MANUAL);
  // Once songs and purchases load, start on the first paid song that has no certificate yet.
  useEffect(() => { if (target === MANUAL && waiting[0]) setTarget(waiting[0]); }, [waiting]); // eslint-disable-line react-hooks/exhaustive-deps
  const targetTrack = target === MANUAL ? undefined : trackById(target);
  const [f, setF] = useState({ title: "", artist: "", isrc: "", upc: "", iswc: "" });
  const [writerRows, setWriterRows] = useState<WriterRow[]>(blankWriters());
  useEffect(() => {
    resetProof();
    if (!targetTrack) { setF({ title: "", artist: "", isrc: "", upc: "", iswc: "" }); setWriterRows(blankWriters()); return; }
    const m = targetTrack.metadata;
    setF({ title: targetTrack.title, artist: targetTrack.artist, isrc: m.isrc ?? "", upc: m.upc ?? "", iswc: m.iswc ?? "" });
    const rows: WriterRow[] = [];
    const add = (list: { name: string }[] | undefined, role: WriterRole) => (list ?? []).forEach((c) => {
      const name = c.name.trim(); if (!name) return;
      const hit = rows.find((r) => r.name.toLowerCase() === name.toLowerCase());
      if (hit && ((hit.role === "author" && role === "composer") || (hit.role === "composer" && role === "author"))) hit.role = "both";
      else if (!hit || hit.role !== role) rows.push({ name, role });
    });
    // Certificates are legal records: legal names, with Author/Composer counted as both.
    for (const w of registrationWriters(m)) add([w], w.role === "Author" ? "author" : w.role === "Composer" ? "composer" : "both");
    add(m.producers, "producer");
    setWriterRows(rows.length ? rows : blankWriters());
  }, [targetTrack?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const named = writerRows.filter((w) => w.name.trim());
  const pick = (roles: WriterRole[]) => named.filter((w) => roles.includes(w.role)).map((w) => w.name.trim()).join(", ");
  const writers = pick(["author", "both"]);
  const composers = pick(["composer", "both"]);
  const producers = pick(["producer"]);
  const editRow = (i: number, patch: Partial<WriterRow>) => setWriterRows(writerRows.map((w, j) => (j === i ? { ...w, ...patch } : w)));
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  const detailsMissing = [!f.title.trim() && "Track title", !f.artist.trim() && "Artist name", !named.some((w) => w.role !== "producer") && "At least one writer's legal name"].filter(Boolean) as string[];

  // ---- Proof videos -----------------------------------------------------------------------------------------------
  const [daw, setDaw] = useState<Proof>();
  const [notes, setNotes] = useState<Proof>();
  const [draftNotes, setDraftNotes] = useState("");
  /** Optional: the draft dates the artist can see in their video, as a plain note. Stamped with the manifest; never required. */
  const [draftDates, setDraftDates] = useState("");
  const [status, setStatus] = useState<Record<Kind, Status>>({ daw: {}, drafts: {} });
  const [attest, setAttest] = useState(false);
  const [busy, setBusy] = useState(false);
  const [issued, setIssued] = useState<Certificate>();
  const [videosFor, setVideosFor] = useState<string>();
  function resetProof() {
    setDaw(undefined); setNotes(undefined); setDraftNotes(""); setDraftDates("");
    setStatus({ daw: {}, drafts: {} }); setAttest(false); backups.current = {};
  }

  const setKind = (kind: Kind, s: Status) => setStatus((all) => ({ ...all, [kind]: s }));
  // The fingerprint uses the original video on the device, so file size never blocks a
  // certificate. Only the private backup copy has a storage limit; it uploads in the background.
  async function proof(file: File | undefined, kind: Kind, done: (p: Proof, file: File) => void) {
    if (!file) return;
    const fail = (error: string) => setKind(kind, { error });
    const bad = proofFileError(file);
    if (bad) return fail(bad);
    let d: number;
    try { d = await videoDuration(file); } catch { return fail("That video could not be read on this device. Try an MP4 or MOV file."); }
    if (d < MIN_PROOF_SECONDS || d > MAX_PROOF_SECONDS) return fail(`This video is ${Math.round(d)} seconds. Proof videos can be ${MIN_PROOF_SECONDS}–${MAX_PROOF_SECONDS} seconds long.`);
    setKind(kind, { busy: `Fingerprinting your video (${(file.size / 1048576).toFixed(1)}MB)…` });
    const hash = await sha256(await file.arrayBuffer());
    setKind(kind, {});
    done({ name: file.name, hash, size: file.size, created: file.lastModified || Date.now(), backup: "saving" }, file);
    backups.current[kind] = saveBackup(file, kind, hash, d);
  }

  const backups = useRef<Partial<Record<Kind, Promise<string>>>>({});
  const patchProof = (kind: Kind, hash: string, patch: Partial<Proof>) =>
    (kind === "daw" ? setDaw : setNotes)((p) => (p?.hash === hash ? { ...p, ...patch } : p));
  /** Stores a private backup copy (shrunk to 720p when over 50MB). Resolves to its path, or DEVICE_ONLY if it can't. */
  async function saveBackup(file: File, kind: Kind, hash: string, seconds: number): Promise<string> {
    try {
      let copy = file;
      if (file.size > MAX_PROOF_BYTES) {
        // The shrink plays the video once in real time; give up (keeping the original on the device) if it stalls.
        const limit = new Promise<never>((_, bad) => setTimeout(() => bad(new Error("timeout")), (seconds * 3 + 30) * 1000));
        copy = await Promise.race([compressTo720p(file, (p) => patchProof(kind, hash, { progress: Math.round(p * 100) })), limit]);
        if (copy.size > MAX_PROOF_BYTES) throw new Error("too big");
      }
      const ext = copy.name.split(".").pop()?.toLowerCase() || "mp4";
      // "_720p" marks a shrunk copy, whose fingerprint differs from the original's (shown when downloading it back).
      const path = `${userId}/${Date.now()}_${kind}${copy === file ? "" : "_720p"}.${ext}`;
      const { error } = await supabase.storage.from("proof-videos").upload(path, copy, { contentType: proofVideoType(copy) ?? copy.type });
      if (error) throw error;
      patchProof(kind, hash, { backup: "saved", path, progress: undefined });
      return path;
    } catch {
      patchProof(kind, hash, { backup: "device", progress: undefined });
      return DEVICE_ONLY;
    }
  }

  const proofMissing = [
    !daw && (status.daw.error ? `DAW Session video: ${status.daw.error}` : "Add your DAW Session video (step 2)"),
    !notes && (status.drafts.error ? `Draft History video: ${status.drafts.error}` : "Add your Draft History video (step 2)"),
    !attest && "Check the attestation (step 3)",
  ].filter(Boolean) as string[];

  async function generate() {
    if (detailsMissing.length || !daw || !notes || !attest) return;
    setBusy(true);
    try {
      // Usually finished long before this; waits only if a backup copy is still uploading.
      const [dawPath, notesPath] = await Promise.all([backups.current.daw ?? daw.path ?? DEVICE_ONLY, backups.current.drafts ?? notes.path ?? DEVICE_ONLY]);
      const manifest = proofManifest({
        Track: f.title, Artist: f.artist, Writers: writers, Composers: composers, Producers: producers || "-",
        ISRC: f.isrc || "-", UPC: f.upc || "-", ISWC: f.iswc || "-",
        "DAW session SHA-256": daw.hash, "Draft history SHA-256": notes.hash, "Draft dates shown in video (entered by the artist)": draftDates.trim() || "-", "Draft notes": draftNotes || "-",
      });
      const manifestBytes = new TextEncoder().encode(manifest);
      const digest = await sha256(manifestBytes.buffer as ArrayBuffer);
      let ots: { calendar: string; receipt: string } | null = null;
      try { ots = await stamp({ data: { digest } }); } catch { toast.warning("Blockchain timestamp unavailable right now — certificate issued without it."); }
      const { data, error } = await supabase.from("ai_protection_certificates").insert({
        user_id: userId, catalog_id: targetTrack?.id ?? null, format_type: (purchases.find((p) => p.kind === "ai")?.details["package"] ?? "Single") as PackageId, track_title: f.title, artist_name: f.artist,
        legal_credits: { writers, composers, producers },
        isrc: f.isrc || null, upc: f.upc || null, iswc: f.iswc || null,
        session_hash: daw.hash, notes_hash: notes.hash, attested: true,
        session_video_url: dawPath, notes_proof_url: notesPath, manifest,
        proof_digest: digest, ots_receipt: ots?.receipt ?? null, ots_calendar: ots?.calendar ?? null,
        blockchain_status: ots ? "pending_bitcoin" : "none",
      }).select("*").single();
      if (error) throw error;
      const cert = data as Certificate;
      requestBadgeCheck();
      await saveCertificatePdf(cert);
      saveBitcoinProof(cert);
      setIssued(cert);
      toast.success(ots ? "Certificate issued and submitted to the Bitcoin blockchain." : "Certificate issued.");
      await loadCerts();
      const next = waiting.find((id) => id !== target);
      setTarget(next ?? MANUAL);
      if (target === MANUAL) { resetProof(); setF({ title: "", artist: "", isrc: "", upc: "", iswc: "" }); setWriterRows(blankWriters()); }
      setCertsOpen(true);
      document.getElementById("my-certificates")?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not generate certificate."); }
    finally { setBusy(false); }
  }

  // Songs offered in step 1: paid-for songs first, then the rest of the catalog.
  const stepSongs = [...waiting.map(trackById).filter((t): t is CatalogTrack => !!t), ...tracks.filter((t) => !waiting.includes(t.id) && !protectedIds.has(t.id))];
  const buyShown = buyOpen ?? !active;

  return (
    <section className="mx-auto mt-8 max-w-4xl space-y-6 pb-12">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3"><ShieldCheck className="h-8 w-8 text-primary" /><h1 className="text-2xl font-bold">AI Protection Hub</h1></div>
          <p className="max-w-2xl text-sm text-muted-foreground">Lock in timestamped, independently verifiable proof of your creative process. Each Certificate of Human Origin is fingerprinted, sworn and anchored on the Bitcoin blockchain before your master reaches DSPs or social media.</p>
        </div>
        {getPaymentsEnvironment() === "sandbox" && left === 0 && (
          <Button variant="outline" size="sm" onClick={() => setUnlocked((v) => !v)}>{unlocked ? "Exit test preview" : "Preview steps (Test Mode)"}</Button>
        )}
      </header>

      {/* 1 · My certificates */}
      <Card id="my-certificates" title="My certificates" open={certsOpen} onToggle={() => setCertsOpen(!certsOpen)} aside={credits > 0 && <span className="rounded-full border border-primary px-3 py-1 text-xs font-semibold text-primary">{creditLine}</span>}>
        {!certs ? <p className="text-sm text-muted-foreground">Loading…</p>
          : certs.length === 0 && waiting.length === 0 ? (
            <p className="text-sm text-muted-foreground">Your certificates will live here. Pick a song below, record your proof, and download your certificate any time.</p>
          ) : (
            <ul className="divide-y divide-border">
              {certs.map((c) => (
                <li key={c.id} className={`grid items-center gap-3 py-3 sm:grid-cols-[1fr_auto_auto] ${issued?.id === c.id ? "rounded-lg bg-primary/5 px-3" : ""}`}>
                  <SongCell title={c.track_title} artist={c.artist_name} />
                  <span className="text-xs font-semibold text-primary">Issued · {c.ots_receipt ? "Anchored on Bitcoin" : "No Bitcoin stamp"} · {c.issued_at ? new Date(c.issued_at).toLocaleDateString() : ""}</span>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => void saveCertificatePdf(c)}><Download className="h-4 w-4" />PDF</Button>
                    {c.ots_receipt && <Button size="sm" variant="outline" title={c.manifest ? "Manifest .txt + .ots receipt" : "Use with the manifest .txt you downloaded when the certificate was issued"} onClick={() => saveBitcoinProof(c)}><Download className="h-4 w-4" />Bitcoin proof</Button>}
                    <Button size="sm" variant="outline" aria-expanded={videosFor === c.id} onClick={() => setVideosFor(videosFor === c.id ? undefined : c.id)}><Video className="h-4 w-4" />Proof videos</Button>
                  </div>
                  {videosFor === c.id && <ProofVideos cert={c} />}
                </li>
              ))}
              {waiting.map((id) => (
                <li key={id} className="grid items-center gap-3 py-3 sm:grid-cols-[1fr_auto_auto]">
                  <SongCell title={trackById(id)!.title} artist={trackById(id)!.artist} />
                  <span className="text-xs font-semibold text-muted-foreground">Paid · proof not recorded yet</span>
                  <Button size="sm" onClick={() => { setTarget(id); steps.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }}>Start proof</Button>
                </li>
              ))}
            </ul>
          )}
      </Card>

      {confirming && (
        <div className="flex items-center gap-3 rounded-2xl border-2 border-primary bg-card p-5 text-sm font-semibold"><Loader2 className="h-5 w-5 animate-spin text-primary" />Payment received. Confirming it with Stripe, which usually takes a few seconds…</div>
      )}
      {justPaid && timedOut && left === 0 && (
        <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-5 text-sm"><AlertTriangle className="h-5 w-5 text-primary" />We haven't received your payment confirmation yet. Refresh in a minute; if it still doesn't show, contact billing@camethroughaudio.com.</div>
      )}

      {/* 2 · Buy */}
      {!confirming && (
        <div className="rounded-2xl border border-border bg-card">
          <button type="button" aria-expanded={buyShown} onClick={() => setBuyOpen(!buyShown)} className="flex w-full items-start justify-between gap-3 rounded-2xl p-5 text-left hover:bg-primary/5 sm:px-6">
            <span className="space-y-1">
              <span className="flex items-center gap-2 text-lg font-bold">{active && <Plus className="h-4 w-4 text-primary" />}{active ? "Protect more songs" : "Protect a song"}</span>
              {buyShown && <span className="block text-sm text-muted-foreground">{tracks.length ? "Choose the songs from My Catalog. Their details fill in for you after checkout." : "No songs in My Catalog yet: choose a package and type each song's details after checkout."}</span>}
            </span>
            <ChevronDown className={`mt-1 h-5 w-5 shrink-0 transition ${buyShown ? "rotate-180" : ""}`} />
          </button>
          {buyShown && <div className="space-y-5 border-t border-border p-5 sm:p-6">
          {tracks.length > 0 && (
            <div className="grid max-h-72 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
              {tracks.map((t) => {
                const done = protectedIds.has(t.id), paid = waiting.includes(t.id), on = picked.includes(t.id);
                return (
                  <button key={t.id} type="button" disabled={done || paid} onClick={() => togglePick(t.id)}
                    className={`flex items-center gap-3 rounded-xl border p-3 text-left transition disabled:cursor-default disabled:opacity-60 ${on ? "border-primary bg-primary/5" : "border-border hover:border-primary/60"}`}>
                    <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${on ? "border-primary bg-primary text-primary-foreground" : "border-input"}`}>{on && <Check className="h-3.5 w-3.5" />}</span>
                    <SongCell title={t.title} artist={t.artist} />
                    {(done || paid) && <span className="ml-auto text-xs font-semibold text-primary">{done ? "Protected" : "Paid"}</span>}
                  </button>
                );
              })}
            </div>
          )}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {PACKAGES.map((p) => {
              const tooSmall = p.songs < picked.length;
              return (
                <button key={p.id} type="button" disabled={tooSmall} onClick={() => setPkg(p.id)}
                  className={`rounded-xl border-2 p-3 text-left transition disabled:opacity-40 ${pkg === p.id ? "border-primary" : "border-border hover:border-primary/50"}`}>
                  <div className="text-sm font-semibold">{p.label.split(" · ")[0]}</div>
                  <div className="text-xs text-muted-foreground">{p.id === "Single" ? `$${p.price} per song, 1–${p.songs} songs` : `up to ${p.songs} songs`}</div>
                  <div className="mt-1 text-lg font-bold text-primary">${p.id === "Single" ? packagePrice("Single", picked.length) : p.price}</div>
                </button>
              );
            })}
          </div>
          <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">{picked.length ? `${picked.length} song${picked.length === 1 ? "" : "s"} selected` : needsSong ? "Select at least one song" : "Add song details after checkout"} · {pkg === "Single" ? `${Math.max(1, picked.length)} × Single` : PACKAGES.find((p) => p.id === pkg)!.label.split(" · ")[0]}{pkg === "Single" && picked.length === 3 ? " · a 4th song switches to the EP ($9.99 for up to 6)" : ""}</p>
            <Button size="lg" className="font-bold" disabled={needsSong} onClick={checkout}><Lock className="h-4 w-4" />Lock In Protection · ${price}</Button>
          </div>
          <details className="group rounded-xl border border-border">
            <summary className="flex cursor-pointer list-none items-center justify-between p-4 text-sm font-semibold">How it works<ChevronDown className="h-4 w-4 transition group-open:rotate-180" /></summary>
            <div className="grid gap-4 border-t border-border p-4 md:grid-cols-3">
              {EXPLAINERS.map((x) => (
                <div key={x.title} className="space-y-2 text-sm">
                  <x.icon className="h-6 w-6 text-primary" />
                  <div className="font-bold">{x.title}</div>
                  <div className="text-xs font-semibold text-primary">{x.tag}</div>
                  <p><span className="font-semibold">In plain English: </span>{x.plain}</p>
                  <p className="text-muted-foreground"><span className="font-semibold text-foreground">Why you need it: </span>{x.why}</p>
                </div>
              ))}
            </div>
          </details>
          </div>}
        </div>
      )}

      {/* 3 · Create the certificate */}
      {active && (
        <div ref={steps} className="scroll-mt-24">
          <Card title="Create your certificate" subtitle={justPaid && welcomed ? "Payment received. Follow the five steps below; each song takes a few minutes." : "Five steps, a few minutes per song."}>
            <ol className="space-y-8">
              <Step n={1} title="Song details" done={!detailsMissing.length}>
                <div className="space-y-1">
                  <Label>Which song are you protecting?</Label>
                  <select value={target} onChange={(e) => setTarget(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                    {stepSongs.map((t) => <option key={t.id} value={t.id}>{t.title}{waiting.includes(t.id) ? " (paid)" : ""}</option>)}
                    <option value={MANUAL}>A song that isn't in My Catalog</option>
                  </select>
                </div>
                <div className="grid gap-4 sm:grid-cols-2"><F label="Track title" v={f.title} on={set("title")} /><F label="Artist name" v={f.artist} on={set("artist")} /></div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between"><Label>Writers</Label><span className="text-xs text-muted-foreground">Legal names only. Certificates are legal records.</span></div>
                  {writerRows.map((w, i) => (
                    <div key={i} className="grid gap-2 sm:grid-cols-[1fr_11rem_auto]">
                      <Input aria-label={`Writer ${i + 1} legal name`} placeholder="Legal name" value={w.name} onChange={(e) => editRow(i, { name: e.target.value })} />
                      <select aria-label={`Writer ${i + 1} role`} value={w.role} onChange={(e) => editRow(i, { role: e.target.value as WriterRole })} className="rounded-md border border-input bg-background px-3 py-2 text-sm">
                        <option value="author">Author</option>
                        <option value="composer">Composer</option>
                        <option value="both">Author/Composer</option>
                        <option value="producer">Producer</option>
                      </select>
                      <Button type="button" variant="ghost" size="icon" aria-label="Remove writer" disabled={writerRows.length === 1} onClick={() => setWriterRows(writerRows.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  ))}
                  <Button type="button" variant="outline" size="sm" onClick={() => setWriterRows([...writerRows, { name: "", role: "both" }])}><Plus className="h-4 w-4" />Add writer</Button>
                </div>
                <div className="grid gap-4 sm:grid-cols-3"><F label="ISRC (optional)" v={f.isrc} on={set("isrc")} /><F label="UPC (optional)" v={f.upc} on={set("upc")} /><F label="ISWC (optional)" v={f.iswc} on={set("iswc")} /></div>
              </Step>

              <Step n={2} title="Record your proof" done={!!daw && !!notes}>
                <div className="flex gap-3 rounded-xl border-l-4 border-primary bg-primary/5 p-4 text-sm">
                  <Music2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                  <p><b>Start with your melody.</b> Copyright protects melody and lyrics, not drum patterns or chord progressions, so your melody is the most important thing to prove. Solo your lead vocal or melody line first, then solo as many other tracks as you can, then play the full mix.</p>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <ProofBox title="DAW Session" proof={daw} status={status.daw} on={(file) => proof(file, "daw", (p) => setDaw(p))}
                    tip="Screen-record your open project (FL Studio, Logic, Ableton, Pro Tools, BandLab…). Melody first, then each track solo, then the full mix. This shows you have the real working session, not just the final song.">
                  </ProofBox>
                  <ProofBox title="Draft History" proof={notes} status={status.drafts} on={(file) => proof(file, "drafts", (p) => setNotes(p))}
                    tip="Screen-record your earlier versions: voice memos, rough takes, lyric notes, or a folder showing file dates. Early melody ideas (hummed voice memos, rough toplines) are your strongest drafts, and showing their dates makes your evidence stronger.">
                    <div className="space-y-1"><Label htmlFor="draft-dates">Draft dates shown in your video (optional)</Label><Input id="draft-dates" value={draftDates} onChange={(e) => setDraftDates(e.target.value)} placeholder="e.g. Voice memo March 3, 2026; lyrics note April 20, 2026" />
                      <p className="text-xs text-muted-foreground">A quick index for anyone reviewing your proof later. It's stamped with your certificate. Leave it blank if you like.</p></div>
                    <div className="space-y-1"><Label>Notes (optional)</Label><Input value={draftNotes} onChange={(e) => setDraftNotes(e.target.value)} /></div>
                  </ProofBox>
                </div>
                <details className="group rounded-xl border border-border">
                  <summary className="flex cursor-pointer list-none items-center justify-between p-4 text-sm font-semibold">How to record on your phone, and how to show draft dates<ChevronDown className="h-4 w-4 transition group-open:rotate-180" /></summary>
                  <div className="grid gap-4 border-t border-border p-4 md:grid-cols-2"><RecordGuide /><NoteGuide /></div>
                </details>
              </Step>

              <Step n={3} title="Attest" done={attest}>
                <label className="flex items-start gap-3 rounded-xl border border-border p-4 text-sm">
                  <input type="checkbox" className="mt-1 h-4 w-4 accent-[var(--primary)]" checked={attest} onChange={(e) => setAttest(e.target.checked)} />
                  <span>I attest under penalty of law that the information and recordings I provide are true and that I (and the listed contributors) created this work. I understand fraudulent misrepresentation may expose me to statutory damages under 17 U.S.C. §504.</span>
                </label>
              </Step>

              <Step n={4} title="Generate your certificate" done={false} last>
                <div className="flex gap-3 rounded-xl border-l-4 border-primary bg-primary/5 p-4 text-sm">
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                  <div className="space-y-1">
                    <p><b>Keep your original videos, unchanged.</b> Your certificate's fingerprints only match the exact files you upload. Don't edit, trim, re-export or delete them; back them up with your project files and stems.</p>
                    <p className="text-muted-foreground">This certificate is strong supporting evidence of when your work existed. For the strongest protection, also register important songs with the U.S. Copyright Office.</p>
                  </div>
                </div>
                {(detailsMissing.length > 0 || proofMissing.length > 0) && <Checklist items={[...detailsMissing.map((m) => `${m} (step 1)`), ...proofMissing]} />}
                <Button size="lg" disabled={busy || detailsMissing.length > 0 || proofMissing.length > 0} onClick={generate}>{busy ? <><Loader2 className="h-4 w-4 animate-spin" />{daw?.backup === "saving" || notes?.backup === "saving" ? "Finishing your backup copies…" : "Generating…"}</> : "Generate & download certificate"}</Button>
                <p className="text-xs text-muted-foreground">You'll get the PDF certificate and a Bitcoin proof ZIP (manifest .txt, .ots file and how to verify). Keep the ZIP with your original videos. Everything stays downloadable under My certificates.</p>
              </Step>
            </ol>
          </Card>
        </div>
      )}
    </section>
  );
}

/** A section card. With onToggle, the title row opens and closes it. */
function Card({ id, title, subtitle, aside, open = true, onToggle, children }: { id?: string; title: string; subtitle?: string; aside?: React.ReactNode; open?: boolean; onToggle?: () => void; children: React.ReactNode }) {
  const heading = <div className="space-y-1"><h2 className="text-lg font-bold">{title}</h2>{subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}</div>;
  return (
    <div id={id} className="scroll-mt-24 space-y-5 rounded-2xl border border-border bg-card p-5 sm:p-6">
      {onToggle ? (
        <button type="button" aria-expanded={open} onClick={onToggle} className="flex w-full flex-wrap items-center justify-between gap-3 text-left">
          {heading}
          <span className="flex items-center gap-3">{aside}<ChevronDown className={`h-5 w-5 shrink-0 transition ${open ? "rotate-180" : ""}`} /></span>
        </button>
      ) : (
        <div className="flex flex-wrap items-start justify-between gap-3">{heading}{aside}</div>
      )}
      {open && children}
    </div>
  );
}

function Step({ n, title, done, last, children }: { n: number; title: string; done: boolean; last?: boolean; children: React.ReactNode }) {
  return (
    <li className="relative grid grid-cols-[2rem_1fr] gap-4">
      {!last && <span className="absolute bottom-[-2rem] left-4 top-9 w-px -translate-x-1/2 bg-border" aria-hidden />}
      <span className={`flex h-8 w-8 items-center justify-center rounded-full border-2 text-sm font-bold ${done ? "border-primary bg-primary text-primary-foreground" : "border-primary text-primary"}`}>{done ? <Check className="h-4 w-4" /> : n}</span>
      <div className="min-w-0 space-y-4"><h3 className="pt-1 font-bold">{title}</h3>{children}</div>
    </li>
  );
}

function Checklist({ items }: { items: string[] }) {
  return (
    <ul className="space-y-1.5 rounded-xl border border-border p-4 text-sm">
      <li className="font-semibold">To unlock this step:</li>
      {items.map((m) => <li key={m} className="flex gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-primary" />{m}</li>)}
    </ul>
  );
}

function SongCell({ title, artist }: { title: string | null; artist: string | null }) {
  return <div className="min-w-0"><p className="truncate text-sm font-semibold">{title || "Untitled"}</p>{artist && <p className="truncate text-xs text-muted-foreground">{artist}</p>}</div>;
}

function F({ label, v, on }: { label: string; v: string; on: (e: React.ChangeEvent<HTMLInputElement>) => void }) {
  return <div className="space-y-1"><Label>{label}</Label><Input value={v} onChange={on} /></div>;
}

function ProofBox({ title, tip, proof, status, on, children }: { title: string; tip: string; proof?: Proof | undefined; status: Status; on: (f?: File) => void; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border p-4">
      <div className="flex items-center gap-2 font-semibold"><Video className="h-5 w-5 text-primary" />{title}</div>
      <p className="text-sm">{tip}</p>
      <p className="text-xs text-muted-foreground">{MIN_PROOF_SECONDS}–{MAX_PROOF_SECONDS} second video (MP4, MOV or WebM), any size. Stored privately; only its fingerprint is anchored to Bitcoin.</p>
      <Input type="file" accept={[...PROOF_VIDEO_TYPES, ".mov", ".mp4", ".m4v", ".webm"].join(",")} disabled={!!status.busy} onChange={(e) => { on(e.target.files?.[0]); e.target.value = ""; }} />
      {status.busy && (
        <div className="space-y-2 text-xs"><p className="flex items-center gap-2 font-semibold"><Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />{status.busy}</p>{status.progress !== undefined && <Progress value={status.progress} />}</div>
      )}
      {status.error && <p className="flex gap-2 text-xs font-semibold"><AlertTriangle className="h-4 w-4 shrink-0 text-primary" />{status.error}</p>}
      {proof && !status.busy && <div className="space-y-1 rounded-md border border-primary/40 p-2 text-xs"><p className="font-semibold text-primary">Fingerprinted · {proof.name} · {(proof.size / 1048576).toFixed(1)}MB</p><p className="break-all text-muted-foreground">SHA-256: {proof.hash}</p>
        <p className="text-muted-foreground">{proof.backup === "saving" ? `Saving a private backup copy${proof.progress !== undefined ? ` · ${proof.progress}%` : ""}. You can keep going.`
          : proof.backup === "saved" ? "Private backup copy saved." : "Keep this original video: its fingerprint is on your certificate. (We couldn't store a backup copy.)"}</p></div>}
      {children}
    </div>
  );
}

/**
 * Downloads a certificate's private backup videos (signed links, 10 minutes). A "_720p" copy was shrunk to fit the
 * storage limit, so only the artist's original file matches the fingerprint.
 */
function ProofVideos({ cert }: { cert: Certificate }) {
  const [busy, setBusy] = useState<string>();
  const videos = [["DAW session video", cert.session_video_url], ["Draft history video", cert.notes_proof_url]] as const;
  async function get(label: string, path: string) {
    setBusy(path);
    try {
      const name = `${(cert.track_title || "song").replace(/[^\w-]+/g, "_")} - ${label}.${path.split(".").pop()}`;
      const { data, error } = await supabase.storage.from("proof-videos").createSignedUrl(path, 600, { download: name });
      if (error || !data) throw error ?? new Error("missing");
      window.location.assign(data.signedUrl);
    } catch { toast.error("Couldn't get that video. Try again in a moment."); }
    finally { setBusy(undefined); }
  }
  return (
    <div className="space-y-2 rounded-xl bg-muted/50 p-3 text-sm sm:col-span-3">
      {videos.map(([label, path]) => {
        const saved = !!path && path !== DEVICE_ONLY;
        return (
          <div key={label} className="flex flex-wrap items-center justify-between gap-2">
            <span>
              <span className="font-semibold">{label}</span>{" "}
              <span className="text-xs text-muted-foreground">{!saved ? "· No backup saved. Keep your original file." : path.includes("_720p") ? "· 720p copy. Your original file is the one that matches the certificate." : ""}</span>
            </span>
            {saved && <Button size="sm" variant="ghost" disabled={busy === path} onClick={() => void get(label, path)}>{busy === path ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}Download</Button>}
          </div>
        );
      })}
      <p className="text-xs text-muted-foreground">Backups are private to your account. The fingerprints on your certificate match your original files exactly.</p>
    </div>
  );
}
