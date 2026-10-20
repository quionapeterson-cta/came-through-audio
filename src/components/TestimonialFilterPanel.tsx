import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { TestimonialCard } from "@/components/TestimonialCard";
import { DEFAULT_TESTIMONIAL_FILTER, FILTER_RANGES, TESTIMONIALS, type TestimonialFilter } from "@/lib/testimonials";
import { getTestimonialFilter, setTestimonialFilter } from "@/lib/testimonials.functions";

const KEYS = Object.keys(FILTER_RANGES) as (keyof TestimonialFilter)[];

/**
 * Admin → Homepage: the one photo filter every homepage testimonial uses. Changes preview live on all the cards at
 * once and go to the homepage on Save. There is no per-photo filter, so every card always matches.
 */
export function TestimonialFilterPanel() {
  const load = useServerFn(getTestimonialFilter);
  const save = useServerFn(setTestimonialFilter);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["testimonial-filter"], queryFn: () => load() });
  const [draft, setDraft] = useState<TestimonialFilter>(DEFAULT_TESTIMONIAL_FILTER);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (q.data) setDraft(q.data); }, [q.data]);
  const changed = !!q.data && KEYS.some((k) => draft[k] !== q.data![k]);

  async function publish() {
    setBusy(true);
    try {
      await save({ data: draft });
      await qc.invalidateQueries({ queryKey: ["testimonial-filter"] });
      toast.success("Saved. Every testimonial photo on the homepage now uses this filter.");
    } catch { toast.error("Couldn't save the filter."); }
    finally { setBusy(false); }
  }

  if (q.isLoading) return <p className="mt-6 text-muted-foreground">Loading…</p>;
  if (q.isError) return <p className="mt-6 text-destructive">Couldn't load the testimonial filter.</p>;
  return (
    <div className="mt-6 space-y-6">
      <section className="rounded-2xl border border-border bg-card p-5">
        <h3 className="text-lg font-bold">Testimonial photo filter</h3>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          One filter for every testimonial photo, so they always match: black-and-white with a Cobalt Blue tint and a dark fade
          behind the name. Adjust it here and every card changes together.
        </p>
        <div className="mt-5 grid gap-6 sm:grid-cols-2">
          {KEYS.map((k) => <div key={k} className="space-y-2">
            <div className="flex items-baseline justify-between text-sm">
              <label htmlFor={`filter-${k}`} className="font-semibold">{FILTER_RANGES[k].label}</label>
              <span className="tabular-nums text-muted-foreground">{draft[k]}%</span>
            </div>
            <Slider id={`filter-${k}`} min={FILTER_RANGES[k].min} max={FILTER_RANGES[k].max} step={1} value={[draft[k]]}
              onValueChange={([v]) => setDraft((d) => ({ ...d, [k]: v ?? d[k] }))} aria-label={FILTER_RANGES[k].label} />
          </div>)}
        </div>
        <div className="mt-6 flex flex-wrap gap-2">
          <Button onClick={() => void publish()} disabled={busy || !changed}>{busy ? "Saving…" : "Save to homepage"}</Button>
          <Button variant="outline" onClick={() => setDraft(q.data ?? DEFAULT_TESTIMONIAL_FILTER)} disabled={!changed}>Undo changes</Button>
          <Button variant="ghost" onClick={() => setDraft(DEFAULT_TESTIMONIAL_FILTER)}>Brand default</Button>
        </div>
      </section>
      <section>
        <h3 className="mb-3 text-sm font-bold uppercase tracking-widest text-primary">Preview</h3>
        <div className="grid gap-6 md:grid-cols-3">
          {TESTIMONIALS.map((t) => <TestimonialCard key={t.name} t={t} filter={draft} />)}
        </div>
      </section>
    </div>
  );
}
