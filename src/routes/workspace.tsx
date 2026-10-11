import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { FileAudio, CalendarClock, Lock, Disc3, Activity, FileSignature, ScrollText, GraduationCap, LogOut, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { MetadataUploader } from "@/components/MetadataUploader";

export const Route = createFileRoute("/workspace")({
  head: () => ({
    meta: [
      { title: "Workspace — Came Through Audio" },
      { name: "description", content: "Your Came Through Audio workspace: catalog, royalty health, splits, contracts and masterclasses." },
      { property: "og:title", content: "Workspace — Came Through Audio" },
      { property: "og:description", content: "Manage your music business from one secure dashboard." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  validateSearch: (s: Record<string, unknown>) => ({ tab: typeof s["tab"] === "string" ? (s["tab"] as string) : undefined } as { tab?: string | undefined }),
  component: Workspace,
});

const tabs = [
  { id: "embed", label: "Embed Metadata", icon: FileAudio },
  { id: "catalog", label: "My Catalog", icon: Disc3 },
  { id: "splits", label: "Split Sheets", icon: FileSignature },
  { id: "health", label: "Royalty Health Check", icon: Activity },
  { id: "contracts", label: "Contracts & Blueprints", icon: ScrollText },
  { id: "masterclasses", label: "Masterclasses", icon: GraduationCap },
];

function Workspace() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState<string>("");
  const [tier, setTier] = useState<string>("free");
  const search = Route.useSearch();
  const [tab, setTab] = useState(search.tab ?? "embed");
  const [splitTrack, setSplitTrack] = useState<string>();
  const [catalogKey, setCatalogKey] = useState(0);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/" });
  }, [loading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    const meta = user.user_metadata ?? {};
    setName(meta["stage_name"] || meta["legal_name"] || user.email || "");
    supabase.from("profiles").select("stage_name, legal_name, tier").eq("id", user.id).maybeSingle().then(({ data }) => {
      if (data) {
        setName(data.stage_name || data.legal_name || meta["stage_name"] || user.email || "");
        if (data.tier) setTier(data.tier);
      }
    });
  }, [user]);

  if (loading || !user) {
    return <div className="flex min-h-screen items-center justify-center bg-ink text-ink-muted">Loading…</div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-ink text-ink-foreground">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4">
          <div>
            <div className="text-xs uppercase tracking-widest text-ink-muted">Came Through Audio</div>
            <div className="text-xl font-bold">{name}</div>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="border-ink-border text-ink-foreground">{tier === "paid" ? "Paid Tier" : "Free Tier"}</Badge>
            <PlansDialog />
            <Button variant="ghost" size="icon" aria-label="Log out" className="text-ink-muted hover:bg-ink-border hover:text-ink-foreground"
              onClick={async () => { await supabase.auth.signOut(); navigate({ to: "/" }); }}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="h-auto w-full flex-wrap justify-start gap-1 bg-muted p-1">
            {tabs.map(({ id, label, icon: Icon }, i) => (
              <TabsTrigger key={id} value={id} className="gap-2 px-4 py-2.5 font-semibold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <span className="text-xs opacity-70">{i + 1}.</span><Icon className="h-4 w-4" /> {label}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="embed" forceMount className="data-[state=inactive]:hidden"><MetadataUploader stageName={name} userId={user.id} mode="embed" onSubmitted={() => setCatalogKey((k) => k + 1)} /></TabsContent>
          <TabsContent value="catalog" forceMount className="data-[state=inactive]:hidden">
            <div className="mx-auto mt-8 max-w-5xl rounded-xl border border-primary p-5">
              <div className="font-bold">AI Protection Certificate uploads</div>
              <p className="mt-1 text-sm text-muted-foreground">If you added AI Protection, upload a 15-second DAW session video and an 8-second notes-app proof for each protected song.</p>
            </div>
            <MetadataUploader key={catalogKey} userId={user.id} mode="catalog" canSplit={tier === "paid"} onSplitSheet={(t) => { setSplitTrack(t.title); setTab("splits"); }} />
          </TabsContent>
          <TabsContent value="splits"><Blank icon={FileSignature} title="Split Sheets" text={splitTrack ? `Starting a split sheet for "${splitTrack}". Collaborators will be invited by email to sign.` : "Generate a split sheet from any song in My Catalog."} /></TabsContent>
          <TabsContent value="health"><Blank icon={Activity} title="Royalty Health Check" text="Your free Royalty Health Check across BMI, ASCAP, SoundExchange and the MLC starts here." /></TabsContent>
          <TabsContent value="contracts"><Blank icon={ScrollText} title="Contracts & Blueprints" text="Producer agreements, videographer releases and beat licenses — included with Catalog & Contracts." /></TabsContent>
          <TabsContent value="masterclasses"><Masterclasses /></TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function Blank({ icon: Icon, title, text }: { icon: React.ElementType; title: string; text: string }) {
  return (
    <div className="mt-6 flex min-h-72 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border p-10 text-center">
      <Icon className="h-10 w-10 text-primary" />
      <h2 className="mt-4 text-2xl font-bold">{title}</h2>
      <p className="mt-2 max-w-md text-muted-foreground">{text}</p>
    </div>
  );
}

const plans = [
  { name: "Starter", price: "Free", monthly: "", text: "Provides entry-level users and collaborators with a 100% free account to sign split sheets and run Unlimited Royalty Health Checks across public databases." },
  { name: "Catalog Plus", price: "$24.99/yr", monthly: "(Only $2.08 / month)", text: "Provides independent creators with unlimited core metadata embedding, centralized master asset cataloging, and Unlimited Royalty Health Checks." },
  { name: "Catalog & Collaborate", price: "$44.99/yr", monthly: "(Only $3.75 / month)", text: "Unlocks collaborative industry-standard split sheets generation, automated e-signature requests, and our unlimited PRO Formula Converter suite." },
  { name: "Catalog & Contracts", price: "$89.99/yr", monthly: "(Only $7.50 / month)", text: "Includes everything in lower tiers plus unlimited access to our professional contract blueprints vault (producer agreements, videographer releases, beat licenses) and custom metadata protection playbooks." },
];

function PlansDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild><Button className="font-semibold">View Plans</Button></DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto">
        <DialogHeader><DialogTitle className="text-2xl font-bold">Choose your plan</DialogTitle></DialogHeader>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {plans.map((p, i) => (
            <div key={p.name} className={`flex flex-col rounded-xl p-5 ${i === 1 ? "bg-ink text-ink-foreground" : "border border-border"}`}>
              <div className="font-bold text-primary">{p.name}</div>
              <div className="mt-2 text-3xl font-bold">{p.price}</div>
              {p.monthly && <div className="text-sm opacity-80">{p.monthly}</div>}
              <Badge variant="outline" className="mt-2 w-fit">{i === 0 ? "Always free" : "Billed annually"}</Badge>
              <p className="mt-4 flex-1 text-sm opacity-90">{p.text}</p>
              <Button className="mt-5 w-full" variant={i === 0 ? "outline" : "default"} disabled>{i === 0 ? "Current plan" : "Coming soon"}</Button>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Masterclasses() {
  const [songs, setSongs] = useState(0);
  const [type, setType] = useState<"single" | "album">("single");
  const [count, setCount] = useState(1);
  const [agencies, setAgencies] = useState(1);
  const [agree, setAgree] = useState(false);
  useEffect(() => { supabase.from("catalogs").select("id", { count: "exact", head: true }).then(({ count: c }) => setSongs(c ?? 0)); }, []);
  const base = type === "single" ? 14.99 : 29.99;
  const n = type === "album" ? Math.min(count, 20) : count;
  const total = (base + 4.99 * n * agencies).toFixed(2);
  const unlocked = songs > 0 && agree;
  return (
    <div className="mt-6 grid gap-6 md:grid-cols-2">
      <div className="rounded-2xl border border-border p-6">
        <GraduationCap className="h-8 w-8 text-primary" />
        <h2 className="mt-3 text-2xl font-bold">Music Business Masterclasses</h2>
        <p className="mt-2 text-muted-foreground">Live group classes with an industry expert.</p>
        <div className="mt-4 flex items-center justify-between rounded-lg bg-muted p-4"><span className="font-semibold">1 class slot</span><span className="text-xl font-bold text-primary">$19/slot</span></div>
        <Button className="mt-4 w-full" disabled>Checkout coming soon</Button>
      </div>
      <div className="rounded-2xl border border-primary p-6">
        <CalendarClock className="h-8 w-8 text-primary" />
        <h2 className="mt-3 text-2xl font-bold">Expert Registration Assistance</h2>
        <p className="mt-2 text-sm text-muted-foreground">1-on-1 live video guidance registering your songs with your PRO, SoundExchange and the MLC.</p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          {(["single", "album"] as const).map((t) => <Button key={t} variant={type === t ? "default" : "outline"} onClick={() => setType(t)}>{t === "single" ? "Single / EP" : "Full album"}</Button>)}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <label className="space-y-1"><span>Songs{type === "album" ? " (up to 20)" : ""}</span><input type="number" min={1} max={type === "album" ? 20 : 6} value={count} onChange={(e) => setCount(Math.max(1, Number(e.target.value)))} className="w-full rounded-md border border-input bg-background px-3 py-2" /></label>
          <label className="space-y-1"><span>Agencies</span><input type="number" min={1} max={4} value={agencies} onChange={(e) => setAgencies(Math.min(4, Math.max(1, Number(e.target.value))))} className="w-full rounded-md border border-input bg-background px-3 py-2" /></label>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">${base} setup + $4.99 per song per agency</p>
        <div className="mt-1 text-3xl font-bold text-primary">${total}</div>
        <label className="mt-4 flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1 accent-[var(--primary)]" checked={agree} onChange={(e) => setAgree(e.target.checked)} />I confirm I can successfully log into my PRO, SoundExchange and MLC accounts.</label>
        {songs === 0 && <p className="mt-3 flex items-center gap-2 text-sm text-destructive"><Lock className="h-4 w-4" />Add your track details to My Catalog first.</p>}
        <Button className="mt-4 w-full" disabled={!unlocked}>{unlocked ? "Booking calendar coming soon" : "Locked"}</Button>
      </div>
    </div>
  );
}
