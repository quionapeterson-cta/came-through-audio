import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { ADMIN_EMAIL } from "@/lib/email-layout";
import {
  dropFilesProblem,
  dropStoragePath,
  INBOX_BUCKET,
  INBOX_FILE_DROP_LABEL,
  INBOX_FILE_DROP_ROLES,
  MAX_DROP_FILES,
  MAX_INBOX_FILE_BYTES,
  threadSubjectKey,
} from "@/lib/inbox-attachments";

/**
 * The "Send us a file" receiver (founder, 2026-11-17): a super admin or department lead files a business contact's
 * document — one too big to attach, or one the contact's own mail server would bounce — and it lands in the Admin Inbox
 * as a message from that contact, with the files kept beside it.
 *
 * The page is not public (founder, 2026-11-17), and neither is this receiver: it lives at `/api/inbox/file`, outside
 * `api/public`, because it is staff-only rather than one of the doors anybody may knock on. The bearer token of the
 * signed-in caller is verified here and the same role list the page uses is checked against the database before a byte
 * is stored, so calling the URL directly is refused. A lookup that fails is reported as a failed check, never as "not
 * allowed", so a super admin is never told they lack access because the database didn't answer.
 *
 * After that it is the strictest door: nothing is written unless the name, a reply address and what the file is are all
 * there, no more than five files are taken at once, and every file is checked against the founder's 10 MB cap.
 *
 * The submission id is made here, so the keys are ours; the files go up before the message is written, and are removed
 * again if writing it fails, so the bucket never holds a file no conversation mentions.
 */

let _sb: ReturnType<typeof createClient> | null;
function db() {
  if (!_sb) {
    _sb = createClient(process.env["SUPABASE_URL"]!, process.env["SUPABASE_SERVICE_ROLE_KEY"]!);
  }
  return _sb;
}

const payload = z.object({
  name: z.string().trim().min(2, "Tell us your name.").max(120),
  email: z
    .string()
    .trim()
    .max(320)
    .refine(
      (value) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value),
      "Use an email address we can reply to.",
    ),
  subject: z.string().trim().min(3, "Say what you're sending.").max(200),
  note: z.string().trim().max(4000).default(""),
});

/** Documents, images, audio, video and archives only; never executables, scripts or web pages. */
const ALLOWED_DROP_TYPE =
  /\.(pdf|docx?|xlsx?|csv|txt|rtf|pptx?|odt|ods|pages|numbers|key|png|jpe?g|gif|webp|heic|tiff?|mp3|wav|aiff?|flac|m4a|aac|ogg|mp4|mov|m4v|webm|zip)$/i;

const fail = (message: string, status = 400) =>
  Response.json({ ok: false, error: message }, { status });

/**
 * The signed-in caller, or the refusal to send back. The page sends its session as a bearer token; this verifies it and
 * then asks the database for the same roles `canDropInboxFiles` allows, so a copied URL with no token, an expired one or
 * a member account is turned away before the form is ever read.
 */
async function staffCaller(request: Request): Promise<{ userId: string } | Response> {
  const url = process.env["SUPABASE_URL"]!;
  const publishable = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token || token.split(".").length !== 3) return fail("Sign in to file a file.", 401);

  const auth = createClient(url, publishable, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await auth.auth.getClaims(token);
  const userId = data?.claims?.sub;
  if (error || !userId) return fail("Sign in to file a file.", 401);

  const checks = await Promise.all(
    INBOX_FILE_DROP_ROLES.map((role) =>
      db().rpc("has_role" as never, { _user_id: userId, _role: role } as never),
    ),
  );
  // One true answer is a yes, whatever the other lookups did.
  if (checks.some((one) => one.data === true)) return { userId };

  // A lookup that errored is not a refusal (founder, 2026-11-17): saying "not allowed" would tell a real super admin
  // they have no access when the truth is that the database didn't answer. The page shows a failed check instead.
  const broken = checks.find((one) => one.error);
  if (broken) {
    console.error("Send us a file: couldn't check the caller's role:", broken.error?.message);
    return fail("We couldn't confirm your access, so nothing was sent. Please try again.", 503);
  }
  return fail(`Only a ${INBOX_FILE_DROP_LABEL} can file a file here.`, 403);
}

export const Route = createFileRoute("/api/inbox/file")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (
          !process.env["SUPABASE_URL"] ||
          !process.env["SUPABASE_PUBLISHABLE_KEY"] ||
          !process.env["SUPABASE_SERVICE_ROLE_KEY"]
        ) {
          console.error("Send us a file: Supabase is not configured, so nothing can be stored.");
          return fail(
            "Sending isn't available right now. Please use the email address below.",
            503,
          );
        }

        const caller = await staffCaller(request);
        if (caller instanceof Response) return caller;

        const declared = Number(request.headers.get("content-length") ?? "0");
        if (declared > MAX_DROP_FILES * MAX_INBOX_FILE_BYTES + 1024 * 1024) {
          return fail(
            `That is more than ${MAX_DROP_FILES} files of up to ${MAX_INBOX_FILE_BYTES / (1024 * 1024)} MB.`,
            413,
          );
        }

        let form: FormData;
        try {
          form = await request.formData();
        } catch {
          return fail("That didn't come through as a form. Please try again.");
        }
        const text = (key: string) => {
          const value = form.get(key);
          return typeof value === "string" ? value.trim() : "";
        };

        // A hidden field only a bot fills. Answering as if it worked keeps a scraper from learning the shape of the form.
        if (text("website")) return Response.json({ ok: true });

        const parsed = payload.safeParse({
          name: text("name"),
          email: text("email"),
          subject: text("subject"),
          note: text("note"),
        });
        if (!parsed.success) {
          return fail(parsed.error.issues[0]?.message ?? "Check the form and try again.");
        }

        const files = form
          .getAll("files")
          .filter((one): one is File => typeof one !== "string" && one.size > 0);
        const problem = dropFilesProblem(files.map((f) => ({ name: f.name, size: f.size })));
        if (problem) return fail(problem);
        const badType = files.find((f) => !ALLOWED_DROP_TYPE.test(f.name));
        if (badType)
          return fail(
            `${badType.name} isn't a file type we accept. Send documents, images, audio, video or a ZIP.`,
          );

        const submissionId = crypto.randomUUID();
        const stored: { filename: string; mimeType?: string; size: number; storagePath: string }[] =
          [];
        for (const [index, file] of files.entries()) {
          const path = dropStoragePath({ submissionId, index, filename: file.name });
          const { error } = await db()
            .storage.from(INBOX_BUCKET)
            .upload(path, await file.arrayBuffer(), {
              contentType: file.type || "application/octet-stream",
              upsert: false,
            });
          if (error) {
            console.error(`Send us a file: couldn't store ${file.name}:`, error.message);
            if (stored.length) {
              await db()
                .storage.from(INBOX_BUCKET)
                .remove(stored.map((one) => one.storagePath));
            }
            return fail(
              /bucket/i.test(error.message)
                ? "File storage isn't set up yet. Please use the email address below for now."
                : `${file.name} didn't finish uploading. Please try again.`,
              500,
            );
          }
          stored.push({
            filename: file.name,
            ...(file.type ? { mimeType: file.type } : {}),
            size: file.size,
            storagePath: path,
          });
        }

        const supabase = db();
        const receivedAt = new Date().toISOString();
        const subjectKey = threadSubjectKey(parsed.data.subject);

        // Same correspondent and subject is the same conversation, exactly as a second email would be.
        const { data: found } = await supabase
          .from("admin_inbox_threads")
          .select("id")
          .eq("mailbox", "admin")
          .eq("counterpart_email", parsed.data.email.toLowerCase())
          .eq("subject_key", subjectKey)
          .maybeSingle();
        let threadId = (found as { id: string } | null)?.id ?? null;

        if (!threadId) {
          const { data: created, error } = await supabase
            .from("admin_inbox_threads")
            .insert({
              mailbox: "admin",
              subject: parsed.data.subject,
              subject_key: subjectKey,
              counterpart_email: parsed.data.email.toLowerCase(),
              counterpart_name: parsed.data.name,
              last_message_at: receivedAt,
            } as never)
            .select("id")
            .single();
          if (!error) {
            threadId = (created as { id: string }).id;
          } else if (error.code === "23505") {
            // A simultaneous submission opened it first; join that one.
            const { data: twin } = await supabase
              .from("admin_inbox_threads")
              .select("id")
              .eq("mailbox", "admin")
              .eq("counterpart_email", parsed.data.email.toLowerCase())
              .eq("subject_key", subjectKey)
              .maybeSingle();
            threadId = (twin as { id: string } | null)?.id ?? null;
          }
          if (!threadId) {
            console.error("Send us a file: couldn't open the thread:", error?.message ?? "no row");
            await supabase.storage.from(INBOX_BUCKET).remove(stored.map((one) => one.storagePath));
            return fail("We couldn't file that. Please try again.", 500);
          }
        }

        const { error: insertError } = await supabase.from("admin_inbox_messages").insert({
          thread_id: threadId,
          mailbox: "admin",
          direction: "inbound",
          from_email: parsed.data.email.toLowerCase(),
          from_name: parsed.data.name,
          to_emails: [ADMIN_EMAIL],
          subject: parsed.data.subject,
          body_text: parsed.data.note || null,
          // No `kept` flag: every file that got this far is in the bucket.
          attachments: stored,
          received_at: receivedAt,
        } as never);
        if (insertError) {
          console.error("Send us a file: couldn't store the message:", insertError.message);
          await supabase.storage.from(INBOX_BUCKET).remove(stored.map((one) => one.storagePath));
          return fail("We couldn't file that. Please try again.", 500);
        }

        await supabase
          .from("admin_inbox_threads")
          .update({ last_message_at: receivedAt } as never)
          .eq("id", threadId);

        return Response.json({ ok: true });
      },
    },
  },
});
