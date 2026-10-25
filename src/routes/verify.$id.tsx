import { useState } from "react";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { CheckCircle2, Download, ExternalLink, FolderOpen, Loader2, ShieldCheck, XCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { saveBitcoinProof, saveCertificatePdf, type Certificate } from "@/lib/certificate";
import { BrandLogo } from "@/components/BrandLogo";
import { Button } from "@/components/ui/button";
import { getPublicCertificate } from "@/lib/certificate-verify.functions";
import { buildOtsFile, download } from "@/lib/ots";
import { sha256 } from "@/lib/proof";

/**
 * Public page behind the QR code on every AI Protection certificate. Exempt from the staging gate in __root.tsx.
 * Shows the certificate's summary, checks a manifest .txt in the browser against the stamped fingerprint, and hands
 * out the .ots receipt for opentimestamps.org. The manifest itself stays with the artist.
 */
export const Route = createFileRoute("/verify/$id")({
  loader: async ({ params }) => {
    const cert = await getPublicCertificate({ data: { id: params.id } }).catch(() => null);
    if (!cert) throw notFound();
    return cert;
  },
  head: () => ({ meta: [{ title: "Verify a certificate — Came Through Audio" }, { name: "robots", content: "noindex" }] }),
  // Our own loading screen while the certificate loads, so nothing else flashes first.
  pendingComponent: () => (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background text-foreground">
      <BrandLogo tone="light" /><p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading the certificate…</p>
    </div>
  ),
  component: VerifyPage,
});

function VerifyPage() {
  const c = Route.useLoaderData();
  const [check, setCheck] = useState<"match" | "nomatch">();
  const issued = c.issued_at ? new Date(c.issued_at).toUTCString() : "—";
  const base = (c.track_title || "certificate").replace(/[^\w-]+/g, "_");
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);

  /** The owner's own proof files, on the same phone that opened the QR code (no second device needed). */
  async function downloadProof() {
    if (!user) { toast.error("Log in with the account that owns this certificate to download its proof files."); return; }
    setBusy(true);
    try {
      const { data } = await supabase.from("ai_protection_certificates").select("*").eq("id", c.id).maybeSingle();
      if (!data) { toast.error("Only the account that owns this certificate can download its proof files."); return; }
      await saveCertificatePdf(data as Certificate);
      saveBitcoinProof(data as Certificate);
    } finally { setBusy(false); }
  }

  async function checkFile(file: File | undefined) {
    if (!file) return;
    const digest = await sha256(await file.arrayBuffer());
    setCheck(digest === c.proof_digest ? "match" : "nomatch");
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-5 sm:px-6"><BrandLogo tone="light" /></div>
      </header>
      <main className="mx-auto max-w-3xl space-y-6 px-4 py-12 sm:px-6">
        <div>
          <p className="flex items-center gap-2 text-sm font-bold uppercase tracking-[2px] text-primary"><ShieldCheck className="h-4 w-4" />Certificate of Human Origin</p>
          <h1 className="mt-2 text-3xl font-bold md:text-4xl">{c.track_title || "Untitled"}</h1>
          <p className="mt-1 text-lg text-muted-foreground">{c.artist_name}</p>
        </div>

        {/* Already on the phone that scanned the code? Open it or download the files here. */}
        <div className="flex flex-wrap gap-2">
          <Button asChild><Link to="/workspace" search={{ tab: "protect" }}><FolderOpen className="h-4 w-4" />Open your certificate</Link></Button>
          <Button variant="outline" disabled={busy} onClick={() => void downloadProof()}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}Download proof files</Button>
        </div>
        <p className="-mt-3 text-xs text-muted-foreground">For the artist who owns this certificate: log in to open it or download the PDF and Bitcoin proof. Anyone can check it below.</p>

        <dl className="grid gap-3 rounded-2xl border border-border p-5 text-sm sm:grid-cols-[10rem_1fr]">
          <dt className="font-semibold">Issued</dt><dd>{issued}</dd>
          <dt className="font-semibold">Certificate ID</dt><dd className="break-all">{c.id}</dd>
          <dt className="font-semibold">Fingerprint (SHA-256)</dt><dd className="break-all font-mono text-xs">{c.proof_digest ?? "—"}</dd>
          <dt className="font-semibold">Bitcoin timestamp</dt>
          <dd>{c.ots_receipt ? "Submitted to the Bitcoin blockchain through OpenTimestamps. It's confirmed within a few hours of the issue time." : "This certificate was issued without a Bitcoin timestamp."}</dd>
        </dl>

        <section className="space-y-3 rounded-2xl border border-border p-5">
          <h2 className="text-lg font-bold">Check a proof manifest</h2>
          <p className="text-sm text-muted-foreground">Choose the <b>proof-manifest.txt</b> that came with this certificate. We check it on this device; nothing is uploaded.</p>
          <p className="text-sm text-muted-foreground">Where to find it: <b>AI Protection Hub → My certificates → Bitcoin proof</b>. It's inside that ZIP; unzip it first (on a phone, open the ZIP in Files and tap the .txt).</p>
          <input type="file" accept=".txt,text/plain" aria-label="Proof manifest" onChange={(e) => void checkFile(e.target.files?.[0])} className="text-sm" />
          {check === "match" && <p className="flex items-center gap-2 font-semibold text-primary"><CheckCircle2 className="h-5 w-5" />It matches. This is the exact manifest this certificate stamped.</p>}
          {check === "nomatch" && <p className="flex items-center gap-2 font-semibold text-destructive"><XCircle className="h-5 w-5" />It doesn't match. Use the proof-manifest.txt from this certificate, unchanged (not the PDF).</p>}
        </section>

        {c.ots_receipt && c.proof_digest && (
          <section className="space-y-3 rounded-2xl border border-border p-5">
            <h2 className="text-lg font-bold">Verify on the Bitcoin blockchain</h2>
            <ol className="list-decimal space-y-1 pl-5 text-sm">
              <li>Download the timestamp receipt below (the .ots file).</li>
              <li>Open opentimestamps.org and drop in the .ots file.</li>
              <li>When it asks for the original file, drop in the <b>proof-manifest.txt</b>, not the PDF.</li>
            </ol>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => download(`${base}-proof-manifest.txt.ots`, buildOtsFile(c.proof_digest!, c.ots_receipt!), "application/octet-stream")}><Download className="h-4 w-4" />Timestamp receipt (.ots)</Button>
              <Button asChild variant="outline"><a href="https://opentimestamps.org" target="_blank" rel="noreferrer">opentimestamps.org<ExternalLink className="h-4 w-4" /></a></Button>
            </div>
            <p className="text-xs text-muted-foreground">In the first few hours it shows as pending while Bitcoin confirms. That's normal.</p>
          </section>
        )}

        <p className="text-xs text-muted-foreground">Bitcoin timestamping proves this fingerprint existed at that time and hasn't changed since. It doesn't prove ownership by itself. Issued by <Link to="/" className="underline">Came Through Audio</Link>.</p>
      </main>
    </div>
  );
}
