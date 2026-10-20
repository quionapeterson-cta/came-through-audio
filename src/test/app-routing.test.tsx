import { QueryClient } from "@tanstack/react-query";
import { createRouter, isRedirect, rootRouteId } from "@tanstack/react-router";
import { describe, expect, it, vi } from "vitest";

import { routeTree } from "@/routeTree.gen";
import { Route as RootRoute } from "@/routes/__root";

vi.mock("@/lib/gate.functions", () => ({ getGateStatus: async () => ({ unlocked: false }), unlockSite: async () => ({ ok: false }) }));

// Match routes without running loaders or rendering: loaders may need a server or
// network the test run lacks, and jsdom never loads the stylesheets React waits on.
describe("App routing", () => {
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
    const beforeLoad = RootRoute.options.beforeLoad as unknown as (ctx: unknown) => Promise<unknown>;
    for (const path of ["/admin", "/admin/staff", "/workspace", "/profile"]) {
      const err = await beforeLoad({ location: { pathname: path, href: path } }).catch((e: unknown) => e);
      expect(isRedirect(err)).toBe(true);
    }
  });

  it("opens only the pages a payment provider reviews, with signup still locked", async () => {
    const beforeLoad = RootRoute.options.beforeLoad as unknown as (ctx: unknown) => Promise<unknown>;
    for (const path of ["/", "/plans", "/contact", "/terms-of-service", "/privacy-policy", "/refund-policy"]) {
      await expect(beforeLoad({ location: { pathname: path, href: path } })).resolves.toEqual({ siteLocked: true });
    }
  });
});
