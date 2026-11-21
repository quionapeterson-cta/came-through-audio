import { describe, expect, it, vi } from "vitest";
import { closePauseSafely, vaultStopped } from "./pause-close";

const ok = () => Promise.resolve();
const active = () => Promise.resolve("active");

describe("closing a pause's Vault subscription", () => {
  it("ends the pause only once Stripe confirms the charge is stopped", async () => {
    const end = vi.fn(ok);
    const alert = vi.fn(ok);
    expect(await closePauseSafely({ cancel: ok, status: active, alert, end }, "sub_vault")).toBe(true);
    expect(end).toHaveBeenCalledOnce();
    expect(alert).not.toHaveBeenCalled();
  });

  it("leaves the pause open and alerts staff when Stripe refuses", async () => {
    const end = vi.fn(ok);
    const alert = vi.fn(ok);
    const result = await closePauseSafely({
      cancel: () => Promise.reject(new Error("Stripe is unreachable")),
      status: active,
      alert,
      end,
    }, "sub_vault");
    // False means the row is not ended: the $1.99 charge stays visible and the daily pass / next attempt retries it.
    expect(result).toBe(false);
    expect(end).not.toHaveBeenCalled();
    expect(alert).toHaveBeenCalledOnce();
  });

  it("treats a subscription Stripe already reports cancelled as stopped, so a retry finishes", async () => {
    const end = vi.fn(ok);
    const alert = vi.fn(ok);
    const result = await closePauseSafely({
      cancel: () => Promise.reject(new Error("This subscription has already been canceled.")),
      status: () => Promise.resolve("canceled"),
      alert,
      end,
    }, "sub_vault");
    expect(result).toBe(true);
    expect(end).toHaveBeenCalledOnce();
    expect(alert).not.toHaveBeenCalled();
  });

  it("alerts instead of closing when even the read-back fails", async () => {
    const end = vi.fn(ok);
    const alert = vi.fn(ok);
    expect(await closePauseSafely({
      cancel: () => Promise.reject(new Error("rate limited")),
      status: () => Promise.reject(new Error("rate limited")),
      alert,
      end,
    }, "sub_vault")).toBe(false);
    expect(end).not.toHaveBeenCalled();
    expect(alert).toHaveBeenCalledOnce();
  });

  it("closes a pause that never had a Vault subscription without asking Stripe", async () => {
    const cancel = vi.fn(ok);
    const end = vi.fn(ok);
    expect(await closePauseSafely({ cancel, status: active, alert: vi.fn(ok), end }, null)).toBe(true);
    expect(cancel).not.toHaveBeenCalled();
    expect(end).toHaveBeenCalledOnce();
  });

  it("reports the stop itself, without needing the close wrapper", async () => {
    expect(await vaultStopped({ cancel: ok, status: active, alert: vi.fn(ok) })).toBe(true);
    expect(await vaultStopped({ cancel: () => Promise.reject(new Error("no")), status: active, alert: vi.fn(ok) })).toBe(false);
  });
});
