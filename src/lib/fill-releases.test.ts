import { beforeEach, describe, expect, it } from "vitest";
import { cacheReleases, mergeRelease, readCachedReleases, releaseKey, withoutCatalog, type FillRelease } from "./fill-releases";

class Memory implements Storage {
  private map = new Map<string, string>();
  get length() { return this.map.size; }
  clear() { this.map.clear(); }
  getItem(k: string) { return this.map.get(k) ?? null; }
  key(i: number) { return [...this.map.keys()][i] ?? null; }
  removeItem(k: string) { this.map.delete(k); }
  setItem(k: string, v: string) { this.map.set(k, v); }
}

describe("releases typed by hand in the fill dialog", () => {
  let store: Memory;
  beforeEach(() => { store = new Memory(); });

  it("puts a new release first and keeps one entry per kind and title", () => {
    let list: FillRelease[] = [];
    list = mergeRelease(list, { type: "EP", name: "Afterglow" });
    list = mergeRelease(list, { type: "Album", name: "BAM" });
    expect(list).toEqual([
      { type: "Album", name: "BAM" },
      { type: "EP", name: "Afterglow" },
    ]);
    // The same release typed again replaces its entry, whatever the spelling, and keeps its place at the front.
    list = mergeRelease(list, { id: "r1", type: "EP", name: "  afterglow " });
    expect(list).toEqual([
      { id: "r1", type: "EP", name: "afterglow" },
      { type: "Album", name: "BAM" },
    ]);
    expect(releaseKey({ type: "EP", name: " AFterglow " })).toBe(releaseKey({ type: "EP", name: "afterglow" }));
  });

  it("keeps a different kind of the same title apart, and never keeps an unnamed release", () => {
    let list = mergeRelease([], { type: "EP", name: "Afterglow" });
    list = mergeRelease(list, { type: "Album", name: "Afterglow" });
    expect(list).toHaveLength(2);
    expect(mergeRelease(list, { type: "EP", name: "   " })).toBe(list);
  });

  it("drops a remembered title the catalog now offers", () => {
    expect(withoutCatalog([{ type: "EP", name: "Afterglow" }], [{ album: "afterglow", kind: "EP" }])).toEqual([]);
    expect(withoutCatalog([{ type: "EP", name: "Afterglow" }], [{ album: "Afterglow", kind: "Album" }])).toHaveLength(1);
  });

  it("keeps a browser copy per account, and survives a browser that blocks storage", () => {
    cacheReleases("u1", [{ type: "EP", name: "Afterglow" }], store);
    cacheReleases("u2", [{ type: "Album", name: "Theirs" }], store);
    expect(readCachedReleases("u1", store)).toEqual([{ type: "EP", name: "Afterglow" }]);
    expect(readCachedReleases("u2", store)).toEqual([{ type: "Album", name: "Theirs" }]);
    const broken: Storage = {
      length: 0,
      clear: () => undefined,
      getItem: () => { throw new Error("blocked"); },
      key: () => null,
      removeItem: () => undefined,
      setItem: () => { throw new Error("blocked"); },
    };
    expect(() => cacheReleases("u1", [{ type: "EP", name: "Afterglow" }], broken)).not.toThrow();
    expect(readCachedReleases("u1", broken)).toEqual([]);
  });
});
