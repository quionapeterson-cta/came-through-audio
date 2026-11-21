import { afterEach, describe, expect, it, vi } from "vitest";
import { isPageLoadError, readGateWithRetry } from "./page-load";

afterEach(() => vi.useRealTimers());

describe("page loading recovery", () => {
  it("recognizes Safari fetch and module loading interruptions", () => {
    expect(isPageLoadError(new TypeError("Load failed"))).toBe(true);
    expect(isPageLoadError(new TypeError("Importing a module script failed."))).toBe(true);
    expect(isPageLoadError(new TypeError("Failed to fetch"))).toBe(true);
    expect(isPageLoadError(new TypeError("Cannot read properties of undefined"))).toBe(false);
    expect(isPageLoadError(new Error("Load failed"))).toBe(false);
  });

  it("recovers a transient gate request and preserves the server's locked result", async () => {
    vi.useFakeTimers();
    const read = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("Load failed"))
      .mockResolvedValue({ unlocked: false });
    const result = readGateWithRetry(read);
    await vi.runAllTimersAsync();
    await expect(result).resolves.toEqual({ unlocked: false });
    expect(read).toHaveBeenCalledTimes(2);
  });

  it("stops after repeated network failures without granting access", async () => {
    vi.useFakeTimers();
    const error = new TypeError("Load failed");
    const read = vi.fn().mockRejectedValue(error);
    const result = expect(readGateWithRetry(read)).rejects.toBe(error);
    await vi.runAllTimersAsync();
    await result;
    expect(read).toHaveBeenCalledTimes(3);
  });

  it("does not retry server or programming errors", async () => {
    const error = new Error("Forbidden");
    const read = vi.fn().mockRejectedValue(error);
    await expect(readGateWithRetry(read)).rejects.toBe(error);
    expect(read).toHaveBeenCalledTimes(1);
  });
});
