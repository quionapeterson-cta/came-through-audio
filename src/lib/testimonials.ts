/**
 * Homepage testimonials. Quotes are the client's own words, trimmed for length (… marks a cut); never reword them.
 * Every person here must have a signed Photo, Video & Testimonial Release before their entry goes live.
 *
 * To add one: upload the photo in Lovable (it lands in public/testimonials/*.asset.json), copy its `url` here,
 * and set `focus` (CSS object-position) so the face sits in the wide frame. The shared filter
 * (TestimonialFilter, set in Admin → Homepage) makes every photo match, whatever its original colors.
 */
export type Testimonial = {
  name: string;
  /** Optional role line, e.g. "CEO & Founder, Hustlin 4 A Livin Ent, LLC". */
  title?: string;
  location?: string;
  service: string;
  quote: string;
  photo: string;
  /** CSS object-position for the wide crop; portrait photos need a face-height value like "50% 35%". */
  focus?: string;
  /** Zoom into the focus point for full-body shots where the person is small in the frame (1 = no zoom). */
  zoom?: number;
};

export const TESTIMONIALS: Testimonial[] = [
  {
    name: "Biggz",
    location: "Atlanta, GA",
    service: "Royalty Account Setups",
    quote: "Before Came Through Audio, I didn't know nothin' about no MLC, no SoundExchange, no ASCAP… but they got me right. Now I have all my accounts properly set up. I'm ready for that bag, feel me?",
    photo: "/__l5e/assets-v1/b55301ad-f2b6-469f-bd27-38d2475d27e1/biggz.jpg",
    focus: "50% 30%",
  },
  {
    name: "HU$TLEMANN THE O.G.",
    title: "CEO & Founder, Hustlin 4 A Livin Ent, LLC",
    location: "Dallas born, LA livin'",
    service: "Branding Power Sessions",
    quote: "My Branding Power Session allowed me to build my Blueprint and Branding Guidelines. They helped me gain greater clarity, strengthen my brand identity, and establish a more consistent and professional presence in the entertainment industry.",
    photo: "/__l5e/assets-v1/336276e6-b655-4ca5-a1ad-90789826b4d0/hustlemann.jpg",
    focus: "50% 12%",
  },
  {
    name: "Lil Flippa",
    location: "Atlanta, GA",
    service: "Branding Power Sessions",
    quote: "They came up with a perfect blueprint that fits my artistry all around… Most definitely one of the best services ever offered to me as an independent musician.",
    photo: "/__l5e/assets-v1/15f77a5a-bb9b-4320-8e54-fe5b49395247/lil-flippa.jpg",
    focus: "47% 22%",
    // Kept low: browser zoom stretches pixels, and 1.6 made this photo look grainy.
    zoom: 1.25,
  },
];

/**
 * The one brand filter every testimonial photo gets: black-and-white, then these four settings, the same for every card.
 * Marketing & Social Media and Branding adjust it in Admin → Homepage; the ranges keep names readable and the look on brand.
 */
export type TestimonialFilter = {
  /** Photo brightness, % (100 = as shot). */
  brightness: number;
  /** Photo contrast, % (100 = as shot). Higher values show more grain. */
  contrast: number;
  /** Strength of the Cobalt Blue tint, %. */
  tint: number;
  /** How far up the photo the dark fade behind the name reaches, % of its height. */
  fade: number;
};

export const FILTER_RANGES: Record<keyof TestimonialFilter, { min: number; max: number; label: string }> = {
  brightness: { min: 80, max: 120, label: "Brightness" },
  contrast: { min: 90, max: 130, label: "Contrast" },
  tint: { min: 0, max: 80, label: "Cobalt tint" },
  fade: { min: 35, max: 100, label: "Dark fade height" },
};

export const DEFAULT_TESTIMONIAL_FILTER: TestimonialFilter = { brightness: 100, contrast: 110, tint: 50, fade: 60 };

/** Any saved value, kept inside its range; missing or broken values fall back to the default. */
export function cleanFilter(v: unknown): TestimonialFilter {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const out = { ...DEFAULT_TESTIMONIAL_FILTER };
  for (const k of Object.keys(FILTER_RANGES) as (keyof TestimonialFilter)[]) {
    const n = Number(o[k]);
    if (Number.isFinite(n)) out[k] = Math.round(Math.min(FILTER_RANGES[k].max, Math.max(FILTER_RANGES[k].min, n)));
  }
  return out;
}

/** Limits that keep every card the same shape on the homepage (same fonts and sizes, no overflowing text). */
export const TESTIMONIAL_LIMITS = { name: 40, title: 70, location: 40, service: 40, quote: 320 } as const;
export const ZOOM_RANGE = { min: 1, max: 1.6 } as const;

/** A testimonial as Marketing edits it in Admin → Homepage: published only with a signed release date. */
export type EditableTestimonial = Testimonial & { id: string; published: boolean; releaseSignedOn: string };

/** What blocks publishing a card, in plain words; empty when it's ready. */
export function testimonialProblems(t: EditableTestimonial): string[] {
  const out: string[] = [];
  if (!t.name.trim()) out.push("Add the person's name.");
  if (!t.quote.trim()) out.push("Add their quote.");
  if (!t.service.trim()) out.push("Add the service it's about.");
  if (!t.photo) out.push("Add a photo.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t.releaseSignedOn)) out.push("Enter the date their Photo, Video & Testimonial Release was signed.");
  for (const k of Object.keys(TESTIMONIAL_LIMITS) as (keyof typeof TESTIMONIAL_LIMITS)[]) {
    if ((t[k] ?? "").length > TESTIMONIAL_LIMITS[k]) out.push(`Shorten the ${k} to ${TESTIMONIAL_LIMITS[k]} characters.`);
  }
  return out;
}

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
/** Saved testimonials, cleaned: limits applied, safe photo URLs only, focus/zoom in range. Published only if ready. */
export function cleanTestimonials(v: unknown): EditableTestimonial[] {
  const list = Array.isArray(v) ? v.slice(0, 12) : [];
  return list.map((raw, i): EditableTestimonial => {
    const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
    const photo = typeof o["photo"] === "string" && /^(https:\/\/|\/)[^\s"'<>]+$/.test(o["photo"]) ? o["photo"] : "";
    const focus = typeof o["focus"] === "string" && /^\d{1,3}% \d{1,3}%$/.test(o["focus"]) ? o["focus"] : "50% 30%";
    const zoom = Math.min(ZOOM_RANGE.max, Math.max(ZOOM_RANGE.min, Number(o["zoom"]) || 1));
    const t: EditableTestimonial = {
      id: str(o["id"], 40) || `t${i}`, name: str(o["name"], TESTIMONIAL_LIMITS.name), title: str(o["title"], TESTIMONIAL_LIMITS.title),
      location: str(o["location"], TESTIMONIAL_LIMITS.location), service: str(o["service"], TESTIMONIAL_LIMITS.service),
      quote: str(o["quote"], TESTIMONIAL_LIMITS.quote), photo, focus, zoom, releaseSignedOn: str(o["releaseSignedOn"], 10), published: o["published"] === true,
    };
    return { ...t, published: t.published && testimonialProblems(t).length === 0 };
  });
}

/** The current file entries as editable cards (their releases are signed; date recorded as the editor's start). */
export const SEED_TESTIMONIALS: EditableTestimonial[] = TESTIMONIALS.map((t, i) => ({ ...t, id: `seed${i}`, published: true, releaseSignedOn: "2026-10-20" }));
