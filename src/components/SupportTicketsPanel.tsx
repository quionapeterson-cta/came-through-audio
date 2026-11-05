import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { MessageSquare } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BADGES, COLLECTIONS } from "@/lib/badges";
import { grantBadgeForTicket } from "@/lib/badges.functions";
import { ScriptCard } from "@/components/SupportScriptsPanel";
import { listTickets, updateTicketStatus, TICKET_STATUSES } from "@/lib/support.functions";
import { isBillingTicket, scriptsForTicket, ticketScriptValues } from "@/lib/support-scripts";

/**
 * Unlocks a badge for the account behind this ticket's email, when the app should have awarded it but didn't.
 * The reason is required and every unlock is logged.
 */
function UnlockBadge({ ticketId, subject }: { ticketId: string; subject: string }) {
  const grant = useServerFn(grantBadgeForTicket);
  const [badgeId, setBadgeId] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  async function unlock() {
    setBusy(true);
    try {
      const r = await grant({ data: { ticketId, badgeId, reason: reason.trim() || `Ticket: ${subject}` } });
      toast.success(`${r.title} unlocked. They'll see it the next time they open the app.`);
      setBadgeId(""); setReason("");
    } catch (e) { toast.error((e as Error).message || "Couldn't unlock the badge."); }
    finally { setBusy(false); }
  }
  return (
    <div className="space-y-2 rounded-lg border border-border p-3">
      <div className="text-sm font-semibold">Unlock a badge</div>
      <p className="text-xs text-muted-foreground">Only when the app should have awarded it. Check their records first. Every unlock is logged with your name and reason.</p>
      <div className="flex flex-wrap gap-2">
        <label htmlFor={`unlock-badge-${ticketId}`} className="sr-only">Badge</label>
        <select id={`unlock-badge-${ticketId}`} value={badgeId} onChange={(e) => setBadgeId(e.target.value)} className="h-9 min-w-0 rounded-md border border-input bg-background px-2 text-sm">
          <option value="">Choose a badge…</option>
          {COLLECTIONS.map((c) => <optgroup key={c.id} label={c.title}>
            {BADGES.filter((b) => b.collection === c.id).map((b) => <option key={b.id} value={b.id}>{b.title}</option>)}
          </optgroup>)}
        </select>
        <label htmlFor={`unlock-reason-${ticketId}`} className="sr-only">Reason</label>
        <Input id={`unlock-reason-${ticketId}`} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500}
          placeholder="Reason, e.g. split sheet fully signed but Sealed didn't unlock" className="h-9 min-w-0 flex-1" />
        <Button size="sm" disabled={!badgeId || busy} onClick={() => void unlock()}>Unlock</Button>
      </div>
    </div>
  );
}

/**
 * The ticket's own scripts, one click from the message (founder, 2026-11-05): the queue owner's wording — Billing's on
 * a billing ticket, Support's otherwise — with the member's first name and the subject already in it. Staff copy one,
 * fill anything still in braces, and send it from the ticket. The full catalog stays in Admin → Support Scripts.
 */
function TicketScripts({ ticket }: { ticket: { category: string; name: string; subject: string } }) {
  const [open, setOpen] = useState(false);
  const rows = scriptsForTicket(ticket.category);
  const values = ticketScriptValues(ticket);
  const owner = isBillingTicket(ticket.category) ? "Billing" : "Support";
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-semibold"><MessageSquare className="h-4 w-4" />Scripts for this ticket</div>
          <p className="mt-1 text-xs text-muted-foreground">
            {owner}'s words for this category, with the first name and subject filled in. Copy one, fill anything left in
            braces, then send it from here. Every department's scripts are in Support Scripts.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => setOpen(!open)}>
          {open ? "Hide scripts" : `Show ${rows.length} scripts`}
        </Button>
      </div>
      {open && <div className="mt-3 space-y-3">{rows.map((s) => <ScriptCard key={s.id} script={s} values={values} />)}</div>}
    </div>
  );
}

const LABEL: Record<string, string> = { open: "Open", in_progress: "In Progress", resolved: "Resolved" };

export function SupportTicketsPanel({ scope = "all" }: { scope?: "all" | "billing" }) {
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
      <p className="text-sm text-muted-foreground">
        {scope === "billing"
          ? "Billing's own tickets: charges, invoices, refunds, plan changes, seats and branding kits. Everything else belongs to Support."
          : "Every ticket from the site. Billing answers the Account & billing ones in its own tab; answer the rest from here."}
      </p>
      <div className="flex flex-wrap gap-2">
        {[...TICKET_STATUSES, "all"].map((s) => (
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
              <TicketScripts ticket={t} />
              <UnlockBadge ticketId={t.id} subject={t.subject} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
