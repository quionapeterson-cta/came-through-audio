/**
 * The environment the database counts (site_settings `payments`), or `null` when the row isn't set. `read: false` means
 * the read itself failed; checkout then refuses rather than charge for a plan nothing may count, because the published
 * link must never take real money by accident (founder, 2026-11-12).
 *
 * One reader for checkout and for the staff banner that reports a build/database disagreement, so the two can never
 * answer differently.
 */
export async function readCountedPaymentsEnvironment(): Promise<
  { read: false } | { read: true; env: "sandbox" | "live" | null }
> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("site_settings")
      .select("content")
      .eq("id", "payments")
      .maybeSingle();
    if (error) throw new Error(error.message);
    const value = (data?.content as { environment?: string } | null)?.environment;
    return { read: true, env: value === "live" || value === "sandbox" ? value : null };
  } catch (e) {
    // Checkout refuses on this answer (CHECKOUT_UNAVAILABLE), so the log says that rather than the old "letting it through".
    console.error(
      "Could not read the payments environment; checkout is refused until it can be read:",
      e,
    );
    return { read: false };
  }
}
