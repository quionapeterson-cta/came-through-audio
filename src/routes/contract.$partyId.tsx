import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AlertTriangle, Check, Download, FileSignature, Loader2, LogOut, Mail, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { BrandLogo } from "@/components/BrandLogo";
import { SignupCard } from "@/components/SignupCard";
import { Button } from "@/components/ui/button";
import { COMPANY_LEGAL_NAME, CONTRACT_DISCLAIMER } from "@/lib/contract-blueprints";
import { downloadContractPdf } from "@/lib/contract-pdf";
import { getContractInvite, signContract, type ContractInvite } from "@/lib/contracts";
import { clearReturn, rememberReturn } from "@/lib/password";
import { useServerFn } from "@tanstack/react-start";
import { grantCollaboratorTrial } from "@/lib/collab-trial.functions";
import { getPaymentsEnvironment } from "@/lib/checkout";
import { openSignLink, sendSignCode, signByLink } from "@/lib/contract-sign.functions";

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
  validateSearch: (s: Record<string, unknown>): { t?: string } => (typeof s["t"] === "string" ? { t: s["t"] } : {}),
  component: ContractSignPage,
});

function ContractSignPage() {
  const { t } = Route.useSearch();
  return t ? <LinkSigning token={t} /> : <AccountSigning />;
}

function Shell({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="bg-ink text-ink-foreground">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <BrandLogo />
          {right}
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6">{children}</main>
    </div>
  );
}

const pdf = (i: ContractInvite) => downloadContractPdf({ title: i.title, body: i.body, bodyHash: i.body_hash, status: i.status,
  parties: i.parties.map((p) => ({ name: p.name, role: p.role, signedAt: p.signed_at, signatureName: p.signature_name, signatureHash: p.signature_hash })) });

/** The agreement, who has signed, and the locked text, shared by both ways of signing. */
function ContractView({ invite, from }: { invite: ContractInvite; from?: string }) {
  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-bold uppercase tracking-widest text-primary">{from ? `From ${from}` : "Contract"}</p>
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
    </>
  );
}

function SignedNote({ invite }: { invite: ContractInvite }) {
  return (
    <div className="rounded-2xl border-2 border-primary p-6 text-center">
      <ShieldCheck className="mx-auto h-10 w-10 text-primary" />
      <p className="mt-3 text-lg font-bold">You signed on {new Date(invite.signed_at!).toLocaleString()}.</p>
      <p className="text-sm text-muted-foreground">{invite.status === "signed" ? "Everyone has signed. Download the signed PDF for your records." : "We'll email you when everyone has signed, and the signed copy will be here."}</p>
    </div>
  );
}

/** Company agreements: no account. The private link opens it; a code emailed to the invited address signs it. */
function LinkSigning({ token }: { token: string }) {
  const { partyId } = Route.useParams();
  const open = useServerFn(openSignLink);
  const sendCode = useServerFn(sendSignCode);
  const signFn = useServerFn(signByLink);
  const [invite, setInvite] = useState<(ContractInvite & { email_hint: string }) | null>(null);
  const [error, setError] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [code, setCode] = useState("");
  const [consent, setConsent] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);

  const load = () => open({ data: { partyId, token } }).then(setInvite).catch((e) => setError(e instanceof Error ? e.message : "Could not open this agreement."));
  useEffect(() => { void load(); }, [partyId, token]);

  async function requestCode() {
    setBusy(true);
    try { await sendCode({ data: { partyId, token } }); setCodeSent(true); toast.success(`Code sent to ${invite?.email_hint}.`); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Couldn't send the code."); }
    finally { setBusy(false); }
  }

  async function sign() {
    if (!invite) return;
    if (typed.trim().toLowerCase() !== invite.legal_name.trim().toLowerCase()) { toast.error("Type your legal name exactly as listed."); return; }
    setBusy(true);
    try {
      await signFn({ data: { partyId, token, code: code.replace(/\D/g, ""), signatureName: typed, consent: true, origin: window.location.origin } });
      toast.success("Signed! Thank you.");
      await load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not sign."); }
    finally { setBusy(false); }
  }

  return (
    <Shell>
      {error ? (
        <div className="rounded-2xl border border-destructive p-8 text-center"><p className="font-semibold">{error}</p></div>
      ) : !invite ? (
        <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" />
      ) : (
        <div className="space-y-8">
          <ContractView invite={invite} from={COMPANY_LEGAL_NAME} />
          {invite.signed_at ? <SignedNote invite={invite} /> : invite.can_sign ? (
            <div className="space-y-4 rounded-2xl border-2 border-primary p-6">
              <h2 className="text-xl font-bold">Sign as {invite.role}</h2>
              <p className="text-sm text-muted-foreground">No account needed. We'll email a 6-digit code to {invite.email_hint} to confirm it's you.</p>
              <div className="flex flex-wrap items-end gap-3">
                <Button variant={codeSent ? "outline" : "default"} disabled={busy} onClick={() => void requestCode()}><Mail className="h-4 w-4" />{codeSent ? "Send a new code" : "Send me a code"}</Button>
                {codeSent && <label className="space-y-1 text-sm"><span className="font-medium">Code from your email</span>
                  <input value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" autoComplete="one-time-code" maxLength={7} placeholder="123 456" className="block w-40 rounded-md border border-input bg-background px-3 py-2 text-lg tracking-widest" /></label>}
              </div>
              <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[var(--primary)]" />I've read the full agreement above, agree to its terms, and agree to sign electronically. My typed name is my legal signature.</label>
              <label className="block space-y-1 text-sm"><span className="font-medium">Type your legal name to sign: <span className="font-bold">{invite.legal_name}</span></span>
                <input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={invite.legal_name} className="w-full rounded-md border border-input bg-background px-3 py-3 font-serif text-2xl italic" /></label>
              <p className="text-xs text-muted-foreground">Your signature is time-stamped and secured with a SHA-256 hash tied to this exact agreement text, along with the time you agreed and a private record of the device you signed from.</p>
              <Button size="lg" onClick={() => void sign()} disabled={busy || !consent || !codeSent || code.replace(/\D/g, "").length !== 6}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSignature className="h-4 w-4" />} Sign agreement</Button>
            </div>
          ) : null}
        </div>
      )}
    </Shell>
  );
}

function AccountSigning() {
  const { partyId } = Route.useParams();
  const { user, loading } = useAuth();
  const [invite, setInvite] = useState<ContractInvite | null>();
  const [error, setError] = useState("");
  const [typed, setTyped] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);

  const grantTrial = useServerFn(grantCollaboratorTrial);
  const load = () => {
    setError("");
    getContractInvite(partyId)
      .then((d) => {
        setInvite(d); clearReturn();
        // Signers who open their invite get a one-time 30-day Catalog & Collaborate trial (fraud-guarded on the server).
        if (d?.can_sign) grantTrial({ data: { partyId, environment: getPaymentsEnvironment() } })
          .then((r) => { if (r.granted) toast.success("Welcome! You've unlocked a free 30-day Catalog & Collaborate account."); })
          .catch(() => {});
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Could not open this contract."));
  };
  // Only remember this page once we know the visitor is logged out; while auth is still loading `user` is null even for
  // signed-in people, and saving then would send them back here on every later sign-in.
  useEffect(() => { if (loading) return; if (user) clearReturn(); else rememberReturn(`/contract/${partyId}`); }, [user, loading, partyId]);
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

  return (
    <Shell right={user && <Button variant="ghost" size="sm" className="text-ink-muted hover:bg-ink-border hover:text-ink-foreground" onClick={() => supabase.auth.signOut()}><LogOut className="h-4 w-4" /> Log out</Button>}>
        {loading ? (
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" />
        ) : !user ? (
          <div className="grid gap-8 md:grid-cols-2 md:items-center">
            <div className="space-y-4">
              <FileSignature className="h-10 w-10 text-primary" />
              <h1 className="text-3xl font-bold">You've been asked to sign a contract</h1>
              <p className="text-muted-foreground">Log in, or create a free account using the same email the request was sent to. Then read the full contract and sign in seconds. Signing is always free.</p>
              <p className="rounded-lg border border-primary p-3 text-sm font-medium">Bonus: new signers get a free 30-day Catalog & Collaborate account.</p>
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
            <ContractView invite={invite} />

            {invite.signed_at ? <SignedNote invite={invite} /> : invite.can_sign && invite.status === "sent" ? (
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
    </Shell>
  );
}
