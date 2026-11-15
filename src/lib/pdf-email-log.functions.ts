import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { DELIVERY_STATUSES, type DeliveryStatus } from "./resend-events";

/**
 * The delivery results for emails sent from Admin → PDF Tools (founder, 2026-11-15). "Sent" only means Resend took the
 * message; the webhook moves each row to Delivered or Bounced and keeps the reason the recipient's server gave.
 */

type Ctx = {
  supabase: { rpc: (fn: never, args: never) => PromiseLike<{ data: unknown }> };
  userId: string;
};

export type PdfEmailSend = {
  id: string;
  recipients: string[];
  subject: string;
  fileName: string;
  mailbox: string;
  status: DeliveryStatus;
  bounceType: string | null;
  bounceMessage: string | null;
  sentAt: string;
  sentBy: string;
};

type Row = {
  id: string;
  recipients: string[];
  subject: string;
  file_name: string;
  mailbox: string;
  status: string;
  bounce_type: string | null;
  bounce_message: string | null;
  created_at: string;
  sent_by: string;
};

const isStatus = (value: string): value is DeliveryStatus =>
  (DELIVERY_STATUSES as readonly string[]).includes(value);

/** The last 20 sends every staff member can see, newest first. */
export const listPdfEmails = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PdfEmailSend[]> => {
    const { data: staff } = await context.supabase.rpc(
      "is_staff" as never,
      { _user_id: context.userId } as never,
    );
    if (!staff) throw new Error("Only staff can see PDF emails.");
    const { data, error } = await context.supabase
      .from("pdf_email_sends" as never)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20);
    if (error)
      throw new Error("Couldn't load delivery results. Run migration 20261115180000 first.");
    const rows = (data ?? []) as unknown as Row[];

    const people = [...new Set(rows.map((r) => r.sent_by))];
    const names = new Map<string, string>();
    if (people.length) {
      const { data: profiles } = await context.supabase
        .from("profiles")
        .select("id, stage_name, legal_name")
        .in("id", people);
      for (const p of (profiles ?? []) as {
        id: string;
        stage_name: string | null;
        legal_name: string | null;
      }[]) {
        names.set(p.id, p.legal_name || p.stage_name || "");
      }
    }

    return rows.map((row) => ({
      id: row.id,
      recipients: row.recipients ?? [],
      subject: row.subject,
      fileName: row.file_name,
      mailbox: row.mailbox,
      status: isStatus(row.status) ? row.status : "accepted",
      bounceType: row.bounce_type,
      bounceMessage: row.bounce_message,
      sentAt: row.created_at,
      sentBy: names.get(row.sent_by) ?? "",
    }));
  });
