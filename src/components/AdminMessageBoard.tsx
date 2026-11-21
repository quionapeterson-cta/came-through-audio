import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, CheckCircle2, Flag, MessageSquarePlus, Send, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  BOARD_CATEGORIES,
  BOARD_CATEGORY_HINT,
  BOARD_CATEGORY_LABEL,
  BOARD_POSTABLE_CATEGORIES,
  BOARD_PRIORITIES,
  BOARD_PRIORITY_LABEL,
  BOARD_STATUSES,
  BOARD_STATUS_LABEL,
  isBoardCategory,
  type BoardCategory,
  type BoardPriority,
  type BoardStatus,
} from "@/lib/board";
import {
  createBoardThread,
  listBoardThreads,
  openBoardThread,
  replyToBoardThread,
  setBoardThreadStatus,
  type BoardThread,
} from "@/lib/board.functions";

/**
 * Admin → Message Board (founder, 2026-11-18): the super admin's threaded board, in the founder's five categories.
 *
 * It is the place a registration issue lands when someone presses Report an Issue, so a reported case has a thread, a
 * priority and a "Mark Resolved" that settles the registration too. Staff see the threads they opened; a super admin
 * sees everything.
 *
 * This is additive to Admin → Team Board (the cross-department pulse and its coordination notices), which is unchanged.
 */

const when = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

const priorityTone = (priority: BoardPriority) =>
  priority === "urgent" ? "destructive" : priority === "high" ? "default" : "secondary";

export function AdminMessageBoard({
  isSuper,
  onOpenCase,
}: {
  isSuper: boolean;
  onOpenCase?: ((purchaseId: string) => void) | undefined;
}) {
  const qc = useQueryClient();
  const threads = useQuery({
    queryKey: ["board-threads"],
    queryFn: () => listBoardThreads(),
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });
  const [category, setCategory] = useState<BoardCategory | "all">("all");
  const [openId, setOpenId] = useState<string | null>(null);

  const refresh = () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ["board-threads"] }),
      qc.invalidateQueries({ queryKey: ["board-unread"] }),
    ]);

  const rows = (threads.data ?? []).filter(
    (thread) => category === "all" || thread.category === category,
  );
  const counts = (threads.data ?? []).reduce<Record<string, number>>((totals, thread) => {
    totals[thread.category] = (totals[thread.category] ?? 0) + 1;
    return totals;
  }, {});
  const unread = (threads.data ?? []).reduce((total, thread) => total + thread.unread, 0);

  if (openId) {
    const thread = (threads.data ?? []).find((row) => row.id === openId) ?? null;
    return (
      <ThreadView
        id={openId}
        summary={thread}
        isSuper={isSuper}
        onBack={() => setOpenId(null)}
        onOpenCase={onOpenCase}
        onChange={() => void refresh()}
      />
    );
  }

  return (
    <div className="mt-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-lg font-bold">Super Admin Message Board</h2>
          <p className="text-sm text-muted-foreground">
            Reported issues, agency escalations, client follow-ups, billing audits and announcements
            — threaded, with priorities and unread counts.
          </p>
        </div>
        {unread > 0 && <Badge variant="default">{unread} unread</Badge>}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setCategory("all")}
          className={`min-h-11 rounded-full border px-3 text-xs font-semibold ${
            category === "all"
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-card"
          }`}
        >
          All threads {(threads.data ?? []).length}
        </button>
        {BOARD_CATEGORIES.map((entry) => (
          <button
            key={entry.value}
            type="button"
            onClick={() => setCategory(entry.value)}
            className={`min-h-11 rounded-full border px-3 text-xs font-semibold ${
              category === entry.value
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card"
            }`}
          >
            {entry.label} {counts[entry.value] ?? 0}
          </button>
        ))}
      </div>

      {category !== "all" && (
        <p className="text-xs text-muted-foreground">{BOARD_CATEGORY_HINT[category]}</p>
      )}

      <NewThread />

      {threads.isLoading ? (
        <p className="text-muted-foreground">Loading the board…</p>
      ) : threads.isError ? (
        <p className="text-destructive">
          Couldn't load the board ({(threads.error as Error).message}). Run migration 20261118160000
          first.
        </p>
      ) : rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          No threads in this category yet.
        </p>
      ) : (
        <ul className="space-y-2">
          {rows.map((thread) => (
            <li key={thread.id}>
              <button
                type="button"
                onClick={() => setOpenId(thread.id)}
                className="w-full min-h-11 rounded-xl border border-border bg-card p-3 text-left transition-colors hover:border-primary/60"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={priorityTone(thread.priority)} className="text-[10px]">
                    {BOARD_PRIORITY_LABEL[thread.priority]}
                  </Badge>
                  <Badge variant="outline" className="text-[10px]">
                    {BOARD_STATUS_LABEL[thread.status]}
                  </Badge>
                  {thread.unread > 0 && (
                    <Badge variant="default" className="text-[10px]">
                      {thread.unread} new
                    </Badge>
                  )}
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    {BOARD_CATEGORY_LABEL[thread.category]}
                  </span>
                </div>
                <p className="mt-1 break-words text-sm font-semibold">{thread.title}</p>
                <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{thread.createdName}</span>
                  <span>{when(thread.lastReplyAt)}</span>
                  <span>
                    {thread.replies} {thread.replies === 1 ? "reply" : "replies"}
                  </span>
                  {thread.userName ? <span>· {thread.userName}</span> : null}
                </p>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** A super admin directive, an escalation or a handover. A reported issue is only opened from a registration. */
function NewThread() {
  const qc = useQueryClient();
  const create = useServerFn(createBoardThread);
  const [category, setCategory] = useState<BoardCategory>(
    BOARD_POSTABLE_CATEGORIES[0] ?? "announcements",
  );
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [priority, setPriority] = useState<BoardPriority>("normal");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      await create({ data: { category, title: title.trim(), body: body.trim(), priority } });
      setTitle("");
      setBody("");
      setPriority("normal");
      toast.success("Posted to the board.");
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["board-threads"] }),
        qc.invalidateQueries({ queryKey: ["board-unread"] }),
      ]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't post that.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <details className="rounded-xl border border-border bg-card">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 p-4 text-sm font-semibold [&::-webkit-details-marker]:hidden">
        <MessageSquarePlus className="h-4 w-4 text-primary" />
        Open a thread
      </summary>
      <div className="space-y-2 border-t border-border p-4">
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="font-medium">Category</span>
            <select
              className="mt-1 min-h-11 w-full rounded-md border border-input bg-background px-2"
              value={category}
              onChange={(event) => setCategory(event.target.value as BoardCategory)}
            >
              {BOARD_POSTABLE_CATEGORIES.map((value) => (
                <option key={value} value={value}>
                  {BOARD_CATEGORY_LABEL[value]}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="font-medium">Priority</span>
            <select
              className="mt-1 min-h-11 w-full rounded-md border border-input bg-background px-2"
              value={priority}
              onChange={(event) => setPriority(event.target.value as BoardPriority)}
            >
              {BOARD_PRIORITIES.map((value) => (
                <option key={value} value={value}>
                  {BOARD_PRIORITY_LABEL[value]}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="block text-sm">
          <span className="font-medium">Title</span>
          <Input
            className="mt-1 min-h-11"
            value={title}
            maxLength={200}
            placeholder="The MLC invite arrived for a different address"
            onChange={(event) => setTitle(event.target.value)}
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium">What does the super admin need to know?</span>
          <Textarea
            className="mt-1 min-h-24"
            value={body}
            maxLength={8000}
            placeholder="What is blocked, who is affected, and what has been tried. Tag a teammate with their full @address."
            onChange={(event) => setBody(event.target.value)}
          />
        </label>
        <div className="flex justify-end">
          <Button
            className="min-h-11"
            disabled={busy || title.trim().length < 3 || body.trim().length < 3}
            onClick={() => void submit()}
          >
            {busy ? "Posting…" : "Post thread"}
          </Button>
        </div>
      </div>
    </details>
  );
}

function ThreadView({
  id,
  summary,
  isSuper,
  onBack,
  onOpenCase,
  onChange,
}: {
  id: string;
  summary: BoardThread | null;
  isSuper: boolean;
  onBack: () => void;
  onOpenCase?: ((purchaseId: string) => void) | undefined;
  onChange: () => void;
}) {
  const qc = useQueryClient();
  const open = useServerFn(openBoardThread);
  const reply = useServerFn(replyToBoardThread);
  const setStatus = useServerFn(setBoardThreadStatus);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  const thread = useQuery({
    queryKey: ["board-thread", id],
    queryFn: () => open({ data: { threadId: id } }),
  });
  const detail = thread.data ?? null;

  const send = useMutation({
    mutationFn: (text: string) => reply({ data: { threadId: id, body: text } }),
    onSuccess: async () => {
      setBody("");
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["board-thread", id] }),
        qc.invalidateQueries({ queryKey: ["board-threads"] }),
        qc.invalidateQueries({ queryKey: ["board-unread"] }),
      ]);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Couldn't send that."),
  });

  const move = async (status: BoardStatus) => {
    setBusy(true);
    try {
      await setStatus({ data: { threadId: id, status } });
      toast.success(BOARD_STATUS_LABEL[status]);
      onChange();
      await qc.invalidateQueries({ queryKey: ["board-thread", id] });
      await qc.invalidateQueries({ queryKey: ["registration-queue"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't move that thread.");
    } finally {
      setBusy(false);
    }
  };

  if (thread.isLoading) return <p className="mt-6 text-muted-foreground">Loading…</p>;
  if (thread.isError || !detail)
    return <p className="mt-6 text-destructive">Couldn't load this thread.</p>;

  return (
    <div className="mt-4 space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" className="min-h-11" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
          Board
        </Button>
        <Badge variant={priorityTone(detail.priority)}>
          {BOARD_PRIORITY_LABEL[detail.priority]}
        </Badge>
        <Badge variant="outline">{BOARD_STATUS_LABEL[detail.status]}</Badge>
        <span className="text-xs uppercase tracking-wide text-muted-foreground">
          {BOARD_CATEGORY_LABEL[detail.category]}
        </span>
      </div>

      <div className="min-w-0">
        <h2 className="break-words text-lg font-bold">{detail.title}</h2>
        <p className="text-xs text-muted-foreground">
          Opened by {detail.createdName} · {when(detail.createdAt)}
        </p>
        {(detail.userName || detail.userEmail) && (
          <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <UserRound className="h-3.5 w-3.5" />
            {detail.userName ?? "Customer"}
            {detail.userEmail ? ` · ${detail.userEmail}` : ""}
          </p>
        )}
      </div>

      {detail.purchaseId && onOpenCase && (
        <Button
          size="sm"
          variant="outline"
          className="min-h-11"
          onClick={() => onOpenCase(detail.purchaseId!)}
        >
          <Flag className="h-4 w-4" />
          Open this customer in Registrations
        </Button>
      )}

      {isSuper && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-3">
          <label className="flex items-center gap-2 text-xs font-medium">
            Thread status
            <select
              className="min-h-11 rounded-md border border-input bg-background px-2 text-xs"
              value={detail.status}
              disabled={busy}
              onChange={(event) => void move(event.target.value as BoardStatus)}
            >
              {BOARD_STATUSES.map((value) => (
                <option key={value} value={value}>
                  {BOARD_STATUS_LABEL[value]}
                </option>
              ))}
            </select>
          </label>
          {detail.issueId && detail.status !== "resolved" && (
            <Button className="min-h-11" disabled={busy} onClick={() => void move("resolved")}>
              <CheckCircle2 className="h-4 w-4" />
              Mark Resolved
            </Button>
          )}
          {detail.issueId && (
            <span className="text-xs text-muted-foreground">
              Resolving this thread also settles the reported registration issue.
            </span>
          )}
        </div>
      )}

      <ul className="space-y-3">
        {detail.messages.map((message) => (
          <li key={message.id} className="rounded-xl border border-border bg-card p-3">
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="text-sm font-semibold">{message.authorName}</span>
              <span className="text-xs text-muted-foreground">{when(message.createdAt)}</span>
              {message.mentions.length > 0 && (
                <span className="flex flex-wrap gap-1">
                  {message.mentions.map((mention) => (
                    <Badge key={mention} variant="secondary" className="text-[10px]">
                      @{mention}
                    </Badge>
                  ))}
                </span>
              )}
            </div>
            <p className="mt-1 whitespace-pre-wrap break-words text-sm">{message.body}</p>
          </li>
        ))}
      </ul>

      <div className="rounded-xl border border-border bg-card p-3">
        <Textarea
          aria-label="Reply to this thread"
          className="min-h-24"
          value={body}
          maxLength={8000}
          placeholder="Reply. Tag a teammate with their full @address so the mention is recorded."
          onChange={(event) => setBody(event.target.value)}
        />
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">{body.length}/8000</span>
          <Button
            className="min-h-11"
            disabled={send.isPending || !body.trim()}
            onClick={() => send.mutate(body.trim())}
          >
            <Send className="h-4 w-4" />
            {send.isPending ? "Sending…" : "Reply"}
          </Button>
        </div>
      </div>
      {summary?.replies ? (
        <p className="text-xs text-muted-foreground">
          This thread has {summary.replies} replies recorded.
        </p>
      ) : null}
    </div>
  );
}

export const boardCategoryLabel = (value: string) =>
  isBoardCategory(value) ? BOARD_CATEGORY_LABEL[value] : value;
