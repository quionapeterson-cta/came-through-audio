import { createFileRoute } from "@tanstack/react-router";

/**
 * Daily cron endpoint: reminds Expert Assistance customers whose songs still need details, 3 days after payment and
 * then weekly, until every song is ready, and sends the release-day note for songs released today. Protected by the same bearer secret as trial reminders; returns counts only.
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
        const [{ sendDueRegistrationReminders }, { sendReleaseDayEmails }] = await Promise.all([import("@/lib/registration.server"), import("@/lib/release-day.server")]);
        // Also the release-day note for songs whose release date is today (pre-distribution, 2026-10-25).
        const [reminders, releaseDay] = await Promise.all([sendDueRegistrationReminders(), sendReleaseDayEmails().catch((e) => { console.error("Release-day emails failed:", e); return { released: 0, sent: 0 }; })]);
        return Response.json({ ...reminders, releaseDay });
      },
    },
  },
});
