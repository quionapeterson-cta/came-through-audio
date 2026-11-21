import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveAccess, type StaffAccess } from "@/lib/departments";
import {
  canDecideTestimonials,
  canEditTestimonials,
  canSubmitTestimonials,
  cleanReview,
  decideTestimonialsError,
  publishableTestimonials,
  STARTING_REVIEW,
  submitTestimonialsError,
  testimonialsEditable,
  type TestimonialReview,
  type TestimonialWorkspace,
} from "@/lib/testimonial-review";
import {
  cleanFilter,
  cleanTestimonials,
  SEED_TESTIMONIALS,
  TESTIMONIALS,
  type EditableTestimonial,
  type Testimonial,
  type TestimonialFilter,
} from "@/lib/testimonials";

const FILTER_ID = "testimonial_filter";
/** The cards the homepage shows, written only when a super admin approves a version. */
const LIVE_ID = "testimonials";
/** The working copy Marketing and Branding edit, with its review state. Never read by the public page. */
const DRAFT_ID = "testimonial_drafts";

type Ctx = {
  supabase: {
    from: (table: "user_roles") => {
      select: (columns: string) => {
        eq: (column: string, value: unknown) => PromiseLike<{ data: unknown }>;
      };
    };
  };
  userId: string;
};

const adminDb = async () => (await import("@/integrations/supabase/client.server")).supabaseAdmin;

async function accessOf(context: Ctx): Promise<StaffAccess | null> {
  const { data } = await context.supabase.from("user_roles").select("role, departments").eq("user_id", context.userId);
  return resolveAccess((data ?? []) as { role: string; departments?: string[] | null }[]);
}

/** Marketing, Branding and super admins: who may open the section, drafts included. */
async function requireEditor(context: Ctx): Promise<void> {
  if (!canEditTestimonials(await accessOf(context))) {
    throw new Error("Homepage testimonials are for Marketing, Branding and super admins.");
  }
}

/** A Marketing or Branding lead (or a super admin) sends a version to a super admin. */
async function requireSubmitter(context: Ctx): Promise<void> {
  const access = await accessOf(context);
  if (!canEditTestimonials(access)) throw new Error("Homepage testimonials are for Marketing, Branding and super admins.");
  if (!canSubmitTestimonials(access)) {
    throw new Error("Only a Marketing or Branding lead can send the section for approval.");
  }
}

/** Only a super admin approves, declines or sends it back. */
async function requireDecider(context: Ctx): Promise<void> {
  if (!canDecideTestimonials(await accessOf(context))) {
    throw new Error("Only a super admin can approve the homepage testimonials.");
  }
}

type SettingContent = Record<string, unknown> | null;

async function readContent(id: string): Promise<SettingContent> {
  const db = await adminDb();
  const { data } = await db.from("site_settings").select("content").eq("id", id).maybeSingle();
  return ((data?.content ?? null) as SettingContent) ?? null;
}

const itemsOf = (content: SettingContent): unknown => (content && "items" in content ? content["items"] : null);

/**
 * What the editor works on: the saved draft, or the live cards, or the file's list. The review state is separate so a
 * card can never be auto-published by a save, and the photo filter rides with the cards as part of the same version.
 */
async function workspace(): Promise<TestimonialWorkspace> {
  const [draft, live, liveFilter] = await Promise.all([
    readContent(DRAFT_ID),
    readContent(LIVE_ID),
    readContent(FILTER_ID),
  ]);
  const draftItems = itemsOf(draft);
  const liveItems = itemsOf(live);
  const items: EditableTestimonial[] = Array.isArray(draftItems)
    ? cleanTestimonials(draftItems)
    : Array.isArray(liveItems)
      ? cleanTestimonials(liveItems)
      : SEED_TESTIMONIALS;
  // An edit starts from the draft's own filter when it has one, otherwise from the look the homepage shows today.
  const filter = cleanFilter(draft && "filter" in draft ? draft["filter"] : liveFilter);
  return { items, review: cleanReview(draft?.["review"]), filter };
}

/** Writes the working copy only. Nothing on the homepage is touched until a super admin approves. */
async function writeDraft(items: EditableTestimonial[], review: TestimonialReview, filter: TestimonialFilter) {
  const db = await adminDb();
  const { error } = await db.from("site_settings").upsert({
    id: DRAFT_ID,
    content: { items, review, filter } as never,
    updated_at: new Date().toISOString(),
  } as never);
  if (error) {
    console.error("[testimonials] draft save failed", error.message);
    throw new Error("Couldn't save the testimonial section.");
  }
}

/** Public: the shared testimonial photo filter for the homepage (defaults until someone saves one). */
export const getTestimonialFilter = createServerFn({ method: "GET" }).handler(
  async (): Promise<TestimonialFilter> => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data } = await supabaseAdmin
        .from("site_settings")
        .select("content")
        .eq("id", FILTER_ID)
        .maybeSingle();
      return cleanFilter(data?.content);
    } catch {
      return cleanFilter(null);
    }
  },
);

// The filter is never saved on its own (founder, 2026-11-21): it is edited in the same draft as the cards, and
// `decideTestimonials` writes it to the homepage when the version is approved. There is no direct write path.

/** Public: the published homepage testimonials (the file's list until a version is approved). */
export const getTestimonials = createServerFn({ method: "GET" }).handler(
  async (): Promise<Testimonial[]> => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data } = await supabaseAdmin
        .from("site_settings")
        .select("content")
        .eq("id", LIVE_ID)
        .maybeSingle();
      const items = (data?.content as { items?: unknown } | null)?.items;
      if (!Array.isArray(items)) return TESTIMONIALS;
      return publishableTestimonials(cleanTestimonials(items))
        .map(({ id: _id, published: _p, releaseSignedOn: _r, ...t }) => t);
    } catch {
      return TESTIMONIALS;
    }
  },
);

/**
 * Marketing, Branding and super admins: the working copy and where its review stands. An ordinary staff member can
 * neither read this nor reach it through `site_settings`, which the new policy narrows.
 */
export const getTestimonialDrafts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<TestimonialWorkspace> => {
    await requireEditor(context as unknown as Ctx);
    return workspace();
  });

/** Save the working copy: the cards and the photo filter together. Neither reaches the homepage without approval. */
export const saveTestimonials = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => {
    const o = (d && typeof d === "object" ? d : {}) as { items?: unknown; filter?: unknown };
    return { items: cleanTestimonials(o.items), filter: cleanFilter(o.filter) };
  })
  .handler(async ({ data, context }): Promise<TestimonialWorkspace> => {
    await requireEditor(context as unknown as Ctx);
    const { review } = await workspace();
    if (!testimonialsEditable(review.status)) {
      throw new Error("This version is with a super admin. Edits open again when they decide.");
    }
    const now = new Date().toISOString();
    // A save is a new version: the old decision is spent, while the reviewer's note stays as context.
    await writeDraft(
      data.items,
      {
        ...STARTING_REVIEW,
        note: review.note,
        updatedBy: context.userId,
        updatedAt: now,
      },
      data.filter,
    );
    return workspace();
  });

/** Send the saved version to a super admin. Only one version can wait for a decision at a time. */
export const requestTestimonialApproval = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<TestimonialWorkspace> => {
    await requireSubmitter(context as unknown as Ctx);
    const current = await workspace();
    const problem = submitTestimonialsError(current.review);
    if (problem) throw new Error(problem);
    const draft = await readContent(DRAFT_ID);
    if (!draft) throw new Error("Save the section before sending it for approval.");
    const now = new Date().toISOString();
    await writeDraft(
      current.items,
      {
        status: "pending_approval",
        submittedBy: context.userId,
        submittedAt: now,
        decidedBy: null,
        decidedAt: null,
        note: current.review.note,
        updatedBy: context.userId,
        updatedAt: now,
      },
      current.filter,
    );
    return workspace();
  });

/**
 * A super admin's decision (founder, 2026-11-21): approve puts the ticked cards on the homepage, decline closes the
 * version, and sending it back reopens the editor with the note attached.
 */
export const decideTestimonials = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        decision: z.enum(["approve", "deny", "changes"]),
        note: z.string().trim().max(500).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<TestimonialWorkspace> => {
    await requireDecider(context as unknown as Ctx);
    const current = await workspace();
    const note = (data.note ?? "").trim();
    const problem = decideTestimonialsError(current.review, data.decision, note);
    if (problem) throw new Error(problem);
    const draft = await readContent(DRAFT_ID);
    if (!draft) throw new Error("Nothing is waiting for approval.");

    const now = new Date().toISOString();
    if (data.decision === "approve") {
      const db = await adminDb();
      // The live rows are what the homepage reads, and the approved version is both of them: the cards and the filter.
      // Unticked cards travel with the cards row but are never shown.
      const { error } = await db.from("site_settings").upsert({
        id: LIVE_ID,
        content: {
          items: current.items,
          updatedBy: context.userId,
          updatedAt: now,
          approvedBy: context.userId,
          approvedAt: now,
        } as never,
        updated_at: now,
      } as never);
      if (error) {
        console.error("[testimonials] approval failed", error.message);
        throw new Error("Couldn't put the approved cards on the homepage.");
      }
      const { error: filterError } = await db.from("site_settings").upsert({
        id: FILTER_ID,
        content: {
          ...current.filter,
          updatedBy: context.userId,
          updatedAt: now,
          approvedBy: context.userId,
          approvedAt: now,
        } as never,
        updated_at: now,
      } as never);
      if (filterError) {
        console.error("[testimonials] filter approval failed", filterError.message);
        throw new Error("Couldn't put the approved photo filter on the homepage.");
      }
    }

    await writeDraft(
      current.items,
      {
        status: data.decision === "approve" ? "approved" : data.decision === "deny" ? "denied" : "changes_requested",
        submittedBy: current.review.submittedBy,
        submittedAt: current.review.submittedAt,
        decidedBy: context.userId,
        decidedAt: now,
        note,
        updatedBy: context.userId,
        updatedAt: now,
      },
      current.filter,
    );
    return workspace();
  });

/** Upload a testimonial photo (JPEG/PNG/WebP, up to 5 MB) to the public site-media bucket; returns its public URL. */
export const uploadTestimonialPhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { base64: string; type: string }) => {
    if (!["image/jpeg", "image/png", "image/webp"].includes(d?.type))
      throw new Error("Use a JPEG, PNG or WebP photo.");
    if (typeof d.base64 !== "string" || d.base64.length > 7_000_000)
      throw new Error("Photos can be up to 5 MB.");
    return d;
  })
  .handler(async ({ data, context }) => {
    await requireEditor(context as unknown as Ctx);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const ext = data.type === "image/png" ? "png" : data.type === "image/webp" ? "webp" : "jpg";
    const path = `testimonials/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabaseAdmin.storage
      .from("site-media")
      .upload(path, Buffer.from(data.base64, "base64"), { contentType: data.type });
    if (error)
      throw new Error(
        "Couldn't upload the photo. Has migration 20261025110000 (site-media) been run?",
      );
    return { url: supabaseAdmin.storage.from("site-media").getPublicUrl(path).data.publicUrl };
  });
