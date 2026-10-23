import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BadgeCheck, Loader2, LogOut, Music4 } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { BrandLogo } from "@/components/BrandLogo";
import { SignupCard } from "@/components/SignupCard";
import { ProSelect } from "@/components/ProSelect";
import { InfoTip } from "@/components/InfoTip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { answerIpiInvite, getIpiInvite, nameKey, type IpiAnswer, type IpiInvite } from "@/lib/ipi-requests";
import { grantCollaboratorTrial } from "@/lib/collab-trial.functions";
import { getPaymentsEnvironment } from "@/lib/checkout";
import { clearReturn, rememberReturn } from "@/lib/password";
import { loadProfile, saveOnboarding, saveProfile, syncFromCloud, withOwnWriter } from "@/lib/artist-profile";
import { creditName } from "@/lib/metadata";

export const Route = createFileRoute("/ipi/$id")({
  head: () => ({
    meta: [
      { title: "Add your PRO and IPI — Came Through Audio" },
      { name: "description", content: "A co-writer asked for your PRO and IPI so your writer share gets paid. Create a free account and add them in a minute." },
      { property: "og:title", content: "Add your PRO and IPI so your writer share gets paid" },
      { property: "og:description", content: "Create a free account and add your details in a minute." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: IpiPage,
});

/** Your own Catalog Profile gets the same details (blanks only), so they're ready for your own songs. */
async function saveToOwnProfile(userId: string, a: IpiAnswer) {
  const ob = await syncFromCloud(userId);
  const p = loadProfile(userId) ?? {};
  const rows = withOwnWriter(p.writers, ob?.legalName || a.legal_name) ?? [];
  const mine = rows.findIndex((r) => nameKey(creditName(r)) === nameKey(a.legal_name));
  const at = mine >= 0 ? mine : rows.length === 1 ? 0 : -1;
  if (at >= 0 && !a.no_pro) {
    const r = rows[at]!;
    rows[at] = { ...r, legalName: r.legalName?.trim() || a.legal_name, pro: r.pro?.trim() || a.pro, ipi: r.ipi?.trim() || a.ipi };
    saveProfile(userId, { ...p, writers: rows });
  }
  if (ob && !ob.legalName?.trim()) saveOnboarding(userId, { ...ob, legalName: a.legal_name });
}

function IpiPage() {
  const { id } = Route.useParams();
  const { user, loading } = useAuth();
  const [invite, setInvite] = useState<IpiInvite | null>();
  const [error, setError] = useState("");
  const [legal, setLegal] = useState("");
  const [pro, setPro] = useState("");
  const [ipi, setIpi] = useState("");
  const [noPro, setNoPro] = useState(false);
  const [busy, setBusy] = useState(false);
  const grantTrial = useServerFn(grantCollaboratorTrial);

  const load = () => {
    setError("");
    getIpiInvite(id)
      .then((d) => {
        setInvite(d);
        setLegal(d?.answer?.legal_name ?? d?.writer_name ?? "");
        clearReturn();
        if (d) grantTrial({ data: { ipiRequestId: id, environment: getPaymentsEnvironment() } })
          .then((r) => { if (r.granted) toast.success("Welcome! You've unlocked a free 30-day Catalog & Collaborate account."); })
          .catch(() => {});
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Could not open this request."));
  };
  // Remember this page only once we know the visitor is logged out (see /sign/$rowId).
  useEffect(() => { if (loading) return; if (user) clearReturn(); else rememberReturn(`/ipi/${id}`); }, [user, loading, id]);
  useEffect(() => { if (user) load(); }, [user?.id, id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function send() {
    if (!invite || !user) return;
    const a: IpiAnswer = { legal_name: legal.trim(), pro: noPro ? "" : pro, ipi: noPro ? "" : ipi.replace(/\D/g, ""), no_pro: noPro };
    if (!a.legal_name) { toast.error("Add your legal name."); return; }
    if (!noPro && (!a.pro || !/^\d{9,11}$/.test(a.ipi))) { toast.error("Choose your PRO and add your 9–11 digit IPI, or tick \"I'm not in a PRO yet\"."); return; }
    setBusy(true);
    try {
      await answerIpiInvite(id, a);
      await saveToOwnProfile(user.id, a).catch(() => {});
      toast.success("Sent! Thank you.");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not send your details.");
    } finally { setBusy(false); }
  }

  const songs = invite?.songs ?? [];
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
              <Music4 className="h-10 w-10 text-primary" />
              <h1 className="text-3xl font-bold">A co-writer needs your PRO and IPI</h1>
              <p className="text-muted-foreground">Create your free account using the same email the request was sent to, or log in. Then add your details in about a minute, so your writer share gets paid.</p>
              <p className="rounded-lg border border-primary p-3 text-sm font-medium">Bonus: a free 30-day Catalog &amp; Collaborate account when you join.</p>
            </div>
            <SignupCard returnPath={`/ipi/${id}`} onAuthed={() => {}} inviteMode />
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-destructive p-8 text-center">
            <p className="font-semibold">{error}</p>
            <p className="mt-2 text-sm text-muted-foreground">You're logged in as {user.email}. Log in with the email the request was sent to.</p>
          </div>
        ) : invite === undefined ? (
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" />
        ) : !invite ? (
          <p className="text-center text-muted-foreground">This request no longer exists.</p>
        ) : invite.answered ? (
          <div className="rounded-2xl border-2 border-primary p-8 text-center">
            <BadgeCheck className="mx-auto h-10 w-10 text-primary" />
            <p className="mt-3 text-xl font-bold">Thanks, {invite.answer?.legal_name ?? invite.writer_name}. Your details were sent to {invite.artist_name || "your co-writer"}.</p>
            <p className="mt-1 text-sm text-muted-foreground">They're saved in your own Catalog Profile too, ready for your own songs.</p>
            <Button className="mt-5" onClick={() => { window.location.href = "/workspace"; }}>Open your workspace</Button>
          </div>
        ) : invite.expired ? (
          <p className="text-center text-muted-foreground">This request has expired. Ask {invite.artist_name || "your co-writer"} to send a new one.</p>
        ) : (
          <div className="space-y-8">
            <div>
              <p className="text-sm font-bold uppercase tracking-widest text-primary">Co-writer details</p>
              <h1 className="mt-1 text-3xl font-bold md:text-4xl">Hi {invite.writer_name}, add your writer details</h1>
              <p className="mt-2 text-muted-foreground">For {songs.slice(0, 5).map((t) => `"${t}"`).join(", ")}{songs.length > 5 ? ` and ${songs.length - 5} more` : ""}{invite.artist_name ? ` by ${invite.artist_name}` : ""}.</p>
            </div>
            <div className="space-y-4 rounded-2xl border-2 border-primary p-6">
              <label className="block space-y-1 text-sm"><span className="flex items-center gap-1 font-medium">Your legal name <InfoTip text="The name your PRO has on file. Registrations always use legal names." /></span>
                <Input value={legal} onChange={(e) => setLegal(e.target.value)} autoComplete="name" /></label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={noPro} onChange={(e) => setNoPro(e.target.checked)} className="h-4 w-4 accent-primary" />I'm not in a PRO yet</label>
              {!noPro && <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1 text-sm"><span className="flex items-center gap-1 font-medium">PRO affiliation <InfoTip term="pro" /></span><ProSelect value={pro} onChange={setPro} id="ipi-pro" /></div>
                <label className="block space-y-1 text-sm"><span className="flex items-center gap-1 font-medium">IPI name number <InfoTip term="ipi" /></span>
                  <Input value={ipi} onChange={(e) => setIpi(e.target.value)} inputMode="numeric" placeholder="9 to 11 digits" /></label>
              </div>}
              <p className="text-xs text-muted-foreground">{noPro ? "No problem. Join one when you're ready and add it in your Catalog Profile." : "Your IPI is in your PRO account, usually on your profile or member page."} Only {invite.artist_name || "your co-writer"} sees what you send. It's used to register these songs and is never published or added to the music files.</p>
              <Button disabled={busy} onClick={() => void send()}>{busy && <Loader2 className="animate-spin" />}Send to {invite.artist_name || "your co-writer"}</Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
