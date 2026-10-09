import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Disc3, Activity, FileSignature, ScrollText, GraduationCap, LogOut, Check } from "lucide-react";
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
  component: Workspace,
});

const tabs = [
  { id: "catalog", label: "My Catalog", icon: Disc3, blurb: "Your master catalog entries will live here." },
  { id: "health", label: "Royalty Health Check", icon: Activity, blurb: "Run health checks across BMI, ASCAP, SoundExchange and PPL UK." },
  { id: "splits", label: "Split Sheets", icon: FileSignature, blurb: "Create and sign split sheets with your collaborators." },
  { id: "contracts", label: "Contracts & Blueprints", icon: ScrollText, blurb: "Contract templates and business blueprints are coming here." },
];

function Workspace() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState<string>("");
  const [tier, setTier] = useState<string>("free");

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
        <Tabs defaultValue="catalog">
          <TabsList className="h-auto w-full flex-wrap justify-start gap-1 bg-muted p-1">
            {[...tabs, { id: "masterclasses", label: "Masterclasses", icon: GraduationCap }].map(({ id, label, icon: Icon }) => (
              <TabsTrigger key={id} value={id} className="gap-2 px-4 py-2.5 font-semibold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <Icon className="h-4 w-4" /> {label}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="catalog" forceMount className="data-[state=inactive]:hidden"><MetadataUploader /></TabsContent>
          {tabs.filter(({ id }) => id !== "catalog").map(({ id, label, icon: Icon, blurb }) => (
            <TabsContent key={id} value={id}><Blank icon={Icon} title={label} text={blurb} /></TabsContent>
          ))}
          <TabsContent value="masterclasses">
            <div className="mt-6 grid gap-6 md:grid-cols-2">
              <Blank icon={GraduationCap} title="Upcoming Bookings" text="Your scheduled calendar sessions will appear here." />
              <Blank icon={Activity} title="Live Sessions" text="Active in-house live sessions will appear here." />
            </div>
          </TabsContent>
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

function PlansDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild><Button className="font-semibold">View Plans</Button></DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle className="text-2xl font-bold">Choose your plan</DialogTitle></DialogHeader>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-border p-6">
            <div className="font-bold">Free</div>
            <div className="mt-1 text-3xl font-bold">$0</div>
            <ul className="mt-4 space-y-2 text-sm"><li className="flex gap-2"><Check className="h-4 w-4 text-primary" />1 Free Royalty Health Check</li></ul>
            <Button variant="outline" disabled className="mt-6 w-full">Current plan</Button>
          </div>
          <div className="rounded-xl bg-ink p-6 text-ink-foreground">
            <div className="font-bold text-primary">Pro</div>
            <div className="mt-1 text-3xl font-bold">$24.99<span className="text-base text-ink-muted">/yr</span></div>
            <ul className="mt-4 space-y-2 text-sm">
              {["Unlimited Master Catalog", "Unlimited Metadata Embedding", "Unlimited Royalty Health Checks"].map((f) => (
                <li key={f} className="flex gap-2"><Check className="h-4 w-4 text-primary" />{f}</li>
              ))}
            </ul>
            <Button className="mt-6 w-full" disabled>Coming soon</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
