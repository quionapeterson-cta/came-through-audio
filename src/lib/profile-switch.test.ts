import { beforeAll, describe, expect, it } from "vitest";
import { readWorkingAs, rememberWorkingAs, scopedTier, switchable, workingProfiles, type WorkingProfile } from "./profile-switch";

// The switcher remembers its pick in this browser; node has no storage, so the test brings its own.
beforeAll(() => {
  const store = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => { store.set(k, v); },
      removeItem: (k: string) => { store.delete(k); },
    },
  });
});

const own = { userId: "me", name: "Jordan", tier: "management" as const };
const seats = [
  { userId: "a1", name: "Karma", tier: "plus" as const },
  { userId: "a2", name: "Bo", tier: "collaborate" as const },
  { userId: "a1", name: "Karma again", tier: "plus" as const },
];

describe("working as another artist", () => {
  it("lists the account first, then each seat artist once", () => {
    expect(workingProfiles(own, seats)).toEqual([
      { userId: "me", name: "Jordan", tier: "management", seat: false },
      { userId: "a1", name: "Karma", tier: "plus", seat: true },
      { userId: "a2", name: "Bo", tier: "collaborate", seat: true },
    ]);
  });

  it("never lists the account twice, even if a seat points at it", () => {
    expect(workingProfiles(own, [{ userId: "me", name: "Jordan", tier: "plus" }])).toHaveLength(1);
  });

  it("works at the seat's own tier, and at your own when no seat is selected", () => {
    const list = workingProfiles(own, seats);
    expect(scopedTier(null, "management")).toBe("management");
    expect(scopedTier(list[0]!, "management")).toBe("management");
    // A Plus seat never borrows the owner's Catalog Management tools.
    expect(scopedTier(list[1]!, "management")).toBe("plus");
  });

  it("only offers a seat while it is paid for", () => {
    expect(switchable({ ...own, seat: false })).toBe(true);
    expect(switchable({ ...own, seat: true })).toBe(true);
    expect(switchable({ ...own, seat: true, tier: "free" })).toBe(false);
  });

  it("remembers a pick only for a profile this account may work as", () => {
    const list: WorkingProfile[] = workingProfiles(own, seats);
    rememberWorkingAs("a2");
    expect(readWorkingAs(list)).toBe("a2");
    rememberWorkingAs("someone-else");
    expect(readWorkingAs(list)).toBeNull();
    rememberWorkingAs(null);
    expect(readWorkingAs(list)).toBeNull();
  });
});
