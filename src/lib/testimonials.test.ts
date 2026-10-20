import { describe, expect, it } from "vitest";
import { cleanFilter, DEFAULT_TESTIMONIAL_FILTER } from "@/lib/testimonials";

describe("testimonial filter", () => {
  it("falls back to the brand default", () => {
    expect(cleanFilter(null)).toEqual(DEFAULT_TESTIMONIAL_FILTER);
    expect(cleanFilter({ brightness: "nope" })).toEqual(DEFAULT_TESTIMONIAL_FILTER);
  });
  it("keeps every setting inside its range, so names stay readable", () => {
    expect(cleanFilter({ brightness: 300, contrast: 10, tint: -5, fade: 12, extra: 1 })).toEqual({ brightness: 120, contrast: 90, tint: 0, fade: 35 });
  });
});
