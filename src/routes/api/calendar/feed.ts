import { createFileRoute } from "@tanstack/react-router";
import { resolveAccess } from "@/lib/departments";
import {
  buildCalendarFeedIcs,
  calendarViewer,
  feedWindow,
  visibleCalendarEvents,
  visibleTaskDeadlines,
  type AdminCalendarDeadline,
  type AdminCalendarEvent,
} from "@/lib/admin-calendar";

/**
 * The personal Admin calendar feed (founder spec, 2026-11-19): a read-only .ics URL a staff member subscribes to from
 * Apple Calendar, Google Calendar or Outlook. A calendar app cannot sign in, so the URL's token is the credential.
 *
 * The token is looked up with the service role, then every row is filtered through the same visibility rules the app's
 * RLS uses (src/lib/admin-calendar.ts) — this route must never hand one department's entries to another. An unknown or
 * malformed token answers 404, never a hint that it was close.
 */

const TOKEN = /^[a-f0-9]{48}$/;

const unavailable = (message: string) =>
  new Response(message, { status: 503, headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });

export const Route = createFileRoute("/api/calendar/feed")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const token = (new URL(request.url).searchParams.get("token") ?? "").trim().toLowerCase();
        if (!TOKEN.test(token)) return new Response("Not found", { status: 404, headers: { "X-Robots-Tag": "noindex" } });

        if (!process.env["SUPABASE_URL"] || !process.env["SUPABASE_SERVICE_ROLE_KEY"]) {
          console.error("Calendar feed: Supabase is not configured, so no feed can be built.");
          return unavailable("The calendar feed isn't available right now.");
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: row, error: tokenError } = await supabaseAdmin
          .from("calendar_feed_tokens" as never)
          .select("user_id")
          .eq("token", token)
          .maybeSingle();
        if (tokenError) {
          console.error("Calendar feed: couldn't read the feed token:", tokenError.message);
          return unavailable("The calendar feed isn't available right now.");
        }
        const userId = (row as { user_id?: string } | null)?.user_id;
        if (!userId) return new Response("Not found", { status: 404, headers: { "X-Robots-Tag": "noindex" } });

        const { data: roles, error: roleError } = await supabaseAdmin
          .from("user_roles")
          .select("role, departments")
          .eq("user_id", userId);
        if (roleError) {
          console.error("Calendar feed: couldn't read the owner's roles:", roleError.message);
          return unavailable("The calendar feed isn't available right now.");
        }
        const access = resolveAccess((roles ?? []) as { role: string; departments: string[] | null }[]);
        // A link outlives a role only until its next refresh: someone no longer on staff has nothing to subscribe to.
        if (!access) return new Response("Not found", { status: 404, headers: { "X-Robots-Tag": "noindex" } });

        const viewer = calendarViewer(userId, access);
        const { from, to } = feedWindow();
        // All-day entries are dates, not instants: the subscription's own zone is what keeps them on the right day.
        const timeZone = new URL(request.url).searchParams.get("tz") ?? undefined;

        const [eventsResult, deadlinesResult] = await Promise.all([
          supabaseAdmin
            .from("calendar_events")
            .select("id, owner_id, department, title, notes, starts_at, ends_at, all_day, updated_at")
            .gte("starts_at", from)
            .lte("starts_at", to),
          supabaseAdmin
            .from("department_tasks")
            .select("id, department, title, due_at, status")
            .not("due_at", "is", null)
            .gte("due_at", from)
            .lte("due_at", to),
        ]);
        if (eventsResult.error || deadlinesResult.error) {
          console.error(
            "Calendar feed: couldn't read the calendar:",
            eventsResult.error?.message ?? deadlinesResult.error?.message,
          );
          return unavailable("The calendar feed isn't available right now.");
        }

        const ics = buildCalendarFeedIcs({
          events: visibleCalendarEvents((eventsResult.data ?? []) as AdminCalendarEvent[], viewer),
          deadlines: visibleTaskDeadlines((deadlinesResult.data ?? []) as AdminCalendarDeadline[], viewer),
          now: new Date(),
          origin: new URL(request.url).origin,
          ...(timeZone ? { timeZone } : {}),
        });

        // A read is the only thing this route does; the stamp is best effort and never fails the feed.
        await supabaseAdmin
          .from("calendar_feed_tokens" as never)
          .update({ last_read_at: new Date().toISOString() } as never)
          .eq("user_id", userId);

        return new Response(ics, {
          headers: {
            "Content-Type": "text/calendar; charset=utf-8",
            "Content-Disposition": 'inline; filename="came-through-audio-admin.ics"',
            "Cache-Control": "private, max-age=300",
            "X-Robots-Tag": "noindex",
          },
        });
      },
    },
  },
});
