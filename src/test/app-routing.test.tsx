import { QueryClient } from "@tanstack/react-query";
import { createRouter, isRedirect, rootRouteId } from "@tanstack/react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import { routeTree } from "@/routeTree.gen";
import { Route as RootRoute } from "@/routes/__root";
import { Route as UnlockRoute } from "@/routes/unlock";

const gateStatus = vi.hoisted(() => vi.fn(async () => ({ unlocked: false })));

vi.mock("@/lib/gate.functions", () => ({
  getGateStatus: gateStatus,
  unlockSite: async () => ({ ok: false }),
}));

afterEach(() => {
  vi.useRealTimers();
  gateStatus.mockReset().mockResolvedValue({ unlocked: false });
});

// Match routes without running loaders or rendering: loaders may need a server or
// network the test run lacks, and jsdom never loads the stylesheets React waits on.
describe("App routing", () => {
  it("retries interrupted reads on the passcode page without skipping a locked gate", async () => {
    vi.useFakeTimers();
    gateStatus.mockRejectedValueOnce(new TypeError("Load failed"));
    const beforeLoad = UnlockRoute.options.beforeLoad as unknown as (
      ctx: unknown,
    ) => Promise<unknown>;
    const result = beforeLoad({ search: { next: "/login" } });
    await vi.runAllTimersAsync();
    await expect(result).resolves.toBeUndefined();
    expect(gateStatus).toHaveBeenCalledTimes(2);
  });

  it("matches a page for / instead of falling back to not found", () => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });

    const matches = router.matchRoutes("/");

    expect(matches.at(-1)?.routeId).not.toBe(rootRouteId);
  });

  it("matches /admin/staff to the staff page, not the dashboard", () => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });

    expect(router.matchRoutes("/admin/staff").at(-1)?.routeId).toBe("/admin_/staff");
  });

  it("keeps the workspace and admin pages behind the private-preview gate", async () => {
    const beforeLoad = RootRoute.options.beforeLoad as unknown as (
      ctx: unknown,
    ) => Promise<unknown>;
    for (const path of ["/admin", "/admin/staff", "/workspace", "/profile"]) {
      const err = await beforeLoad({ location: { pathname: path, href: path } }).catch(
        (e: unknown) => e,
      );
      expect(isRedirect(err)).toBe(true);
    }
  });

  it("opens only the pages a payment provider reviews, with signup still locked", async () => {
    const beforeLoad = RootRoute.options.beforeLoad as unknown as (
      ctx: unknown,
    ) => Promise<unknown>;
    for (const path of [
      "/",
      "/plans",
      "/contact",
      "/contact-us",
      "/terms-of-service",
      "/privacy-policy",
      "/refund-policy",
    ]) {
      await expect(beforeLoad({ location: { pathname: path, href: path } })).resolves.toEqual({
        siteLocked: true,
      });
    }
  });
});
