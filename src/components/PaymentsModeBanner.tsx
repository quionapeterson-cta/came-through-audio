import { useQuery } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { paymentModeStatus } from "@/lib/price-audit.functions";

/**
 * Admin's staff banner (founder, 2026-11-20): checkout refuses every purchase when the mode this build checks out in
 * and the environment site_settings `payments` counts disagree. That refusal is correct, but silent from the staff
 * side: the first report is a member saying Buy is broken. This says it first, to the teams who answer that report.
 *
 * Server-gated to super admins and the Billing, Support and Software departments, so a member's browser never reads
 * the live account's setting.
 */
export function PaymentsModeBanner() {
  const status = useQuery({
    queryKey: ["payment-mode"],
    queryFn: () => paymentModeStatus(),
    retry: false,
    refetchInterval: 120000,
  });
  const s = status.data;
  // A denied or failed read renders nothing: this banner is a staff tool, not a member-facing error.
  if (!s || (!s.mismatch && !s.readFailed)) return null;
  return (
    <div role="alert" className="border-b border-destructive bg-destructive/10 px-4 py-3 text-sm">
      <div className="mx-auto flex max-w-[100rem] items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
        <div>
          <p className="font-bold text-destructive">
            {s.readFailed
              ? "The payments setting can't be read, so every checkout is refused."
              : "The build and the database disagree on payment mode, so every checkout is refused."}
          </p>
          {s.readFailed ? (
            <p className="mt-1 text-foreground">
              This build checks out in <strong>{s.app}</strong> mode, but{" "}
              <code className="rounded bg-muted px-1 py-0.5">site_settings.payments</code> couldn't
              be read. Nothing is charged while it stays unreadable: fix that row before telling
              anyone a purchase is broken.
            </p>
          ) : (
            <p className="mt-1 text-foreground">
              This build checks out in <strong>{s.app}</strong> mode, but{" "}
              <code className="rounded bg-muted px-1 py-0.5">site_settings.payments</code> says{" "}
              <strong>{s.counted ?? "nothing"}</strong>. Every Buy on this site is refused before
              Stripe is called. Set the row to <strong>{s.app}</strong>, or publish the build whose
              Stripe key matches it.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
