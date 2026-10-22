import { createFileRoute } from "@tanstack/react-router";

/**
 * Daily cron endpoint: reminds Expert Assistance customers whose songs still need details, 3 days after payment and
 * then weekly, until every song is ready. Protected by the same bearer secret as trial reminders; returns counts only.
 */
export const Route = createFileRoute("/api/public/cron/registration-reminders")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["CRON_SECRET"];
        const auth = request.headers.get("authorization") ?? "";
        if (!secret || auth !== `Bearer ${secret}`) {
          return new Response("Unauthorized", { status: 401 });
        }
        const { sendDueRegistrationReminders } = await import("@/lib/registration.server");
        return Response.json(await sendDueRegistrationReminders());
      },
    },
  },
});
