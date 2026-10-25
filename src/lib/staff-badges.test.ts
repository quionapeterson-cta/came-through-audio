import { describe, expect, it } from "vitest";
import { staffBadges } from "./staff-badges";
import { existsSync } from "node:fs";

describe("staff badges", () => {
  const now = new Date("2026-12-01T00:00:00Z");
  it("earns department badges from completed tasks (first, then every 10) and Welcome/Tenure from the join date", () => {
    const b = staffBadges({ joinedAt: "2026-10-01T00:00:00Z", completed: { support: 11 }, departments: ["support", "registration"], now });
    expect(b.find((x) => x.id === "fast_friend")).toMatchObject({ earned: true, times: 2 });
    expect(b.find((x) => x.id === "first_acceptance")).toMatchObject({ earned: false, times: 0 });
    expect(b.filter((x) => x.collection === "Welcome" && x.earned).map((x) => x.id)).toEqual(["first_day", "first_week", "days_30", "days_60"]);
    expect(b.find((x) => x.id === "year_1")?.earned).toBe(false);
    expect(b.filter((x) => x.later).every((x) => !x.earned)).toBe(true);
  });
  it("only uses art that's in the repo", () => {
    const b = staffBadges({ joinedAt: "2020-01-01T00:00:00Z", completed: {}, departments: ["registration", "royalty_accounts", "finance", "branding", "marketing", "marketing_sales", "support", "ai", "software", "security", "hr"], now });
    expect(b.filter((x) => !existsSync(`public${x.src}`)).map((x) => x.src)).toEqual([]);
  });
});
