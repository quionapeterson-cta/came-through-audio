import { describe, expect, it } from "vitest";
import { mergePlans, planFromDoc, planHeading, planSlug, type CompanyPlan } from "./company-plans";

const plan = (over: Partial<CompanyPlan>): CompanyPlan => ({
  slug: "plan-x",
  title: "X",
  status: "",
  body: "# X",
  file: "PLAN-x.md",
  updated_at: null,
  ...over,
});

describe("planSlug", () => {
  it("matches the slug the SQL loader writes", () => {
    expect(planSlug("PLAN-blog.md")).toBe("plan-blog");
    expect(planSlug("PLAN.md")).toBe("plan");
    expect(planSlug("PLAN-Tax-Writeoff.md")).toBe("plan-tax-writeoff");
  });

  it("ignores a directory in the glob key", () => {
    expect(planSlug("../../PLAN-operations.md")).toBe("plan-operations");
    expect(planSlug("..\\..\\PLAN-operations.md")).toBe("plan-operations");
  });
});

describe("planHeading", () => {
  it("reads the title the loader reads, without the PLAN prefix or version", () => {
    expect(
      planHeading(
        "# PLAN — Company Operations: Finance, Departments · v1\n\nStatus: **awaiting approval.**",
        "plan-operations",
      ),
    ).toEqual({ title: "Company Operations: Finance, Departments", status: "awaiting approval." });
  });

  it("keeps a plain heading whole", () => {
    expect(planHeading("# The artist tax write-off worksheet (Financial Lab)\n", "plan-tax")).toEqual({
      title: "The artist tax write-off worksheet (Financial Lab)",
      status: "",
    });
  });

  it("falls back to the slug when there is no heading", () => {
    expect(planHeading("no heading here", "plan-bare")).toEqual({
      title: "plan-bare",
      status: "",
    });
  });

  it("only reads a Status line at the start of a line", () => {
    expect(planHeading("# A\n\nStatus: **draft**\nStatuses: not this one", "plan-a").status).toBe(
      "draft",
    );
  });
});

describe("planFromDoc", () => {
  it("records the file it came from", () => {
    const p = planFromDoc("../../PLAN-blog.md", "# Blog\n\nStatus: live");
    expect(p).toMatchObject({ slug: "plan-blog", title: "Blog", status: "live", file: "PLAN-blog.md" });
  });
});

describe("mergePlans", () => {
  it("prefers the repository text for a slug in both", () => {
    const repo = [plan({ slug: "plan-a", title: "A", body: "# fresh" })];
    const stored = [plan({ slug: "plan-a", title: "A old", body: "# stale", file: null, updated_at: "2026-10-25T00:00:00Z" })];
    expect(mergePlans(repo, stored)).toEqual([
      expect.objectContaining({ slug: "plan-a", body: "# fresh", updated_at: "2026-10-25T00:00:00Z" }),
    ]);
  });

  it("keeps a row the repository does not have", () => {
    const merged = mergePlans([plan({ slug: "plan-a", title: "A" })], [
      plan({ slug: "plan-b", title: "B", file: null, body: "# stored" }),
    ]);
    expect(merged.map((p) => p.slug)).toEqual(["plan-a", "plan-b"]);
    expect(merged[1]).toMatchObject({ file: null, body: "# stored" });
  });

  it("sorts by title, whatever order the two sources arrive in", () => {
    const merged = mergePlans(
      [plan({ slug: "plan-z", title: "Zebra" })],
      [plan({ slug: "plan-a", title: "Apple", file: null })],
    );
    expect(merged.map((p) => p.title)).toEqual(["Apple", "Zebra"]);
  });

  it("shows each slug once", () => {
    const merged = mergePlans([plan({ slug: "plan-a" })], [plan({ slug: "plan-a", file: null })]);
    expect(merged).toHaveLength(1);
  });
});
