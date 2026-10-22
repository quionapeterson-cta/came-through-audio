import { createFileRoute } from "@tanstack/react-router";

/**
 * Daily cron endpoint: starts the 30-day grace period for catalogs whose plan ended, sends the reminders that are due
 * and empties catalogs on their date (PLAN-catalog-emptying.md). Protected by the same bearer secret as the trial
 * reminders; returns counts only.
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
        const { runCatalogLapses } = await import("@/lib/retention.server");
        return Response.json(await runCatalogLapses());
      },
    },
  },
});
