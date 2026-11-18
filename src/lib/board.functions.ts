import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  BOARD_POSTABLE_CATEGORIES,
  isBoardCategory,
  isBoardPriority,
  isBoardStatus,
  issueTitle,
  mentionsIn,
  type BoardCategory,
  type BoardPriority,
  type BoardStatus,
} from "./board";

/**
 * The Super Admin message board and "Report an Issue" (founder, 2026-11-18).
 *
 * A reported issue is never a second system: it writes `registration_issues` for the song and opens the board thread that
 * tracks it, so "Mark Resolved" in one place settles the case the registration card is still showing. The board's five
 * categories, priorities and states come from `src/lib/board.ts`, the same module the panel reads.
 *
 * Unread is counted, never stored: a reply is unread until the viewer's own `admin_board_reads` row is newer than it.
 * Reads use the service role because a list needs several tables at once, so every read is gated here first — a
 * super admin sees the board, the registration desk sees what it filed.
 */

type Db = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];

/** What the board shows for one thread. */
export type BoardThread = {
  id: string;
  category: BoardCategory;
  title: string;
  priority: BoardPriority;
  status: BoardStatus;
  createdName: string;
  createdAt: string;
  lastReplyAt: string;
  /** The registration case this thread came from, so the panel can open that customer's card again. */
  issueId: string | null;
  purchaseId: string | null;
  songId: string | null;
  userEmail: string | null;
  userName: string | null;
  replies: number;
  unread: number;
};

export type BoardReply = {
  id: string;
  body: string;
  authorName: string;
  authorId: string | null;
  createdAt: string;
  mentions: string[];
};

export type BoardThreadDetail = BoardThread & { messages: BoardReply[] };

type ThreadRow = {
  id: string;
  category: string;
  title: string;
  priority: string;
  status: string;
  created_by: string | null;
  created_name: string | null;
  issue_id: string | null;
  purchase_id: string | null;
  song_id: string | null;
  user_email: string | null;
  user_name: string | null;
  created_at: string;
  last_reply_at: string;
};

type ReplyRow = {
  id: string;
  thread_id: string;
  body: string;
  author_id: string | null;
  author_name: string | null;
  mentions: string[] | null;
  created_at: string;
};

async function boardDb(context: { supabase: unknown; userId: string }): Promise<{ db: Db; isSuper: boolean }> {
  const client = context.supabase as {
    rpc: (fn: "has_role", args: { _user_id: string; _role: "super_admin" }) => PromiseLike<{ data: unknown }>;
  };
  const { data } = await client.rpc("has_role", { _user_id: context.userId, _role: "super_admin" });
  const isSuper = !!data;
  if (!isSuper) {
    const { requireRegistrationStaff } = await import("./registration.server");
    await requireRegistrationStaff(context);
  }
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return { db: supabaseAdmin, isSuper };
}

/** The board is a super admin's, so changing a thread's state is theirs alone. */
async function requireSuperAdmin(context: { supabase: unknown; userId: string }) {
  const { isSuper } = await boardDb(context);
  if (!isSuper) throw new Error("Only a super admin can change the board.");
}

/** A thread is visible to a super admin, and to the staff member who opened it. */
async function visibleThread(db: Db, threadId: string, userId: string, isSuper: boolean): Promise<ThreadRow> {
  const { data } = await db.from("admin_board_threads" as never).select("*").eq("id", threadId).maybeSingle();
  const thread = data as ThreadRow | null;
  if (!thread) throw new Error("That thread doesn't exist.");
  if (!isSuper && thread.created_by !== userId) throw new Error("That thread belongs to a super admin.");
  return thread;
}

function toThread(row: ThreadRow, replies: number, unread: number): BoardThread {
  return {
    id: row.id,
    category: isBoardCategory(row.category) ? row.category : "announcements",
    title: row.title,
    priority: isBoardPriority(row.priority) ? row.priority : "normal",
    status: isBoardStatus(row.status) ? row.status : "open",
    createdName: row.created_name ?? "Came Through Audio",
    createdAt: row.created_at,
    lastReplyAt: row.last_reply_at,
    issueId: row.issue_id,
    purchaseId: row.purchase_id,
    songId: row.song_id,
    userEmail: row.user_email,
    userName: row.user_name,
    replies,
    unread,
  };
}

function toReply(row: ReplyRow): BoardReply {
  return {
    id: row.id,
    body: row.body,
    authorName: row.author_name ?? "A teammate",
    authorId: row.author_id,
    createdAt: row.created_at,
    mentions: Array.isArray(row.mentions) ? row.mentions : [],
  };
}

/** Threads newest activity first, with the reply count and the viewer's own unread count. */
export const listBoardThreads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<BoardThread[]> => {
    const { db, isSuper } = await boardDb(context);
    let query = db
      .from("admin_board_threads" as never)
      .select("*")
      .order("last_reply_at", { ascending: false })
      .limit(300);
    // The registration desk reads the threads it filed; a super admin reads all of them.
    if (!isSuper) query = query.eq("created_by", context.userId);
    const { data, error } = await query;
    if (error) throw new Error("Couldn't load the board. Run migration 20261118160000 first.");
    const rows = (data ?? []) as unknown as ThreadRow[];
    if (!rows.length) return [];

    const ids = rows.map((row) => row.id);
    const [{ data: replyRows }, { data: readRows }] = await Promise.all([
      db.from("admin_board_replies" as never).select("thread_id, created_at").in("thread_id", ids).limit(5000),
      db.from("admin_board_reads" as never).select("thread_id, read_at").eq("user_id", context.userId).in("thread_id", ids),
    ]);

    const readAt = new Map(
      ((readRows ?? []) as unknown as { thread_id: string; read_at: string }[]).map((row) => [row.thread_id, row.read_at]),
    );
    const totals = new Map<string, number>();
    const unread = new Map<string, number>();
    for (const reply of (replyRows ?? []) as unknown as { thread_id: string; created_at: string }[]) {
      totals.set(reply.thread_id, (totals.get(reply.thread_id) ?? 0) + 1);
      const seen = readAt.get(reply.thread_id);
      if (!seen || Date.parse(reply.created_at) > Date.parse(seen)) {
        unread.set(reply.thread_id, (unread.get(reply.thread_id) ?? 0) + 1);
      }
    }

    return rows.map((row) => toThread(row, totals.get(row.id) ?? 0, unread.get(row.id) ?? 0));
  });

/** The tab's badge: unread replies across every thread this person can read. Counted, never stored. */
export const boardUnreadCount = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<number> => {
    const { db, isSuper } = await boardDb(context);
    let threadQuery = db.from("admin_board_threads" as never).select("id").limit(500);
    if (!isSuper) threadQuery = threadQuery.eq("created_by", context.userId);
    const { data: threads } = await threadQuery;
    const ids = ((threads ?? []) as unknown as { id: string }[]).map((row) => row.id);
    if (!ids.length) return 0;
    const [{ data: replyRows }, { data: readRows }] = await Promise.all([
      db.from("admin_board_replies" as never).select("thread_id, created_at").in("thread_id", ids).limit(5000),
      db.from("admin_board_reads" as never).select("thread_id, read_at").eq("user_id", context.userId).in("thread_id", ids),
    ]);
    const readAt = new Map(
      ((readRows ?? []) as unknown as { thread_id: string; read_at: string }[]).map((row) => [row.thread_id, row.read_at]),
    );
    let count = 0;
    for (const reply of (replyRows ?? []) as unknown as { thread_id: string; created_at: string }[]) {
      const seen = readAt.get(reply.thread_id);
      if (!seen || Date.parse(reply.created_at) > Date.parse(seen)) count += 1;
    }
    return count;
  });

/** One thread with its replies, oldest first. Opening it is reading it. */
export const openBoardThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ threadId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<BoardThreadDetail> => {
    const { db, isSuper } = await boardDb(context);
    const thread = await visibleThread(db, data.threadId, context.userId, isSuper);
    const { data: replyRows } = await db
      .from("admin_board_replies" as never)
      .select("*")
      .eq("thread_id", data.threadId)
      .order("created_at")
      .limit(500);
    const messages = ((replyRows ?? []) as unknown as ReplyRow[]).map(toReply);

    // The read mark is the viewer's own row, moved to now; a failed write only means the badge stays unread, which is
    // the safe direction to fail in.
    await db
      .from("admin_board_reads" as never)
      .upsert(
        { thread_id: data.threadId, user_id: context.userId, read_at: new Date().toISOString() } as never,
        { onConflict: "thread_id,user_id" } as never,
      );

    return { ...toThread(thread, messages.length, 0), messages };
  });

/** Adds a reply to a thread, naming whoever is tagged with a full @address. */
export const replyToBoardThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ threadId: z.string().uuid(), body: z.string().trim().min(1).max(8000) }).parse(d))
  .handler(async ({ data, context }) => {
    const { db, isSuper } = await boardDb(context);
    await visibleThread(db, data.threadId, context.userId, isSuper);
    const { staffName } = await import("./registration.server");
    const authorName = await staffName(db, context.userId);
    const now = new Date().toISOString();
    const { error } = await db.from("admin_board_replies" as never).insert({
      thread_id: data.threadId,
      body: data.body,
      author_id: context.userId,
      author_name: authorName,
      mentions: mentionsIn(data.body),
    } as never);
    if (error) throw new Error(error.message);
    await db
      .from("admin_board_threads" as never)
      .update({ last_reply_at: now, updated_at: now } as never)
      .eq("id", data.threadId);
    // Replying marks the thread read for the person who wrote it.
    await db
      .from("admin_board_reads" as never)
      .upsert({ thread_id: data.threadId, user_id: context.userId, read_at: now } as never, {
        onConflict: "thread_id,user_id",
      } as never);
    return { ok: true };
  });

/** Moves a thread's state; resolving a reported issue settles the registration case too. */
export const setBoardThreadStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ threadId: z.string().uuid(), status: z.string().max(20) }).parse(d))
  .handler(async ({ data, context }) => {
    await requireSuperAdmin(context);
    if (!isBoardStatus(data.status)) throw new Error("That isn't a board status.");
    const { db } = await boardDb(context);
    const thread = await visibleThread(db, data.threadId, context.userId, true);
    const now = new Date().toISOString();
    const { error } = await db
      .from("admin_board_threads" as never)
      .update({ status: data.status, updated_at: now } as never)
      .eq("id", data.threadId);
    if (error) throw new Error(error.message);
    if (data.status === "resolved" && thread.issue_id) {
      await db
        .from("registration_issues" as never)
        .update({ status: "resolved", resolved_at: now, resolved_by: context.userId, updated_at: now } as never)
        .eq("id", thread.issue_id);
    }
    return { ok: true, issueId: thread.issue_id };
  });

/** A directive, an escalation or a handover, opened by hand rather than by a registration card. */
export const createBoardThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      category: z.string().max(40),
      title: z.string().trim().min(3).max(200),
      body: z.string().trim().min(3).max(8000),
      priority: z.string().max(20).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { db } = await boardDb(context);
    if (!isBoardCategory(data.category) || !(BOARD_POSTABLE_CATEGORIES as readonly string[]).includes(data.category)) {
      throw new Error("A reported issue can only be opened from a registration.");
    }
    const priority = data.priority && isBoardPriority(data.priority) ? data.priority : "normal";
    const { staffName } = await import("./registration.server");
    const authorName = await staffName(db, context.userId);
    const now = new Date().toISOString();
    const { data: created, error } = await db
      .from("admin_board_threads" as never)
      .insert({
        category: data.category,
        title: data.title,
        priority,
        status: "open",
        created_by: context.userId,
        created_name: authorName,
        last_reply_at: now,
      } as never)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    const threadId = (created as { id: string }).id;
    const { error: replyError } = await db.from("admin_board_replies" as never).insert({
      thread_id: threadId,
      body: data.body,
      author_id: context.userId,
      author_name: authorName,
      mentions: mentionsIn(data.body),
    } as never);
    if (replyError) throw new Error(replyError.message);
    return { ok: true, threadId };
  });

/**
 * "Report an Issue" on one song: records the issue against it and opens the board thread that tracks it, in one step.
 * The song is optionally set On Hold, which is what the warning banner tells staff to do instead of marking it
 * Registered. The title, ISRC and customer travel with the thread so the board can link back to the card.
 */
export const reportRegistrationIssue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      songId: z.string().uuid(),
      agency: z.enum(["SoundExchange", "The MLC", "ASCAP", "BMI", "Internal/Metadata"]),
      detail: z.string().trim().min(10).max(4000),
      setOnHold: z.boolean().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { db } = await boardDb(context);
    const { staffName } = await import("./registration.server");

    const { data: songRow } = await db
      .from("registration_songs" as never)
      .select("id, purchase_id, user_id, status, snapshot, submitted_at")
      .eq("id", data.songId)
      .maybeSingle();
    const song = songRow as {
      id: string;
      purchase_id: string;
      user_id: string;
      status: Record<string, string>;
      snapshot: { title?: string; artist?: string; isrc?: string } | null;
      submitted_at: string | null;
    } | null;
    if (!song) throw new Error("That song isn't in the queue.");

    // The agencies this order was bought for. A hold is only ever written for one of them: an Internal/Metadata issue is
    // our own problem, and writing it into the status map used to leave a key no agency ever reads.
    const { data: orderRow } = await db
      .from("registration_orders" as never)
      .select("agencies")
      .eq("purchase_id", song.purchase_id)
      .maybeSingle();
    const orderAgencies = ((orderRow as { agencies: string[] | null } | null)?.agencies ?? []).filter(Boolean);

    const { data: profile } = await db.from("profiles").select("stage_name, legal_name").eq("id", song.user_id).maybeSingle();
    const { data: account } = await db.auth.admin.getUserById(song.user_id);
    const userEmail = account.user?.email ?? null;
    const userName = (profile as { stage_name: string | null; legal_name: string | null } | null)?.stage_name
      ?? (profile as { legal_name: string | null } | null)?.legal_name
      ?? userEmail;

    const authorName = await staffName(db, context.userId);
    const now = new Date().toISOString();
    const title = issueTitle({ agency: data.agency, songTitle: song.snapshot?.title?.trim() || "Untitled" });

    const { data: created, error: threadError } = await db
      .from("admin_board_threads" as never)
      .insert({
        category: "reported_issues",
        title,
        priority: data.agency === "Internal/Metadata" ? "normal" : "high",
        status: "open",
        created_by: context.userId,
        created_name: authorName,
        purchase_id: song.purchase_id,
        song_id: song.id,
        user_email: userEmail,
        user_name: userName,
        last_reply_at: now,
      } as never)
      .select("id")
      .single();
    if (threadError) throw new Error(threadError.message);
    const threadId = (created as { id: string }).id;

    const { data: issue, error: issueError } = await db
      .from("registration_issues" as never)
      .insert({
        song_id: song.id,
        purchase_id: song.purchase_id,
        user_id: song.user_id,
        agency: data.agency,
        detail: data.detail,
        status: "open",
        reported_by: context.userId,
        reported_name: authorName,
        thread_id: threadId,
      } as never)
      .select("id")
      .single();
    if (issueError) {
      // The thread points at the issue, so a half-written pair is removed rather than left as an empty thread with
      // nothing to resolve.
      await db.from("admin_board_threads" as never).delete().eq("id", threadId);
      throw new Error(issueError.message);
    }
    const issueId = (issue as { id: string }).id;

    await db.from("admin_board_threads" as never).update({ issue_id: issueId } as never).eq("id", threadId);

    const opening = [
      data.detail,
      "",
      `Agency: ${data.agency}`,
      `Song: ${song.snapshot?.title?.trim() || "Untitled"}${song.snapshot?.artist ? ` — ${song.snapshot.artist}` : ""}`,
      `ISRC: ${song.snapshot?.isrc?.trim() || "not on the submitted copy"}`,
      `Customer: ${userName ?? "unknown"}${userEmail ? ` (${userEmail})` : ""}`,
    ].join("\n");

    const { error: replyError } = await db.from("admin_board_replies" as never).insert({
      thread_id: threadId,
      body: opening,
      author_id: context.userId,
      author_name: authorName,
      mentions: mentionsIn(opening),
    } as never);
    if (replyError) throw new Error(replyError.message);

    if (data.setOnHold && orderAgencies.includes(data.agency)) {
      await db
        .from("registration_songs" as never)
        .update({ status: { ...(song.status ?? {}), [data.agency]: "on_hold" }, updated_at: now } as never)
        .eq("id", song.id);
    }

    return { ok: true, issueId, threadId, held: !!data.setOnHold && orderAgencies.includes(data.agency) };
  });

/** Settles a reported issue without opening the board (the same write the thread's Mark Resolved makes). */
export const resolveRegistrationIssue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ issueId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await requireSuperAdmin(context);
    const { db } = await boardDb(context);
    const now = new Date().toISOString();
    const { data: row } = await db
      .from("registration_issues" as never)
      .select("id, thread_id")
      .eq("id", data.issueId)
      .maybeSingle();
    const issue = row as { id: string; thread_id: string | null } | null;
    if (!issue) throw new Error("That issue doesn't exist.");
    const { error } = await db
      .from("registration_issues" as never)
      .update({ status: "resolved", resolved_at: now, resolved_by: context.userId, updated_at: now } as never)
      .eq("id", data.issueId);
    if (error) throw new Error(error.message);
    if (issue.thread_id) {
      await db
        .from("admin_board_threads" as never)
        .update({ status: "resolved", updated_at: now } as never)
        .eq("id", issue.thread_id);
    }
    return { ok: true, threadId: issue.thread_id };
  });

