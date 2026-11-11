import { useEffect, useState } from "react";
import { Barcode, ChevronLeft, FileDown, Hourglass, Truck, X } from "lucide-react";
import { toast } from "sonner";
import { downloadPamphletPdf } from "@/lib/pamphlet-pdf";
import { Button } from "@/components/ui/button";
import { ORGAN_NAME } from "@/lib/royalty-checkup";
import { PAMPHLETS, type PamphletOrgan } from "@/lib/waiting-area";
import { ClinicArt, OrganGlyph } from "@/components/ClinicArt";

/**
 * The Waiting Area (PLAN-royalty-health-hub-v2 section 1): the rack you read from before the appointment.
 * Redesigned 2026-11-11 into a grid of micro-cards with single-colour line icons, and the pamphlet itself opens in a
 * side drawer so the Hub stays in view. Each pamphlet keeps its own picture and its own copy: the titles are still the
 * way into them. Copy lives in lib/waiting-area.ts.
 */
type Organ = PamphletOrgan;

/**
 * The name printed on each leaflet. Five organs, plus the three leaflets that are not about an organ: the ISRC code, and
 * the two money leaflets (founder, 2026-11-11).
 */
const LEAFLET: Record<Organ, string> = {
  heart: ORGAN_NAME.heart, lungs: ORGAN_NAME.lungs, kidneys: ORGAN_NAME.kidneys,
  brain: ORGAN_NAME.brain, spine: ORGAN_NAME.spine, isrc: "ISRC",
  distributor: "Distributor", unclaimed: "Unclaimed",
};

/** One line icon per leaflet: an organ's own glyph, or the mark the leaflet is about. */
function LeafletIcon({ organ, className = "h-3.5 w-3.5" }: { organ: Organ; className?: string }) {
  if (organ === "isrc") return <Barcode className={className} aria-hidden />;
  if (organ === "distributor") return <Truck className={className} aria-hidden />;
  if (organ === "unclaimed") return <Hourglass className={className} aria-hidden />;
  return <OrganGlyph organ={organ} className={className} />;
}

export function WaitingArea() {
  const [open, setOpen] = useState<Organ>();
  const leaf = PAMPHLETS.find((p) => p.organ === open);
  const number = (o: Organ) => PAMPHLETS.findIndex((p) => p.organ === o) + 1;
  const close = () => setOpen(undefined);

  // Escape closes the drawer, the way every other panel in the app does.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(undefined); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <section aria-labelledby="waiting-area" className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1 border-b border-border px-4 py-3">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">Waiting Area</p>
          <h3 id="waiting-area" className="mt-0.5 text-base font-bold">What the Music Royalty Doctor examines</h3>
        </div>
        <p className="max-w-[54ch] text-xs text-muted-foreground">
          Take a pamphlet while you're here: one per organ, plus the codes behind them, and what each one means for your money.
        </p>
      </div>

      {/* The rack, as micro-cards: one line icon and one title each. The title is the way into that pamphlet. */}
      <ul aria-label="Pamphlet rack" className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-3">
        {PAMPHLETS.map((p) => (
          <li key={p.organ}>
            <button
              type="button"
              onClick={() => setOpen(p.organ)}
              aria-label={`Open the ${LEAFLET[p.organ]} pamphlet`}
              className="group flex h-full w-full items-start gap-2 rounded-lg border border-border bg-card px-2.5 py-2 text-left transition hover:border-primary/60 hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="mt-px flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-border text-primary group-hover:border-primary/50">
                <LeafletIcon organ={p.organ} />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                  <span className="text-primary">{number(p.organ)}.</span> {LEAFLET[p.organ]}
                </span>
                <span className="mt-0.5 block text-xs font-semibold leading-snug">{p.subject}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>

      {leaf && (
        /* The pamphlet itself in a side drawer: picture first, then the reading, with the Hub still in view behind it. */
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-labelledby="pamphlet-title">
          <button type="button" aria-label="Close the pamphlet" onClick={close} className="absolute inset-0 h-full w-full cursor-default bg-ink/40" />
          <article id="pamphlet" className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col overflow-y-auto border-l border-border bg-card shadow-2xl">
            <div className="relative shrink-0">
              <ClinicArt name={leaf.organ} className="h-32 w-full rounded-none border-0 object-cover" />
              <button type="button" aria-label="Close the pamphlet" onClick={close}
                className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full border border-border bg-card text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <X className="h-3.5 w-3.5" aria-hidden />
              </button>
            </div>
            <div className="p-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
                Pamphlet No. {number(leaf.organ)} &middot; {LEAFLET[leaf.organ]}
              </p>
              <h4 id="pamphlet-title" className="mt-1 text-lg font-extrabold leading-snug tracking-tight">{leaf.subject}</h4>
              <p className="mt-1 text-sm font-semibold">{leaf.lede}</p>
              <div className="mt-3 space-y-2 text-xs text-muted-foreground">
                {leaf.body.map((para) => <p key={para.slice(0, 32)}>{para}</p>)}
              </div>
              <dl className="mt-4 grid gap-2 border-t border-dashed border-border pt-3 text-xs sm:grid-cols-3">
                <div>
                  <dt className="text-[10px] font-bold uppercase tracking-[0.12em] text-primary">Healthy reading</dt>
                  <dd className="mt-0.5 text-muted-foreground">{leaf.healthy}.</dd>
                </div>
                <div>
                  <dt className="text-[10px] font-bold uppercase tracking-[0.12em]">Bad reading</dt>
                  <dd className="mt-0.5 text-muted-foreground">{leaf.unhealthy}.</dd>
                </div>
                <div>
                  <dt className="text-[10px] font-bold uppercase tracking-[0.12em]">In your report</dt>
                  <dd className="mt-0.5 text-muted-foreground">{leaf.meaning}.</dd>
                </div>
              </dl>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={close} autoFocus><ChevronLeft />Back to the rack</Button>
                {/* Take the pamphlet home (founder, 2026-11-11): the same words, as a PDF with our header and footer. */}
                <Button size="sm" variant="outline" onClick={() => void downloadPamphletPdf(leaf, LEAFLET[leaf.organ]).catch(() => toast.error("Couldn't create the pamphlet PDF. Try again."))}>
                  <FileDown />Download PDF
                </Button>
              </div>
            </div>
          </article>
        </div>
      )}
    </section>
  );
}
