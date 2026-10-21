import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Check, FileSignature, Loader2, LogOut, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { BrandLogo } from "@/components/BrandLogo";
import { SignupCard } from "@/components/SignupCard";
import { Button } from "@/components/ui/button";
import { ALL_PROS, getSplitInvite, signSplitInvite, type SplitInvite } from "@/lib/splits";
import { useServerFn } from "@tanstack/react-start";
import { grantCollaboratorTrial } from "@/lib/collab-trial.functions";
import { getPaymentsEnvironment } from "@/lib/checkout";
import { clearReturn, rememberReturn } from "@/lib/password";

export const Route = createFileRoute("/sign/$rowId")({
  head: () => ({
    meta: [
      { title: "Sign Your Split Sheet — Came Through Audio" },
      { name: "description", content: "Review your ownership split and sign it with a free Came Through Audio collaborator account." },
      { property: "og:title", content: "You've been asked to sign a split sheet" },
      { property: "og:description", content: "Create a free account, confirm your PRO and IPI, and sign in seconds." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SignPage,
});

function SignPage() {
  const { rowId } = Route.useParams();
  const { user, loading } = useAuth();
  const [invite, setInvite] = useState<SplitInvite | null>();
  const [error, setError] = useState("");
  const [typed, setTyped] = useState("");
  const [pro, setPro] = useState("");
  const [ipi, setIpi] = useState("");
  const [busy, setBusy] = useState(false);

  const grantTrial = useServerFn(grantCollaboratorTrial);
  const load = () => {
    setError("");
    getSplitInvite(rowId)
      .then((d) => {
        setInvite(d); setPro(d?.pro ?? ""); setIpi(d?.ipi ?? "");
        clearReturn();
        if (d) grantTrial({ data: { rowId, environment: getPaymentsEnvironment() } })
          .then((r) => { if (r.granted) toast.success("Welcome! You've unlocked a free 30-day Catalog & Collaborate account."); })
          .catch(() => {});
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Could not open this request."));
  };
  // Only remember this page once we know the visitor is logged out; while auth is still loading `user` is null even for
  // signed-in people, and saving then would send them back here on every later sign-in.
  useEffect(() => { if (loading) return; if (user) clearReturn(); else rememberReturn(`/sign/${rowId}`); }, [user, loading, rowId]);
  useEffect(() => { if (user) load(); }, [user?.id, rowId]);

  async function sign() {
    if (!invite || !user) return;
    if (typed.trim().toLowerCase() !== invite.legal_name.trim().toLowerCase()) { toast.error("Type your legal name exactly as listed."); return; }
    setBusy(true);
    try {
      await signSplitInvite(rowId, typed, pro, ipi, user.email ?? "", invite.percentage);
      toast.success("Signed! The owner can now see your signature.");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not sign.");
    } finally { setBusy(false); }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="bg-ink text-ink-foreground">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <BrandLogo />
          {user && <Button variant="ghost" size="sm" className="text-ink-muted hover:bg-ink-border hover:text-ink-foreground" onClick={() => supabase.auth.signOut()}><LogOut className="h-4 w-4" /> Log out</Button>}
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-12">
        {loading ? (
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" />
        ) : !user ? (
          <div className="grid gap-8 md:grid-cols-2 md:items-center">
            <div className="space-y-4">
              <FileSignature className="h-10 w-10 text-primary" />
              <h1 className="text-3xl font-bold">You've been asked to sign a split sheet</h1>
              <p className="text-muted-foreground">Create your free collaborator account using the same email the request was sent to, or log in. Then review your share and sign in seconds.</p>
              <p className="rounded-lg border border-primary p-3 text-sm font-medium">Bonus: collaborators who sign get a free 30-day Catalog & Collaborate account.</p>
            </div>
            <SignupCard returnPath={`/sign/${rowId}`} onAuthed={() => {}} inviteMode />
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
            <div>
              <p className="text-sm font-bold uppercase tracking-widest text-primary">Split sheet</p>
              <h1 className="mt-1 text-4xl font-bold">{invite.track_title}</h1>
              <p className="text-muted-foreground">{invite.artist_name}{invite.isrc ? ` · ISRC ${invite.isrc}` : ""}</p>
            </div>
            <div className="overflow-hidden rounded-2xl border border-border">
              {invite.collaborators.map((c, i) => (
                <div key={i} className={`flex items-center justify-between gap-3 px-5 py-3 ${i % 2 ? "bg-muted/50" : ""}`}>
                  <span className="flex items-center gap-2">{c.signed ? <Check className="h-4 w-4 text-primary" /> : <span className="h-2 w-2 rounded-full bg-muted-foreground" />}<span className="font-semibold">{c.name}</span>{c.performer ? <span className="text-sm text-muted-foreground">p/k/a {c.performer}</span> : null}<span className="text-sm text-muted-foreground">{c.role}</span></span>
                  <span className="font-bold">{c.percentage}%</span>
                </div>
              ))}
            </div>
            {invite.signed_at ? (
              <div className="rounded-2xl border-2 border-primary p-6 text-center">
                <ShieldCheck className="mx-auto h-10 w-10 text-primary" />
                <p className="mt-3 text-lg font-bold">You signed on {new Date(invite.signed_at).toLocaleString()}.</p>
                <p className="text-sm text-muted-foreground">Your signature is recorded with a verification hash.</p>
              </div>
            ) : (
              <div className="space-y-4 rounded-2xl border-2 border-primary p-6">
                <h2 className="text-xl font-bold">Your share: {invite.percentage}% · {invite.role}</h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="space-y-1 text-sm"><span className="font-medium">PRO affiliation</span>
                    <select value={pro} onChange={(e) => setPro(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2">
                      <option value="">Select PRO…</option>
                      {pro && !(ALL_PROS as readonly string[]).includes(pro) && <option value={pro}>{pro}</option>}
                      {ALL_PROS.map((p) => <option key={p} value={p}>{p}</option>)}
                    </select></label>
                  <label className="space-y-1 text-sm"><span className="font-medium">IPI / CAE number</span>
                    <input value={ipi} onChange={(e) => setIpi(e.target.value)} placeholder="Optional" className="w-full rounded-md border border-input bg-background px-3 py-2" /></label>
                </div>
                {(invite.performer_name || invite.publisher_name) && (
                  <div className="grid gap-2 rounded-lg bg-muted p-3 text-sm sm:grid-cols-2">
                    {invite.performer_name && <p><span className="text-muted-foreground">Performer name:</span> <span className="font-semibold">{invite.performer_name}</span></p>}
                    {invite.publisher_name && <p><span className="text-muted-foreground">Publisher:</span> <span className="font-semibold">{invite.publisher_name}</span>{invite.publisher_pro ? ` · ${invite.publisher_pro}` : ""}{invite.publisher_ipi ? ` · IPI ${invite.publisher_ipi}` : ""}{invite.publisher_percentage ? ` · ${invite.publisher_percentage}%` : ""}</p>}
                  </div>
                )}
                {invite.notes && (
                  <div className="rounded-lg border border-border p-3 text-sm">
                    <p className="mb-1 font-semibold">Notes</p>
                    <p className="whitespace-pre-wrap text-muted-foreground">{invite.notes}</p>
                  </div>
                )}
                <label className="block space-y-1 text-sm"><span className="font-medium">Type your legal name to sign: <span className="font-bold">{invite.legal_name}</span></span>
                  <input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={invite.legal_name} className="w-full rounded-md border border-input bg-background px-3 py-3 font-serif text-2xl italic" /></label>
                <p className="text-xs text-muted-foreground">By signing, you agree the ownership percentages above are accurate. Your signature is time-stamped and secured with a SHA-256 hash.</p>
                <Button size="lg" onClick={() => void sign()} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSignature className="h-4 w-4" />} Sign split sheet</Button>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
