import { createServerFn } from "@tanstack/react-start";
import { gatewayFetch, type PaddleEnv } from "@/lib/paddle.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const resolvePaddlePrice = createServerFn({ method: "GET" })
  .inputValidator((data: { priceId: string; environment: PaddleEnv }) => data)
  .handler(async ({ data }) => {
    const response = await gatewayFetch(data.environment, `/prices?external_id=${encodeURIComponent(data.priceId)}`);
    const result = await response.json();
    if (!result.data?.length) throw new Error("Price not found");
    return result.data[0].id as string;
  });

/**
 * Opens the signed-in user's Paddle customer portal: cancel, update the card, see invoices. The subscription is
 * looked up through the caller's own session, so nobody can open someone else's billing.
 */
export const openBillingPortal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { environment: PaddleEnv }) => ({ environment: data.environment === "live" ? "live" as const : "sandbox" as const }))
  .handler(async ({ data, context }) => {
    const { data: subs } = await context.supabase.from("subscriptions").select("paddle_customer_id, paddle_subscription_id")
      .eq("user_id", context.userId).eq("environment", data.environment).order("created_at", { ascending: false }).limit(1);
    const sub = subs?.[0];
    if (!sub?.paddle_customer_id) throw new Error("No plan to manage yet. Pick a plan first.");
    const response = await gatewayFetch(data.environment, `/customers/${encodeURIComponent(sub.paddle_customer_id)}/portal-sessions`, {
      method: "POST",
      body: JSON.stringify({ subscription_ids: [sub.paddle_subscription_id] }),
    });
    const result = await response.json().catch(() => ({}));
    const url = result?.data?.urls?.general?.overview as string | undefined;
    if (!response.ok || !url) throw new Error("Billing couldn't open. Contact support and we'll help right away.");
    return { url };
  });
