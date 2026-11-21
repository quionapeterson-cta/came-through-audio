import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useWorkspaceReminders } from "@/hooks/useWorkspaceReminders";
import { PRIORITY_SHORT, dueText, dueReminders } from "@/lib/workspace-reminders";

/**
 * The reminder banner above every Admin tab (founder spec, 2026-11-19). It reads the one reminder store the workspace
 * strip and the follow-up pills write to, so a staff member's due reminder follows them into Admin and is acknowledged
 * the same way: open it, snooze a day, or mark it done. It is mounted above the tab content rather than inside a tab,
 * so switching tabs never takes it off the screen.
 */
export function GlobalReminderBanner() {
  const store = useWorkspaceReminders();
  const [index, setIndex] = useState(0);
  const due = store ? dueReminders(store.reminders, store.now) : [];

  // Answering the last due reminder shortens the list under the pager, so the index is kept inside it.
  useEffect(() => {
    if (index > due.length - 1) setIndex(Math.max(0, due.length - 1));
  }, [due.length, index]);

  if (!store || due.length === 0) return null;

  const at = Math.min(index, due.length - 1);
  const reminder = due[at];
  if (!reminder) return null;

  return (
    <div className="mx-auto max-w-[100rem] px-4 pt-5 sm:px-6">
      <section
        role="region"
        aria-label="Admin reminders due"
        aria-live="polite"
        data-priority={reminder.priority}
        className="cta-reminder-strip relative overflow-hidden rounded-xl border-2 px-4 py-3 sm:px-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <span className="cta-reminder-sparkle mt-0.5 text-xl leading-none" aria-hidden="true">
              💎
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="cta-reminder-chip">{PRIORITY_SHORT[reminder.priority]}</span>
                <span className="cta-reminder-eyebrow">Admin reminder</span>
                <span className="cta-reminder-due">{dueText(reminder, store.now)}</span>
              </div>
              <p className="mt-1 truncate text-sm font-bold sm:text-base">{reminder.title}</p>
              {reminder.note && (
                <p className="mt-0.5 line-clamp-1 text-xs opacity-75">{reminder.note}</p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {due.length > 1 && (
              <div
                className="cta-reminder-pager"
                aria-label={`Reminder ${at + 1} of ${due.length}`}
              >
                <button
                  type="button"
                  aria-label="Previous reminder"
                  onClick={() => setIndex((i) => (i - 1 + due.length) % due.length)}
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
                <span>
                  {at + 1} of {due.length}
                </span>
                <button
                  type="button"
                  aria-label="Next reminder"
                  onClick={() => setIndex((i) => (i + 1) % due.length)}
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
            <button
              type="button"
              className="cta-reminder-open"
              onClick={() => {
                store.complete(reminder.id);
                window.location.assign(reminder.href);
              }}
            >
              Take Action / Open
            </button>
            <button
              type="button"
              className="cta-reminder-ghost"
              onClick={() => {
                store.snooze(reminder.id);
                setIndex(0);
              }}
            >
              Snooze 1 Day
            </button>
            <button
              type="button"
              className="cta-reminder-ghost"
              onClick={() => {
                store.complete(reminder.id);
                setIndex(0);
              }}
            >
              Mark Done
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
