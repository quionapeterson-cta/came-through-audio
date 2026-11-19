/**
 * info@ becomes a Support ticket (founder, 2026-11-19).
 *
 * The public general-inquiry address used to be a forward to a Gmail box, so a question from somebody who had never
 * signed up sat outside the queue. Now the Cloudflare Email Worker posts it to the same receiver as the company
 * mailboxes, and this stores it as a ticket with `channel = 'info'` — in the same queue, with the same replies, the same
 * statuses and the same scripts as support@. Nothing about the support@ path changes: a ticket opened from the site is
 * still `channel = 'support'`.
 *
 * A delivery the Worker retries is one ticket: the mail's own Message-ID is stored and the unique index refuses a twin.
 * Server-only (it is handed the service-role client by the receiver), so no component may import it.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { GENERAL_AREA, categoryFor } from "./support-topics";

/** The category an info@ message is filed under, so it reads in the queue like any other row. */
export const INFO_CATEGORY = categoryFor(GENERAL_AREA, "Public info (info@)");

/** The column's own ceiling, matched here so an enormous mail is trimmed rather than refused. */
const MAX_MESSAGE = 3000;
const MAX_SUBJECT = 150;

export type InfoIntakeInput = {
  from: string;
  fromName?: string | undefined;
  subject: string;
  text?: string | undefined;
  html?: string | undefined;
  messageId?: string | null;
  receivedAt: string;
};

export type InfoIntakeResult = {
  ok: true;
  channel: "info";
  ticketId: string;
  duplicate: boolean;
};

/** A readable name for the sender: the display name they wrote with, otherwise the part before the @. */
function senderName(input: InfoIntakeInput): string {
  const named = (input.fromName ?? "").trim();
  if (named) return named.slice(0, 100);
  const local = input.from.split("@")[0]?.replace(/[._-]+/g, " ").trim() ?? "";
  return (local || "Website visitor").slice(0, 100);
}

/**
 * Stores one info@ message as a ticket. The opening message lives on the ticket, exactly as a Contact Us message does,
 * and the thread above it starts with the first staff reply.
 */
export async function storeInfoEmail(
  supabase: SupabaseClient,
  input: InfoIntakeInput,
): Promise<InfoIntakeResult> {
  // A retried delivery names the same mail, so it is the same ticket rather than a second one.
  if (input.messageId) {
    const { data: prior } = await supabase
      .from("support_tickets")
      .select("id")
      .eq("source_message_id", input.messageId)
      .maybeSingle();
    const found = prior as { id: string } | null;
    if (found) return { ok: true, channel: "info", ticketId: found.id, duplicate: true };
  }

  const body = (input.text ?? "").trim() || "(the message had no plain-text body)";
  const { data: row, error } = await supabase
    .from("support_tickets")
    .insert({
      kind: "contact",
      channel: "info",
      name: senderName(input),
      email: input.from,
      category: INFO_CATEGORY,
      subject: (input.subject.trim() || "Message to info@").slice(0, MAX_SUBJECT),
      message: body.slice(0, MAX_MESSAGE),
      // No account behind a public inquiry, so the thread is staff-only until the sender writes back by email.
      user_id: null,
      status: "open",
      source_message_id: input.messageId ?? null,
    })
    .select("id")
    .single();

  if (error || !row) {
    if (error?.code === "23505" && input.messageId) {
      const { data: twin } = await supabase
        .from("support_tickets")
        .select("id")
        .eq("source_message_id", input.messageId)
        .maybeSingle();
      const found = twin as { id: string } | null;
      if (found) return { ok: true, channel: "info", ticketId: found.id, duplicate: true };
    }
    console.error("Info intake: couldn't store the message:", error?.message ?? "no row");
    throw new Error("Could not store the info@ message");
  }

  return { ok: true, channel: "info", ticketId: (row as { id: string }).id, duplicate: false };
}
