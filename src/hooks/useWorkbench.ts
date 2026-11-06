import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { isEmptyEntry, toggleChecked, workbenchKey, type WorkbenchEntry, type WorkbenchKind } from "@/lib/workbench";

type Stored = WorkbenchEntry & { /** Saved while the table was unreachable; sent up on the next good load. */ pending?: boolean };
type Row = { kind: WorkbenchKind; item_id: string; checked: string[] | null; pinned: boolean | null; updated_at: string | null };

const storageKey = (userId: string) => `cta.workbench.${userId}`;
function readLocal(userId: string): Record<string, Stored> {
  try { return JSON.parse(localStorage.getItem(storageKey(userId)) ?? "{}") as Record<string, Stored>; } catch { return {}; }
}
function writeLocal(userId: string, all: Record<string, Stored>) {
  try { localStorage.setItem(storageKey(userId), JSON.stringify(all)); } catch { /* storage blocked */ }
}

const table = () => supabase.from("workbench_items" as never);

/**
 * Working On: checklist ticks and saved items, per member, in public.workbench_items. Writes are optimistic. If the
 * table can't be reached (the migration hasn't run, or the network drops) everything carries on in this browser's
 * storage under the member's id, without an error, and is sent up the next time the table answers.
 */
export function useWorkbench(userId: string | undefined, enabled = true) {
  const [entries, setEntries] = useState<Record<string, Stored>>({});
  const [loaded, setLoaded] = useState(false);
  const latest = useRef(entries);
  const remote = useRef(false);
  const queue = useRef<Record<string, Promise<unknown>>>({});

  const push = useCallback((e: Stored) => {
    if (!userId) return Promise.resolve(false);
    const req = isEmptyEntry(e)
      ? table().delete().eq("user_id" as never, userId as never).eq("kind" as never, e.kind as never).eq("item_id" as never, e.itemId as never)
      : table().upsert({ user_id: userId, kind: e.kind, item_id: e.itemId, checked: e.checked, pinned: e.pinned, updated_at: new Date().toISOString() } as never, { onConflict: "user_id,kind,item_id" });
    return Promise.resolve(req).then(({ error }) => !error, () => false);
  }, [userId]);

  useEffect(() => {
    if (!userId || !enabled) return;
    let live = true;
    const local = readLocal(userId);
    latest.current = local; setEntries(local);
    void (async () => {
      const { data, error } = await Promise.resolve(table().select("kind, item_id, checked, pinned, updated_at").eq("user_id" as never, userId as never))
        .catch(() => ({ data: null, error: new Error("offline") }));
      if (!live) return;
      if (error || !Array.isArray(data)) { remote.current = false; setLoaded(true); return; }
      remote.current = true;
      const next: Record<string, Stored> = {};
      for (const r of data as Row[]) next[workbenchKey(r.kind, r.item_id)] = { kind: r.kind, itemId: r.item_id, checked: r.checked ?? [], pinned: !!r.pinned, updatedAt: r.updated_at ?? undefined };
      for (const [key, e] of Object.entries(local)) {
        if (!e.pending) continue;
        if (isEmptyEntry(e)) delete next[key]; else next[key] = { ...e, pending: false };
        void push(e);
      }
      latest.current = next; setEntries(next); writeLocal(userId, next); setLoaded(true);
    })();
    return () => { live = false; };
  }, [userId, enabled, push]);

  const save = useCallback((e: Stored) => {
    if (!userId) return;
    const key = workbenchKey(e.kind, e.itemId);
    const next = { ...latest.current };
    if (isEmptyEntry(e) && remote.current) delete next[key]; else next[key] = { ...e, pending: !remote.current };
    latest.current = next; setEntries(next); writeLocal(userId, next);
    if (!remote.current) return;
    // One write at a time per item, so quick ticks land in order.
    queue.current[key] = (queue.current[key] ?? Promise.resolve()).then(() => push(e)).then((ok) => {
      if (ok) return;
      remote.current = false;
      const cur = latest.current[key];
      const kept = { ...latest.current, [key]: { ...(cur ?? e), pending: true } };
      latest.current = kept; writeLocal(userId, kept);
    });
  }, [userId, push]);

  const get = useCallback((kind: WorkbenchKind, itemId: string): WorkbenchEntry =>
    entries[workbenchKey(kind, itemId)] ?? { kind, itemId, checked: [], pinned: false }, [entries]);

  const toggle = useCallback((kind: WorkbenchKind, itemId: string, item: string) => {
    const cur = latest.current[workbenchKey(kind, itemId)] ?? { kind, itemId, checked: [], pinned: false };
    save(toggleChecked(cur, item));
  }, [save]);

  const setPinned = useCallback((kind: WorkbenchKind, itemId: string, pinned: boolean) => {
    const cur = latest.current[workbenchKey(kind, itemId)] ?? { kind, itemId, checked: [], pinned: false };
    save({ ...cur, pinned });
  }, [save]);

  return { entries: Object.values(entries), get, toggle, setPinned, loaded };
}

export type Workbench = ReturnType<typeof useWorkbench>;
