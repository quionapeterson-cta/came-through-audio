import { describe, expect, it } from "vitest";
import { easternDay, easternMoment } from "./eastern-time";

describe("easternDay", () => {
  it("keeps a late-evening signature on its own Eastern day", () => {
    // The internship packet James Weaver signed: 7:28 pm and 8:28 pm Eastern on 16 November, which UTC calls the 17th.
    expect(easternDay("2026-11-17T00:28:17.632Z")).toBe("16 November 2026");
    expect(easternDay("2026-11-17T01:28:58.321Z")).toBe("16 November 2026");
  });

  it("moves to the next day at Eastern midnight, not UTC midnight", () => {
    expect(easternDay("2026-11-17T04:59:59Z")).toBe("16 November 2026");
    expect(easternDay("2026-11-17T05:00:00Z")).toBe("17 November 2026");
  });

  it("reads a summer moment on daylight time", () => {
    expect(easternDay("2026-07-04T02:30:00Z")).toBe("3 July 2026");
  });
});

describe("easternMoment", () => {
  it("prints the Eastern clock time and names the zone", () => {
    expect(easternMoment("2026-11-17T00:28:17.632Z")).toBe("16 November 2026 at 19:28 ET");
    expect(easternMoment("2026-07-04T02:30:00Z")).toBe("3 July 2026 at 22:30 ET");
  });
});
