import { useState } from "react";
import { Check, Copy, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { CARD_STATEMENT, PRICE_LIST, PRICE_LIST_EFFECTIVE, stripeLookupKeyText } from "@/lib/price-list";
import { LivePriceAudit } from "@/components/LivePriceAudit";

/**
 * Admin → Price List: the official prices for staff to quote from. Reads src/lib/price-list.ts, which in turn reads the
 * same constants the site and checkout use, so nothing here can be out of date with what a customer is charged.
 *
 * The lookup keys block is a super admin's (founder, 2026-11-19): it is the list to copy beside the billing dashboard,
 * and it names each price's type because Stripe must hold them exactly that way or checkout refuses the charge.
 *
 * The live check (founder, 2026-11-20) is for Billing, Support, Software and super admins: it reads every key back from
 * the live Stripe account, so a missing or mispriced price is named here instead of at Buy.
 */
export function PriceList({ isSuper, canAuditPrices = false }: { isSuper: boolean; canAuditPrices?: boolean }) {
  const keys = isSuper ? stripeLookupKeyText() : "";
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(keys);
      setCopied(true);
      toast.success("Lookup keys copied. Paste them beside the billing dashboard.");
    } catch {
      toast.error("Couldn't copy. Select the text below and copy it instead.");
    }
  }

  return (
    <div className="mt-6 space-y-4">
      {canAuditPrices && <LivePriceAudit />}

      <div className="rounded-2xl border border-border bg-card p-5">
        <h2 className="text-xl font-bold">Official price list</h2>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          Everything Came Through Audio charges, in one place, for staff to quote from. These are the same numbers the
          plan charts, the site's copy and checkout all read, so a price quoted here is the price charged.
        </p>
        <p className="mt-3 text-xs font-bold uppercase tracking-[2px] text-primary">Effective {PRICE_LIST_EFFECTIVE} · USD · Billed yearly unless marked one-time</p>
      </div>

      {isSuper && (
        <section className="rounded-2xl border border-border bg-card p-5">
          <h3 className="flex items-center gap-2 text-lg font-bold"><KeyRound className="h-4 w-4" />Lookup keys to copy into Stripe</h3>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Super admins only. One product per line: the lookup key exactly as Stripe must hold it, the amount the site
            quotes, and whether it is a <strong>yearly subscription</strong> (recurring) or a <strong>one-time</strong>{" "}
            charge. A price with the wrong amount or type is refused at checkout, naming the key, so nothing is charged.
          </p>
          <Button className="mt-3" variant="outline" onClick={() => void copy()}>
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}{copied ? "Copied" : "Copy all lookup keys"}
          </Button>
          <pre className="mt-3 max-h-96 overflow-auto rounded-xl border border-border bg-muted p-3 font-mono text-xs leading-relaxed">{keys}</pre>
        </section>
      )}

      <div className="rounded-2xl border border-border bg-card p-5">
        <h3 className="text-lg font-bold">What a charge reads as on a card statement</h3>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          A member who doesn't recognise the charge is the most common reason a payment comes back as a dispute. The
          payment processor shows the full descriptor where it can, and keeps only the first ten characters for most
          card statements:
        </p>
        <p className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">Full descriptor</span>
          <code className="rounded bg-muted px-2 py-1 font-bold tracking-wide">{CARD_STATEMENT.full}</code>
          <span className="text-muted-foreground">Card prefix</span>
          <code className="rounded bg-muted px-2 py-1 font-bold tracking-wide">{CARD_STATEMENT.prefix}</code>
        </p>
        <p className="mt-2 max-w-3xl text-xs text-muted-foreground">
          The prefix is set on purpose: leave it blank and the processor cuts the name to <code>CAME THROU</code>. Both
          are exact pieces of the business name, so neither creates a second DBA. Product names and descriptions for the
          billing system are listed in the billing product sheet.
        </p>
      </div>

      {PRICE_LIST.map((group) => (
        <section key={group.title} className="rounded-2xl border border-border bg-card p-5">
          <h3 className="text-lg font-bold">{group.title}</h3>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{group.note}</p>
          <div className="mt-3 overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted text-left">
                <tr>
                  <th className="px-3 py-2 font-semibold">Item</th>
                  <th className="px-3 py-2 font-semibold">Price</th>
                  <th className="px-3 py-2 font-semibold">What it covers</th>
                  <th className="px-3 py-2 font-semibold">Billing lookup key</th>
                </tr>
              </thead>
              <tbody>
                {group.rows.map((row) => (
                  <tr key={row.item} className="border-t border-border align-top">
                    <td className="px-3 py-2 font-semibold">{row.item}</td>
                    <td className="whitespace-nowrap px-3 py-2 font-bold">{row.price}</td>
                    <td className="px-3 py-2 text-muted-foreground">{row.detail ?? "—"}</td>
                    <td className="px-3 py-2">
                      {row.lookupKey
                        ? <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{row.lookupKey}</code>
                        : <span className="text-xs text-muted-foreground">Not on sale yet</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}

      <p className="max-w-3xl text-xs text-muted-foreground">
        Plan and seat prices live in <code>src/lib/plans.ts</code>; each add-on price sits with its own feature. Never
        quote a price that isn't on this page: if a number here looks wrong, it is wrong on the site too, so tell Software
        rather than adjusting it in a message. Seats are sold inside the app from Profile → Add another artist, and checkout buys by the lookup key
        shown, so a price changed in the billing system must keep its key.
      </p>
    </div>
  );
}
