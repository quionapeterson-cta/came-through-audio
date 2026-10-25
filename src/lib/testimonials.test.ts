import { describe, expect, it } from "vitest";
import { cleanFilter, cleanTestimonials, DEFAULT_TESTIMONIAL_FILTER, TESTIMONIAL_LIMITS, testimonialProblems } from "@/lib/testimonials";

describe("testimonial filter", () => {
  it("falls back to the brand default", () => {
    expect(cleanFilter(null)).toEqual(DEFAULT_TESTIMONIAL_FILTER);
    expect(cleanFilter({ brightness: "nope" })).toEqual(DEFAULT_TESTIMONIAL_FILTER);
  });
  it("keeps every setting inside its range, so names stay readable", () => {
    expect(cleanFilter({ brightness: 300, contrast: 10, tint: -5, fade: 12, extra: 1 })).toEqual({ brightness: 120, contrast: 90, tint: 0, fade: 35 });
  });
});

describe("testimonials editor rules", () => {
  const ok = { id: "a", name: "Biggz", service: "Royalty Account Setups", quote: "They got me right.", photo: "https://x.supabase.co/storage/v1/object/public/site-media/testimonials/a.jpg", releaseSignedOn: "2026-10-20", published: true };
  it("publishes only cards with a photo, quote, service and a signed release date", () => {
    expect(cleanTestimonials([ok])[0]!.published).toBe(true);
    expect(cleanTestimonials([{ ...ok, releaseSignedOn: "" }])[0]!.published).toBe(false);
    expect(testimonialProblems({ ...cleanTestimonials([ok])[0]!, photo: "" })).toContain("Add a photo.");
  });
  it("keeps text inside the card limits and drops unsafe photo links", () => {
    const t = cleanTestimonials([{ ...ok, quote: "x".repeat(500), photo: "javascript:alert(1)", zoom: 9, focus: "evil" }])[0]!;
    expect(t.quote).toHaveLength(TESTIMONIAL_LIMITS.quote);
    expect(t.photo).toBe("");
    expect(t.zoom).toBe(1.6);
    expect(t.focus).toBe("50% 30%");
  });
});
