import { describe, expect, it } from "vitest";
import {
  MAX_SCENARIOS,
  emptyLabNumbers,
  labStorageKey,
  removeScenario,
  sanitizeNumbers,
  sanitizeStore,
  saveScenario,
} from "./financial-lab-scenario";

describe("lab storage key", () => {
  it("names the member, the song and the tool", () => {
    expect(labStorageKey("u1", "song-2", "royalty")).toBe("cta.lab.v1.u1.song-2.royalty");
    expect(labStorageKey(undefined, "", "merch")).toBe("cta.lab.v1.anon.manual.merch");
  });
});

describe("sanitizeNumbers", () => {
  it("opens on the platform defaults when nothing is stored", () => {
    const n = sanitizeNumbers(null);
    expect(n.distributor).toBe("0");
    expect(n.streams["spotify"]).toBe("0");
    expect(n.rates["audiomack"]).toBe("0.004");
  });

  it("clamps the distributor cut and keeps typed digits", () => {
    expect(sanitizeNumbers({ distributor: 140 }).distributor).toBe("100");
    expect(sanitizeNumbers({ distributor: -5 }).distributor).toBe("0");
    expect(sanitizeNumbers({ streams: { spotify: "1,250" } }).streams["spotify"]).toBe("1250");
  });

  it("drops territory entries it cannot read", () => {
    const n = sanitizeNumbers({ territories: { spotify: { on: true, us: "60" } } });
    expect(n.territories["spotify"]).toEqual({ on: true, us: "60", uk: "0", ng: "0", row: "0" });
  });
});

describe("scenarios", () => {
  const store = sanitizeStore(null);

  it("saves one, and replaces a setup saved under the same name", () => {
    const first = saveScenario(store, "Album cycle", emptyLabNumbers(), 100);
    const again = saveScenario(first, "album CYCLE", emptyLabNumbers(), 200);
    expect(again.scenarios).toHaveLength(1);
    expect(again.scenarios[0]!.total).toBe(200);
  });

  it("refuses an unnamed setup", () => {
    expect(saveScenario(store, "   ", emptyLabNumbers(), 10).scenarios).toHaveLength(0);
  });

  it("keeps the newest ten and can remove one", () => {
    let s = store;
    for (let i = 0; i < MAX_SCENARIOS + 3; i++)
      s = saveScenario(s, `Run ${i}`, emptyLabNumbers(), i);
    expect(s.scenarios).toHaveLength(MAX_SCENARIOS);
    expect(s.scenarios.at(-1)!.name).toBe("Run 12");
    const removed = removeScenario(s, s.scenarios[0]!.id);
    expect(removed.scenarios).toHaveLength(MAX_SCENARIOS - 1);
  });
});
