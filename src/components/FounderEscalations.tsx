import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowUpRight, BellRing } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  listFounderEscalations,
  markFounderEscalationsRead,
} from "@/lib/support-escalation.functions";
import { TICKET_STATUS_LABEL } from "@/lib/support-replies";

const when = (iso: string) => new Date(iso).toLocaleString();

/**
 * Escalated to you (founder, 2026-11-19): the handoffs waiting in her priority queue, each with the note Support left and
 * one button that opens that exact thread in Admin → Support Tickets. The notice is the escalation row itself, so opening
 * the thread marks it read and the count settles.
 */
export function FounderEscalations({ onOpenTicket }: { onOpenTicket: (ticketId: string) => void }) {
  const list = useServerFn(listFounderEscalations);
  const markRead = useServerFn(markFounderEscalationsRead);
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["founder-escalations"],
    queryFn: () => list(),
    refetchInterval: 60000,
  });

  async function open(ticketId: string) {
    // The thread comes up first; the read mark only settles the notice, so it never holds the click up.
    onOpenTicket(ticketId);
    try {
      await markRead({ data: { ticketId } });
      await qc.invalidateQueries({ queryKey: ["founder-escalations"] });
      await qc.invalidateQueries({ queryKey: ["support-tickets"] });
    } catch {
      /* the thread is already open; the notice can be settled next time */
    }
  }

  if (q.isLoading) return null;
  if (q.isError) {
    return (
      <section className="rounded-2xl border border-destructive/40 bg-destructive/5 p-4">
        <p className="text-sm text-destructive">Couldn't load your escalations.</p>
      </section>
    );
  }
  const rows = q.data ?? [];
  if (!rows.length) return null;
  const unread = rows.filter((r) => !r.readAt).length;

  return (
    <section className="rounded-2xl border border-primary/40 bg-primary/5 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-primary">
          <BellRing className="h-3.5 w-3.5" />
          Escalated to you
        </h2>
        <span className="text-xs font-semibold text-primary">
          {unread ? `${unread} new` : "All read"}
        </span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Support hands a public inquiry here when it needs your decision. Open it and the thread comes up ready to answer.
      </p>
      <ul className="mt-3 space-y-2">
        {rows.map((notice) => (
          <li
            key={notice.id}
            className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-border bg-card/80 p-3"
          >
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                {!notice.readAt ? <Badge className="bg-primary text-primary-foreground">New</Badge> : null}
                <Badge variant="outline">{notice.channel === "info" ? "INFO" : "SUPPORT"}</Badge>
                <Badge variant="outline">
                  {TICKET_STATUS_LABEL[notice.status as keyof typeof TICKET_STATUS_LABEL] ?? notice.status}
                </Badge>
              </div>
              <p className="mt-1 truncate text-sm font-semibold">{notice.subject}</p>
              <p className="text-xs text-muted-foreground">
                {notice.memberName} · handed over by {notice.byName} · {when(notice.createdAt)}
              </p>
              {notice.note ? (
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{notice.note}</p>
              ) : null}
            </div>
            <Button
              className="min-h-11 shrink-0"
              onClick={() => void open(notice.ticketId)}
              aria-label={`Open the thread: ${notice.subject}`}
            >
              <ArrowUpRight className="h-4 w-4" />
              Open thread
            </Button>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[11px] text-muted-foreground">
        Opening a thread marks its notice read. Everything stays on the ticket, so the queue never holds a second copy.
      </p>
    </section>
  );
}
