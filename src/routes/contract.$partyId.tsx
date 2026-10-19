import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AlertTriangle, Check, Download, FileSignature, Loader2, LogOut, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { BrandLogo } from "@/components/BrandLogo";
import { SignupCard } from "@/components/SignupCard";
import { Button } from "@/components/ui/button";
import { CONTRACT_DISCLAIMER } from "@/lib/contract-blueprints";
import { downloadContractPdf } from "@/lib/contract-pdf";
import { getContractInvite, signContract, type ContractInvite } from "@/lib/contracts";
import { clearReturn, rememberReturn } from "@/lib/password";

export const Route = createFileRoute("/contract/$partyId")({
  head: () => ({
    meta: [
      { title: "Review & Sign a Contract — Came Through Audio" },
      { name: "description", content: "Read the full contract and sign it with a free Came Through Audio account." },
      { property: "og:title", content: "You've been asked to sign a contract" },
      { property: "og:description", content: "Log in or create a free account to read the contract and sign in seconds." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ContractSignPage,
});

function ContractSignPage() {
  const { partyId } = Route.useParams();
  const { user, loading } = useAuth();
  const [invite, setInvite] = useState<ContractInvite | null>();
  const [error, setError] = useState("");
  const [typed, setTyped] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = () => {
    setError("");
    getContractInvite(partyId)
      .then((d) => { setInvite(d); clearReturn(); })
      .catch((e) => setError(e instanceof Error ? e.message : "Could not open this contract."));
  };
  useEffect(() => { if (!user) rememberReturn(`/contract/${partyId}`); }, [user, partyId]);
  useEffect(() => { if (user) load(); }, [user?.id, partyId]);

  async function sign() {
    if (!invite) return;
    if (typed.trim().toLowerCase() !== invite.legal_name.trim().toLowerCase()) { toast.error("Type your legal name exactly as listed."); return; }
    setBusy(true);
    try {
      await signContract(partyId, typed);
      toast.success("Signed! Everyone on the contract can now see your signature.");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not sign.");
    } finally { setBusy(false); }
  }

  const pdf = (i: ContractInvite) => downloadContractPdf({ title: i.title, body: i.body, bodyHash: i.body_hash, status: i.status,
    parties: i.parties.map((p) => ({ name: p.name, role: p.role, signedAt: p.signed_at, signatureName: p.signature_name, signatureHash: p.signature_hash })) });

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="bg-ink text-ink-foreground">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <BrandLogo />
          {user && <Button variant="ghost" size="sm" className="text-ink-muted hover:bg-ink-border hover:text-ink-foreground" onClick={() => supabase.auth.signOut()}><LogOut className="h-4 w-4" /> Log out</Button>}
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        {loading ? (
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" />
        ) : !user ? (
          <div className="grid gap-8 md:grid-cols-2 md:items-center">
            <div className="space-y-4">
              <FileSignature className="h-10 w-10 text-primary" />
              <h1 className="text-3xl font-bold">You've been asked to sign a contract</h1>
              <p className="text-muted-foreground">Log in, or create a free account using the same email the request was sent to. Then read the full contract and sign in seconds. Signing is always free.</p>
            </div>
            <SignupCard returnPath={`/contract/${partyId}`} onAuthed={() => {}} inviteMode />
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-destructive p-8 text-center">
            <p className="font-semibold">{error}</p>
            <p className="mt-2 text-sm text-muted-foreground">You're logged in as {user.email}. Log in with the email the request was sent to.</p>
          </div>
        ) : invite === undefined ? (
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" />
        ) : !invite ? (
          <p className="text-center text-muted-foreground">This signature request no longer exists.</p>
        ) : (
          <div className="space-y-8">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-sm font-bold uppercase tracking-widest text-primary">Contract</p>
                <h1 className="mt-1 text-3xl font-bold sm:text-4xl">{invite.title}</h1>
                <p className="text-muted-foreground">You sign as {invite.role}</p>
              </div>
              <Button variant="outline" onClick={() => void pdf(invite)}><Download className="h-4 w-4" />{invite.status === "signed" ? "Signed PDF" : "PDF"}</Button>
            </div>

            <div className="overflow-hidden rounded-2xl border border-border">
              {invite.parties.map((p, i) => (
                <div key={i} className={`flex items-center justify-between gap-3 px-5 py-3 ${i % 2 ? "bg-muted/50" : ""}`}>
                  <span className="flex items-center gap-2">{p.signed_at ? <Check className="h-4 w-4 text-primary" /> : <span className="h-2 w-2 rounded-full bg-muted-foreground" />}<span className="font-semibold">{p.name}</span><span className="text-sm text-muted-foreground">{p.role}</span></span>
                  <span className="text-sm text-muted-foreground">{p.signed_at ? `Signed ${new Date(p.signed_at).toLocaleDateString()}` : "Waiting"}</span>
                </div>
              ))}
            </div>

            <div className="max-h-[36rem] overflow-y-auto whitespace-pre-wrap rounded-2xl border border-border bg-muted/30 p-6 text-sm leading-relaxed">{invite.body}</div>
            <p className="flex items-start gap-2 text-xs text-muted-foreground"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />{CONTRACT_DISCLAIMER} Contract fingerprint (SHA-256): <span className="break-all">{invite.body_hash}</span></p>

            {invite.signed_at ? (
              <div className="rounded-2xl border-2 border-primary p-6 text-center">
                <ShieldCheck className="mx-auto h-10 w-10 text-primary" />
                <p className="mt-3 text-lg font-bold">You signed on {new Date(invite.signed_at).toLocaleString()}.</p>
                <p className="text-sm text-muted-foreground">{invite.status === "signed" ? "Everyone has signed. Download the signed PDF for your records." : "We'll keep the signed copy here once everyone signs."}</p>
              </div>
            ) : invite.can_sign && invite.status === "sent" ? (
              <div className="space-y-4 rounded-2xl border-2 border-primary p-6">
                <h2 className="text-xl font-bold">Sign as {invite.role}</h2>
                <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[var(--primary)]" />I've read the full contract above and agree to its terms.</label>
                <label className="block space-y-1 text-sm"><span className="font-medium">Type your legal name to sign: <span className="font-bold">{invite.legal_name}</span></span>
                  <input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={invite.legal_name} className="w-full rounded-md border border-input bg-background px-3 py-3 font-serif text-2xl italic" /></label>
                <p className="text-xs text-muted-foreground">Your signature is time-stamped and secured with a SHA-256 hash tied to this exact contract text.</p>
                <Button size="lg" onClick={() => void sign()} disabled={busy || !agreed}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSignature className="h-4 w-4" />} Sign contract</Button>
              </div>
            ) : null}
          </div>
        )}
      </main>
    </div>
  );
}
