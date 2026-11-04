import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { cleanSocials, DEFAULT_SOCIALS, type SocialLink } from "@/lib/social";

const SETTING_ID = "social_links";

/** Public: the accounts the footer shows, with defaults until someone saves a set. Never throws at a visitor. */
export const getSiteSocials = createServerFn({ method: "GET" }).handler(async (): Promise<SocialLink[]> => {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin.from("site_settings").select("content").eq("id", SETTING_ID).maybeSingle();
    const saved = (data?.content as { links?: unknown } | null)?.links;
    return cleanSocials(saved ?? DEFAULT_SOCIALS);
  } catch { return DEFAULT_SOCIALS; }
});

/** Marketing & Social Media, Branding and super admins: the addresses and which icons show. */
export const setSiteSocials = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => cleanSocials(d))
  .handler(async ({ data, context }) => {
    const can = async (dept: string) => (await context.supabase.rpc("in_department", { _user_id: context.userId, _dept: dept })).data;
    if (!(await can("marketing")) && !(await can("branding"))) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("site_settings").upsert({
      id: SETTING_ID, content: { links: data, updatedBy: context.userId } as never, updated_at: new Date().toISOString(),
    });
    if (error) throw new Error("Couldn't save the social links.");
    return data;
  });
