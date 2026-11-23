import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireStaffAccess } from "@/lib/staff-access.server";
import type { SupportScript } from "@/lib/support-scripts";
import { SUPPORT_SCRIPTS } from "@/lib/support-scripts.server";

/**
 * Every support script, for every staff member (founder, 2026-11-05, moved server-side 2026-11-21). The catalog lives in
 * a `.server` module, so no script body — the `internal: true` wording above all — ships in the public admin bundle; it
 * reaches the panel and the ticket rail only through this staff-checked call.
 */
export const listSupportScripts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SupportScript[]> => {
    await requireStaffAccess(context, "Support Scripts are for team members.");
    return [...SUPPORT_SCRIPTS];
  });
