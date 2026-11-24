import { describe, expect, it } from "vitest";
import { payoutTimeline } from "./financial-lab-payout";

const now = new Date(Date.UTC(2026, 10, 24)); // 24 Nov 2026

describe("payoutTimeline", () => {
  it("dates each payer from the month the streams belong to", () => {
    const rows = payoutTimeline({
      pool: 1000,
      masterShare: 100,
      songShare: 100,
      distributor: 0,
      radio: 40,
      audiomack: 0,
      now,
    });
    expect(rows.map((r) => r.id)).toEqual(["distributor", "pro", "soundexchange"]);
    expect(rows[0]!.when).toBe("as early as Feb 2027");
    // November sits in Q4, whose payments arrive in January.
    expect(rows[1]!.when).toBe("from Jan 2027");
  });

  it("takes the distributor cut off the master side only", () => {
    const rows = payoutTimeline({
      pool: 1000,
      masterShare: 100,
      songShare: 100,
      distributor: 15,
      radio: 0,
      audiomack: 0,
      now,
    });
    expect(rows[0]!.amount).toBeCloseTo(680, 6);
  });

  it("adds Audiomack only when something was entered there", () => {
    const none = payoutTimeline({
      pool: 0,
      masterShare: 100,
      songShare: 100,
      distributor: 0,
      radio: 0,
      audiomack: 0,
      now,
    });
    expect(none.some((r) => r.id === "audiomack")).toBe(false);
    const some = payoutTimeline({
      pool: 0,
      masterShare: 100,
      songShare: 100,
      distributor: 0,
      radio: 0,
      audiomack: 12.5,
      now,
    });
    expect(some.find((r) => r.id === "audiomack")?.when).toBe("as early as Mar 2027");
  });
});
