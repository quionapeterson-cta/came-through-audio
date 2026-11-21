import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, RefreshCw, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { livePriceAudit } from "@/lib/price-audit.functions";

/** The one query both the Admin-wide alert and the Price List panel read, so opening the tab never re-checks Stripe. */
const useLivePriceAudit = () =>
  useQuery({
    queryKey: ["live-price-audit"],
    queryFn: () => livePriceAudit(),
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: 60_000,
  });

/**
 * Admin's loud strip (founder, 2026-11-20): shown above every tab while a sold price fails in live Stripe, so a missing
 * price is found by staff rather than by the member whose Buy it refuses. Silent when the check passes or the account
 * hasn't answered yet.
 */
export function LivePriceAlert({ onOpen }: { onOpen: () => void }) {
  const audit = useLivePriceAudit();
  const d = audit.data;
  if (!d || d.ok) return null;
  return (
    <div role="alert" className="border-b border-destructive bg-destructive/10 px-4 py-3 text-sm">
      <div className="mx-auto flex max-w-[100rem] flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
          <div>
            <p className="font-bold text-destructive">
              {d.error
                ? "The live price check couldn't read Stripe, so no price is confirmed."
                : `${d.problems.length} live price ${d.problems.length === 1 ? "problem" : "problems"} in Stripe: Buy is refused wherever one applies.`}
            </p>
            <p className="mt-1 text-foreground">{d.problems[0]}</p>
            {d.problems.length > 1 && (
              <p className="mt-1 text-xs text-muted-foreground">
                And {d.problems.length - 1} more in the full check.
              </p>
            )}
          </div>
        </div>
        <Button size="sm" variant="outline" onClick={onOpen}>
          <Receipt className="h-4 w-4" />
          Open the price check
        </Button>
      </div>
    </div>
  );
}

/**
 * Admin → Price List's live check (founder, 2026-11-20): every lookup key the site sells, read back from the live
 * Stripe account and matched against the amount the price list publishes. A key that was never created, was archived,
 * holds the wrong billing type or charges the wrong amount is what checkout refuses at Buy — here it is named before a
 * member meets it.
 *
 * Rendered only for super admins and Billing, Support and Software; the server checks the same rule again.
 */
export function LivePriceAudit() {
  const audit = useLivePriceAudit();
  const d = audit.data;
  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold">Live Stripe prices</h3>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Every lookup key the site sells, checked against the live Stripe account: it must exist,
            be active, be in USD, be the billing type below (yearly, monthly or one-time), and
            charge exactly the published amount. A key that fails here fails at Buy, so fix it in
            Stripe before a member finds it.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void audit.refetch()}
          disabled={audit.isFetching}
        >
          <RefreshCw className={`h-4 w-4 ${audit.isFetching ? "animate-spin" : ""}`} />
          {audit.isFetching ? "Checking…" : "Check again"}
        </Button>
      </div>

      {audit.isLoading && (
        <p className="mt-4 text-sm text-muted-foreground">Checking the live Stripe account…</p>
      )}

      {audit.isError && (
        <p role="alert" className="mt-4 text-sm font-semibold text-destructive">
          Couldn't run the live price check ({(audit.error as Error).message}).
        </p>
      )}

      {d && d.ok && (
        <div className="mt-4 flex items-start gap-2 rounded-xl border border-emerald-600/40 bg-emerald-600/5 p-3 text-sm">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
          <p>
            <strong>All {d.rows.length} sold prices are right in live Stripe.</strong> Every key
            exists, is active, and charges the published amount. Checked{" "}
            {new Date(d.checkedAt).toLocaleString()}.
          </p>
        </div>
      )}

      {d && !d.ok && (
        <div
          role="alert"
          className="mt-4 rounded-xl border-2 border-destructive bg-destructive/10 p-4 text-sm"
        >
          <p className="flex items-center gap-2 font-bold text-destructive">
            <AlertTriangle className="h-5 w-5" />
            {d.error
              ? "The live price check couldn't read Stripe, so no price is confirmed."
              : `${d.problems.length} live price ${d.problems.length === 1 ? "problem" : "problems"}: Buy is refused wherever one applies.`}
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-6">
            {d.problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted-foreground">
            Checked {new Date(d.checkedAt).toLocaleString()} in the live Stripe account.
          </p>
        </div>
      )}

      {!!d?.rows.length && (
        <div className="mt-4 overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted text-left">
              <tr>
                <th className="px-3 py-2 font-semibold">Item</th>
                <th className="px-3 py-2 font-semibold">Lookup key</th>
                <th className="px-3 py-2 font-semibold">Must be</th>
                <th className="px-3 py-2 font-semibold">Published</th>
                <th className="px-3 py-2 font-semibold">Live Stripe</th>
                <th className="px-3 py-2 font-semibold">Result</th>
              </tr>
            </thead>
            <tbody>
              {d.rows.map((row) => (
                <tr key={row.lookupKey} className="border-t border-border align-top">
                  <td className="px-3 py-2 font-semibold">{row.item}</td>
                  <td className="px-3 py-2">
                    <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{row.lookupKey}</code>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                    {row.billing === "recurring-yearly"
                      ? "Yearly subscription"
                      : row.billing === "recurring-monthly"
                        ? "Monthly subscription"
                        : "One-time"}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap font-bold">
                    {row.publishedText ?? "—"}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">{row.stripeText ?? "Not found"}</td>
                  <td
                    className={`px-3 py-2 ${row.problem ? "font-semibold text-destructive" : "text-emerald-600"}`}
                  >
                    {row.problem ? "Fails at Buy" : "OK"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {d && !d.rows.length && d.error && (
        <p className="mt-3 text-xs text-muted-foreground">
          No row could be checked until the live Stripe account is readable.
        </p>
      )}
    </section>
  );
}
