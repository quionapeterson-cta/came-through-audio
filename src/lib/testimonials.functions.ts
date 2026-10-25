import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { cleanFilter, cleanTestimonials, SEED_TESTIMONIALS, TESTIMONIALS, type EditableTestimonial, type Testimonial, type TestimonialFilter } from "@/lib/testimonials";

const SETTING_ID = "testimonial_filter";

/** Public: the shared testimonial photo filter for the homepage (defaults until someone saves one). */
export const getTestimonialFilter = createServerFn({ method: "GET" }).handler(async (): Promise<TestimonialFilter> => {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin.from("site_settings").select("content").eq("id", SETTING_ID).maybeSingle();
    return cleanFilter(data?.content);
  } catch { return cleanFilter(null); }
});

/** Marketing & Social Media, Branding and super admins: save the one filter every testimonial photo uses. */
export const setTestimonialFilter = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => cleanFilter(d))
  .handler(async ({ data, context }) => {
    const can = async (dept: string) => (await context.supabase.rpc("in_department", { _user_id: context.userId, _dept: dept })).data;
    if (!(await can("marketing")) && !(await can("branding"))) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("site_settings").upsert({
      id: SETTING_ID, content: { ...data, updatedBy: context.userId } as never, updated_at: new Date().toISOString(),
    });
    if (error) throw new Error("Couldn't save the filter.");
    return data;
  });

const LIST_ID = "testimonials";
const canEditHomepage = async (context: { supabase: { rpc: (fn: "in_department", args: { _user_id: string; _dept: string }) => PromiseLike<{ data: unknown }> }; userId: string }) =>
  !!(await context.supabase.rpc("in_department", { _user_id: context.userId, _dept: "marketing" })).data
  || !!(await context.supabase.rpc("in_department", { _user_id: context.userId, _dept: "branding" })).data;

/** Public: the published homepage testimonials (the file's list until Marketing saves one). */
export const getTestimonials = createServerFn({ method: "GET" }).handler(async (): Promise<Testimonial[]> => {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin.from("site_settings").select("content").eq("id", LIST_ID).maybeSingle();
    const items = (data?.content as { items?: unknown } | null)?.items;
    if (!Array.isArray(items)) return TESTIMONIALS;
    return cleanTestimonials(items).filter((t) => t.published).map(({ id: _id, published: _p, releaseSignedOn: _r, ...t }) => t);
  } catch { return TESTIMONIALS; }
});

/** Marketing, Branding and super admins: every card, drafts included, for the editor. */
export const getTestimonialDrafts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<EditableTestimonial[]> => {
    if (!(await canEditHomepage(context))) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin.from("site_settings").select("content").eq("id", LIST_ID).maybeSingle();
    const items = (data?.content as { items?: unknown } | null)?.items;
    return Array.isArray(items) ? cleanTestimonials(items) : SEED_TESTIMONIALS;
  });

/** Save the cards. Cards that aren't ready (missing release date, too long, no photo) are saved as drafts, never published. */
export const saveTestimonials = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => cleanTestimonials(d))
  .handler(async ({ data, context }) => {
    if (!(await canEditHomepage(context))) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("site_settings").upsert({
      id: LIST_ID, content: { items: data, updatedBy: context.userId, updatedAt: new Date().toISOString() } as never, updated_at: new Date().toISOString(),
    });
    if (error) throw new Error("Couldn't save the testimonials.");
    return data;
  });

/** Upload a testimonial photo (JPEG/PNG/WebP, up to 5 MB) to the public site-media bucket; returns its public URL. */
export const uploadTestimonialPhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { base64: string; type: string }) => {
    if (!["image/jpeg", "image/png", "image/webp"].includes(d?.type)) throw new Error("Use a JPEG, PNG or WebP photo.");
    if (typeof d.base64 !== "string" || d.base64.length > 7_000_000) throw new Error("Photos can be up to 5 MB.");
    return d;
  })
  .handler(async ({ data, context }) => {
    if (!(await canEditHomepage(context))) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const ext = data.type === "image/png" ? "png" : data.type === "image/webp" ? "webp" : "jpg";
    const path = `testimonials/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabaseAdmin.storage.from("site-media").upload(path, Buffer.from(data.base64, "base64"), { contentType: data.type });
    if (error) throw new Error("Couldn't upload the photo. Has migration 20261025110000 (site-media) been run?");
    return { url: supabaseAdmin.storage.from("site-media").getPublicUrl(path).data.publicUrl };
  });
