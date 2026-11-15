import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { bounceDetail, deliveryStatusFor, verifyResendSignature } from "@/lib/resend-events";

let _sb: ReturnType<typeof createClient> | null = null;
function db() {
  if (!_sb)
    _sb = createClient(process.env["SUPABASE_URL"]!, process.env["SUPABASE_SERVICE_ROLE_KEY"]!);
  return _sb;
}

type ResendEvent = {
  type?: string;
  data?: {
    email_id?: string;
    to?: string[] | string;
    subject?: string;
    bounce?: { type?: string; subType?: string; message?: string };
  };
};

/**
 * Resend's delivery webhook (founder, 2026-11-15). A send is only "accepted" when Resend answers; whether the recipient's
 * server took it arrives here minutes later. The request is signed by Svix, so an unsigned call can never mark someone's
 * document delivered, and only a row we recorded (by Resend's own email id) is touched. Resend retries a non-2xx, so a
 * failed write is a 500 on purpose.
 */
export const Route = createFileRoute("/api/public/email/resend-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["RESEND_WEBHOOK_SECRET"];
        if (!secret) {
          console.error(
            "Resend webhook: RESEND_WEBHOOK_SECRET is not set, so nothing can be verified.",
          );
          return new Response("Webhook not configured", { status: 503 });
        }
        const payload = await request.text();
        const signed = await verifyResendSignature({
          secret,
          id: request.headers.get("svix-id"),
          timestamp: request.headers.get("svix-timestamp"),
          signature: request.headers.get("svix-signature"),
          payload,
        });
        if (!signed) return new Response("Invalid webhook signature", { status: 401 });

        let event: ResendEvent;
        try {
          event = JSON.parse(payload) as ResendEvent;
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }

        const status = deliveryStatusFor(event.type ?? "");
        const emailId = event.data?.email_id;
        // Opened, clicked and sent change nothing we show; an unknown message is simply not one of ours.
        if (!status || !emailId) return new Response("ignored", { status: 200 });

        const bounce = bounceDetail(event);
        const { error } = await db()
          .from("pdf_email_sends")
          .update({
            status,
            bounce_type: bounce.type,
            bounce_message: bounce.message,
            updated_at: new Date().toISOString(),
          } as never)
          .eq("resend_id", emailId);
        if (error) {
          console.error(
            `Resend webhook: couldn't record ${event.type} for ${emailId}:`,
            error.message,
          );
          return new Response("Could not record the event", { status: 500 });
        }
        return new Response("ok", { status: 200 });
      },
    },
  },
});
