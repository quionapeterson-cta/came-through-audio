import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveAccess } from "./departments";
import { formatStaffDisplayName } from "./staff-display";

/**
 * Escalate & tag (founder, 2026-11-19). A public inquiry either Support answers, or Support hands to the team that owns
 * it: Marketing (press, partnerships, collaborations, brand) or the founder ("The Founder" — Mrs. Peterson).
 *
 * The handoff is three records, written together: the internal whisper note on the thread (staff-only, never emailed), a
 * system line in the timeline naming who handed it over, and one escalation row per destination. That row is also the
 * in-app notification the receiving team sees, and the flags on the ticket are what the queue filters read.
 */
const TAGS = ["marketing", "founder"] as const;
type EscalationTag = (typeof TAGS)[number];

export const TAG_LABEL: Record<EscalationTag, string> = {
  marketing: "Marketing",
  founder: "The Founder",
};

type Ctx = {
  supabase: {
    from: (table: string) => any;
    rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown }>;
  };
  userId: string;
  claims?: unknown;
};

/** The sender's role and departments, so a handoff can be attributed and a name shown. */
async function accessOf(context: Ctx) {
  const { data: roles } = await context.supabase
    .from("user_roles")
    .select("role, departments")
    .eq("user_id", context.userId);
  const rows = (roles ?? []) as { role: string; departments?: string[] | null }[];
  const access = resolveAccess(rows);
  const role = rows.find((r) => r.role === "super_admin")?.role ?? rows[0]?.role ?? "employee";
  const claims = (context.claims ?? {}) as { name?: string; email?: string };
  const name = formatStaffDisplayName(role, { name: claims.name, email: claims.email });
  return { access, role, name };
}

/** Whoever may work a ticket may hand it on: the Support department, Marketing, or the founder. */
function mayEscalate(access: ReturnType<typeof resolveAccess>): boolean {
  if (!access) return false;
  return (
    access.role === "super_admin" ||
    access.departments.includes("support") ||
    access.departments.includes("marketing")
  );
}

export type TicketEscalation = {
  id: string;
  tag: EscalationTag;
  note: string;
  byName: string;
  createdAt: string;
  readAt: string | null;
};

export const escalateTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        ticketId: z.string().uuid(),
        marketing: z.boolean().default(false),
        founder: z.boolean().default(false),
        note: z.string().trim().min(5, "Add a short handoff note.").max(2000),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { access, name } = await accessOf(context as unknown as Ctx);
    if (!mayEscalate(access)) throw new Error("Only the Support or Marketing team can escalate a thread.");
    const tags: EscalationTag[] = [
      ...(data.marketing ? (["marketing"] as const) : []),
      ...(data.founder ? (["founder"] as const) : []),
    ];
    if (!tags.length) throw new Error("Choose Marketing, The Founder, or both.");
    if (data.founder && access?.role !== "super_admin" && !access?.departments.includes("support")) {
      // Marketing may hand a thread to Marketing; handing it to the founder is the Support desk's or the founder's call.
      throw new Error("Only Support or The Founder can escalate to The Founder.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: ticketRow } = await supabaseAdmin
      .from("support_tickets")
      .select("id, subject")
      .eq("id", data.ticketId)
      .maybeSingle();
    if (!ticketRow) throw new Error("That thread is no longer here.");

    // 1. The whisper note: internal, so it is never emailed and the member never reads it.
    const { error: noteError } = await supabaseAdmin.from("support_ticket_messages").insert({
      ticket_id: data.ticketId,
      author_kind: "staff",
      author_id: context.userId,
      author_name: name,
      body: data.note,
      internal: true,
    } as never);
    if (noteError) throw new Error("Couldn't save the handoff note, so nothing was escalated.");

    // 2. The timeline line: who handed it to whom.
    const labels = tags.map((tag) => TAG_LABEL[tag]);
    const joined = labels.length > 1 ? `${labels[0]} & ${labels[1]}` : labels[0];
    await supabaseAdmin.from("support_ticket_messages").insert({
      ticket_id: data.ticketId,
      author_kind: "system",
      author_id: context.userId,
      author_name: name,
      body: `Tagged for ${joined} by ${name}.`,
      internal: true,
    } as never);

    // 3. One row per destination: the notification the receiving team sees.
    const { error: escalationError } = await supabaseAdmin.from("support_ticket_escalations" as never).insert(
      tags.map((tag) => ({
        ticket_id: data.ticketId,
        tag,
        note: data.note,
        by_id: context.userId,
        by_name: name,
      })) as never,
    );
    if (escalationError) {
      console.error("Escalation: the note was saved but the tag wasn't:", escalationError.message);
      throw new Error("The note is on the thread, but the escalation didn't go through. Try again.");
    }

    await supabaseAdmin
      .from("support_tickets")
      .update({
        ...(data.marketing ? { escalated_marketing: true } : {}),
        ...(data.founder ? { escalated_founder: true } : {}),
      } as never)
      .eq("id", data.ticketId);

    return { ok: true as const, tags };
  });

/** The handoffs already on a thread, newest first, for the panel's own history. */
export const listTicketEscalations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ ticketId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<TicketEscalation[]> => {
    const { access } = await accessOf(context as unknown as Ctx);
    if (!mayEscalate(access)) throw new Error("That thread isn't yours to read.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await supabaseAdmin
      .from("support_ticket_escalations" as never)
      .select("id, tag, note, by_name, created_at, read_at")
      .eq("ticket_id", data.ticketId)
      .order("created_at", { ascending: false })
      .limit(50);
    return ((rows ?? []) as unknown as {
      id: string;
      tag: EscalationTag;
      note: string;
      by_name: string;
      created_at: string;
      read_at: string | null;
    }[]).map((row) => ({
      id: row.id,
      tag: row.tag,
      note: row.note,
      byName: row.by_name,
      createdAt: row.created_at,
      readAt: row.read_at,
    }));
  });

/**
 * "Viewing: Mrs. Peterson" (founder, 2026-11-19): the person with the thread open says so, and the panel shows whoever
 * else is in it. Two minutes is the whole life of the claim, so a closed tab never leaves a name behind.
 */
export const VIEWING_WINDOW_SECONDS = 120;

export type TicketViewer = { userId: string; name: string; seenAt: string };

export const markTicketViewing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ ticketId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { access, name } = await accessOf(context as unknown as Ctx);
    if (!mayEscalate(access)) return { ok: false as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("support_ticket_viewers" as never).upsert(
      {
        ticket_id: data.ticketId,
        user_id: context.userId,
        name,
        seen_at: new Date().toISOString(),
      } as never,
      { onConflict: "ticket_id,user_id" } as never,
    );
    return { ok: true as const };
  });

export const listTicketViewers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ ticketId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<TicketViewer[]> => {
    const { access } = await accessOf(context as unknown as Ctx);
    if (!mayEscalate(access)) return [];
    const since = new Date(Date.now() - VIEWING_WINDOW_SECONDS * 1000).toISOString();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await supabaseAdmin
      .from("support_ticket_viewers" as never)
      .select("user_id, name, seen_at")
      .eq("ticket_id", data.ticketId)
      .gte("seen_at", since)
      .order("seen_at", { ascending: false })
      .limit(10);
    return ((rows ?? []) as unknown as { user_id: string; name: string; seen_at: string }[])
      .filter((row) => row.user_id !== context.userId)
      .map((row) => ({ userId: row.user_id, name: row.name, seenAt: row.seen_at }));
  });
