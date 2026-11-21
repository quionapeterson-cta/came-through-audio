import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { TestimonialCard } from "@/components/TestimonialCard";
import { DEFAULT_TESTIMONIAL_FILTER, FILTER_RANGES, TESTIMONIALS, type TestimonialFilter } from "@/lib/testimonials";

const KEYS = Object.keys(FILTER_RANGES) as (keyof TestimonialFilter)[];

/**
 * Admin → Homepage: the one photo filter every homepage testimonial uses, edited as part of the section's draft. It
 * never saves on its own (founder, 2026-11-21): it rides with the cards in the same version, so it reaches the
 * homepage only when a super admin approves that version. The sliders therefore change the parent's draft, and
 * "Save draft" / "Request approval" in the section above are the only ways forward.
 */
export function TestimonialFilterPanel({
  filter,
  onChange,
  locked,
}: {
  filter: TestimonialFilter;
  onChange: (next: TestimonialFilter) => void;
  locked: boolean;
}) {
  const set = (k: keyof TestimonialFilter, v: number) => onChange({ ...filter, [k]: v });
  return (
    <div className="mt-6 space-y-6">
      <section className="rounded-2xl border border-border bg-card p-5">
        <h3 className="text-lg font-bold">Testimonial photo filter</h3>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          One filter for every testimonial photo, so they always match: black-and-white with a Cobalt Blue tint and a dark fade
          behind the name. Adjust it here and every card changes together. It is saved and approved with the cards, so it reaches
          the homepage only with a super admin's approval.
        </p>
        <div className="mt-5 grid gap-6 sm:grid-cols-2">
          {KEYS.map((k) => <div key={k} className="space-y-2">
            <div className="flex items-baseline justify-between text-sm">
              <label htmlFor={`filter-${k}`} className="font-semibold">{FILTER_RANGES[k].label}</label>
              <span className="tabular-nums text-muted-foreground">{filter[k]}%</span>
            </div>
            <Slider id={`filter-${k}`} min={FILTER_RANGES[k].min} max={FILTER_RANGES[k].max} step={1} value={[filter[k]]}
              onValueChange={([v]) => set(k, v ?? filter[k])} disabled={locked} aria-label={FILTER_RANGES[k].label} />
          </div>)}
        </div>
        <div className="mt-6 flex flex-wrap gap-2">
          <Button variant="ghost" onClick={() => onChange(DEFAULT_TESTIMONIAL_FILTER)} disabled={locked}>Brand default</Button>
        </div>
      </section>
      <section>
        <h3 className="mb-3 text-sm font-bold uppercase tracking-widest text-primary">Preview</h3>
        <div className="grid gap-6 md:grid-cols-3">
          {TESTIMONIALS.map((t) => <TestimonialCard key={t.name} t={t} filter={filter} />)}
        </div>
      </section>
    </div>
  );
}
