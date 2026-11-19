import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  loadReminders,
  makeReminder,
  normalizeReminders,
  reminderStorageKey,
  saveReminders,
  trimReminders,
  type NewReminder,
  type WorkspaceReminder,
} from "@/lib/workspace-reminders";

/**
 * One reminder store for the whole workspace, so the header count, the quiet pills and the full-width strip always
 * agree. The browser is the fast copy; the account's auth metadata is the copy a second device adopts on its first
 * visit. Nothing here touches the database schema.
 */

export interface WorkspaceRemindersStore {
  reminders: WorkspaceReminder[];
  /** Refreshed every 30 seconds, so a due reminder surfaces without a reload. */
  now: number;
  add: (input: NewReminder) => WorkspaceReminder;
  update: (id: string, patch: Partial<WorkspaceReminder>) => void;
  remove: (id: string) => void;
  snooze: (id: string, hours?: number) => void;
  complete: (id: string) => void;
  restore: (id: string) => void;
}

const WorkspaceRemindersContext = createContext<WorkspaceRemindersStore | null>(null);

export function useWorkspaceReminders(): WorkspaceRemindersStore | null {
  return useContext(WorkspaceRemindersContext);
}

export function WorkspaceRemindersProvider({
  userId,
  cloud,
  children,
}: {
  userId: string;
  /** `user.user_metadata.workspace_reminders`, used only when this browser has no list yet. */
  cloud?: unknown;
  children: ReactNode;
}) {
  const [reminders, setReminders] = useState<WorkspaceReminder[]>(() => loadReminders(userId));
  const [now, setNow] = useState(() => Date.now());
  const latest = useRef(reminders);

  useEffect(() => {
    latest.current = reminders;
  }, [reminders]);

  // The account's own list is adopted on a new device; a browser that already has one keeps it as the source of truth.
  useEffect(() => {
    setNow(Date.now());
    const local = loadReminders(userId);
    if (local.length) {
      setReminders(local);
      return;
    }
    const seeded = normalizeReminders(cloud);
    if (seeded.length) {
      saveReminders(userId, seeded);
      setReminders(seeded);
    } else {
      setReminders([]);
    }
  }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const tick = window.setInterval(() => setNow(Date.now()), 30_000);
    const onStorage = (event: StorageEvent) => {
      if (event.key !== reminderStorageKey(userId)) return;
      setReminders(loadReminders(userId));
    };
    window.addEventListener("storage", onStorage);
    return () => {
      window.clearInterval(tick);
      window.removeEventListener("storage", onStorage);
    };
  }, [userId]);

  const commit = useCallback((next: WorkspaceReminder[]) => {
    const trimmed = trimReminders(next);
    latest.current = trimmed;
    setReminders(trimmed);
    saveReminders(userId, trimmed);
    // Best effort: a blocked or signed-out auth write never stops the in-browser reminder.
    void supabase.auth
      .updateUser({ data: { workspace_reminders: trimmed } })
      .then(({ error }) => { if (error) console.info("Reminders stayed in this browser:", error.message); })
      .catch(() => {});
  }, [userId]);

  const add = useCallback((input: NewReminder) => {
    const reminder = makeReminder(input);
    commit([reminder, ...latest.current]);
    return reminder;
  }, [commit]);

  const update = useCallback((id: string, patch: Partial<WorkspaceReminder>) => {
    const at = new Date().toISOString();
    commit(latest.current.map((r) => (r.id === id ? { ...r, ...patch, id: r.id, updatedAt: at } : r)));
  }, [commit]);

  const remove = useCallback((id: string) => {
    commit(latest.current.filter((r) => r.id !== id));
  }, [commit]);

  const snooze = useCallback((id: string, hours = 24) => {
    const until = new Date(Date.now() + hours * 3_600_000).toISOString();
    commit(latest.current.map((r) => (r.id === id ? { ...r, snoozedUntil: until, updatedAt: new Date().toISOString() } : r)));
  }, [commit]);

  const complete = useCallback((id: string) => {
    const at = new Date().toISOString();
    commit(latest.current.map((r) => (r.id === id ? { ...r, completedAt: at, snoozedUntil: null, updatedAt: at } : r)));
  }, [commit]);

  const restore = useCallback((id: string) => {
    commit(latest.current.map((r) => (r.id === id ? { ...r, completedAt: null, snoozedUntil: null, updatedAt: new Date().toISOString() } : r)));
  }, [commit]);

  const value = useMemo<WorkspaceRemindersStore>(
    () => ({ reminders, now, add, update, remove, snooze, complete, restore }),
    [reminders, now, add, update, remove, snooze, complete, restore],
  );

  return <WorkspaceRemindersContext.Provider value={value}>{children}</WorkspaceRemindersContext.Provider>;
}
