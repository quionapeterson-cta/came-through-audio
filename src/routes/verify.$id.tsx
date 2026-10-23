import { useState } from "react";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { CheckCircle2, Download, ExternalLink, ShieldCheck, XCircle } from "lucide-react";
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
  component: VerifyPage,
});

function VerifyPage() {
  const c = Route.useLoaderData();
  const [check, setCheck] = useState<"match" | "nomatch">();
  const issued = c.issued_at ? new Date(c.issued_at).toUTCString() : "—";
  const base = (c.track_title || "certificate").replace(/[^\w-]+/g, "_");

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
