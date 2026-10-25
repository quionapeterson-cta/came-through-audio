import { useState } from "react";
import { AlertTriangle, Loader2, PenLine, ShoppingCart, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CONTRACT_DISCLAIMER, type Blueprint } from "@/lib/contract-blueprints";
import { CONTRACT_PRICE, SCENARIO_MAX, SCENARIO_MIN, type GeneratedDraft, type GeneratorResult } from "@/lib/contract-generator";
import { openCheckout } from "@/lib/checkout";
import { generateContract } from "@/lib/contract-generator.functions";

const EXAMPLE = "I'm paying a producer $500 for an exclusive beat for my song Bloodline. They keep 50% of the publishing, I own the master, and they get 3% of master royalties after I make my money back.";
const COMPANY_EXAMPLE = "A testimonial from an artist who used the app during beta. We'll use their photo, a short video and their quote on the homepage and social media.";

/**
 * Contract Generator (founder, 2026-10-25): describe the deal, get a draft from the closest blueprint with its fields
 * filled in, then finish it in the normal editor. The wording always comes from our blueprints.
 */
export function ContractGenerator({ blueprints, unlocked, company = false, onDraft, onUse }: {
  /** Catalog Management: the suggested blueprints open for free (drafts are still $3.99 each). */
  blueprints: Blueprint[]; unlocked: boolean; company?: boolean;
  onDraft: (bp: Blueprint, draft: GeneratedDraft) => void; onUse: (bp: Blueprint) => void;
}) {
  const generate = useServerFn(generateContract);
  const [scenario, setScenario] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<GeneratorResult>();
  const byId = (id: string) => blueprints.find((b) => b.id === id);
  const ready = scenario.trim().length >= SCENARIO_MIN;

  async function run() {
    setBusy(true);
    setResult(undefined);
    try { setResult(await generate({ data: { scenario, company } })); }
    catch (e) { toast.error(e instanceof Error ? e.message : "The generator couldn't run. Try again."); }
    finally { setBusy(false); }
  }

  async function buy() {
    if (result?.kind !== "draft" || !result.generationId) return;
    try { await openCheckout({ kind: "contract", generationId: result.generationId }); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Checkout could not open. Contact support and we'll help right away."); }
  }

  const draft = result?.kind === "draft" ? result.draft : undefined;
  const bp = draft && byId(draft.blueprintId);

  return (
    <section className="space-y-4 rounded-2xl border border-primary/40 bg-accent/20 p-5">
      <div>
        <h3 className="flex items-center gap-2 text-lg font-bold"><Sparkles className="h-5 w-5 text-primary" />Contract Generator</h3>
        <p className="text-sm text-muted-foreground">{company
          ? "Describe the agreement. We pick the right company template and fill in what you told us."
          : `Tell us about your deal in your own words. We pick the right blueprint and fill in what you told us. Seeing the match is free; the contract is ${CONTRACT_PRICE}, on any plan.`}</p>
      </div>
      <Textarea value={scenario} maxLength={SCENARIO_MAX} rows={4} onChange={(e) => setScenario(e.target.value)} placeholder={company ? COMPANY_EXAMPLE : EXAMPLE} aria-label="Describe your deal" />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">Include who's involved, what each side gets (money, percentages, rights, credit), for how long, and your state.{result ? ` ${result.left} draft${result.left === 1 ? "" : "s"} left today.` : ""}</p>
        <Button onClick={() => void run()} disabled={busy || !ready}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {busy ? "Drafting…" : "Draft my contract"}
        </Button>
      </div>

      {draft && bp && (
        <div className="space-y-3 rounded-xl border border-border bg-card p-4">
          <p className="text-sm"><span className="font-semibold">Best match: {bp.name}.</span> {draft.reason}</p>
          <p className="text-sm text-muted-foreground">Filled in {Object.keys(draft.fields).length} detail{Object.keys(draft.fields).length === 1 ? "" : "s"}{Object.keys(draft.parties).length ? ` and ${Object.keys(draft.parties).length} name${Object.keys(draft.parties).length === 1 ? "" : "s"}` : ""} from your description.</p>
          {draft.missing.length > 0 && <div className="text-sm">
            <p className="flex items-center gap-1.5 font-semibold"><AlertTriangle className="h-4 w-4 text-primary" />⚠️ Still needed (you'll fill these in next):</p>
            <ul className="ml-6 list-disc text-muted-foreground">{draft.missing.map((m) => <li key={m}>{m}</li>)}</ul>
          </div>}
          {draft.notCovered.length > 0 && <div className="text-sm">
            <p className="font-semibold">Not covered by this blueprint:</p>
            <ul className="ml-6 list-disc text-muted-foreground">{draft.notCovered.map((m) => <li key={m}>{m}</li>)}</ul>
            <p className="mt-1 text-xs text-muted-foreground">Add these with Edit terms, or ask a music attorney to.</p>
          </div>}
          {company
            ? <Button onClick={() => onDraft(bp, draft)}><PenLine className="h-4 w-4" />Open my draft</Button>
            : <div className="flex flex-wrap items-center gap-3">
                <Button onClick={() => void buy()} disabled={!result || result.kind !== "draft" || !result.generationId}><ShoppingCart className="h-4 w-4" />Get this contract · {CONTRACT_PRICE}</Button>
                <span className="text-xs text-muted-foreground">One contract, on any plan: edit it, send it for e-signature and keep the signed copy.</span>
              </div>}
        </div>
      )}

      {result?.kind === "suggest" && (
        <div className="space-y-3 rounded-xl border border-border bg-card p-4">
          <p className="text-sm">{result.reason}</p>
          {result.suggestions.length > 0
            ? <ul className="grid gap-2">{result.suggestions.map(byId).filter((b): b is Blueprint => !!b).map((b) => (
                <li key={b.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3">
                  <div className="min-w-0"><p className="font-semibold">{b.name}</p><p className="text-xs text-muted-foreground">{b.summary}</p></div>
                  {(unlocked || company) && <Button size="sm" variant="outline" onClick={() => onUse(b)}><PenLine className="h-4 w-4" />Use this</Button>}
                </li>))}</ul>
            : <p className="text-sm text-muted-foreground">Browse the {company ? "templates" : "blueprints"} below to find the closest one.</p>}
        </div>
      )}

      <p className="text-xs text-muted-foreground">The wording comes from our blueprints; the generator only fills in the details. Check every detail before you sign. {CONTRACT_DISCLAIMER}</p>
    </section>
  );
}
