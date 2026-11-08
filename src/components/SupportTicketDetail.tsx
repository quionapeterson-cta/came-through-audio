import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AlertTriangle, ArrowLeft, Copy, Lock, Search, Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { BADGES, COLLECTIONS } from "@/lib/badges";
import { grantBadgeForTicket } from "@/lib/badges.functions";
import { listTicketThread, replyToTicket, updateTicketStatus, TICKET_STATUSES } from "@/lib/support.functions";
import {
  AFTER_SEND,
  TICKET_STATUS_LABEL,
  canSendReply,
  draftGaps,
  isClosed,
  type AfterSend,
  type ThreadMessage,
  type TicketRecord,
} from "@/lib/support-replies";
import {
  fillScript,
  scriptsForTicket,
  searchScripts,
  suggestedScripts,
  ticketOwnerDepartment,
  ticketScriptValues,
  type SupportScript,
} from "@/lib/support-scripts";

const when = (iso: string) => new Date(iso).toLocaleString();

/** Unlocks a badge for the account behind this ticket's email, when the app should have awarded it but didn't. */
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

/** One message in the thread: the member's opening message, our replies, and staff-only notes. */
function Bubble({ name, at, body, internal, staff }: { name: string; at: string; body: string; internal?: boolean; staff?: boolean }) {
  return (
    <div className={`rounded-xl border p-3 ${internal ? "border-destructive/50 bg-destructive/5" : staff ? "border-primary/40 bg-primary/5" : "border-border bg-muted/40"}`}>
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span className="font-semibold text-foreground">{name}</span>
        <span>{when(at)}</span>
        {internal ? <Badge variant="outline" className="border-destructive text-destructive"><Lock className="mr-1 h-3 w-3" />Staff note</Badge> : null}
        {staff && !internal ? <Badge variant="outline">Reply</Badge> : null}
      </div>
      <p className="mt-2 whitespace-pre-wrap break-words text-sm">{body}</p>
      {internal ? <p className="mt-2 text-xs text-destructive">Never emailed, and the member never sees it.</p> : null}
    </div>
  );
}

/**
 * The scripts rail, on the right of the message box (founder, 2026-11-08). Owner's wording, the likely three first,
 * its own scroll so the reply never scrolls away; one click puts the words in the reply box.
 */
function ScriptRail({ ticket, onInsert }: { ticket: TicketRecord; onInsert: (script: SupportScript) => void }) {
  const [query, setQuery] = useState("");
  const owner = ticketOwnerDepartment(ticket.category);
  const groups = useMemo(() => {
    const term = query.trim();
    if (term) return [{ title: "Matching scripts", rows: searchScripts(term, owner) }];
    const suggested = suggestedScripts(ticket.category);
    const all = scriptsForTicket(ticket.category);
    const first = new Set(suggested.map((s) => s.id));
    const rest = all.filter((s) => !first.has(s.id) && !s.internal);
    const staffOnly = all.filter((s) => s.internal);
    return [
      ...(suggested.length ? [{ title: "Suggested for this ticket", rows: suggested }] : []),
      { title: `${owner === "billing" ? "Billing" : "Support"}'s scripts`, rows: rest },
      ...(staffOnly.length ? [{ title: "Staff only", rows: staffOnly }] : []),
    ];
  }, [query, ticket.category, owner]);

  async function copy(script: SupportScript) {
    try {
      await navigator.clipboard.writeText(fillScript(script.body, ticketScriptValues(ticket)));
      toast.success("Copied.");
    } catch { toast.error("Couldn't copy — insert it instead."); }
  }

  return (
    <aside className="rounded-xl border border-border bg-card">
      <div className="border-b border-border p-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold">Scripts</p>
          <span className="text-xs text-muted-foreground">{owner === "billing" ? "Billing" : "Support"}</span>
        </div>
        <label className="mt-2 flex items-center gap-2">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search the scripts…" className="h-8" aria-label="Search the scripts" />
        </label>
      </div>
      <div className="max-h-[26rem] overflow-y-auto p-2 lg:max-h-[calc(100vh-16rem)]">
        {groups.map((group) => (
          <div key={group.title} className="mb-2">
            <p className="px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{group.title}</p>
            {!group.rows.length ? <p className="px-2 py-1 text-xs text-muted-foreground">Nothing here.</p> : null}
            {group.rows.map((script) => (
              <div key={script.id} className="group flex items-start gap-1 rounded-lg p-1 hover:bg-muted">
                <button type="button" onClick={() => onInsert(script)} className="min-w-0 flex-1 rounded-md px-2 py-1.5 text-left">
                  <span className="block truncate text-sm font-semibold">{script.title}</span>
                  <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">{script.when}</span>
                  {script.internal ? <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-destructive"><AlertTriangle className="h-3 w-3" />Internal only</span> : null}
                </button>
                <button type="button" onClick={() => void copy(script)} aria-label={`Copy ${script.title}`} className="mt-1 rounded p-1 text-muted-foreground opacity-0 transition group-hover:opacity-100 focus-visible:opacity-100">
                  <Copy className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        ))}
      </div>
    </aside>
  );
}

/**
 * The reply box (founder, 2026-11-08): write it, fill anything still in braces, choose what sending does to the ticket,
 * and send — one action, no second trip to a status control. An internal note is stored here and never emailed.
 */
function ReplyBox({ ticket, onSent, insertion }: {
  ticket: TicketRecord;
  onSent: () => void;
  /** A script the rail handed over: it replaces the draft and turns on an internal note when the wording is staff-only. */
  insertion: { body: string; internal: boolean; nonce: number } | null;
}) {
  const send = useServerFn(replyToTicket);
  const [body, setBody] = useState("");
  const [internal, setInternal] = useState(false);
  const [after, setAfter] = useState<AfterSend>("stay");
  const [fills, setFills] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const gaps = draftGaps(body);

  useEffect(() => {
    if (!insertion) return;
    setBody(insertion.body);
    setInternal(insertion.internal);
    setFills({});
    toast.success(insertion.internal ? "Staff-only script inserted — this stays internal." : "Script inserted. Fill anything still in braces.");
  }, [insertion]);

  async function submit() {
    const check = canSendReply(body, internal);
    if (!check.ok) { toast.error(check.error); return; }
    setBusy(true);
    try {
      const r = await send({ data: { ticketId: ticket.id, body: body.trim(), internal, after, requestId } });
      if (r.duplicate) toast.success("That reply was already sent.");
      else if (internal) toast.success("Note saved. Only staff can read it.");
      else if (r.emailed) toast.success("Sent. They have it by email, with a link straight back to this ticket.");
      else toast.warning("Reply saved on the ticket, but the email didn't go out — send it by hand.");
      setBody(""); setFills({}); setInternal(false); setAfter("stay"); setRequestId(crypto.randomUUID());
      onSent();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't send the reply.");
    } finally { setBusy(false); }
  }

  return (
    <div className={`rounded-xl border p-3 ${internal ? "border-destructive/50 bg-destructive/5" : "border-border bg-card"}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold">{internal ? "Internal note" : `Reply to ${ticket.name.split(/\s+/)[0] || "the member"}`}</p>
        <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-muted-foreground">
          <input type="checkbox" checked={internal} onChange={(e) => setInternal(e.target.checked)} className="h-4 w-4" />
          Internal note (never sent)
        </label>
      </div>
      {gaps.length && !internal ? (
        <div className="mt-2 rounded-lg border border-border bg-background p-2">
          <p className="text-xs font-semibold">Fill these in before sending</p>
          <div className="mt-1 flex flex-wrap items-end gap-2">
            {gaps.map((gap) => (
              <label key={gap} className="text-[11px] font-semibold text-muted-foreground">
                {gap.replace(/_/g, " ")}
                <Input value={fills[gap] ?? ""} onChange={(e) => setFills((f) => ({ ...f, [gap]: e.target.value }))} placeholder={`{{${gap}}}`} className="mt-0.5 h-8 w-40" />
              </label>
            ))}
            <Button size="sm" variant="outline" onClick={() => { setBody((b) => fillScript(b, fills)); setFills({}); }}>Fill in</Button>
          </div>
        </div>
      ) : null}
      <label htmlFor={`reply-${ticket.id}`} className="sr-only">Your reply</label>
      <Textarea
        id={`reply-${ticket.id}`}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); void submit(); } }}
        rows={7}
        maxLength={8000}
        placeholder={internal ? "What the team needs to know — the member never sees this." : "Write the reply, or pick a script on the right."}
        className="mt-2 resize-y"
      />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <label htmlFor={`after-${ticket.id}`} className="sr-only">What sending does to the ticket</label>
        <select id={`after-${ticket.id}`} value={after} onChange={(e) => setAfter(e.target.value as AfterSend)}
          className="h-9 rounded-md border border-input bg-background px-2 text-sm" disabled={internal}>
          {AFTER_SEND.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
        </select>
        <span className="text-xs text-muted-foreground">⌘↵ sends</span>
        <Button className="ml-auto" disabled={busy || !body.trim()} onClick={() => void submit()}>
          <Send className="h-4 w-4" />{busy ? "Sending…" : internal ? "Save note" : "Send reply"}
        </Button>
      </div>
    </div>
  );
}

/**
 * One ticket, opened: the conversation, the message box, and the scripts rail to its right (founder, 2026-11-08).
 * Everything the ticket needs is on this screen; the badge unlock and the address sit under Actions so they stop
 * stacking above the reply.
 */
export function SupportTicketDetail({ ticket, onClose }: { ticket: TicketRecord; onClose: () => void }) {
  const fetchThread = useServerFn(listTicketThread);
  const setStatus = useServerFn(updateTicketStatus);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["ticket-thread", ticket.id], queryFn: () => fetchThread({ data: { ticketId: ticket.id } }) });
  const messages = q.data?.messages ?? [];
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["ticket-thread", ticket.id] });
    void qc.invalidateQueries({ queryKey: ["support-tickets"] });
  };

  // The reply box owns its own text, so a script reaches it through a hand-off with a fresh nonce.
  const [insertion, setInsertion] = useState<{ body: string; internal: boolean; nonce: number } | null>(null);
  function insert(script: SupportScript) {
    setInsertion({ body: fillScript(script.body, ticketScriptValues(ticket)), internal: !!script.internal, nonce: Date.now() });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="ghost" onClick={onClose}><ArrowLeft className="h-4 w-4" />All tickets</Button>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <label htmlFor={`status-${ticket.id}`} className="text-xs font-semibold text-muted-foreground">Status</label>
          <select id={`status-${ticket.id}`} value={ticket.status} className="h-9 rounded-md border border-input bg-background px-2 text-sm"
            onChange={async (e) => {
              try {
                await setStatus({ data: { id: ticket.id, status: e.target.value as (typeof TICKET_STATUSES)[number] } });
                toast.success(e.target.value === "resolved" ? "Resolved. The member sees it closed." : "Status updated.");
                refresh();
              } catch (err) { toast.error(err instanceof Error ? err.message : "Couldn't update the ticket."); }
            }}>
            {TICKET_STATUSES.map((s) => <option key={s} value={s}>{TICKET_STATUS_LABEL[s]}</option>)}
          </select>
          <details className="relative">
            <summary className="cursor-pointer list-none rounded-md border border-border px-3 py-2 text-sm font-semibold">Actions</summary>
            <div className="absolute right-0 z-20 mt-2 w-72 rounded-xl border border-border bg-card p-3 shadow-lg">
              <p className="text-xs text-muted-foreground">{ticket.email}</p>
              <Button size="sm" variant="outline" className="mt-2 w-full" onClick={() => void navigator.clipboard.writeText(ticket.email).then(() => toast.success("Address copied.")).catch(() => toast.error("Couldn't copy."))}>
                <Copy className="h-4 w-4" />Copy email address
              </Button>
            </div>
          </details>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-3">
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="text-lg font-bold">{ticket.subject}</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  {ticket.name} · {ticket.email} · {ticket.category} · opened {when(ticket.created_at)}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">{ticket.kind === "support" ? "Support" : "Contact"}</Badge>
                <Badge className={isClosed(ticket) ? "" : "bg-primary text-primary-foreground"}>{TICKET_STATUS_LABEL[ticket.status as keyof typeof TICKET_STATUS_LABEL] ?? ticket.status}</Badge>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Bubble name={ticket.name} at={ticket.created_at} body={ticket.message} />
            {q.isLoading ? <p className="text-sm text-muted-foreground">Loading the conversation…</p> : null}
            {q.isError ? <p className="text-sm text-destructive">Couldn't load the conversation.</p> : null}
            {messages.map((m: ThreadMessage) => (
              <Bubble key={m.id} name={m.author_name} at={m.created_at} body={m.body} internal={m.internal} staff={m.author_kind === "staff"} />
            ))}
          </div>

          <ReplyBox ticket={ticket} onSent={refresh} insertion={insertion} />
        </div>

        <div className="space-y-3">
          <ScriptRail ticket={ticket} onInsert={insert} />
          <details className="rounded-xl border border-border bg-card p-3">
            <summary className="cursor-pointer text-sm font-semibold">Unlock a badge</summary>
            <div className="mt-2"><UnlockBadge ticketId={ticket.id} subject={ticket.subject} /></div>
          </details>
        </div>
      </div>
    </div>
  );
}
