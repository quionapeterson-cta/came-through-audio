import { Info } from "lucide-react";
import { SCORE_STEPS } from "@/lib/faq";

/** "How your score works": the same explanation as the FAQ, folded away until opened (Hub and Royalty Health Report). */
export function ScoreInfo({ className = "" }: { className?: string }) {
  return (
    <details className={`group rounded-xl border border-current/15 p-3 text-sm ${className}`}>
      <summary className="flex cursor-pointer list-none items-center gap-2 font-semibold"><Info className="h-4 w-4 shrink-0" aria-hidden />How your score works</summary>
      <ol className="mt-2 list-decimal space-y-1.5 pl-5 opacity-85">{SCORE_STEPS.map((s) => <li key={s}>{s}</li>)}</ol>
    </details>
  );
}
