import { useEffect, useState } from "react";
import { CalendarPlus, Clock, Gem, Sparkles, Zap } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useWorkspaceReminders } from "@/hooks/useWorkspaceReminders";
import {
  CONTEXT_DESTINATION,
  CONTEXT_LABEL,
  DESTINATIONS,
  PRIORITY_LABEL,
  atDaysFromNow,
  buildHref,
  contextKeyFor,
  type CalendarTarget,
  type ReminderContextType,
  type ReminderDestination,
  type ReminderPriority,
  type WorkspaceReminder,
} from "@/lib/workspace-reminders";
import { exportReminderToCalendar } from "@/utils/calendarExport";

export interface ReminderDefaults {
  title?: string | undefined;
  note?: string | undefined;
  dueAt?: string | undefined;
  destination?: ReminderDestination | undefined;
  contextType?: ReminderContextType | undefined;
  contextId?: string | undefined;
  songId?: string | undefined;
  sheetId?: string | undefined;
  contractId?: string | undefined;
  blueprintId?: string | undefined;
  stepId?: string | undefined;
  focusField?: string | undefined;
  subject?: string | undefined;
}

type CalendarChoice = CalendarTarget | "none";

const PRIORITY_ICON = { standard: Clock, gold: Gem, urgent: Zap } as const;

function dateValue(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function timeValue(date: Date): string {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

const QUICK_DATES: { label: string; days: number }[] = [
  { label: "Tomorrow 10 AM", days: 1 },
  { label: "In 3 Days", days: 3 },
  { label: "Next Week", days: 7 },
];

export function CustomWorkspaceReminderModal({
  open,
  onOpenChange,
  editing = null,
  defaults,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing?: WorkspaceReminder | null;
  defaults?: ReminderDefaults | null;
  onSaved?: ((reminder: WorkspaceReminder) => void) | undefined;
}) {
  const store = useWorkspaceReminders();
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [destination, setDestination] = useState<ReminderDestination>("general");
  const [priority, setPriority] = useState<ReminderPriority>("standard");
  const [date, setDate] = useState(dateValue(new Date()));
  const [time, setTime] = useState("10:00");
  const [calendar, setCalendar] = useState<CalendarChoice>("none");

  useEffect(() => {
    if (!open) return;
    const sourceDate = editing
      ? new Date(editing.dueAt)
      : defaults?.dueAt
        ? new Date(defaults.dueAt)
        : new Date(atDaysFromNow(1, 10));
    const safeDate = Number.isNaN(sourceDate.getTime())
      ? new Date(atDaysFromNow(1, 10))
      : sourceDate;
    setTitle(editing?.title ?? defaults?.title ?? "");
    setNote(
      editing?.note ?? defaults?.note ?? (defaults?.subject ? `For ${defaults.subject}.` : ""),
    );
    setDestination(
      editing?.destination ??
        defaults?.destination ??
        CONTEXT_DESTINATION[defaults?.contextType ?? "custom"],
    );
    setPriority(editing?.priority ?? "standard");
    setDate(dateValue(safeDate));
    setTime(timeValue(safeDate));
    setCalendar("none");
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  function applyQuickDate(days: number) {
    const next = new Date(atDaysFromNow(days, 10));
    setDate(dateValue(next));
    setTime("10:00");
  }

  function save() {
    if (!store) return;
    const clean = title.trim();
    if (!clean) {
      toast.error("Give the reminder a title first.");
      return;
    }
    const when = new Date(`${date}T${time || "10:00"}:00`);
    if (Number.isNaN(when.getTime())) {
      toast.error("Pick a valid date and time.");
      return;
    }
    const contextType = editing?.contextType ?? defaults?.contextType ?? "custom";
    const contextId = editing?.contextId ?? defaults?.contextId ?? "";
    const link = {
      songId: defaults?.songId,
      sheetId: defaults?.sheetId,
      contractId: defaults?.contractId,
      blueprintId: defaults?.blueprintId,
      stepId: defaults?.stepId,
      focusField: defaults?.focusField,
    };
    const href = buildHref(destination, link);
    const dueAt = when.toISOString();
    const exported: CalendarTarget | null = calendar === "none" ? null : calendar;

    let saved: WorkspaceReminder;
    if (editing) {
      store.update(editing.id, {
        title: clean,
        note: note.trim(),
        dueAt,
        priority,
        destination,
        href,
        snoozedUntil: null,
        calendarExported: exported,
      });
      saved = {
        ...editing,
        title: clean,
        note: note.trim(),
        dueAt,
        priority,
        destination,
        href,
        snoozedUntil: null,
        calendarExported: exported,
      };
    } else {
      saved = store.add({
        title: clean,
        note: note.trim(),
        dueAt,
        priority,
        destination,
        href,
        contextType,
        contextId,
        contextKey: contextKeyFor(contextType, contextId, "custom"),
      });
      if (exported) store.update(saved.id, { calendarExported: exported });
    }

    if (exported) exportReminderToCalendar(saved, exported);
    toast.success(
      editing
        ? "Reminder updated."
        : "Reminder set. It holds at the top of your workspace until you clear it.",
    );
    onOpenChange(false);
    onSaved?.(saved);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <span className="cta-reminder-sparkle" aria-hidden="true">
              💎
            </span>
            {editing ? "Edit reminder" : "Set a workspace reminder"}
          </DialogTitle>
          <DialogDescription>
            A title, a time, and — if you want — the workspace tab it should open. It stays in your
            reminder strip until you open, snooze or complete it.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <label className="block space-y-1.5">
            <span className="text-sm font-semibold">Reminder title / note</span>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={140}
              placeholder="Send stems to mixing engineer"
              aria-label="Reminder title"
            />
            <span className="block text-xs text-muted-foreground">
              Examples: register the new single before Friday, follow up with the distributor on
              payout, book the session.
            </span>
          </label>

          <label className="block space-y-1.5">
            <span className="text-sm font-semibold">Details (optional)</span>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={600}
              rows={3}
              placeholder="Anything you want with it — a checklist, a link, a name to ask for."
              aria-label="Reminder details"
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-sm font-semibold">Workspace destination (optional)</span>
            <select
              value={destination}
              onChange={(e) => setDestination(e.target.value as ReminderDestination)}
              aria-label="Workspace destination"
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              {DESTINATIONS.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label}
                </option>
              ))}
            </select>
            <span className="block text-xs text-muted-foreground">
              Open on the strip jumps straight to this tab.
            </span>
          </label>

          <div className="space-y-2">
            <span className="text-sm font-semibold">Date &amp; time</span>
            <div className="flex flex-wrap gap-2">
              {QUICK_DATES.map((q) => (
                <button
                  key={q.label}
                  type="button"
                  onClick={() => applyQuickDate(q.days)}
                  className="rounded-full border border-border bg-background px-3 py-1 text-xs font-semibold transition hover:border-primary hover:text-primary"
                >
                  {q.label}
                </button>
              ))}
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                aria-label="Reminder date"
              />
              <Input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                aria-label="Reminder time"
              />
            </div>
          </div>

          <div className="space-y-2">
            <span className="text-sm font-semibold">Priority</span>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Reminder priority">
              {(["standard", "gold", "urgent"] as const).map((p) => {
                const Icon = PRIORITY_ICON[p];
                const active = priority === p;
                return (
                  <button
                    key={p}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setPriority(p)}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                      active
                        ? "border-primary cta-reminder-primary"
                        : "border-border bg-background hover:border-primary"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {PRIORITY_LABEL[p]}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-muted/40 p-3">
            <label className="flex flex-wrap items-center justify-between gap-2">
              <span className="inline-flex items-center gap-2 text-sm font-semibold">
                <CalendarPlus className="h-4 w-4 text-primary" />
                Add it to my calendar now
              </span>
              <select
                value={calendar}
                onChange={(e) => setCalendar(e.target.value as CalendarChoice)}
                aria-label="Calendar export"
                className="h-8 rounded-md border border-input bg-background px-2 text-xs"
              >
                <option value="none">No, just the workspace</option>
                <option value="ics">Apple / iPhone / Outlook (.ics)</option>
                <option value="google">Google Calendar</option>
              </select>
            </label>
            <p className="mt-1.5 text-xs text-muted-foreground">
              The calendar event includes a 15-minute alert, the reminder time, and a link back to
              this workspace tab.
            </p>
          </div>

          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            {CONTEXT_LABEL[editing?.contextType ?? defaults?.contextType ?? "custom"]}
            {editing?.contextType === "catalog" || defaults?.contextType === "catalog"
              ? " · My Catalog"
              : ""}
          </p>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="outline" className="cta-reminder-primary" onClick={save}>
            {editing ? "Save changes" : "Set reminder"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
