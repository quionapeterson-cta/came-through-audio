import { Quote } from "lucide-react";
import { DEFAULT_TESTIMONIAL_FILTER, type Testimonial, type TestimonialFilter } from "@/lib/testimonials";

/**
 * One testimonial: a wide photo under the shared brand filter (black-and-white, cobalt tint, dark fade behind the
 * name), so every photo matches no matter how it was shot, with name and location on the photo and the quote below.
 * Every card gets the same `filter`; there is no per-photo filter.
 */
export function TestimonialCard({ t, filter = DEFAULT_TESTIMONIAL_FILTER }: { t: Testimonial; filter?: TestimonialFilter }) {
  const ink = "var(--color-ink, #0b0b0b)";
  return (
    <figure className="flex flex-col overflow-hidden rounded-xl border border-ink-border bg-ink text-ink-foreground">
      <div className="relative aspect-[4/3] overflow-hidden">
        <img src={t.photo} alt={`${t.name}, Came Through Audio client`} loading="lazy"
          style={{ objectPosition: t.focus ?? "50% 30%", transform: t.zoom ? `scale(${t.zoom})` : undefined, transformOrigin: t.focus,
            filter: `grayscale(1) contrast(${filter.contrast}%) brightness(${filter.brightness}%)` }}
          className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-primary mix-blend-color" style={{ opacity: filter.tint / 100 }} aria-hidden />
        {/* Solid behind the name, easing to clear by `fade`% up the photo. */}
        <div className="absolute inset-0" aria-hidden
          style={{ background: `linear-gradient(to top, ${ink} 0%, color-mix(in srgb, ${ink} 55%, transparent) ${filter.fade * 0.45}%, transparent ${filter.fade}%)` }} />
        <figcaption className="absolute inset-x-0 bottom-0 p-5">
          <div className="text-xl font-extrabold uppercase tracking-wide">{t.name}</div>
          {t.title && <div className="text-xs text-ink-muted">{t.title}</div>}
          {t.location && <div className="mt-0.5 text-sm font-semibold text-brand-electric">{t.location}</div>}
        </figcaption>
      </div>
      <div className="flex flex-1 flex-col p-5 pt-4">
        <Quote className="h-5 w-5 text-brand-electric" aria-hidden />
        <blockquote className="mt-2 flex-1 leading-relaxed">{t.quote}</blockquote>
        <div className="mt-4 text-xs font-bold uppercase tracking-[2px] text-ink-muted">{t.service}</div>
      </div>
    </figure>
  );
}
