import {
  Bell,
  CalendarClock,
  Check,
  ExternalLink,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { confirmAction } from "@/components/ConfirmHost";
import { useWorkspaceReminders } from "@/hooks/useWorkspaceReminders";
import {
  DESTINATION_LABEL,
  PRIORITY_SHORT,
  dueText,
  formatReminderDate,
  reminderState,
  type WorkspaceReminder,
} from "@/lib/workspace-reminders";

/**
 * "My Reminders" (founder spec, 2026-11-19): every contextual and custom reminder in one drawer, with edit and delete.
 * It is the list view of the same store the strip and the quiet pills read, so nothing is a second copy.
 */
export function MyRemindersDrawer({
  open,
  onOpenChange,
  onEdit,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (reminder: WorkspaceReminder) => void;
  onCreate: () => void;
}) {
  const store = useWorkspaceReminders();
  if (!store) return null;

  const openReminders = store.reminders
    .filter((r) => !r.completedAt)
    .sort(
      (a, b) =>
        new Date(a.snoozedUntil ?? a.dueAt).getTime() -
        new Date(b.snoozedUntil ?? b.dueAt).getTime(),
    );
  const done = store.reminders
    .filter((r) => r.completedAt)
    .sort((a, b) => new Date(b.completedAt ?? 0).getTime() - new Date(a.completedAt ?? 0).getTime())
    .slice(0, 20);

  async function remove(reminder: WorkspaceReminder) {
    if (!store) return;
    const ok = await confirmAction({
      title: "Delete this reminder?",
      text: "It comes off the strip and out of My Reminders.",
    });
    if (ok) store.remove(reminder.id);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 text-xl">
            <Bell className="h-5 w-5 text-primary" />
            My Reminders
          </SheetTitle>
          <SheetDescription>
            Everything you asked the workspace to bring back — contextual follow-ups and your own
            reminders, all in one list.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-5 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary">
              Active · {openReminders.length}
            </p>
            <Button size="sm" variant="outline" onClick={onCreate}>
              <Plus className="h-3.5 w-3.5" />
              New reminder
            </Button>
          </div>

          {openReminders.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed border-border p-6 text-center">
              <CalendarClock className="mx-auto h-8 w-8 text-primary" />
              <p className="mt-2 text-sm font-semibold">No reminders yet.</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Set one here, or use a “Remind Me” pill beside a song, split sheet, contract or
                blueprint.
              </p>
            </div>
          ) : (
            <ul className="space-y-2">
              {openReminders.map((reminder) => (
                <ReminderRow
                  key={reminder.id}
                  reminder={reminder}
                  now={store.now}
                  onEdit={() => onEdit(reminder)}
                  onOpen={() => {
                    store.complete(reminder.id);
                    window.location.assign(reminder.href);
                  }}
                  onComplete={() => store.complete(reminder.id)}
                  onRemove={() => void remove(reminder)}
                />
              ))}
            </ul>
          )}

          {done.length > 0 && (
            <details className="rounded-xl border border-border">
              <summary className="cursor-pointer px-3 py-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                Completed · {done.length}
              </summary>
              <ul className="space-y-2 px-3 pb-3">
                {done.map((reminder) => (
                  <ReminderRow
                    key={reminder.id}
                    reminder={reminder}
                    now={store.now}
                    done
                    onEdit={() => onEdit(reminder)}
                    onRestore={() => store.restore(reminder.id)}
                    onRemove={() => void remove(reminder)}
                  />
                ))}
              </ul>
            </details>
          )}
        </div>

        <SheetFooter className="mt-5">
          <p className="text-xs text-muted-foreground">
            Reminders stay in your workspace strip until you open, snooze or complete them.
          </p>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function ReminderRow({
  reminder,
  now,
  done = false,
  onEdit,
  onOpen,
  onComplete,
  onRestore,
  onRemove,
}: {
  reminder: WorkspaceReminder;
  now: number;
  done?: boolean;
  onEdit: () => void;
  onOpen?: (() => void) | undefined;
  onComplete?: (() => void) | undefined;
  onRestore?: (() => void) | undefined;
  onRemove: () => void;
}) {
  const state = reminderState(reminder, now);
  const priorityClass =
    reminder.priority === "urgent"
      ? "text-destructive"
      : reminder.priority === "gold"
        ? "text-[#9a7600] dark:text-[#FFD700]"
        : "text-muted-foreground";
  return (
    <li className="rounded-xl border border-border bg-card p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className={`text-sm font-bold ${done ? "line-through opacity-60" : ""}`}>
            {reminder.title}
          </p>
          {reminder.note && (
            <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{reminder.note}</p>
          )}
          <p className="mt-1 text-[11px] text-muted-foreground">
            <span className={`font-bold uppercase tracking-wide ${priorityClass}`}>
              {PRIORITY_SHORT[reminder.priority]}
            </span>
            {" · "}
            {DESTINATION_LABEL[reminder.destination]}
            {" · "}
            {state === "snoozed"
              ? `Snoozed until ${formatReminderDate(reminder.snoozedUntil ?? reminder.dueAt)}`
              : dueText(reminder, now)}
          </p>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {!done && onOpen && (
          <Button
            size="sm"
            variant="outline"
            className="cta-reminder-primary h-7 px-2 text-[11px]"
            onClick={onOpen}
          >
            <ExternalLink className="h-3 w-3" />
            Open
          </Button>
        )}
        <Button size="sm" variant="outline" className="h-7 px-2 text-[11px]" onClick={onEdit}>
          <Pencil className="h-3 w-3" />
          Edit
        </Button>
        {!done && onComplete && (
          <Button size="sm" variant="ghost" className="h-7 px-2 text-[11px]" onClick={onComplete}>
            <Check className="h-3 w-3" />
            Done
          </Button>
        )}
        {done && onRestore && (
          <Button size="sm" variant="ghost" className="h-7 px-2 text-[11px]" onClick={onRestore}>
            <RotateCcw className="h-3 w-3" />
            Restore
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-[11px] text-destructive hover:text-destructive"
          onClick={onRemove}
        >
          <Trash2 className="h-3 w-3" />
          Delete
        </Button>
      </div>
    </li>
  );
}
