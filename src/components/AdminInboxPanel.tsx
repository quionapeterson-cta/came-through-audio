import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, CornerUpLeft, Download, Paperclip, Search, Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  inboxAttachmentUrl,
  listInboxThreads,
  openInboxThread,
  replyToInboxThread,
  type InboxAttachment,
  type InboxMailbox,
  type InboxMessage,
  type InboxThreadSummary,
} from "@/lib/inbox.functions";

/**
 * Admin → Inbox (founder, 2026-11-17): mail sent to admin@ and contracts@, as conversations we answer from here.
 *
 * The unread count is never stored: it is counted from the messages, so a badge can't drift low. Opening a thread marks
 * its inbound messages read on the server. A reply leaves from admin@ and is stored on the thread like the mail it
 * answers, so the next person to open it sees both halves.
 *
 * The files stay with the message (founder, 2026-11-17): each one downloads through a link the server signs for a key the
 * message already holds, so the bucket is never made public and a short-lived address is the only way in.
 */

const when = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

/** Attachment sizes travel with the name; the file itself stays in the mailbox that received it. */
function sizeOf(bytes?: number): string {
  if (typeof bytes !== "number" || bytes <= 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const MAILBOX_LABEL: Record<InboxMailbox, string> = { admin: "admin@", contracts: "contracts@" };

/** One file on a message: the name, then the way to open it when we kept it. */
function AttachmentRow({ messageId, file }: { messageId: string; file: InboxAttachment }) {
  const sign = useServerFn(inboxAttachmentUrl);
  const [link, setLink] = useState<string | null>(null);
  const grab = useMutation({
    mutationFn: () => sign({ data: { messageId, storagePath: file.storagePath ?? "" } }),
    onSuccess: (answer) => {
      setLink(answer.url);
      // Signed addresses are short-lived, so the file opens now; the link stays as a fallback if a pop-up is blocked.
      window.open(answer.url, "_blank", "noopener,noreferrer");
    },
  });

  return (
    <li className="flex flex-wrap items-baseline gap-2 text-sm">
      <span className="font-medium">{file.filename}</span>
      {file.mimeType ? (
        <span className="text-xs text-muted-foreground">{file.mimeType}</span>
      ) : null}
      {sizeOf(file.size) ? (
        <span className="text-xs text-muted-foreground">{sizeOf(file.size)}</span>
      ) : null}
      {file.storagePath ? (
        <span className="ml-auto flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={grab.isPending}
            onClick={() => grab.mutate()}
          >
            <Download className="h-3.5 w-3.5" />
            {grab.isPending ? "Preparing…" : "Download"}
          </Button>
          {link ? (
            <a
              className="text-xs font-semibold text-primary underline"
              href={link}
              target="_blank"
              rel="noreferrer"
            >
              Open
            </a>
          ) : null}
          {grab.isError ? (
            <span className="text-xs text-destructive">{(grab.error as Error).message}</span>
          ) : null}
        </span>
      ) : (
        <span className="text-xs text-muted-foreground">
          not kept{file.reason ? ` · ${file.reason}` : ""}
        </span>
      )}
    </li>
  );
}

function Attachments({ message }: { message: InboxMessage }) {
  if (!message.attachments.length) return null;
  return (
    <div className="mt-3 rounded-lg border border-border bg-muted/40 p-2.5">
      <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
        <Paperclip className="h-3.5 w-3.5" />
        {message.attachments.length === 1
          ? "1 attachment"
          : `${message.attachments.length} attachments`}
      </p>
      <ul className="mt-1.5 space-y-1">
        {message.attachments.map((file, i) => (
          <AttachmentRow key={`${file.filename}-${i}`} messageId={message.id} file={file} />
        ))}
      </ul>
      {message.attachments.some((file) => !file.storagePath) ? (
        <p className="mt-1.5 text-xs text-muted-foreground">
          A file listed as not kept arrived over the 10 MB cap, so only its name is here. Ask the
          sender for a download link, or file it yourself on Send us a file.
        </p>
      ) : null}
    </div>
  );
}

function ThreadView({ id, onClose }: { id: string; onClose: () => void }) {
  const queryClient = useQueryClient();
  const open = useServerFn(openInboxThread);
  const reply = useServerFn(replyToInboxThread);
  const [body, setBody] = useState("");

  const thread = useQuery({
    queryKey: ["inbox-thread", id],
    queryFn: () => open({ data: { threadId: id } }),
  });

  const send = useMutation({
    mutationFn: (text: string) => reply({ data: { threadId: id, body: text } }),
    onSuccess: async () => {
      setBody("");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["inbox-thread", id] }),
        queryClient.invalidateQueries({ queryKey: ["inbox-threads"] }),
        queryClient.invalidateQueries({ queryKey: ["inbox-unread"] }),
      ]);
    },
  });

  if (thread.isLoading) return <p className="mt-6 text-muted-foreground">Loading…</p>;
  if (thread.isError || !thread.data)
    return <p className="mt-6 text-destructive">Couldn't load this conversation.</p>;
  const t = thread.data;

  return (
    <div className="mt-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button variant="ghost" onClick={onClose}>
          <ArrowLeft className="h-4 w-4" />
          All mail
        </Button>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Badge variant="outline">{MAILBOX_LABEL[t.mailbox]}</Badge>
          <span>{t.counterpartName || t.counterpartEmail}</span>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold">{t.subject || "(no subject)"}</h3>
        <p className="text-sm text-muted-foreground">
          {t.counterpartName ? `${t.counterpartName} · ` : ""}
          {t.counterpartEmail}
        </p>
      </div>

      <div className="space-y-3">
        {t.messages.map((m) => (
          <article
            key={m.id}
            className={`rounded-xl border p-4 ${m.direction === "outbound" ? "border-primary/40 bg-primary/5" : "border-border bg-card"}`}
          >
            <header className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-sm font-semibold">
                {m.direction === "outbound" ? "You" : m.fromName || m.fromEmail}
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  {m.fromEmail}
                </span>
              </p>
              <p className="text-xs text-muted-foreground">{when(m.receivedAt)}</p>
            </header>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">
              {m.text?.trim() || "(no plain-text body)"}
            </p>
            <Attachments message={m} />
          </article>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <label htmlFor="inbox-reply" className="flex items-center gap-1.5 text-sm font-semibold">
          <CornerUpLeft className="h-4 w-4" />
          Reply as admin@camethroughaudio.com
        </label>
        <Textarea
          id="inbox-reply"
          className="mt-2"
          rows={6}
          value={body}
          placeholder={`Reply to ${t.counterpartName || t.counterpartEmail}`}
          onChange={(e) => setBody(e.target.value)}
        />
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            {send.isError ? (
              <span className="text-destructive">{(send.error as Error).message}</span>
            ) : (
              "It is sent to them and saved on this thread."
            )}
          </p>
          <Button disabled={!body.trim() || send.isPending} onClick={() => send.mutate(body)}>
            <Send className="h-4 w-4" />
            {send.isPending ? "Sending…" : "Send reply"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function AdminInboxPanel() {
  const list = useServerFn(listInboxThreads);
  const [filter, setFilter] = useState<"all" | "unread" | InboxMailbox>("all");
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ["inbox-threads"],
    queryFn: () => list(),
    refetchInterval: 60000,
  });
  const all = useMemo(() => (q.data ?? []) as InboxThreadSummary[], [q.data]);
  const unread = all.reduce((sum, t) => sum + t.unread, 0);

  const rows = useMemo(() => {
    const term = query.trim().toLowerCase();
    return all.filter((t) => {
      if (filter === "unread" && !t.unread) return false;
      if (filter !== "all" && filter !== "unread" && t.mailbox !== filter) return false;
      if (!term) return true;
      return `${t.subject} ${t.counterpartName ?? ""} ${t.counterpartEmail}`
        .toLowerCase()
        .includes(term);
    });
  }, [all, filter, query]);

  if (openId) return <ThreadView id={openId} onClose={() => setOpenId(null)} />;
  if (q.isLoading) return <p className="mt-6 text-muted-foreground">Loading…</p>;
  if (q.isError) return <p className="mt-6 text-destructive">Couldn't load the inbox.</p>;

  return (
    <div className="mt-4 space-y-3">
      <p className="text-sm text-muted-foreground">
        Mail sent to admin@ and contracts@. Unread is counted from the messages themselves, so the
        badge and this list can't disagree. Opening a conversation marks it read; a reply leaves
        from admin@ and is saved on the thread.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        {(["all", "unread", "admin", "contracts"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full border px-3 py-1 text-sm font-semibold ${
              filter === f ? "border-primary bg-primary text-primary-foreground" : "border-border"
            }`}
          >
            {f === "all" ? "All" : f === "unread" ? `Unread (${unread})` : MAILBOX_LABEL[f]}
          </button>
        ))}
        <label className="ml-auto flex items-center gap-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            className="w-56"
            placeholder="Search sender or subject"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
      </div>

      {!rows.length ? (
        <div className="rounded-2xl border border-border bg-card p-8 text-center text-muted-foreground">
          {all.length
            ? "Nothing matches this view."
            : "No mail yet. Messages sent to admin@ and contracts@ appear here once Email Routing points them at the inbox."}
        </div>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
          {rows.map((t) => (
            <li key={t.id}>
              <button
                className="flex w-full flex-wrap items-baseline gap-2 px-4 py-3 text-left hover:bg-muted/50"
                onClick={() => setOpenId(t.id)}
              >
                <span
                  className={`flex-1 truncate text-sm ${t.unread ? "font-semibold" : "font-medium"}`}
                >
                  {t.counterpartName || t.counterpartEmail}
                  <span className="ml-2 font-normal text-muted-foreground">
                    {t.subject || "(no subject)"}
                  </span>
                </span>
                {t.unread ? <Badge>{t.unread}</Badge> : null}
                <Badge variant="outline">{MAILBOX_LABEL[t.mailbox]}</Badge>
                <span className="text-xs text-muted-foreground">{when(t.lastMessageAt)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
