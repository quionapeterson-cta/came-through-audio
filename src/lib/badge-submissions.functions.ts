import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { badgeKeys, badgeSlug, setFolderProblem, slugProblem, type BadgeScope } from "@/lib/badge-protocol";

/**
 * Badge art protocol (founder, 2026-11-05). Branding, Marketing & Social Media and Support submit ideas plus art
 * (public.can_manage_badges); a super admin approves or rejects; only the founder uploads to R2 and marks it uploaded.
 * The art lives in a private bucket, so a rejected idea is never a public picture.
 */

const ART_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;
/** ~9 MB decoded: a 4K PNG master fits, and nothing larger has any business being badge art. */
const MAX_ART = 12_000_000;
const SIGNED_FOR = 60 * 60 * 24;

type Ctx = { supabase: { rpc: (fn: never, args: never) => PromiseLike<{ data: unknown }> }; userId: string };

const adminDb = async () => (await import("@/integrations/supabase/client.server")).supabaseAdmin;

/** Super admins, Branding, Marketing & Social Media and Support: the same check that opens Admin → Badges. */
async function canManage(context: Ctx): Promise<boolean> {
  const { data } = await context.supabase.rpc("can_manage_badges" as never, { _user_id: context.userId } as never);
  return !!data;
}

/**
 * Founder-only decisions (founder, 2026-11-05): `public.founder_access` holds one account, claimed once from the panel.
 * Until it is claimed the first super admin may act, so a fresh environment is never locked out; after that, a super
 * admin can read the queue but cannot approve it.
 */
async function founderState(context: Ctx): Promise<{ claimed: boolean; me: boolean }> {
  const db = await adminDb();
  const { data } = await db.from("founder_access" as never).select("user_id").limit(1);
  const claimant = ((data ?? []) as { user_id: string }[])[0]?.user_id ?? null;
  const { data: mine } = await context.supabase.rpc("is_founder" as never, { _user_id: context.userId } as never);
  return { claimed: !!claimant, me: !!mine || claimant === context.userId };
}

async function requireFounder(context: Ctx): Promise<void> {
  const state = await founderState(context);
  if (state.me) return;
  if (!state.claimed) {
    const { data: isSuper } = await context.supabase.rpc("has_role" as never, { _user_id: context.userId, _role: "super_admin" } as never);
    if (isSuper) return;
  }
  throw new Error("Only the founder can decide badge art.");
}

export type BadgeSubmissionStatus = "submitted" | "approved" | "rejected" | "uploaded";

export type BadgeSubmission = {
  id: string;
  createdAt: string;
  submitter: string;
  submittedBy: string;
  title: string;
  collection: string;
  tier: string;
  scope: BadgeScope;
  set: string | null;
  slug: string;
  milestone: string;
  action: string;
  description: string;
  popup: string;
  status: BadgeSubmissionStatus;
  note: string;
  decidedAt: string | null;
  uploadedAt: string | null;
  artName: string | null;
  artMime: string | null;
  masterName: string | null;
  webKey: string;
  masterKey: string;
  /** Short-lived links to the art; only a super admin asks for one and only for a file that exists. */
  downloadUrl: string | null;
  masterUrl: string | null;
};

type Row = {
  id: string; created_at: string; submitted_by: string; title: string; collection: string; tier: string;
  scope: BadgeScope; set_folder: string | null; slug: string; milestone: string; action: string;
  description: string; popup: string; art_path: string | null; art_name: string | null; art_mime: string | null;
  master_path: string | null; master_name: string | null; master_mime: string | null;
  status: BadgeSubmissionStatus; decision_note: string | null; decided_at: string | null; uploaded_at: string | null;
};

const extension = (type: string) => (type === "image/jpeg" ? "jpg" : type === "image/webp" ? "webp" : "png");

const ideaInput = z.object({
  title: z.string().trim().min(2, "Give the badge a title.").max(80),
  collection: z.string().trim().min(2).max(40),
  tier: z.enum(["standard", "instant", "mega", "ultimate"]),
  scope: z.enum(["serious", "playful"]),
  set: z.string().trim().max(48).optional().nullable(),
  milestone: z.string().trim().max(200).default(""),
  action: z.string().trim().max(80).default(""),
  description: z.string().trim().max(400).default(""),
  popup: z.string().trim().max(200).default(""),
  art: z
    .object({
      name: z.string().trim().min(1).max(160),
      type: z.enum(ART_TYPES),
      base64: z.string().min(1).max(MAX_ART),
    })
    .optional()
    .nullable(),
  master: z
    .object({
      name: z.string().trim().min(1).max(160),
      type: z.enum(ART_TYPES),
      base64: z.string().min(1).max(MAX_ART),
    })
    .optional()
    .nullable(),
});

/** Branding, Marketing & Social Media and Support: file a badge idea with its art. It lands as Submitted. */
export const submitBadgeIdea = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ideaInput.parse(d))
  .handler(async ({ data, context }): Promise<{ id: string; slug: string; webKey: string; masterKey: string }> => {
    if (!(await canManage(context))) throw new Error("Only Branding, Marketing & Social Media and Support can submit badge ideas.");
    const slug = badgeSlug(data.title);
    const problem = slugProblem(slug) ?? setFolderProblem(data.set ?? "");
    if (problem) throw new Error(problem);
    const set = badgeSlug(data.set ?? "") || null;
    const keys = badgeKeys({ scope: data.scope, slug, set });

    const db = await adminDb();
    const folder = `submissions/${crypto.randomUUID()}`;
    const upload = async (file: { name: string; type: string; base64: string }, suffix: string) => {
      const path = `${folder}/${slug}${suffix}.${extension(file.type)}`;
      const { error } = await db.storage
        .from("badge-submissions")
        .upload(path, Buffer.from(file.base64, "base64"), { contentType: file.type });
      if (error) throw new Error("Couldn't upload the art. Has migration 20261105120000 (badge-submissions) been run?");
      return path;
    };
    const artPath = data.art ? await upload(data.art, "") : null;
    const masterPath = data.master ? await upload(data.master, "-4k") : null;

    const { data: row, error } = await db
      .from("badge_submissions" as never)
      .insert({
        submitted_by: context.userId,
        title: data.title,
        collection: data.collection,
        tier: data.tier,
        scope: data.scope,
        set_folder: set,
        slug,
        milestone: data.milestone,
        action: data.action,
        description: data.description,
        popup: data.popup,
        art_path: artPath,
        art_name: data.art?.name ?? null,
        art_mime: data.art?.type ?? null,
        master_path: masterPath,
        master_name: data.master?.name ?? null,
        master_mime: data.master?.type ?? null,
      } as never)
      .select("id")
      .single();
    if (error) throw new Error("Couldn't save the badge idea. Run migration 20261105120000 first.");
    return { id: (row as unknown as { id: string }).id, slug, webKey: keys.web, masterKey: keys.master };
  });

/** The queue. Anyone who designs badges reads it; only a super admin gets the signed art links. */
export const listBadgeSubmissions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<BadgeSubmission[]> => {
    if (!(await canManage(context))) return [];
    const founder = await founderState(context);
    const db = await adminDb();
    const { data, error } = await db
      .from("badge_submissions" as never)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(300);
    if (error) throw new Error("Couldn't load badge ideas. Run migration 20261105120000 first.");
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
        const keys = badgeKeys({ scope: r.scope, slug: r.slug, set: r.set_folder });
        let downloadUrl: string | null = null;
        let masterUrl: string | null = null;
        if (founder.me) {
          if (r.art_path) {
            const { data: signed } = await db.storage.from("badge-submissions").createSignedUrl(r.art_path, SIGNED_FOR);
            downloadUrl = signed?.signedUrl ?? null;
          }
          if (r.master_path) {
            const { data: signed } = await db.storage.from("badge-submissions").createSignedUrl(r.master_path, SIGNED_FOR);
            masterUrl = signed?.signedUrl ?? null;
          }
        }
        return {
          id: r.id,
          createdAt: r.created_at,
          submitter: names.get(r.submitted_by) ?? "",
          submittedBy: r.submitted_by,
          title: r.title,
          collection: r.collection,
          tier: r.tier,
          scope: r.scope,
          set: r.set_folder,
          slug: r.slug,
          milestone: r.milestone,
          action: r.action,
          description: r.description,
          popup: r.popup,
          status: r.status,
          note: r.decision_note ?? "",
          decidedAt: r.decided_at,
          uploadedAt: r.uploaded_at,
          artName: r.art_name,
          artMime: r.art_mime,
          masterName: r.master_name,
          webKey: keys.web,
          masterKey: keys.master,
          downloadUrl,
          masterUrl,
        };
      }),
    );
  });

/** Super admin: approve or reject. A rejection keeps the reason on the row for good. */
export const decideBadgeSubmission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), decision: z.enum(["approved", "rejected"]), note: z.string().trim().max(500).default("") }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireFounder(context);
    const db = await adminDb();
    const { error } = await db
      .from("badge_submissions" as never)
      .update({ status: data.decision, decided_by: context.userId, decided_at: new Date().toISOString(), decision_note: data.note } as never)
      .eq("id", data.id);
    if (error) throw new Error("Couldn't save the decision.");
    return { status: data.decision };
  });

/** Founder/super admin: the art is in the R2 bucket at the printed keys. This is engineering's green light. */
export const markBadgeUploaded = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), note: z.string().trim().max(500).default("") }).parse(d))
  .handler(async ({ data, context }) => {
    await requireFounder(context);
    const db = await adminDb();
    const { data: row } = await db.from("badge_submissions" as never).select("status, decision_note").eq("id", data.id).maybeSingle();
    const current = row as unknown as { status: BadgeSubmissionStatus; decision_note: string | null } | null;
    if (!current) throw new Error("That badge idea no longer exists.");
    if (current.status !== "approved" && current.status !== "uploaded") throw new Error("Approve the badge before marking its art uploaded.");
    const { error } = await db
      .from("badge_submissions" as never)
      .update({
        status: "uploaded",
        uploaded_at: new Date().toISOString(),
        uploaded_by: context.userId,
        decision_note: data.note || current.decision_note || "",
      } as never)
      .eq("id", data.id);
    if (error) throw new Error("Couldn't mark the art uploaded.");
    return { status: "uploaded" as const };
  });

/** Whether the founder seat is claimed, and whether it is you. The panel shows a claim button to a super admin. */
export const getFounderAccess = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ claimed: boolean; me: boolean }> => founderState(context as unknown as Ctx));

/** Claim the one founder seat. Only while it is empty, and only a super admin, so it cannot be taken twice. */
export const claimFounderAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isSuper } = await context.supabase.rpc("has_role" as never, { _user_id: context.userId, _role: "super_admin" } as never);
    if (!isSuper) throw new Error("Only a super admin can claim founder access.");
    const db = await adminDb();
    const { data: existing, error: readError } = await db.from("founder_access" as never).select("user_id").limit(1);
    if (readError) throw new Error("Couldn't check founder access. Run migration 20261105140000 first.");
    if ((existing ?? []).length) throw new Error("Founder access is already claimed.");
    const { error } = await db.from("founder_access" as never).insert({ user_id: context.userId } as never);
    if (error) throw new Error("Couldn't claim founder access.");
    return { me: true };
  });
