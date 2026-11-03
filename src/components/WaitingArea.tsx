import { useState } from "react";
import { ChevronLeft, MousePointerClick } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ORGAN_NAME } from "@/lib/royalty-checkup";
import { PAMPHLETS, type Pamphlet } from "@/lib/waiting-area";
import { ClinicArt, OrganGlyph } from "@/components/ClinicArt";

/**
 * The Waiting Area (PLAN-royalty-health-hub-v2 §1): the room you sit in before the appointment. The rack photo is the
 * door into it — click it and the tray of leaflets opens. Each leaflet is a real pamphlet you take and read: its own
 * picture, a subject, and two or three paragraphs on how that money reaches you. Copy lives in lib/waiting-area.ts.
 */
export function WaitingArea() {
  const [rack, setRack] = useState(false);
  const [open, setOpen] = useState<Pamphlet["organ"]>();
  const leaf = PAMPHLETS.find((p) => p.organ === open);
  const number = (organ: Pamphlet["organ"]) => PAMPHLETS.findIndex((p) => p.organ === organ) + 1;

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
        {/* The waiting area photo is the way in: click the rack and the leaflets become reachable. */}
        <button
          type="button"
          onClick={() => { setRack((v) => !v); setOpen(undefined); }}
          aria-expanded={rack}
          aria-controls="pamphlet-rack"
          className="group block w-full overflow-hidden rounded-xl border-2 border-border bg-card text-left transition hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ClinicArt name="rack" className="w-full rounded-none border-0" />
          <span className="flex flex-wrap items-center justify-between gap-2 border-t-2 border-border bg-ink px-4 py-3 text-sm font-semibold text-ink-foreground group-hover:text-primary">
            <span className="inline-flex items-center gap-2">
              <MousePointerClick className="h-4 w-4" aria-hidden />
              {rack ? "Close the rack" : "Tap the rack to take a pamphlet"}
            </span>
            <span className="text-xs font-normal text-ink-muted">{PAMPHLETS.length} leaflets · one per organ</span>
          </span>
        </button>

        {leaf ? (
          /* The pamphlet itself: picture first, then the reading. */
          <article id="pamphlet" aria-labelledby="pamphlet-title" className="mt-4 overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            <ClinicArt name={leaf.organ} className="w-full rounded-none border-0" />
            <div className="p-5">
              <p className="text-xs font-semibold uppercase tracking-[2px] text-primary">
                Pamphlet No. {number(leaf.organ)} · {ORGAN_NAME[leaf.organ]}
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
        ) : rack ? (
          /* The rack: a tray of leaflets standing in it, each one clickable. */
          <ul id="pamphlet-rack" className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {PAMPHLETS.map((p, i) => (
              <li key={p.organ}>
                <button
                  type="button"
                  onClick={() => setOpen(p.organ)}
                  className="flex h-full w-full flex-col overflow-hidden rounded-lg border border-border bg-card text-left shadow-sm transition hover:-translate-y-0.5 hover:border-primary hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="flex items-center gap-2 bg-primary px-3 py-2 text-primary-foreground">
                    <OrganGlyph organ={p.organ} className="h-6 w-6 shrink-0" />
                    <b className="text-sm">{ORGAN_NAME[p.organ]}</b>
                    <span className="ml-auto text-[10px] font-semibold uppercase tracking-[1.5px] opacity-70">No. {i + 1}</span>
                  </span>
                  <span className="flex-1 space-y-2 px-3 py-3 text-sm">
                    <span className="block font-semibold">{p.subject}</span>
                    <span className="block text-muted-foreground">{p.lede}</span>
                    <span className="block border-t border-dashed border-border pt-2 text-primary">Read the pamphlet →</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">
            The rack is shut. Open it to read about the five things the Doctor examines.
          </p>
        )}
      </div>
    </section>
  );
}
