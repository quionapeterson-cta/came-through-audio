import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Check, FileSignature, Loader2, LogOut, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { BrandLogo } from "@/components/BrandLogo";
import { SignupCard } from "@/components/SignupCard";
import { Button } from "@/components/ui/button";
import { getSplitInvite, signSplitInvite, type SplitInvite } from "@/lib/splits";

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

  const load = () => {
    setError("");
    getSplitInvite(rowId)
      .then((d) => { setInvite(d); setPro(d?.pro ?? ""); setIpi(d?.ipi ?? ""); })
      .catch((e) => setError(e instanceof Error ? e.message : "Could not open this request."));
  };
  useEffect(() => { if (user) load(); }, [user, rowId]);

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
          <Link to="/"><BrandLogo /></Link>
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
            </div>
            <SignupCard returnPath={`/sign/${rowId}`} onAuthed={() => {}} />
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
                  <span className="flex items-center gap-2">{c.signed ? <Check className="h-4 w-4 text-primary" /> : <span className="h-2 w-2 rounded-full bg-muted-foreground" />}<span className="font-semibold">{c.name}</span><span className="text-sm text-muted-foreground">{c.role}</span></span>
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
                    <input value={pro} onChange={(e) => setPro(e.target.value)} placeholder="ASCAP, BMI, SESAC…" className="w-full rounded-md border border-input bg-background px-3 py-2" /></label>
                  <label className="space-y-1 text-sm"><span className="font-medium">IPI / CAE number</span>
                    <input value={ipi} onChange={(e) => setIpi(e.target.value)} placeholder="Optional" className="w-full rounded-md border border-input bg-background px-3 py-2" /></label>
                </div>
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
