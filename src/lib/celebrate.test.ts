import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CELEBRATED_KEY, CELEBRATION_INTERVAL_DAYS, maybeCelebrate, shouldCelebrate } from "./celebrate";

function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => { map.set(k, v); },
    removeItem: (k: string) => { map.delete(k); },
    clear: () => map.clear(),
    key: (i: number) => [...map.keys()][i] ?? null,
    get length() { return map.size; },
  } as Storage;
}

describe("the member confetti", () => {
  beforeEach(() => { vi.stubGlobal("localStorage", memoryStorage()); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it("bursts a first time, then waits a week", () => {
    const day = 86400000;
    expect(shouldCelebrate(null)).toBe(true);
    expect(shouldCelebrate("not a date")).toBe(true);
    expect(shouldCelebrate(new Date(Date.now() - 1 * day).toISOString())).toBe(false);
    expect(shouldCelebrate(new Date(Date.now() - (CELEBRATION_INTERVAL_DAYS - 1) * day).toISOString())).toBe(false);
    expect(shouldCelebrate(new Date(Date.now() - CELEBRATION_INTERVAL_DAYS * day).toISOString())).toBe(true);
    expect(shouldCelebrate(new Date(Date.now() - 30 * day).toISOString())).toBe(true);
  });

  it("celebrates once and remembers it, so a reload is quiet", () => {
    expect(maybeCelebrate()).toBe(true);
    expect(localStorage.getItem(CELEBRATED_KEY)).not.toBeNull();
    expect(maybeCelebrate()).toBe(false);
  });

  it("stays quiet when the browser blocks storage, instead of bursting on every load", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => { throw new Error("blocked"); },
      setItem: () => { throw new Error("blocked"); },
    });
    expect(maybeCelebrate()).toBe(false);
  });
});
