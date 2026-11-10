import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle2, MessageSquare, Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { listMyTickets, listTicketThread, markTicketRead, replyAsMember } from "@/lib/support.functions";
import { canSendReply, isClosed, memberUnread, memberVisible, ticketCode, type ThreadMessage, type TicketRecord } from "@/lib/support-replies";

type MyTicket = TicketRecord & { last_staff_at: string | null };

/** What the member calls each state. `waiting` is theirs to act on; `resolved` is closed for good. */
const MEMBER_STATUS: Record<string, string> = {
  open: "Open",
  in_progress: "We're on it",
  waiting: "Waiting on you",
  resolved: "Resolved and closed",
};

const when = (iso: string) => new Date(iso).toLocaleString();

/**
 * The member's own Support tab (founder, 2026-11-08). A native reply is only half a feature if the person who wrote in
 * can't read it, so their tickets live here: the thread, the status, and a message box that answers the same ticket.
 *
 * The reply email links straight here with `?tab=support&ticket=<id>`, so one click from the inbox lands on the message
 * box, not on the workspace front door.
 */
export function SupportCenter({ userId, openTicketId }: { userId: string; openTicketId?: string | undefined }) {
  const list = useServerFn(listMyTickets);
  const q = useQuery({ queryKey: ["my-tickets", userId], queryFn: () => list() });
  const [selected, setSelected] = useState<string | undefined>(openTicketId);
  const [openedFromLink, setOpenedFromLink] = useState(!!openTicketId);

  useEffect(() => { if (openTicketId) { setSelected(openTicketId); setOpenedFromLink(true); } }, [openTicketId]);

  const tickets = (q.data ?? []) as MyTicket[];
  const ticket = tickets.find((t) => t.id === selected);

  if (ticket) {
    return (
      <MemberThread
        ticket={ticket}
        focus={openedFromLink}
        onBack={() => { setSelected(undefined); setOpenedFromLink(false); }}
        onChanged={() => { void q.refetch(); }}
      />
    );
  }

  if (q.isLoading) return <p className="mt-6 text-muted-foreground">Loading your tickets…</p>;
  if (q.isError) return (
    <div className="mt-6 space-y-2">
      <p className="text-destructive">Couldn't load your tickets.</p>
      <Button size="sm" variant="outline" onClick={() => void q.refetch()}>Try again</Button>
    </div>
  );

  return (
    <div className="mt-4 space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-2xl font-bold">Support</h2>
          <p className="mt-1 text-sm text-muted-foreground">Your tickets, the replies, and one place to answer them.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* A general question is not a ticket: it has its own half of /contact, and the link says so. */}
          <Button asChild variant="ghost"><Link to="/contact" search={{ type: "contact" }}>General inquiry</Link></Button>
          <Button asChild variant="outline"><Link to="/contact" search={{ type: "support" }}>Open a new ticket</Link></Button>
        </div>
      </div>

      {!tickets.length ? (
        <div className="rounded-2xl border border-border bg-card p-8 text-center">
          <MessageSquare className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 font-semibold">No tickets yet</p>
          <p className="mt-1 text-sm text-muted-foreground">When you write to us, the whole conversation lives here as well as in your inbox.</p>
          <Button asChild className="mt-4"><Link to="/contact" search={{ type: "support" }}>Open a support ticket</Link></Button>
        </div>
      ) : (
        <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
          {tickets.map((t) => {
            const unread = memberUnread(t, t.last_staff_at);
            return (
              <button key={t.id} onClick={() => { setSelected(t.id); setOpenedFromLink(false); }} className="flex w-full flex-wrap items-center justify-between gap-2 p-4 text-left hover:bg-muted/60">
                <span className="min-w-0">
                  <span className="flex items-center gap-2 font-semibold">
                    {unread ? <span className="h-2 w-2 shrink-0 rounded-full bg-primary" aria-label="Support replied" /> : null}
                    {t.subject}
                  </span>
                  <span className="block text-sm text-muted-foreground">
                    {unread && t.last_staff_at ? `Support replied ${new Date(t.last_staff_at).toLocaleDateString()} · ` : `Opened ${new Date(t.created_at).toLocaleDateString()} · `}
                    Ticket #{ticketCode(t.id)}
                  </span>
                </span>
                <Badge className={isClosed(t) ? "" : "bg-primary text-primary-foreground"} variant={isClosed(t) ? "outline" : "default"}>
                  {MEMBER_STATUS[t.status] ?? t.status}
                </Badge>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function MemberThread({ ticket, focus, onBack, onChanged }: {
  ticket: MyTicket;
  focus: boolean;
  onBack: () => void;
  onChanged: () => void;
}) {
  const fetchThread = useServerFn(listTicketThread);
  const markRead = useServerFn(markTicketRead);
  const send = useServerFn(replyAsMember);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["my-ticket-thread", ticket.id], queryFn: () => fetchThread({ data: { ticketId: ticket.id } }) });
  // The server filters internal notes out of a member's copy; this is the second lock, so a staff note never renders
  // in the member's thread even if a future query forgets.
  const messages = memberVisible(q.data?.messages ?? []);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const box = useRef<HTMLTextAreaElement>(null);
  const closed = isClosed(ticket);

  useEffect(() => {
    if (!q.isSuccess) return;
    void markRead({ data: { ticketId: ticket.id } }).then(() => onChanged()).catch(() => {});
  }, [q.isSuccess, messages.length, ticket.id]);

  // Arriving from the reply email: the thread opens on the message box, ready to type in.
  useEffect(() => {
    if (!focus || !q.isSuccess) return;
    const id = window.setTimeout(() => {
      document.getElementById("reply")?.scrollIntoView({ block: "center", behavior: "smooth" });
      box.current?.focus();
    }, 200);
    return () => window.clearTimeout(id);
  }, [focus, q.isSuccess]);

  async function submit() {
    const check = canSendReply(body, false);
    if (!check.ok) { toast.error(check.error); return; }
    setBusy(true);
    try {
      await send({ data: { ticketId: ticket.id, body: body.trim() } });
      setBody("");
      toast.success("Sent. It's on the same ticket, and the team sees it in the queue.");
      await qc.invalidateQueries({ queryKey: ["my-ticket-thread", ticket.id] });
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't send your message.");
    } finally { setBusy(false); }
  }

  return (
    <div className="mt-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="ghost" onClick={onBack}><ArrowLeft className="h-4 w-4" />All tickets</Button>
        <Badge className="ml-auto" variant={closed ? "outline" : "default"}>{MEMBER_STATUS[ticket.status] ?? ticket.status}</Badge>
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <h2 className="text-xl font-bold">{ticket.subject}</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Ticket #{ticketCode(ticket.id)} · {ticket.category} · opened {when(ticket.created_at)}
        </p>
      </div>

      <div className="space-y-2">
        <div className="rounded-xl border border-border bg-muted/40 p-3">
          <p className="text-xs text-muted-foreground"><span className="font-semibold text-foreground">You</span> · {when(ticket.created_at)}</p>
          <p className="mt-2 whitespace-pre-wrap break-words text-sm">{ticket.message}</p>
        </div>
        {q.isLoading ? <p className="text-sm text-muted-foreground">Loading the conversation…</p> : null}
        {q.isError ? (
          <div className="space-y-2">
            <p className="text-sm text-destructive">Couldn't load the conversation.</p>
            <Button size="sm" variant="outline" onClick={() => void q.refetch()}>Try again</Button>
          </div>
        ) : null}
        {messages.map((m: ThreadMessage) => {
          const mine = m.author_kind === "member";
          return (
            <div key={m.id} className={mine ? "rounded-xl border border-border bg-muted/40 p-3" : "rounded-xl border border-primary/40 bg-primary/5 p-3"}>
              <p className="text-xs text-muted-foreground"><span className="font-semibold text-foreground">{mine ? "You" : m.author_name}</span> · {when(m.created_at)}</p>
              <p className="mt-2 whitespace-pre-wrap break-words text-sm">{m.body}</p>
            </div>
          );
        })}
      </div>

      {closed ? (
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="flex items-center gap-2 font-semibold"><CheckCircle2 className="h-4 w-4 text-primary" />This ticket is resolved and closed.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            The conversation stays here to read. If something else comes up, open a new ticket and we'll pick it up — you
            don't need to quote this one.
          </p>
          <Button asChild className="mt-3" variant="outline"><Link to="/contact" search={{ type: "support" }}>Open a new ticket</Link></Button>
        </div>
      ) : (
        <div id="reply" className="rounded-xl border border-border bg-card p-3">
          <p className="text-sm font-semibold">Reply on this ticket</p>
          <label htmlFor="member-reply" className="sr-only">Your message</label>
          <Textarea
            id="member-reply"
            ref={box}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); void submit(); } }}
            rows={5}
            maxLength={8000}
            placeholder="Add anything that helps — a song name, a screenshot, the email on the account."
            className="mt-2"
          />
          <div className="mt-2 flex items-center gap-2">
            <span className="text-xs text-muted-foreground">It lands on the same ticket, so you never repeat yourself.</span>
            <Button className="ml-auto" disabled={busy || !body.trim()} onClick={() => void submit()}>
              <Send className="h-4 w-4" />{busy ? "Sending…" : "Send"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
