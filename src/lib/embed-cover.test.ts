import { beforeEach, describe, expect, it } from "vitest";
import { clearEmbedCover, loadEmbedCover, saveEmbedCover } from "@/lib/embed-session";

// This test run has no browser storage; the helpers are what is under test, not the environment.
const store = new Map<string, string>();
Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => { store.set(key, value); },
    removeItem: (key: string) => { store.delete(key); },
    clear: () => store.clear(),
    key: (i: number) => [...store.keys()][i] ?? null,
    get length() { return store.size; },
  },
});

beforeEach(() => store.clear());

describe("the cover kept with an embed draft", () => {
  it("comes back on the next visit, so the preview and the master both have real artwork", () => {
    saveEmbedCover("u1", "data:image/jpeg;base64,AAAA");
    expect(loadEmbedCover("u1")).toBe("data:image/jpeg;base64,AAAA");
  });
  it("is forgotten when the member removes it or starts a new song", () => {
    saveEmbedCover("u1", "data:image/jpeg;base64,AAAA");
    clearEmbedCover("u1");
    expect(loadEmbedCover("u1")).toBeUndefined();
  });
  it("ignores anything that isn't an image, so a corrupt entry never reaches the form", () => {
    saveEmbedCover("u2", "not-an-image");
    expect(loadEmbedCover("u2")).toBeUndefined();
  });
  it("is kept per account, so one member's cover never appears on another's song", () => {
    saveEmbedCover("u1", "data:image/jpeg;base64,AAAA");
    expect(loadEmbedCover("u2")).toBeUndefined();
  });
});
