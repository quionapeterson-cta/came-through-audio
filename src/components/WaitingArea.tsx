import { ORGAN_NAME } from "@/lib/royalty-checkup";
import { PAMPHLETS } from "@/lib/waiting-area";
import { ClinicArt, OrganGlyph } from "@/components/ClinicArt";

/**
 * The Waiting Area (PLAN-royalty-health-hub-v2 §1): a doctor's-office pamphlet rack, one leaflet per organ, so a
 * visitor learns what a healthy reading looks like before checking in. Each leaflet is a folded card with its organ's
 * picture, the healthy reading, the bad reading, and what it means in the report. Copy lives in lib/waiting-area.ts.
 */
export function WaitingArea() {
  return (
    <section aria-labelledby="waiting-area" className="rounded-2xl border border-border bg-card">
      <div className="flex flex-col gap-4 border-b border-border p-5 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-[2px] text-primary">Waiting Area</p>
          <h3 id="waiting-area" className="mt-1 text-xl font-bold">What the Doctor examines</h3>
          <p className="mt-1 max-w-[62ch] text-sm text-muted-foreground">
            Take a pamphlet while you wait: one per organ, and what each one means for your money.
          </p>
        </div>
        <ClinicArt name="rack" className="h-24 w-full shrink-0 object-cover sm:h-28 sm:w-44" />
      </div>

      {/* The rack: a tray with a lip at the bottom, leaflets standing in it. */}
      <div className="rounded-b-2xl bg-muted/60 p-4 sm:p-5">
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {PAMPHLETS.map((p, i) => (
            <li
              key={p.organ}
              className="relative flex flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              {/* folded tab along the top edge, like a leaflet in a rack */}
              <span className="flex items-center gap-2 bg-primary px-3 py-2 text-primary-foreground">
                <OrganGlyph organ={p.organ} className="h-6 w-6 shrink-0" />
                <b className="text-sm">{ORGAN_NAME[p.organ]}</b>
                <span className="ml-auto text-[10px] font-semibold uppercase tracking-[1.5px] opacity-70">
                  No. {i + 1}
                </span>
              </span>
              <div className="flex-1 space-y-2 px-3 py-3 text-sm">
                <p>
                  <span className="font-semibold text-primary">Healthy reading: </span>
                  <span className="text-muted-foreground">{p.healthy}.</span>
                </p>
                <p>
                  <span className="font-semibold">Bad reading: </span>
                  <span className="text-muted-foreground">{p.unhealthy}.</span>
                </p>
                <p className="border-t border-dashed border-border pt-2">
                  <span className="font-semibold">In your report: </span>
                  <span className="text-muted-foreground">{p.meaning}.</span>
                </p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
