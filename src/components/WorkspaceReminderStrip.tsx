import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useWorkspaceReminders } from "@/hooks/useWorkspaceReminders";
import { PRIORITY_SHORT, dueText, dueReminders } from "@/lib/workspace-reminders";

/**
 * The full-width reminder strip (founder spec, 2026-11-19). It sits directly under the artist-name header and does not
 * leave until the member chooses one of the three acknowledgments: open, snooze one day, or complete.
 */
export function WorkspaceReminderStrip() {
  const store = useWorkspaceReminders();
  const [index, setIndex] = useState(0);
  const due = useMemo(() => (store ? dueReminders(store.reminders, store.now) : []), [store]);

  useEffect(() => {
    if (index > due.length - 1) setIndex(Math.max(0, due.length - 1));
  }, [due.length, index]);

  if (!store || due.length === 0) return null;

  const at = Math.min(index, due.length - 1);
  const reminder = due[at];
  if (!reminder) return null;

  const open = () => {
    store.complete(reminder.id);
    window.location.assign(reminder.href);
  };

  return (
    <section
      role="region"
      aria-label="Workspace reminders due"
      aria-live="polite"
      data-priority={reminder.priority}
      className="cta-reminder-strip relative -mx-6 mb-6 overflow-hidden border-y-2 px-5 py-3 max-md:-mx-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <span className="cta-reminder-sparkle mt-0.5 text-xl leading-none" aria-hidden="true">💎</span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="cta-reminder-chip">{PRIORITY_SHORT[reminder.priority]}</span>
              <span className="cta-reminder-eyebrow">Workspace reminder</span>
              <span className="cta-reminder-due">{dueText(reminder, store.now)}</span>
            </div>
            <p className="mt-1 truncate text-sm font-bold sm:text-base">{reminder.title}</p>
            {reminder.note && <p className="mt-0.5 line-clamp-1 text-xs opacity-75">{reminder.note}</p>}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {due.length > 1 && (
            <div className="cta-reminder-pager" aria-label={`Reminder ${at + 1} of ${due.length}`}>
              <button type="button" aria-label="Previous reminder" onClick={() => setIndex((i) => (i - 1 + due.length) % due.length)}>
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <span>{at + 1} of {due.length}</span>
              <button type="button" aria-label="Next reminder" onClick={() => setIndex((i) => (i + 1) % due.length)}>
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
          <button type="button" className="cta-reminder-open" onClick={open}>Take Action / Open</button>
          <button type="button" className="cta-reminder-ghost" onClick={() => { store.snooze(reminder.id); setIndex(0); }}>Snooze 1 Day</button>
          <button type="button" className="cta-reminder-ghost" onClick={() => { store.complete(reminder.id); setIndex(0); }}>Mark Complete</button>
        </div>
      </div>
    </section>
  );
}
