import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { EscalationNotices } from "@/components/EscalationNotices";
import {
  listFounderEscalations,
  markFounderEscalationsRead,
} from "@/lib/support-escalation.functions";

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

  return (
    <EscalationNotices
      title="Escalated to you"
      blurb="Support hands a public inquiry here when it needs your decision. Open it and the thread comes up ready to answer."
      footer="Opening a thread marks its notice read. Everything stays on the ticket, so the queue never holds a second copy."
      rows={q.data ?? []}
      onOpen={(ticketId) => void open(ticketId)}
    />
  );
}
