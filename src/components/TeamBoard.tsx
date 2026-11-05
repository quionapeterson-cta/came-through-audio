import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, Building2, MessageSquarePlus, Radio } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DEPARTMENT_LABEL, type Department } from "@/lib/departments";
import { postNotice, teamPulse } from "@/lib/queue.functions";

const label = (d: string) => DEPARTMENT_LABEL[d as Department] ?? d.replace(/_/g, " ");

/**
 * Admin → Team Board (founder, 2026-11-05): one screen where a lead sees what every other department has in flight, and
 * a short notice board for the dependencies that email is too slow for. It polls, so the numbers follow the work.
 */
export function TeamBoard() {
  const fetchPulse = useServerFn(teamPulse);
  const post = useServerFn(postNotice);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["team-pulse"], queryFn: () => fetchPulse(), refetchInterval: 20_000, refetchOnWindowFocus: true });
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const pulse = q.data;

  const send = async () => {
    if (!note.trim()) return;
    setBusy(true);
    try {
      await post({ data: { body: note.trim() } });
      setNote("");
      await qc.invalidateQueries({ queryKey: ["team-pulse"] });
      toast.success("Posted to the team board.");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Couldn't post that."); }
    finally { setBusy(false); }
  };

  if (q.isLoading) return <p className="mt-6 text-muted-foreground">Loading the team board…</p>;
  if (q.isError || !pulse) return <p className="mt-6 text-destructive">Couldn't load the team board yet. Run migration 20261105200000 first.</p>;

  return (
    <div className="mt-4 space-y-6">
      <div>
        <h2 className="text-lg font-bold">What the team has moving</h2>
        <p className="text-sm text-muted-foreground">Every department's work in progress, so a hand-off starts with a look instead of a meeting.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {pulse.departments.length === 0 && <p className="text-sm text-muted-foreground">No tasks on the board yet.</p>}
        {pulse.departments.map((d) => (
          <Card key={d.department} className="border-border/70 bg-card/70 p-4 transition-shadow hover:shadow-[0_0_24px_-14px_var(--primary)]">
            <div className="flex items-center gap-2 text-sm font-semibold"><Building2 className="h-4 w-4 text-primary" />{label(d.department)}</div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <div><div className="text-2xl font-bold">{d.inProgress}</div><div className="text-[11px] uppercase tracking-wide text-muted-foreground">In progress</div></div>
              <div><div className="text-2xl font-bold">{d.planned}</div><div className="text-[11px] uppercase tracking-wide text-muted-foreground">Queued</div></div>
              <div><div className="text-2xl font-bold text-primary">{d.doneThisWeek}</div><div className="text-[11px] uppercase tracking-wide text-muted-foreground">Done this week</div></div>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <section>
          <h3 className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-primary"><Radio className="h-4 w-4" />In progress</h3>
          {pulse.inProgress.length === 0 ? <p className="text-sm text-muted-foreground">Nothing in progress right now.</p> : (
            <ul className="space-y-2">
              {pulse.inProgress.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card/60 p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{t.title}</p>
                    <p className="text-xs text-muted-foreground">{label(t.department)}{t.owner ? ` · ${t.owner}` : ""}{t.dueAt ? ` · due ${new Date(t.dueAt).toLocaleDateString()}` : ""}</p>
                  </div>
                  <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h3 className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-primary"><MessageSquarePlus className="h-4 w-4" />Coordination</h3>
          {pulse.canPost ? (
            <div className="rounded-xl border border-border bg-card/60 p-3">
              <textarea
                aria-label="Coordination notice"
                rows={3}
                value={note}
                maxLength={1000}
                onChange={(e) => setNote(e.target.value)}
                placeholder="A dependency, a blocker, a heads-up for the other leads…"
                className="w-full resize-none rounded-md border border-input bg-background p-2 text-sm"
              />
              <div className="mt-2 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{note.length}/1000</span>
                <Button size="sm" disabled={busy || !note.trim()} onClick={() => void send()}>Post note</Button>
              </div>
            </div>
          ) : (
            <p className="rounded-xl border border-dashed border-border p-3 text-sm text-muted-foreground">Leads post here. Send yours to your department lead to put it on the board.</p>
          )}
          <ul className="mt-3 space-y-2">
            {pulse.notices.length === 0 && <li className="text-sm text-muted-foreground">No notes yet.</li>}
            {pulse.notices.map((n) => (
              <li key={n.id} className="rounded-xl border border-border bg-card/60 p-3">
                <p className="whitespace-pre-wrap text-sm">{n.body}</p>
                <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">{n.authorName}</span>
                  {n.department && <Badge variant="outline" className="text-[10px]">{label(n.department)}</Badge>}
                  {new Date(n.createdAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                </p>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
