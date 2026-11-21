import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { EscalationNotices } from "@/components/EscalationNotices";
import { listLeadEscalations, markLeadEscalationsRead } from "@/lib/support-escalation.functions";

/**
 * Escalated to your team (founder, 2026-11-19): a handoff routed to a department also reaches that department's lead, and
 * this is where the lead sees it — in My Queue, with the note Support left and one button that opens the thread. A
 * super admin is not a department lead here: the founder has her own list above.
 */
export function LeadEscalations({ onOpenTicket }: { onOpenTicket: (ticketId: string) => void }) {
  const list = useServerFn(listLeadEscalations);
  const markRead = useServerFn(markLeadEscalationsRead);
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["lead-escalations"],
    queryFn: () => list(),
    refetchInterval: 60000,
  });

  async function open(ticketId: string) {
    // The thread opens first; settling the notice never holds the click up.
    onOpenTicket(ticketId);
    try {
      await markRead({ data: { ticketId } });
      await qc.invalidateQueries({ queryKey: ["lead-escalations"] });
      await qc.invalidateQueries({ queryKey: ["support-tickets"] });
    } catch {
      /* the thread is already open; the notice can be settled next time */
    }
  }

  if (q.isLoading) return null;
  if (q.isError) {
    return (
      <section className="rounded-2xl border border-destructive/40 bg-destructive/5 p-4">
        <p className="text-sm text-destructive">Couldn't load your team's escalations.</p>
      </section>
    );
  }

  return (
    <EscalationNotices
      title="Escalated to your team"
      blurb="Support hands a public inquiry to your department when it needs its lead's call. Open it and the thread comes up ready for your decision."
      footer="Opening a thread marks its notice read. Support writes the member's reply; the thread is yours to read."
      rows={q.data ?? []}
      onOpen={(ticketId) => void open(ticketId)}
    />
  );
}
