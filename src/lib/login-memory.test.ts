import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LOGIN_EMAIL_KEY, forgetLoginEmail, lastLoginEmail, rememberLoginEmail } from "./login-memory";

/** The module only touches the three methods it needs, so a Map is enough — no jsdom required. */
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

describe("the remembered login email", () => {
  beforeEach(() => { vi.stubGlobal("localStorage", memoryStorage()); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it("keeps the address normalised, so a phone's capital letters don't pre-fill a different-looking email", () => {
    rememberLoginEmail("  Ada@Example.COM ");
    expect(lastLoginEmail()).toBe("ada@example.com");
    expect(localStorage.getItem(LOGIN_EMAIL_KEY)).toBe("ada@example.com");
  });

  it("ignores an empty address instead of remembering it", () => {
    rememberLoginEmail("   ");
    expect(lastLoginEmail()).toBeNull();
  });

  it("forgets on request", () => {
    rememberLoginEmail("ada@example.com");
    forgetLoginEmail();
    expect(lastLoginEmail()).toBeNull();
  });

  it("never breaks a log-in when the browser blocks storage", () => {
    vi.stubGlobal("localStorage", { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); }, removeItem: () => { throw new Error("blocked"); } });
    expect(() => rememberLoginEmail("ada@example.com")).not.toThrow();
    expect(lastLoginEmail()).toBeNull();
    expect(() => forgetLoginEmail()).not.toThrow();
  });
});
