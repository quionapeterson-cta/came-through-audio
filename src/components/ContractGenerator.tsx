import { useState } from "react";
import {
  AlertTriangle,
  Check,
  Copy,
  Download,
  Loader2,
  PenLine,
  ShoppingCart,
  Sparkles,
  Wand2,
} from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CONTRACT_DISCLAIMER, type Blueprint } from "@/lib/contract-blueprints";
import {
  CONTRACT_PRICE,
  SCENARIO_MAX,
  SCENARIO_MIN,
  type GeneratedDraft,
  type GeneratorResult,
} from "@/lib/contract-generator";
import {
  ContractWorkerError,
  contractFileName,
  generateContractDocument,
  type GeneratedContract,
} from "@/lib/contract-generator-api";
import { openCheckout } from "@/lib/checkout";
import { Disclaimer } from "@/components/Disclaimer";
import { generateContract } from "@/lib/contract-generator.functions";

const EXAMPLE =
  "I'm paying a producer $500 for an exclusive beat for my song Bloodline. They keep 50% of the publishing, I own the master, and they get 3% of master royalties after I make my money back.";
const COMPANY_EXAMPLE =
  "A testimonial from an artist who used the app during beta. We'll use their photo, a short video and their quote on the homepage and social media.";

type Failure = {
  message: string;
  status?: number | undefined;
  detail?: string | undefined;
  /** A busy day rather than a fault: no error code, no support line, and the closest blueprints are offered. */
  soft?: boolean | undefined;
};

/**
 * Contract Generator (founder, 2026-10-25; full contract from the Worker 2026-11-27): describe the deal and the
 * Contract Generator Worker drafts the complete agreement with Workers AI. The blueprint match is still one click away,
 * unchanged, for anyone who would rather start from our own template.
 */
export function ContractGenerator({
  blueprints,
  unlocked,
  company = false,
  onDraft,
  onUse,
}: {
  /** Catalog Management: the suggested blueprints open for free (drafts are still $3.99 each). */
  blueprints: Blueprint[];
  unlocked: boolean;
  company?: boolean;
  onDraft: (bp: Blueprint, draft: GeneratedDraft) => void;
  onUse: (bp: Blueprint) => void;
}) {
  const matchBlueprint = useServerFn(generateContract);
  const [scenario, setScenario] = useState("");
  const [busy, setBusy] = useState(false);
  const [matching, setMatching] = useState(false);
  const [contract, setContract] = useState<GeneratedContract>();
  const [failure, setFailure] = useState<Failure>();
  const [copied, setCopied] = useState(false);
  const [result, setResult] = useState<GeneratorResult>();
  const byId = (id: string) => blueprints.find((b) => b.id === id);
  const ready = scenario.trim().length >= SCENARIO_MIN;

  /** The main action: the Worker drafts the whole contract. */
  async function run() {
    setBusy(true);
    setFailure(undefined);
    setContract(undefined);
    setResult(undefined);
    try {
      // A paid member (the plan that unlocks Contracts) is never counted against the daily limit.
      setContract(await generateContractDocument({ scenario, company, paid: unlocked }));
    } catch (e) {
      // Out of today's free drafting allowance is a busy day, not a fault: say so and offer the closest premade
      // contracts (the blueprint matcher answers without Workers AI, so it still works).
      const limit =
        e instanceof ContractWorkerError && (e.code === "daily_limit" || e.code === "daily_cap");
      const error: Failure =
        e instanceof ContractWorkerError
          ? {
              message: e.message,
              status: limit ? undefined : e.status,
              detail: limit ? undefined : e.detail,
              soft: limit,
            }
          : {
              message: e instanceof Error ? e.message : "The generator couldn't run. Try again.",
            };
      setFailure(error);
      toast.error(error.message);
      if (limit) void match();
    } finally {
      setBusy(false);
    }
  }

  /** The original path, kept as-is: match one of our blueprints and fill its fields. */
  async function match() {
    setMatching(true);
    setResult(undefined);
    try {
      setResult(await matchBlueprint({ data: { scenario, company } }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The generator couldn't run. Try again.");
    } finally {
      setMatching(false);
    }
  }

  async function copyContract() {
    if (!contract) return;
    try {
      await navigator.clipboard.writeText(contract.contract);
      setCopied(true);
      toast.success("Contract copied.");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy automatically — select the text and copy it.");
    }
  }

  function downloadContract() {
    if (!contract) return;
    const blob = new Blob([contract.contract], { type: "text/plain;charset=utf-8" });
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = contractFileName(contract.title);
    a.click();
    URL.revokeObjectURL(href);
  }

  async function buy() {
    if (result?.kind !== "draft" || !result.generationId) return;
    try {
      await openCheckout({ kind: "contract", generationId: result.generationId });
    } catch (e) {
      toast.error(
        e instanceof Error
          ? e.message
          : "Checkout could not open. Contact support and we'll help right away.",
      );
    }
  }

  const draft = result?.kind === "draft" ? result.draft : undefined;
  const bp = draft && byId(draft.blueprintId);

  return (
    <section className="space-y-4 rounded-2xl border border-primary/40 bg-accent/20 p-5">
      <div>
        <h3 className="flex items-center gap-2 text-lg font-bold">
          <Sparkles className="h-5 w-5 text-primary" />
          Contract Generator
        </h3>
        <p className="text-sm text-muted-foreground">
          {company
            ? "Describe the agreement. We draft the full contract for the deal you describe."
            : `Describe your deal in your own words and get a complete, ready-to-use contract drafted for it — fair terms, no traps. Prefer one of our own blueprints instead? Match one below.`}
        </p>
      </div>
      <Textarea
        value={scenario}
        maxLength={SCENARIO_MAX}
        rows={4}
        onChange={(e) => setScenario(e.target.value)}
        placeholder={company ? COMPANY_EXAMPLE : EXAMPLE}
        aria-label="Describe your deal"
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          Include who's involved, what each side gets (money, percentages, rights, credit), for how
          long, and your state.
          {result ? ` ${result.left} draft${result.left === 1 ? "" : "s"} left today.` : ""}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            onClick={() => void match()}
            disabled={matching || busy || !ready}
          >
            {matching ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Wand2 className="h-4 w-4" />
            )}
            {matching ? "Matching…" : "Match a blueprint"}
          </Button>
          <Button onClick={() => void run()} disabled={busy || matching || !ready}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {busy ? "Drafting…" : "Draft my contract"}
          </Button>
        </div>
      </div>

      {failure && (
        <div
          role="alert"
          className="space-y-1.5 rounded-xl border border-destructive/50 bg-destructive/5 p-4 text-sm"
        >
          <p className="flex items-center gap-2 font-semibold">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            {failure.message}
            {failure.status ? (
              <span className="font-mono text-xs font-normal text-muted-foreground">
                (HTTP {failure.status})
              </span>
            ) : null}
          </p>
          {failure.detail && (
            <p className="break-words font-mono text-xs text-muted-foreground">{failure.detail}</p>
          )}
          <p className="text-xs text-muted-foreground">
            {failure.soft
              ? "The closest premade contracts are below — start from one of those, or describe your deal again tomorrow."
              : "If this keeps happening, send this message to support — it names the exact fault."}
          </p>
        </div>
      )}

      {contract && (
        <div className="space-y-3 rounded-xl border border-border bg-card p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-semibold">{contract.title}</p>
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => void copyContract()}>
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? "Copied" : "Copy"}
              </Button>
              <Button size="sm" variant="outline" onClick={downloadContract}>
                <Download className="h-4 w-4" />
                Download
              </Button>
            </div>
          </div>
          <div className="max-h-[65vh] overflow-auto rounded-lg border border-border bg-background p-4">
            <pre className="whitespace-pre-wrap break-words font-mono text-[12.5px] leading-relaxed">
              {contract.contract}
            </pre>
          </div>
        </div>
      )}

      {draft && bp && (
        <div className="space-y-3 rounded-xl border border-border bg-card p-4">
          <p className="text-sm">
            <span className="font-semibold">Best match: {bp.name}.</span> {draft.reason}
          </p>
          <p className="text-sm text-muted-foreground">
            Filled in {Object.keys(draft.fields).length} detail
            {Object.keys(draft.fields).length === 1 ? "" : "s"}
            {Object.keys(draft.parties).length
              ? ` and ${Object.keys(draft.parties).length} name${Object.keys(draft.parties).length === 1 ? "" : "s"}`
              : ""}{" "}
            from your description.
          </p>
          {draft.missing.length > 0 && (
            <div className="text-sm">
              <p className="flex items-center gap-1.5 font-semibold">
                <AlertTriangle className="h-4 w-4 text-primary" />
                ⚠️ Still needed (you'll fill these in next):
              </p>
              <ul className="ml-6 list-disc text-muted-foreground">
                {draft.missing.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            </div>
          )}
          {draft.notCovered.length > 0 && (
            <div className="text-sm">
              <p className="font-semibold">Not covered by this blueprint:</p>
              <ul className="ml-6 list-disc text-muted-foreground">
                {draft.notCovered.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
              <p className="mt-1 text-xs text-muted-foreground">
                Add these with Edit terms, or ask a music attorney to.
              </p>
            </div>
          )}
          {company ? (
            <Button onClick={() => onDraft(bp, draft)}>
              <PenLine className="h-4 w-4" />
              Open my draft
            </Button>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <Button
                onClick={() => void buy()}
                disabled={!result || result.kind !== "draft" || !result.generationId}
              >
                <ShoppingCart className="h-4 w-4" />
                Get this contract · {CONTRACT_PRICE}
              </Button>
              <span className="text-xs text-muted-foreground">
                One contract, on any plan: edit it, send it for e-signature and keep the signed
                copy.
              </span>
            </div>
          )}
        </div>
      )}

      {result?.kind === "suggest" && (
        <div className="space-y-3 rounded-xl border border-border bg-card p-4">
          <p className="text-sm">{result.reason}</p>
          {result.suggestions.length > 0 ? (
            <ul className="grid gap-2">
              {result.suggestions
                .map(byId)
                .filter((b): b is Blueprint => !!b)
                .map((b) => (
                  <li
                    key={b.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold">{b.name}</p>
                      <p className="text-xs text-muted-foreground">{b.summary}</p>
                    </div>
                    {(unlocked || company) && (
                      <Button size="sm" variant="outline" onClick={() => onUse(b)}>
                        <PenLine className="h-4 w-4" />
                        Use this
                      </Button>
                    )}
                  </li>
                ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              Browse the {company ? "templates" : "blueprints"} below to find the closest one.
            </p>
          )}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Every contract is drafted for the deal you describe and can be edited before you sign. Check
        every detail before you sign. {CONTRACT_DISCLAIMER}
      </p>
      <Disclaimer k="generator" />
    </section>
  );
}
