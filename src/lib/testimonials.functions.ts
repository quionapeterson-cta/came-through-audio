import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { cleanFilter, type TestimonialFilter } from "@/lib/testimonials";

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
