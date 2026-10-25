import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useBilling } from "@/hooks/useBilling";
import { BrandLogo } from "@/components/BrandLogo";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { BETA_WINDOW, betaItemsFor, type BetaItem, type BetaResult } from "@/lib/beta";
import { TIER_LABEL, type Tier } from "@/lib/plans";

export const Route = createFileRoute("/beta")({
  head: () => ({ meta: [{ title: "Beta checklist — Came Through Audio" }, { name: "robots", content: "noindex" }] }),
  component: BetaPage,
});

type Saved = { result: BetaResult | null; note: string };
const TIERS: Tier[] = ["free", "plus", "collaborate", "management"];

/**
 * Beta checklist (Phase 4 item 3): every feature for the tester's plan and the plans below it, each marked Worked or
 * Didn't work with an optional note. Saves as they go; super admins read the results in Admin → Company Contracts.
 */
function BetaPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { tier, loaded } = useBilling(user?.id);
  const [saved, setSaved] = useState<Record<string, Saved>>({});
  useEffect(() => { if (!loading && !user) navigate({ to: "/" }); }, [loading, user, navigate]);
  useEffect(() => {
    if (!user) return;
    void supabase.from("beta_feedback" as never).select("item_id, result, note").then(({ data }) => {
      setSaved(Object.fromEntries(((data ?? []) as { item_id: string; result: BetaResult | null; note: string }[]).map((r) => [r.item_id, { result: r.result, note: r.note }])));
    });
  }, [user]);
  const items = useMemo(() => betaItemsFor(tier), [tier]);
  const done = items.filter((i) => saved[i.id]?.result).length;

  async function save(item: BetaItem, patch: Partial<Saved>) {
    if (!user) return;
    const next = { result: null, note: "", ...saved[item.id], ...patch };
    setSaved((s) => ({ ...s, [item.id]: next }));
    const { error } = await supabase.from("beta_feedback" as never).upsert({ user_id: user.id, item_id: item.id, result: next.result, note: next.note.trim(), updated_at: new Date().toISOString() } as never, { onConflict: "user_id,item_id" });
    if (error) toast.error("Couldn't save that. Check your connection and try again.");
  }

  if (loading || !user || !loaded) return <div className="flex min-h-screen items-center justify-center bg-ink text-ink-muted">Loading…</div>;

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-ink text-ink-foreground">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-6 py-4">
          <BrandLogo />
          <Button asChild variant="ghost" className="text-ink-foreground hover:bg-ink-border hover:text-ink-foreground"><Link to="/workspace"><ArrowLeft />Back to workspace</Link></Button>
        </div>
      </header>
      <main className="mx-auto max-w-4xl space-y-8 px-6 py-10">
        <div>
          <p className="text-xs font-bold uppercase tracking-[2px] text-primary">Beta checklist · {TIER_LABEL[tier]}</p>
          <h1 className="mt-1 text-3xl font-extrabold md:text-4xl">Thanks for testing Came Through Audio</h1>
          <p className="mt-2 text-muted-foreground">{BETA_WINDOW}. Try each one, then mark it. Anything odd, even small, goes in the note: what you clicked, what you expected and what happened. Your answers save as you go.</p>
          <p className="mt-3 text-sm font-semibold">{done} of {items.length} checked</p>
        </div>
        {TIERS.filter((t) => items.some((i) => i.tier === t)).map((t) => (
          <section key={t} className="space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-widest text-primary">{TIER_LABEL[t]}</h2>
            <ul className="space-y-3">
              {items.filter((i) => i.tier === t).map((i) => {
                const s = saved[i.id];
                return (
                  <li key={i.id} className={`rounded-xl border p-4 ${s?.result === "broken" ? "border-destructive" : s?.result === "worked" ? "border-primary" : "border-border"}`}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold">{i.title} <span className="text-xs font-normal text-muted-foreground">· {i.area}</span></p>
                        <p className="text-sm text-muted-foreground">{i.how}</p>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant={s?.result === "worked" ? "default" : "outline"} aria-pressed={s?.result === "worked"} onClick={() => void save(i, { result: s?.result === "worked" ? null : "worked" })}><Check />Worked</Button>
                        <Button size="sm" variant={s?.result === "broken" ? "destructive" : "outline"} aria-pressed={s?.result === "broken"} onClick={() => void save(i, { result: s?.result === "broken" ? null : "broken" })}><X />Didn't work</Button>
                      </div>
                    </div>
                    <Textarea className="mt-3" rows={2} maxLength={2000} placeholder="Notes (optional): what happened?" defaultValue={s?.note ?? ""} key={`${i.id}-${s ? "loaded" : "new"}`}
                      onBlur={(e) => { if (e.target.value.trim() !== (s?.note ?? "")) void save(i, { note: e.target.value }); }} aria-label={`Notes for ${i.title}`} />
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </main>
    </div>
  );
}
