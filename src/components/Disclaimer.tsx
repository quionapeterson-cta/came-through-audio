import { Scale } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { DISCLAIMERS, type DisclaimerKey } from "@/lib/disclaimers";

/** A feature's legal note, small and next to the action, with a link to the full Terms of Service. */
export function Disclaimer({ k, className = "", tone = "light" }: { k: DisclaimerKey; className?: string; tone?: "light" | "ink" }) {
  return (
    <p className={`flex items-start gap-2 text-xs ${tone === "ink" ? "text-ink-muted" : "text-muted-foreground"} ${className}`}>
      <Scale className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
      <span>{DISCLAIMERS[k]} <Link to="/terms-of-service" className="underline underline-offset-2">Terms</Link></span>
    </p>
  );
}
