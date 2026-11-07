import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { celebrateReturn, isReturning, LAST_SEEN_KEY, RETURN_AFTER_DAYS } from "./celebrate";

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

describe("the welcome confetti", () => {
  beforeEach(() => { vi.stubGlobal("localStorage", memoryStorage()); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it("only counts a gap of 30 days or more as a return", () => {
    const day = 86400000;
    expect(RETURN_AFTER_DAYS).toBe(30);
    expect(isReturning(null)).toBe(false);
    expect(isReturning("not a date")).toBe(false);
    expect(isReturning(new Date(Date.now() - 1 * day).toISOString())).toBe(false);
    expect(isReturning(new Date(Date.now() - (RETURN_AFTER_DAYS - 1) * day).toISOString())).toBe(false);
    expect(isReturning(new Date(Date.now() - RETURN_AFTER_DAYS * day).toISOString())).toBe(true);
  });

  it("stays quiet on a first visit and on any visit inside 30 days", () => {
    expect(celebrateReturn()).toBe(false);
    expect(localStorage.getItem(LAST_SEEN_KEY)).not.toBeNull();
    expect(celebrateReturn()).toBe(false);
  });

  it("bursts once after a 30-day gap, then records the visit so the next one is quiet", () => {
    const now = new Date();
    localStorage.setItem(LAST_SEEN_KEY, new Date(now.getTime() - 31 * 86400000).toISOString());
    expect(celebrateReturn(now)).toBe(true);
    expect(celebrateReturn(new Date(now.getTime() + 1000))).toBe(false);
  });

  it("moves the visit forward even when it does not burst", () => {
    const now = new Date();
    localStorage.setItem(LAST_SEEN_KEY, new Date(now.getTime() - 20 * 86400000).toISOString());
    celebrateReturn(now);
    expect(Date.parse(localStorage.getItem(LAST_SEEN_KEY)!)).toBe(now.getTime());
  });

  it("stays quiet when the browser blocks storage, instead of bursting on every load", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => { throw new Error("blocked"); },
      setItem: () => { throw new Error("blocked"); },
    });
    expect(celebrateReturn()).toBe(false);
  });
});
