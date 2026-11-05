import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  fileProblem, KIND_LIMIT, KIND_TYPES, safeFileName,
  SUBMISSION_KINDS, type SubmissionKind, type SubmissionStatus,
} from "@/lib/staff-submissions";

/**
 * Staff Idea Box (founder, 2026-11-05). Any staff member submits an idea, paperwork, a video, music, a photo or a
 * project; a super admin reads it. Because files can be tens of megabytes, the browser uploads straight to the private
 * bucket with a signed URL this server issues — the file never travels through a server function's payload.
 */

type Ctx = { supabase: { rpc: (fn: never, args: never) => PromiseLike<{ data: unknown }> }; userId: string };
const adminDb = async () => (await import("@/integrations/supabase/client.server")).supabaseAdmin;
const BUCKET = "staff-submissions";

async function requireStaff(context: Ctx): Promise<void> {
  const { data } = await context.supabase.rpc("is_staff" as never, { _user_id: context.userId } as never);
  if (!data) throw new Error("Only staff can send submissions.");
}

async function isSuper(context: Ctx): Promise<boolean> {
  const { data } = await context.supabase.rpc("has_role" as never, { _user_id: context.userId, _role: "super_admin" } as never);
  return !!data;
}

export type StaffSubmission = {
  id: string;
  createdAt: string;
  submitter: string;
  kind: SubmissionKind;
  title: string;
  details: string;
  link: string | null;
  fileName: string | null;
  fileSize: number | null;
  status: SubmissionStatus;
  note: string;
  /** A signed link to the file; only a super admin asks for one. */
  downloadUrl: string | null;
};

type Row = {
  id: string; created_at: string; submitted_by: string; kind: SubmissionKind; title: string; details: string;
  link: string | null; file_path: string | null; file_name: string | null; file_size: number | null;
  status: SubmissionStatus; note: string;
};

/**
 * A signed upload URL for one file. The server decides the path (the submitter's own folder) and refuses a file that
 * breaks its kind's rules, so a 200 MB video or a PDF labelled a photo never reaches the bucket.
 */
export const createSubmissionUpload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      kind: z.enum(SUBMISSION_KINDS),
      name: z.string().trim().min(1).max(200),
      size: z.number().int().positive().max(KIND_LIMIT.other),
      type: z.string().trim().min(1).max(120),
    }).parse(d),
  )
  .handler(async ({ data, context }): Promise<{ path: string; token: string }> => {
    await requireStaff(context);
    const problem = fileProblem(data.kind, data);
    if (problem) throw new Error(problem);
    const db = await adminDb();
    const path = `${context.userId}/${crypto.randomUUID()}/${safeFileName(data.name)}`;
    const { data: signed, error } = await db.storage.from(BUCKET).createSignedUploadUrl(path);
    if (error || !signed) throw new Error("Couldn't start the upload. Has migration 20261105130000 been run?");
    return { path, token: signed.token };
  });

/** Save the submission once its file is in the bucket (or straight away, when there is no file). */
export const submitStaffIdea = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      kind: z.enum(SUBMISSION_KINDS),
      title: z.string().trim().min(3, "Give it a title.").max(140),
      details: z.string().trim().max(2000).default(""),
      link: z.string().trim().max(500).refine((v) => /^https?:\/\//i.test(v), "Use a full address, starting with https://").optional().nullable(),
      file: z
        .object({ path: z.string().trim().min(1).max(400), name: z.string().trim().max(200), size: z.number().int().positive(), type: z.string().trim().max(120) })
        .optional()
        .nullable(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireStaff(context);
    if (data.file) {
      const problem = fileProblem(data.kind, { name: data.file.name, size: data.file.size, type: data.file.type });
      if (problem) throw new Error(problem);
      // The path is the one this server issued: a client can't point the row at someone else's file.
      if (!data.file.path.startsWith(`${context.userId}/`)) throw new Error("That upload doesn't belong to you.");
    }
    const db = await adminDb();
    const { error } = await db.from("staff_submissions" as never).insert({
      submitted_by: context.userId,
      kind: data.kind,
      title: data.title,
      details: data.details,
      link: data.link || null,
      file_path: data.file?.path ?? null,
      file_name: data.file?.name ?? null,
      file_size: data.file?.size ?? null,
      file_mime: data.file?.type ?? null,
    } as never);
    if (error) throw new Error("Couldn't save the submission. Run migration 20261105130000 first.");
    return { ok: true };
  });

/** Your own submissions; a super admin sees every one, with a 24-hour download link for each file. */
export const listStaffSubmissions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<StaffSubmission[]> => {
    await requireStaff(context);
    const superUser = await isSuper(context);
    const db = await adminDb();
    let query = db.from("staff_submissions" as never).select("*").order("created_at", { ascending: false }).limit(300);
    if (!superUser) query = query.eq("submitted_by", context.userId);
    const { data, error } = await query;
    if (error) throw new Error("Couldn't load submissions. Run migration 20261105130000 first.");
    const rows = (data ?? []) as unknown as Row[];

    const ids = [...new Set(rows.map((r) => r.submitted_by))];
    const names = new Map<string, string>();
    if (ids.length) {
      const { data: people } = await db.from("profiles").select("id, stage_name, legal_name").in("id", ids);
      for (const p of (people ?? []) as { id: string; stage_name: string | null; legal_name: string | null }[]) {
        names.set(p.id, p.legal_name || p.stage_name || "");
      }
    }

    return Promise.all(
      rows.map(async (r) => {
        let downloadUrl: string | null = null;
        if (superUser && r.file_path) {
          const { data: signed } = await db.storage.from(BUCKET).createSignedUrl(r.file_path, 60 * 60 * 24);
          downloadUrl = signed?.signedUrl ?? null;
        }
        return {
          id: r.id,
          createdAt: r.created_at,
          submitter: names.get(r.submitted_by) ?? "",
          kind: r.kind,
          title: r.title,
          details: r.details,
          link: r.link,
          fileName: r.file_name,
          fileSize: r.file_size,
          status: r.status,
          note: r.note,
          downloadUrl,
        };
      }),
    );
  });

/** Super admin: move a submission along, with a note the submitter can read. */
export const handleStaffSubmission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), status: z.enum(["new", "in_review", "done", "declined"]), note: z.string().trim().max(500).default("") }).parse(d),
  )
  .handler(async ({ data, context }) => {
    if (!(await isSuper(context))) throw new Error("Only a super admin can handle submissions.");
    const db = await adminDb();
    const { error } = await db
      .from("staff_submissions" as never)
      .update({ status: data.status, note: data.note, decided_by: context.userId, decided_at: new Date().toISOString() } as never)
      .eq("id", data.id);
    if (error) throw new Error("Couldn't update the submission.");
    return { status: data.status };
  });

/** The types a kind accepts, so the browser's file picker matches the server's check. */
export const submissionAccept = (kind: SubmissionKind) => KIND_TYPES[kind].join(",");
