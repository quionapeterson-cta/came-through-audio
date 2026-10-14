import { createFileRoute } from "@tanstack/react-router";

/**
 * Daily cron endpoint: emails collaborators whose free trial ends within 5 days,
 * whether or not they sign in. Protected by a bearer secret; returns counts only.
 */
export const Route = createFileRoute("/api/public/cron/trial-reminders")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["CRON_SECRET"];
        const auth = request.headers.get("authorization") ?? "";
        if (!secret || auth !== `Bearer ${secret}`) {
          return new Response("Unauthorized", { status: 401 });
        }
        const origin = new URL(request.url).origin;
        const { sendAllDueTrialReminders } = await import("@/lib/collab-trial.server");
        const result = await sendAllDueTrialReminders(`${origin}/plans`);
        return Response.json(result);
      },
    },
  },
});
