import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { SupportTicketDetail } from "@/components/SupportTicketDetail";
import { listTickets } from "@/lib/support.functions";
import {
  CHANNEL_BADGE,
  CHANNEL_FILTERS,
  TICKET_STATUSES,
  TICKET_STATUS_LABEL,
  channelOf,
  type TicketRecord,
} from "@/lib/support-replies";

/**
 * The channel filters (founder, 2026-11-19): one queue now takes both the site's tickets and the public info@ mail, and
 * the two escalations get their own view so the receiving department's lead and the founder can work what was handed over.
 */
type ChannelFilter = "all" | "support" | "info" | "marketing" | "founder";
const CHANNEL_PILLS: { id: ChannelFilter; label: string }[] = [
  { id: "all", label: "All Support" },
  ...CHANNEL_FILTERS.map((c) => ({ id: c.id as ChannelFilter, label: c.label })),
  { id: "marketing", label: "Escalated: Marketing" },
  { id: "founder", label: "Escalated: The Founder" },
];

/** A row matches one channel pill: its channel, or the team it was handed to. */
function matchesChannel(ticket: TicketRecord, filter: ChannelFilter): boolean {
  if (filter === "all") return true;
  if (filter === "marketing") return !!ticket.escalated_marketing;
  if (filter === "founder") return !!ticket.escalated_founder;
  return channelOf(ticket) === filter;
}

/**
 * Admin → Support Tickets (founder, 2026-11-05; native replies 2026-11-08): the queue, and the ticket opened as a
 * conversation you answer in place. Support sees every ticket; Billing sees its own.
 */
export function SupportTicketsPanel({
  scope = "all",
  focusTicketId,
  onFocusHandled,
}: {
  /** `escalated` is Marketing's seat: the threads handed to it, read-only, never the queue (founder, 2026-11-19). */
  scope?: "all" | "billing" | "escalated";
  /** A thread to open on arrival, e.g. from a founder escalation notice in My Queue. */
  focusTicketId?: string | null;
  onFocusHandled?: () => void;
}) {
  const fetchTickets = useServerFn(listTickets);
  const [filter, setFilter] = useState<string>("all");
  const [channelFilter, setChannelFilter] = useState<ChannelFilter>("all");
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const q = useQuery({ queryKey: ["support-tickets"], queryFn: () => fetchTickets() });

  const all = useMemo(() => (q.data ?? []) as TicketRecord[], [q.data]);
  const rows = useMemo(() => {
    const term = query.trim().toLowerCase();
    return all.filter((t) => {
      if (filter !== "all" && t.status !== filter) return false;
      if (!matchesChannel(t, channelFilter)) return false;
      if (!term) return true;
      return `${t.subject} ${t.name} ${t.email} ${t.category}`.toLowerCase().includes(term);
    });
  }, [all, filter, channelFilter, query]);

  const open = all.find((t) => t.id === openId) ?? null;

  // Straight to the thread that was handed over, whatever filter the queue was left on; then the request is cleared so
  // coming back to this tab later is an ordinary visit.
  useEffect(() => {
    if (!focusTicketId) return;
    setOpenId(focusTicketId);
    onFocusHandled?.();
  }, [focusTicketId, onFocusHandled]);

  // J / K move between tickets in the queue while one is open; Escape goes back to the list.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      const el = e.target as HTMLElement | null;
      if (
        el &&
        (el.tagName === "INPUT" ||
          el.tagName === "TEXTAREA" ||
          el.tagName === "SELECT" ||
          el.isContentEditable)
      )
        return;
      if (e.key === "Escape") {
        setOpenId(null);
        return;
      }
      if (e.key !== "j" && e.key !== "k") return;
      const i = rows.findIndex((t) => t.id === open?.id);
      if (i < 0) return;
      const next = rows[e.key === "j" ? i + 1 : i - 1];
      if (next) setOpenId(next.id);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, rows]);

  if (q.isLoading) return <p className="mt-6 text-muted-foreground">Loading…</p>;
  if (q.isError) return <p className="mt-6 text-destructive">Couldn't load tickets.</p>;

  if (open)
    return (
      <SupportTicketDetail
        ticket={open}
        onClose={() => setOpenId(null)}
        readOnly={scope === "escalated"}
      />
    );

  return (
    <div className="mt-4 space-y-3">
      <p className="text-sm text-muted-foreground">
        {scope === "billing"
          ? "Billing's own tickets: charges, invoices, refunds, plan changes, seats and branding kits. Everything else belongs to Support."
          : scope === "escalated"
            ? "The threads Support handed to this department's lead — only the lead and a super admin read them. Read the note and the conversation, then take the decision back to Support; the member's reply is Support's to send."
            : "Every ticket from the site. Billing answers the Account & billing ones in its own tab; answer the rest from here."}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {CHANNEL_PILLS.map((c) => (
          <button
            key={c.id}
            onClick={() => setChannelFilter(c.id)}
            className={`rounded-full border px-3 py-1 text-sm font-semibold ${channelFilter === c.id ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}
          >
            {c.label} ({all.filter((t) => matchesChannel(t, c.id)).length})
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {(["all", ...TICKET_STATUSES] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`rounded-full border px-3 py-1 text-sm font-semibold ${filter === s ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}
          >
            {s === "all" ? "All" : TICKET_STATUS_LABEL[s]} (
            {all.filter((t) => s === "all" || t.status === s).length})
          </button>
        ))}
        <label className="ml-auto flex items-center gap-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search subject, name, email…"
            className="h-9 max-w-xs"
            aria-label="Search tickets"
          />
        </label>
      </div>
      {!rows.length && <p className="text-muted-foreground">Nothing here yet.</p>}
      <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
        {rows.map((t) => (
          <button
            key={t.id}
            onClick={() => setOpenId(t.id)}
            className="flex w-full flex-wrap items-center justify-between gap-2 p-4 text-left hover:bg-muted/60"
          >
            <span className="min-w-0">
              <span className="block font-semibold">{t.subject}</span>
              <span className="block text-sm text-muted-foreground">
                {t.name} · {t.email} · {new Date(t.created_at).toLocaleString()}
              </span>
            </span>
            <span className="flex flex-wrap items-center gap-2">
              {/* The channel a row came in on, before anything else about it (founder, 2026-11-19). */}
              <Badge
                variant="outline"
                className={channelOf(t) === "info" ? "border-primary text-primary" : ""}
              >
                {CHANNEL_BADGE[channelOf(t)]}
              </Badge>
              {t.escalated_marketing ? <Badge variant="outline">Marketing</Badge> : null}
              {t.escalated_founder ? <Badge variant="outline">The Founder</Badge> : null}
              <Badge variant="outline">{t.kind === "support" ? "Support" : "Contact"}</Badge>
              <Badge variant="outline">{t.category}</Badge>
              <Badge
                className={t.status === "resolved" ? "" : "bg-primary text-primary-foreground"}
              >
                {TICKET_STATUS_LABEL[t.status as keyof typeof TICKET_STATUS_LABEL] ?? t.status}
              </Badge>
            </span>
          </button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Open a ticket, then J and K move down and up the queue; Escape comes back here.
      </p>
    </div>
  );
}
