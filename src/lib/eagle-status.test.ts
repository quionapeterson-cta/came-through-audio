import { describe, expect, it } from "vitest";
import { activeMonths, eagleStage, eagleStatus, EAGLE_ART } from "@/lib/eagle-status";

const at = (iso: string) => new Date(iso);

describe("eagle status", () => {
  it("counts whole months of active use", () => {
    expect(activeMonths("2026-01-10T00:00:00Z", at("2026-01-10T00:00:00Z"))).toBe(0);
    expect(activeMonths("2026-01-10T00:00:00Z", at("2026-02-09T00:00:00Z"))).toBe(0);
    expect(activeMonths("2026-01-10T00:00:00Z", at("2026-02-10T00:00:00Z"))).toBe(1);
    expect(activeMonths("2026-01-10T00:00:00Z", at("2026-11-10T00:00:00Z"))).toBe(10);
    expect(activeMonths(null, at("2026-11-10T00:00:00Z"))).toBe(0);
  });

  it("moves through the three eagles at month 4 and month 8", () => {
    expect(eagleStage(0).key).toBe("soar"); // first month
    expect(eagleStage(2).key).toBe("soar");
    expect(eagleStage(3).key).toBe("keep_soaring"); // 4th month
    expect(eagleStage(6).key).toBe("keep_soaring");
    expect(eagleStage(7).key).toBe("highest"); // 8th month
    expect(eagleStage(30).key).toBe("highest");
  });

  it("uses the founder's art by literal path", () => {
    expect(eagleStage(0).art).toBe(EAGLE_ART.soar);
    expect(eagleStage(4).art).toBe(EAGLE_ART.keepSoaring);
    expect(eagleStage(20).art).toBe(EAGLE_ART.highest);
    expect(EAGLE_ART.soar).toContain("/icons/playful/cta-catalog management - eagle- status badges/");
  });

  it("locks the eagle for everyone off Catalog Management", () => {
    const locked = eagleStatus({ onManagement: false, startedAt: "2025-01-01T00:00:00Z" });
    expect(locked.locked).toBe(true);
    expect(locked.art).toBe(EAGLE_ART.disc);
    expect(locked.detail).toMatch(/Catalog Management/);

    const active = eagleStatus({ onManagement: true, startedAt: "2026-01-10T00:00:00Z", now: at("2026-11-10T00:00:00Z") });
    expect(active.locked).toBe(false);
    if (active.locked) throw new Error("unreachable");
    expect(active.months).toBe(10);
    expect(active.stage.key).toBe("highest");
    expect(active.label).toBe("I Soar The Highest");
  });
});
