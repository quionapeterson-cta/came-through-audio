import { ORGAN_NAME } from "@/lib/royalty-checkup";
import { PAMPHLETS } from "@/lib/waiting-area";

/**
 * The Waiting Area (PLAN-royalty-health-hub-v2 §1): a doctor's-office pamphlet rack, one card per organ, so a visitor
 * learns what a healthy reading looks like before checking in. Copy lives in lib/waiting-area.ts.
 */
export function WaitingArea() {
  return (
    <section
      aria-labelledby="waiting-area"
      className="rounded-2xl border border-border bg-card p-5"
    >
      <p className="text-xs font-semibold uppercase tracking-[2px] text-primary">Waiting Area</p>
      <h3 id="waiting-area" className="mt-1 text-xl font-bold">
        What the Doctor examines
      </h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Take a pamphlet while you wait: one per organ, and what each one means for your money.
      </p>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2">
        {PAMPHLETS.map((p) => (
          <li key={p.organ} className="rounded-xl border border-border p-4 text-sm">
            <b className="block text-base">{ORGAN_NAME[p.organ]}</b>
            <p className="mt-2">
              <span className="font-semibold text-primary">Healthy: </span>
              <span className="text-muted-foreground">{p.healthy}.</span>
            </p>
            <p className="mt-1">
              <span className="font-semibold">Bad reading: </span>
              <span className="text-muted-foreground">{p.unhealthy}.</span>
            </p>
            <p className="mt-1">
              <span className="font-semibold">In your report: </span>
              <span className="text-muted-foreground">{p.meaning}.</span>
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
