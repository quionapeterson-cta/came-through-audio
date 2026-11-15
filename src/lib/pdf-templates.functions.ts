import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  PDF_TEMPLATE_EDITOR_ROLES,
  TEMPLATE_TIERS,
  type PdfTemplate,
  type TemplateBlock,
} from "./pdf-templates";

/**
 * The Template Studio library (founder, 2026-11-15). Staff build or convert a document, save it, and the whole team can
 * open it again. Everything is additive: a saved template is a row of blocks, so a later version of the studio can read
 * one written today.
 */

type Ctx = {
  supabase: { rpc: (fn: never, args: never) => PromiseLike<{ data: unknown }> };
  userId: string;
};

const BLOCK_KINDS = [
  "header",
  "meta",
  "clause",
  "signatures",
  "seal",
  "section",
  "fields",
  "checkboxes",
  "signature",
] as const;

const blockSchema = z
  .object({ id: z.string().min(1).max(40), kind: z.enum(BLOCK_KINDS) })
  .passthrough();

const templateInput = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1, "Name the template.").max(120),
  tier: z.enum(TEMPLATE_TIERS),
  blocks: z.array(blockSchema).min(1).max(60),
  source: z.enum(["built", "converted"]).default("built"),
});

export type SavedTemplate = Required<Pick<PdfTemplate, "id" | "name" | "tier" | "blocks">> & {
  source: "built" | "converted";
  updatedAt: string;
  createdBy: string;
};

type Row = {
  id: string;
  name: string;
  tier: string;
  blocks: TemplateBlock[];
  source: string;
  created_at: string;
  updated_at: string;
  created_by: string;
};

async function requireStaff(context: Ctx): Promise<void> {
  const { data } = await context.supabase.rpc(
    "is_staff" as never,
    { _user_id: context.userId } as never,
  );
  if (!data) throw new Error("Only staff can use Template Studio.");
}

/**
 * Changing the library is narrower than reading it (founder, 2026-11-15): a super admin, HR admin, project manager or
 * department lead writes; every other staff member reads, because the send dialog picks from the same library.
 */
async function requireTemplateAuthor(context: Ctx): Promise<void> {
  await requireStaff(context);
  const checks = await Promise.all(
    PDF_TEMPLATE_EDITOR_ROLES.map((role) =>
      context.supabase.rpc("has_role" as never, { _user_id: context.userId, _role: role } as never),
    ),
  );
  if (!checks.some((result) => Boolean(result.data))) {
    throw new Error(
      "Only a super admin, HR admin, project manager or department lead can change the template library.",
    );
  }
}

const toTemplate = (row: Row): SavedTemplate => ({
  id: row.id,
  name: row.name,
  tier: (TEMPLATE_TIERS as readonly string[]).includes(row.tier)
    ? (row.tier as SavedTemplate["tier"])
    : "standard",
  blocks: Array.isArray(row.blocks) ? row.blocks : [],
  source: row.source === "converted" ? "converted" : "built",
  updatedAt: row.updated_at,
  createdBy: row.created_by,
});

/** Every saved template, newest first. */
export const listPdfTemplates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SavedTemplate[]> => {
    await requireStaff(context);
    const { data, error } = await context.supabase
      .from("pdf_templates" as never)
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(100);
    if (error)
      throw new Error("Couldn't load the template library. Run migration 20261115200000 first.");
    return ((data ?? []) as unknown as Row[]).map(toTemplate);
  });

/** Saves a new template, or updates one that is already in the library. */
export const savePdfTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => templateInput.parse(d))
  .handler(async ({ data, context }): Promise<SavedTemplate> => {
    await requireTemplateAuthor(context);
    const row = {
      name: data.name,
      tier: data.tier,
      blocks: data.blocks as unknown as TemplateBlock[],
      source: data.source,
      updated_by: context.userId,
      updated_at: new Date().toISOString(),
    };
    const query = data.id
      ? context.supabase
          .from("pdf_templates" as never)
          .update(row as never)
          .eq("id", data.id)
      : context.supabase
          .from("pdf_templates" as never)
          .insert({ ...row, created_by: context.userId } as never);
    const { data: saved, error } = await query.select("*").single();
    if (error) throw new Error("Couldn't save the template. Run migration 20261115200000 first.");
    return toTemplate(saved as unknown as Row);
  });

/** Copies a template in the library, so an admin can change a preset without losing the original. */
export const duplicatePdfTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<SavedTemplate> => {
    await requireTemplateAuthor(context);
    const { data: row, error } = await context.supabase
      .from("pdf_templates" as never)
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error || !row) throw new Error("That template is no longer in the library.");
    const source = row as unknown as Row;
    const { data: copy, error: copyError } = await context.supabase
      .from("pdf_templates" as never)
      .insert({
        name: `${source.name} (copy)`.slice(0, 120),
        tier: source.tier,
        blocks: source.blocks,
        source: source.source,
        created_by: context.userId,
      } as never)
      .select("*")
      .single();
    if (copyError) throw new Error("Couldn't duplicate the template.");
    return toTemplate(copy as unknown as Row);
  });

/** Removes a template from the library. The documents already sent with it are untouched. */
export const deletePdfTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await requireTemplateAuthor(context);
    const { error } = await context.supabase
      .from("pdf_templates" as never)
      .delete()
      .eq("id", data.id);
    if (error) throw new Error("Couldn't delete the template.");
    return { ok: true };
  });
