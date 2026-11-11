import { Button } from "@/components/ui/button";

/** The score at or below which the diagnosis carries the specialist call-out (founder, 2026-11-11). */
export const SEVERE_SCORE = 60;

/**
 * Diagnostic Review: High Risk of Unpaid Royalties (founder, 2026-11-11): added to the diagnosis report when its score is 60% or lower. Additive
 * only — it opens the same expert offer the report's own "Let our agents…" buttons do (`onExpert`), and the report
 * around it is unchanged. Worded as a recommendation, never as an order.
 */
export function DiagnosisAlert({ score, onExpert }: { score: number; onExpert: () => void }) {
  if (score > SEVERE_SCORE) return null;
  return (
    <section aria-labelledby="diagnosis-alert" className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-amber-950 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-50">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <h3 id="diagnosis-alert" className="text-sm font-extrabold">🛑 Diagnostic Review: High Risk of Unpaid Royalties</h3>
          <p className="mt-1 max-w-[64ch] text-xs leading-relaxed">
            Your catalog is at high risk for the Black Box. We recommend not self-medicating your data: see our specialist for
            expert help, and we'll handle your registrations for you.
          </p>
        </div>
        <Button size="sm" onClick={onExpert}>See our specialist to get expert registration</Button>
      </div>
    </section>
  );
}
