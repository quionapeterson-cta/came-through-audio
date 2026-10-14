import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Badge } from "@/components/ui/badge";
import { listTickets, updateTicketStatus, TICKET_STATUSES } from "@/lib/support.functions";

const LABEL: Record<string, string> = { open: "Open", in_progress: "In Progress", resolved: "Resolved" };

export function SupportTicketsPanel() {
  const fetchTickets = useServerFn(listTickets);
  const setStatus = useServerFn(updateTicketStatus);
  const qc = useQueryClient();
  const [filter, setFilter] = useState<string>("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const q = useQuery({ queryKey: ["support-tickets"], queryFn: () => fetchTickets() });

  if (q.isLoading) return <p className="mt-6 text-muted-foreground">Loading…</p>;
  if (q.isError) return <p className="mt-6 text-destructive">Couldn't load tickets.</p>;
  const rows = (q.data ?? []).filter((t) => filter === "all" || t.status === filter);

  return (
    <div className="mt-4 space-y-3">
      <div className="flex flex-wrap gap-2">
        {["all", ...TICKET_STATUSES].map((s) => (
          <button key={s} onClick={() => setFilter(s)}
            className={`rounded-full border px-3 py-1 text-sm font-semibold ${filter === s ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>
            {s === "all" ? "All" : LABEL[s]} ({(q.data ?? []).filter((t) => s === "all" || t.status === s).length})
          </button>
        ))}
      </div>
      {!rows.length && <p className="text-muted-foreground">Nothing here yet.</p>}
      {rows.map((t) => (
        <div key={t.id} className="rounded-xl border border-border bg-card p-4">
          <button className="flex w-full flex-wrap items-center justify-between gap-2 text-left" onClick={() => setOpenId(openId === t.id ? null : t.id)}>
            <div>
              <div className="font-semibold">{t.subject}</div>
              <div className="text-sm text-muted-foreground">{t.name} · {t.email} · {new Date(t.created_at).toLocaleString()}</div>
            </div>
            <div className="flex gap-2">
              <Badge variant="outline">{t.kind === "support" ? "Support" : "Contact"}</Badge>
              <Badge variant="outline">{t.category}</Badge>
              <Badge className={t.status === "resolved" ? "" : "bg-primary text-primary-foreground"}>{LABEL[t.status]}</Badge>
            </div>
          </button>
          {openId === t.id && (
            <div className="mt-4 space-y-3 border-t border-border pt-4">
              <p className="whitespace-pre-wrap text-sm">{t.message}</p>
              <div className="flex flex-wrap items-center gap-2">
                <a className="text-sm font-semibold text-primary underline" href={`mailto:${t.email}?subject=${encodeURIComponent("Re: " + t.subject)}`}>Reply by email</a>
                <select value={t.status} className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                  onChange={async (e) => { await setStatus({ data: { id: t.id, status: e.target.value as (typeof TICKET_STATUSES)[number] } }); qc.invalidateQueries({ queryKey: ["support-tickets"] }); }}>
                  {TICKET_STATUSES.map((s) => <option key={s} value={s}>{LABEL[s]}</option>)}
                </select>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
