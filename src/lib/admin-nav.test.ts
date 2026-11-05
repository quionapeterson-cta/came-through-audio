import { describe, expect, it } from "vitest";
import { groupTabs, tabIcon, tabLabel } from "./admin-nav";

const tab = (value: string) => ({ value, label: value.toUpperCase() });

describe("groupTabs", () => {
  it("groups in the founder's order and drops empty groups", () => {
    const groups = groupTabs([tab("queue"), tab("tasks"), tab("calendar")]);
    expect(groups.map((g) => g.key)).toEqual(["operations"]);
    expect(groups[0]!.tabs.map((t) => t.value)).toEqual(["queue", "tasks", "calendar"]);
  });

  it("places every tab it is given exactly once", () => {
    const values = ["queue", "team", "tasks", "calendar", "support", "scripts", "accounts", "reg", "splits", "purchases", "billing", "badges", "legal", "company", "ai", "pdf", "staff-plan", "handbook", "prices", "recognition", "holiday", "plans", "email", "homepage", "submissions"];
    const groups = groupTabs(values.map(tab));
    const seen = groups.flatMap((g) => g.tabs.map((t) => t.value));
    expect(seen.sort()).toEqual([...values].sort());
    expect(groups.map((g) => g.key)).toEqual(["operations", "roster", "legal", "hr"]);
  });

  it("keeps an unknown tab reachable in a More group instead of hiding it", () => {
    const groups = groupTabs([tab("queue"), tab("brand-new")]);
    expect(groups.at(-1)).toMatchObject({ key: "more", tabs: [{ value: "brand-new", label: "BRAND-NEW" }] });
  });

  it("never invents a tab the caller cannot see", () => {
    expect(groupTabs([])).toEqual([]);
    const groups = groupTabs([tab("hr-only")]);
    expect(groups.flatMap((g) => g.tabs.map((t) => t.value))).toEqual(["hr-only"]);
  });
});

describe("helpers", () => {
  it("reads a label and always returns an icon", () => {
    expect(tabLabel([tab("queue")], "queue")).toBe("QUEUE");
    expect(tabLabel([tab("queue")], "nope")).toBe("Dashboard");
    expect(tabIcon("queue")).toBeTruthy();
    expect(tabIcon("nope")).toBeTruthy();
  });
});
