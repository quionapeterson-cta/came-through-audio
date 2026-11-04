import { PRICE_LIST, PRICE_LIST_EFFECTIVE } from "@/lib/price-list";

/**
 * Admin → Price List: the official prices for staff to quote from. Reads src/lib/price-list.ts, which in turn reads the
 * same constants the site and checkout use, so nothing here can be out of date with what a customer is charged.
 */
export function PriceList() {
  return (
    <div className="mt-6 space-y-4">
      <div className="rounded-2xl border border-border bg-card p-5">
        <h2 className="text-xl font-bold">Official price list</h2>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          Everything Came Through Audio charges, in one place, for staff to quote from. These are the same numbers the
          plan charts, the site's copy and checkout all read, so a price quoted here is the price charged.
        </p>
        <p className="mt-3 text-xs font-bold uppercase tracking-[2px] text-primary">Effective {PRICE_LIST_EFFECTIVE} · USD · Billed yearly unless marked one-time</p>
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
                  <th className="px-3 py-2 font-semibold">Stripe lookup key</th>
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
        rather than adjusting it in a message. Seat prices are already set up in Stripe, so a seat can be sold by hand from the dashboard at the rate shown here
        until in-app checkout ships.
      </p>
    </div>
  );
}
