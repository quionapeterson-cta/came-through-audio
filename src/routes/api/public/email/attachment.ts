import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import {
  INBOX_BUCKET,
  INBOX_FILE_LIMIT_LABEL,
  inboundStoragePath,
  MAX_INBOX_FILE_BYTES,
} from "@/lib/inbox-attachments";

/**
 * Where a received mail's files are kept (founder, 2026-11-17). The Cloudflare Email Worker holds each attachment's
 * bytes as it parses the message, and posts them here one at a time; this route writes them into the private
 * `admin-inbox` bucket and answers with the key. The Worker then names that key in the message it sends to the inbound
 * receiver, so the file and its message are joined by something we wrote, never by something the recipient chose.
 *
 * The key is derived here from the mailbox, the mail's own Message-ID and the attachment's position — not taken from a
 * caller — which is also what makes a retry safe: the same mail overwrites the same object instead of filing a second
 * copy of a contract. The shared secret is the only thing that lets a request in.
 *
 * Files over the founder's 10 MB cap are refused rather than trimmed. The Worker records them by name with the reason,
 * so the thread says what arrived and what to ask the sender for.
 */

let _sb: ReturnType<typeof createClient> | null;
function db() {
  if (!_sb) {
    _sb = createClient(process.env["SUPABASE_URL"]!, process.env["SUPABASE_SERVICE_ROLE_KEY"]!);
  }
  return _sb;
}

/** Compares the worker's header with the secret without leaking where the first difference is. */
function sameSecret(given: string | null, expected: string): boolean {
  const a = new TextEncoder().encode(given ?? "");
  const b = new TextEncoder().encode(expected);
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i += 1) difference |= a[i]! ^ b[i]!;
  return difference === 0;
}

function decoded(value: string | null): string {
  if (!value) return "";
  try {
    return decodeURIComponent(value);
  } catch {
    // A header that isn't valid percent-encoding is still a name worth recording, so it is used as it came.
    return value;
  }
}

export const Route = createFileRoute("/api/public/email/attachment")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["INBOUND_EMAIL_SECRET"];
        if (!secret) {
          // Nothing can be verified, so nothing is stored: better a visible 503 than an open bucket door.
          console.error(
            "Admin inbox: INBOUND_EMAIL_SECRET is not set, so attachments cannot be kept.",
          );
          return new Response("Inbound email not configured", { status: 503 });
        }
        if (!sameSecret(request.headers.get("x-worker-secret"), secret)) {
          return new Response("Unauthorized", { status: 401 });
        }
        if (!process.env["SUPABASE_URL"] || !process.env["SUPABASE_SERVICE_ROLE_KEY"]) {
          console.error("Admin inbox: Supabase is not configured, so attachments cannot be kept.");
          return new Response("Inbound email not configured", { status: 503 });
        }

        const mailbox = request.headers.get("x-mailbox");
        if (mailbox !== "admin" && mailbox !== "contracts" && mailbox !== "registrations") {
          return new Response("Unknown mailbox", { status: 400 });
        }
        const messageKey = (request.headers.get("x-message-key") ?? "").trim();
        if (!messageKey) return new Response("Missing message key", { status: 400 });
        const index = Number(request.headers.get("x-index"));
        if (!Number.isInteger(index) || index < 0 || index > 99) {
          return new Response("Bad attachment position", { status: 400 });
        }
        const filename = decoded(request.headers.get("x-filename")).trim().slice(0, 300);
        if (!filename) return new Response("Missing filename", { status: 400 });

        const declared = Number(request.headers.get("content-length") ?? "0");
        if (declared > MAX_INBOX_FILE_BYTES) {
          return new Response(`Files over ${INBOX_FILE_LIMIT_LABEL} are not stored`, {
            status: 413,
          });
        }

        let bytes: ArrayBuffer;
        try {
          bytes = await request.arrayBuffer();
        } catch {
          return new Response("Unreadable file", { status: 400 });
        }
        if (!bytes.byteLength) return new Response("Empty file", { status: 400 });
        if (bytes.byteLength > MAX_INBOX_FILE_BYTES) {
          return new Response(`Files over ${INBOX_FILE_LIMIT_LABEL} are not stored`, {
            status: 413,
          });
        }

        const path = inboundStoragePath({ mailbox, messageKey, index, filename });
        const mimeType = (request.headers.get("content-type") ?? "").trim() || undefined;
        const { error } = await db()
          .storage.from(INBOX_BUCKET)
          .upload(path, bytes, {
            contentType: mimeType ?? "application/octet-stream",
            // The same mail retried by the worker writes the same key again, which must not be an error.
            upsert: true,
          });
        if (error) {
          console.error(`Admin inbox: couldn't store ${filename}:`, error.message);
          // A non-2xx makes the worker retry, so a storage blip delays the file instead of losing it.
          return new Response(
            /bucket/i.test(error.message)
              ? "File storage not set up (run migration 20261117140000)"
              : "Could not store the file",
            { status: 500 },
          );
        }

        return Response.json({ ok: true, path });
      },
    },
  },
});
