import { createFileRoute } from "@tanstack/react-router";

/**
 * Daily cron endpoint: renewal reminders (90, 60, 30, 7 and 1 day ahead), keeping ended plans read-only on Free, the
 * two-year inactivity deadline (stored files, proof videos and catalog, and the account when it never came back), its
 * notices, staff offboarding, and the seats whose paid period has passed. Protected
 * by the same bearer secret as the trial reminders; returns counts only.
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
        const { runInactiveAccounts } = await import("@/lib/inactivity.server");
        // Each part runs even if another fails, so a reminder problem never holds up the offboarding or a deletion.
        const [renewals, lapses, offboarding, seats, inactivity] = await Promise.allSettled([sendRenewalReminders(), runCatalogLapses(), runStaffOffboarding(), runSeatEndings(), runInactiveAccounts()]);
        const out = (r: PromiseSettledResult<object>) => (r.status === "fulfilled" ? r.value : { error: String(r.reason) });
        return Response.json({ ...out(renewals), ...out(lapses), ...out(offboarding), ...out(seats), ...out(inactivity) });
      },
    },
  },
});
