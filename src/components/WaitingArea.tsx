import { useState } from "react";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ORGAN_NAME } from "@/lib/royalty-checkup";
import { PAMPHLETS, type Pamphlet } from "@/lib/waiting-area";
import { ClinicArt, OrganGlyph } from "@/components/ClinicArt";

/**
 * The Waiting Area (PLAN-royalty-health-hub-v2 section 1): the room you sit in before the appointment. The rack picture
 * is the rack itself: each pamphlet's title is printed on the leaflet it belongs to, and tapping a title takes that
 * pamphlet out to read. Copy lives in lib/waiting-area.ts.
 */
type Organ = Pamphlet["organ"];

/** Where each title sits on the rack drawing, as a percentage of the 480x320 picture. */
const ON_RACK: Record<Organ, { x: number; y: number }> = {
  heart: { x: 36.3, y: 30 },
  lungs: { x: 50, y: 26.5 },
  kidneys: { x: 63.8, y: 30 },
  brain: { x: 50, y: 52 },
  spine: { x: 50, y: 74 },
};

export function WaitingArea() {
  const [open, setOpen] = useState<Organ>();
  const leaf = PAMPHLETS.find((p) => p.organ === open);
  const number = (o: Organ) => PAMPHLETS.findIndex((p) => p.organ === o) + 1;

  return (
    <section aria-labelledby="waiting-area" className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="border-b border-border p-5">
        <p className="text-xs font-semibold uppercase tracking-[2px] text-primary">Waiting Area</p>
        <h3 id="waiting-area" className="mt-1 text-xl font-bold">What the Doctor examines</h3>
        <p className="mt-1 max-w-[62ch] text-sm text-muted-foreground">
          Take a pamphlet while you wait: one per organ, and what each one means for your money.
        </p>
      </div>

      <div className="bg-muted/60 p-4 sm:p-5">
        {leaf ? (
          /* The pamphlet itself: picture first, then the reading. */
          <article id="pamphlet" aria-labelledby="pamphlet-title" className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            <ClinicArt name={leaf.organ} className="w-full rounded-none border-0" />
            <div className="p-5">
              <p className="text-xs font-semibold uppercase tracking-[2px] text-primary">
                Pamphlet No. {number(leaf.organ)} &middot; {ORGAN_NAME[leaf.organ]}
              </p>
              <h4 id="pamphlet-title" className="mt-1 text-2xl font-extrabold tracking-tight">{leaf.subject}</h4>
              <p className="mt-1 font-semibold">{leaf.lede}</p>
              <div className="mt-3 max-w-[68ch] space-y-3 text-sm text-muted-foreground">
                {leaf.body.map((para) => <p key={para.slice(0, 32)}>{para}</p>)}
              </div>
              <dl className="mt-5 grid gap-3 border-t border-dashed border-border pt-4 text-sm sm:grid-cols-3">
                <div>
                  <dt className="font-semibold text-primary">Healthy reading</dt>
                  <dd className="mt-0.5 text-muted-foreground">{leaf.healthy}.</dd>
                </div>
                <div>
                  <dt className="font-semibold">Bad reading</dt>
                  <dd className="mt-0.5 text-muted-foreground">{leaf.unhealthy}.</dd>
                </div>
                <div>
                  <dt className="font-semibold">In your report</dt>
                  <dd className="mt-0.5 text-muted-foreground">{leaf.meaning}.</dd>
                </div>
              </dl>
              <Button className="mt-5" variant="outline" onClick={() => setOpen(undefined)}><ChevronLeft />Back to the rack</Button>
            </div>
          </article>
        ) : (
          <>
            {/* The rack, with every title printed on its own leaflet: each title is the way into that pamphlet. */}
            <div className="relative overflow-hidden rounded-xl border-2 border-border bg-card">
              <ClinicArt name="rack" className="w-full rounded-none border-0" />
              <ul aria-label="Pamphlet rack" className="absolute inset-0">
                {PAMPHLETS.map((p) => (
                  <li
                    key={p.organ}
                    className="absolute"
                    style={{ left: `${ON_RACK[p.organ].x}%`, top: `${ON_RACK[p.organ].y}%`, transform: "translate(-50%, -50%)" }}
                  >
                    <button
                      type="button"
                      onClick={() => setOpen(p.organ)}
                      aria-label={`Open the ${ORGAN_NAME[p.organ]} pamphlet`}
                      className="inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-ink-border bg-ink px-2 py-1 text-[10px] font-extrabold uppercase tracking-[1px] text-ink-foreground shadow-sm transition hover:bg-primary hover:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <OrganGlyph organ={p.organ} className="h-3 w-3 shrink-0" />
                      {ORGAN_NAME[p.organ]}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              {PAMPHLETS.length} leaflets on the rack. Tap a title to take that pamphlet and read it.
            </p>
          </>
        )}
      </div>
    </section>
  );
}
