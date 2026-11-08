import { createFileRoute } from "@tanstack/react-router";

/**
 * Daily cron endpoint: renewal reminders (90, 60, 30, 7 and 1 day ahead), the 30-day grace period for catalogs whose
 * plan ended, its reminders, and emptying on the date (PLAN-catalog-emptying.md), plus the seats whose paid period has
 * passed. Protected by the same bearer secret as the trial reminders; returns counts only.
 */
export const Route = createFileRoute("/api/public/cron/catalog-lapses")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["CRON_SECRET"];
        const auth = request.headers.get("authorization") ?? "";
        if (!secret || auth !== `Bearer ${secret}`) {
          return new Response("Unauthorized", { status: 401 });
        }
        const { runCatalogLapses, sendRenewalReminders } = await import("@/lib/retention.server");
        const { runStaffOffboarding } = await import("@/lib/staff-offboarding.server");
        const { runSeatEndings } = await import("@/lib/seats.server");
        // Each part runs even if another fails, so a reminder problem never holds up the emptying or the offboarding.
        const [renewals, lapses, offboarding, seats] = await Promise.allSettled([sendRenewalReminders(), runCatalogLapses(), runStaffOffboarding(), runSeatEndings()]);
        const out = (r: PromiseSettledResult<object>) => (r.status === "fulfilled" ? r.value : { error: String(r.reason) });
        return Response.json({ ...out(renewals), ...out(lapses), ...out(offboarding), ...out(seats) });
      },
    },
  },
});
