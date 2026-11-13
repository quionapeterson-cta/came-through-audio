import { beforeEach, describe, expect, it } from "vitest";
import { readFillReleases, rememberFillRelease, withoutCatalog, type FillRelease } from "./fill-releases";

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

  it("remembers a release for the next song, newest first", () => {
    rememberFillRelease("u1", { type: "EP", name: "Afterglow" }, store);
    rememberFillRelease("u1", { type: "Album", name: "BAM" }, store);
    expect(readFillReleases("u1", store)).toEqual([
      { type: "Album", name: "BAM" },
      { type: "EP", name: "Afterglow" },
    ]);
  });

  it("keeps one entry per release, however the title is typed the second time", () => {
    rememberFillRelease("u1", { type: "EP", name: "Afterglow" }, store);
    rememberFillRelease("u1", { type: "EP", name: "  afterglow " }, store);
    expect(readFillReleases("u1", store)).toEqual([{ type: "EP", name: "afterglow" }]);
  });

  it("keeps each account's own list, and drops what the catalog already offers", () => {
    rememberFillRelease("u1", { type: "EP", name: "Afterglow" }, store);
    rememberFillRelease("u2", { type: "Album", name: "Theirs" }, store);
    expect(readFillReleases("u1", store).map((r) => r.name)).toEqual(["Afterglow"]);
    expect(readFillReleases("u2", store).map((r) => r.name)).toEqual(["Theirs"]);
    const kept = withoutCatalog([{ type: "EP", name: "Afterglow" }], [{ album: "afterglow", kind: "EP" }]);
    expect(kept).toEqual([]);
  });

  it("survives a browser that blocks storage", () => {
    const broken: Storage = {
      length: 0,
      clear: () => undefined,
      getItem: () => { throw new Error("blocked"); },
      key: () => null,
      removeItem: () => undefined,
      setItem: () => { throw new Error("blocked"); },
    };
    const typed: FillRelease = { type: "Single", name: "One Off" };
    expect(() => rememberFillRelease("u1", typed, broken)).not.toThrow();
    expect(readFillReleases("u1", broken)).toEqual([]);
  });
});
