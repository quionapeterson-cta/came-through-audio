import { createFileRoute } from "@tanstack/react-router";

/** Hourly cron endpoint: Top priority task deadline emails (24 hours and 1 hour before). Same bearer secret as the others. */
export const Route = createFileRoute("/api/public/cron/task-reminders")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["CRON_SECRET"];
        if (!secret || (request.headers.get("authorization") ?? "") !== `Bearer ${secret}`) return new Response("Unauthorized", { status: 401 });
        const { sendDueTaskReminders } = await import("@/lib/task-reminders.server");
        return Response.json(await sendDueTaskReminders());
      },
    },
  },
});
