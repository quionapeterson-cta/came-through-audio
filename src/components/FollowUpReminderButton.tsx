import { useMemo, useState } from "react";
import { CalendarClock, CalendarPlus, Check, ChevronRight, RotateCcw, Trash2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { CustomWorkspaceReminderModal, type ReminderDefaults } from "@/components/CustomWorkspaceReminderModal";
import { useWorkspaceReminders } from "@/hooks/useWorkspaceReminders";
import {
  CONTEXT_DESTINATION,
  atDaysFromNow,
  buildHref,
  contextKeyFor,
  dueText,
  formatReminderDate,
  presetsFor,
  type ReminderContextType,
  type ReminderDestination,
  type ReminderPreset,
  type WorkspaceReminder,
} from "@/lib/workspace-reminders";
import { exportReminderToCalendar } from "@/utils/calendarExport";

/**
 * The quiet contextual follow-up pill (founder spec, 2026-11-19). It sits in a card header, a catalog row or a
 * checklist item, shows "Remind Me" until something is scheduled, then shows the date. Nothing here interrupts a
 * member's work: the popover is the only thing that opens.
 */
export function FollowUpReminderButton({
  contextType,
  contextId,
  songId,
  sheetId,
  contractId,
  blueprintId,
  stepId,
  stepTitle,
  subject,
  className = "",
}: {
  contextType: ReminderContextType;
  contextId?: string | undefined;
  songId?: string | undefined;
  sheetId?: string | undefined;
  contractId?: string | undefined;
  blueprintId?: string | undefined;
  stepId?: string | undefined;
  stepTitle?: string | undefined;
  subject?: string | undefined;
  className?: string | undefined;
}) {
  const store = useWorkspaceReminders();
  const [open, setOpen] = useState(false);
  const [fresh, setFresh] = useState<WorkspaceReminder | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<WorkspaceReminder | null>(null);
  const presets = useMemo(() => presetsFor(contextType, { stepTitle }), [contextType, stepTitle]);
  const id = contextId ?? "";
  const active = store?.reminders.find((r) => !r.completedAt && r.contextType === contextType && r.contextId === id) ?? null;

  if (!store) return null;

  const link = { songId, sheetId, contractId, blueprintId, stepId };
  const destination = CONTEXT_DESTINATION[contextType];
  const defaults: ReminderDefaults = {
    destination,
    contextType,
    contextId: id,
    songId,
    sheetId,
    contractId,
    blueprintId,
    stepId,
    subject,
    title: "",
    focusField: undefined,
  };

  function schedule(preset: ReminderPreset) {
    if (!store) return;
    const reminder = store.add({
      title: preset.title,
      note: subject ? `For ${subject}.` : "",
      dueAt: atDaysFromNow(preset.days),
      priority: preset.priority,
      destination: preset.destination,
      href: buildHref(preset.destination, { ...link, focusField: preset.focusField }),
      contextType,
      contextId: id,
      contextKey: contextKeyFor(contextType, id, preset.key),
    });
    setFresh(reminder);
  }

  function openCustom() {
    setEditing(null);
    setModalOpen(true);
    setOpen(false);
  }

  function edit(reminder: WorkspaceReminder) {
    setEditing(reminder);
    setModalOpen(true);
    setOpen(false);
  }

  return (
    <>
      <Popover open={open} onOpenChange={(next) => { setOpen(next); if (!next) setFresh(null); }}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={`cta-followup ${className}`}
            data-scheduled={active ? "true" : "false"}
            aria-label={active ? `Follow-up scheduled for ${formatReminderDate(active.dueAt)}. Open reminder options.` : "Set a follow-up reminder"}
          >
            <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
            {active ? `Scheduled · ${formatReminderDate(active.dueAt)}` : "Remind Me"}
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-80 p-3">
          {fresh ? (
            <div className="space-y-3">
              <div>
                <p className="flex items-center gap-1.5 text-sm font-bold"><Check className="h-4 w-4 text-primary" />Reminder set</p>
                <p className="mt-1 text-xs text-muted-foreground">{fresh.title}</p>
                <p className="mt-0.5 text-xs font-semibold text-primary">{formatReminderDate(fresh.dueAt)} · 10:00 AM</p>
              </div>
              <div className="space-y-1.5">
                <p className="text-xs font-semibold">Also put it on your calendar</p>
                <div className="grid gap-1.5">
                  <Button size="sm" variant="outline" className="justify-start" onClick={() => exportReminderToCalendar(fresh, "ics")}>
                    <CalendarPlus className="h-4 w-4" />Apple / iPhone / Outlook (.ics)
                  </Button>
                  <Button size="sm" variant="outline" className="justify-start" onClick={() => exportReminderToCalendar(fresh, "google")}>
                    <CalendarPlus className="h-4 w-4" />Google Calendar
                  </Button>
                </div>
              </div>
              <div className="flex justify-between gap-2">
                <Button size="sm" variant="ghost" onClick={() => edit(fresh)}>Add details</Button>
                <Button size="sm" variant="outline" className="cta-reminder-primary" onClick={() => setOpen(false)}>Done</Button>
              </div>
            </div>
          ) : active ? (
            <div className="space-y-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary">Scheduled · {formatReminderDate(active.dueAt)}</p>
                <p className="mt-1 text-sm font-semibold">{active.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">{dueText(active, store.now)}</p>
              </div>
              <Button size="sm" variant="outline" className="w-full justify-start" onClick={() => edit(active)}>
                <RotateCcw className="h-3.5 w-3.5" />Reschedule or edit
              </Button>
              <div className="space-y-1.5">
                <p className="text-xs font-semibold">Re-export to calendar</p>
                <div className="grid grid-cols-2 gap-1.5">
                  <Button size="sm" variant="outline" onClick={() => exportReminderToCalendar(active, "ics")}>Apple / Outlook</Button>
                  <Button size="sm" variant="outline" onClick={() => exportReminderToCalendar(active, "google")}>Google</Button>
                </div>
              </div>
              <div className="flex justify-between gap-2 border-t border-border pt-2">
                <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => { store.remove(active.id); setOpen(false); }}>
                  <Trash2 className="h-3.5 w-3.5" />Clear
                </Button>
                <Button size="sm" variant="ghost" onClick={() => { store.complete(active.id); setOpen(false); }}>
                  <Check className="h-3.5 w-3.5" />Mark complete
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary">Smart follow-up</p>
                <p className="mt-1 text-sm font-bold">{subject || "Remind me about this"}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">One click. It waits in your reminder strip until you clear it.</p>
              </div>
              <div className="space-y-1">
                {presets.map((preset) => (
                  <button
                    key={preset.key}
                    type="button"
                    onClick={() => schedule(preset)}
                    className="flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left transition hover:bg-muted"
                  >
                    <span className="mt-0.5 rounded-full border border-border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">{preset.label}</span>
                    <span className="min-w-0 flex-1 text-xs leading-snug">{preset.title}</span>
                    <ChevronRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  </button>
                ))}
              </div>
              <Button size="sm" variant="outline" className="w-full justify-start" onClick={openCustom}>
                <CalendarPlus className="h-3.5 w-3.5" />Pick custom date &amp; time…
              </Button>
            </div>
          )}
        </PopoverContent>
      </Popover>

      <CustomWorkspaceReminderModal
        open={modalOpen}
        onOpenChange={(next) => { setModalOpen(next); if (!next) setEditing(null); }}
        editing={editing}
        defaults={editing ? null : { ...defaults, destination: destination as ReminderDestination }}
      />
    </>
  );
}
