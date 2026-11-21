import { useState } from "react";
import { Bell, Plus } from "lucide-react";
import { CustomWorkspaceReminderModal } from "@/components/CustomWorkspaceReminderModal";
import { MyRemindersDrawer } from "@/components/MyRemindersDrawer";
import { useWorkspaceReminders } from "@/hooks/useWorkspaceReminders";
import { activeReminders, type WorkspaceReminder } from "@/lib/workspace-reminders";

/**
 * The header pair beside the artist name (founder spec, 2026-11-19): "+ Set Reminder" and "My Reminders" with the
 * active count. Both open the same store the strip and contextual pills use.
 */
export function WorkspaceReminderHeaderActions() {
  const store = useWorkspaceReminders();
  const [createOpen, setCreateOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<WorkspaceReminder | null>(null);

  if (!store) return null;
  const count = activeReminders(store.reminders).length;

  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      <button
        type="button"
        className="cta-reminder-quick"
        onClick={() => {
          setEditing(null);
          setCreateOpen(true);
        }}
      >
        <Plus className="h-3.5 w-3.5" aria-hidden="true" />
        Set Reminder
      </button>
      <button
        type="button"
        className="cta-reminder-mine"
        onClick={() => setDrawerOpen(true)}
        aria-label={`My Reminders, ${count} active`}
      >
        <Bell className="h-3.5 w-3.5" aria-hidden="true" />
        My Reminders
        <span className="cta-reminder-count">{count}</span>
      </button>

      <CustomWorkspaceReminderModal
        open={createOpen}
        onOpenChange={(next) => {
          setCreateOpen(next);
          if (!next) setEditing(null);
        }}
        editing={editing}
      />
      <MyRemindersDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        onEdit={(reminder) => {
          setEditing(reminder);
          setDrawerOpen(false);
          setCreateOpen(true);
        }}
        onCreate={() => {
          setEditing(null);
          setDrawerOpen(false);
          setCreateOpen(true);
        }}
      />
    </div>
  );
}
