import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { verifyWebhook, EventName, type PaddleEnv } from "@/lib/paddle.server";

let _sb: ReturnType<typeof createClient> | null = null;
function db() {
  if (!_sb) _sb = createClient(process.env['SUPABASE_URL']!, process.env['SUPABASE_SERVICE_ROLE_KEY']!);
  return _sb;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function subCreated(data: any, env: PaddleEnv) {
  const userId = data.customData?.userId;
  if (!userId) return console.error("No userId in customData");
  const item = data.items[0];
  const priceId = item.price.importMeta?.externalId;
  const productId = item.product.importMeta?.externalId;
  if (!priceId || !productId) return console.warn("Skipping subscription: missing importMeta.externalId");
  await db().from("subscriptions").upsert({
    user_id: userId, paddle_subscription_id: data.id, paddle_customer_id: data.customerId,
    product_id: productId, price_id: priceId, status: data.status,
    current_period_start: data.currentBillingPeriod?.startsAt, current_period_end: data.currentBillingPeriod?.endsAt,
    environment: env, updated_at: new Date().toISOString(),
  } as never, { onConflict: "paddle_subscription_id" });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function subUpdated(data: any, env: PaddleEnv) {
  const item = data.items?.[0];
  const priceId = item?.price?.importMeta?.externalId;
  await db().from("subscriptions").update({
    status: data.status,
    ...(priceId ? { price_id: priceId, product_id: item.product?.importMeta?.externalId ?? undefined } : {}),
    current_period_start: data.currentBillingPeriod?.startsAt, current_period_end: data.currentBillingPeriod?.endsAt,
    cancel_at_period_end: data.scheduledChange?.action === "cancel", updated_at: new Date().toISOString(),
  } as never).eq("paddle_subscription_id", data.id).eq("environment", env);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function txCompleted(data: any, env: PaddleEnv) {
  if (data.subscriptionId) return; // subscription payments handled above
  const cd = data.customData ?? {};
  if (!cd.userId || !cd.kind) return console.warn("One-time transaction without userId/kind");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const priceIds = (data.items ?? []).map((i: any) => i.price?.importMeta?.externalId).filter(Boolean);
  await db().from("purchases").upsert({
    user_id: cd.userId, paddle_transaction_id: data.id, kind: cd.kind, price_ids: priceIds, details: cd, environment: env,
  } as never, { onConflict: "paddle_transaction_id" });
}

export const Route = createFileRoute("/api/public/payments/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const env = (new URL(request.url).searchParams.get("env") || "sandbox") as PaddleEnv;
        try {
          const event = await verifyWebhook(request, env);
          switch (event.eventType) {
            case EventName.SubscriptionCreated: await subCreated(event.data, env); break;
            case EventName.SubscriptionUpdated: await subUpdated(event.data, env); break;
            case EventName.SubscriptionCanceled:
              await db().from("subscriptions").update({ status: "canceled", updated_at: new Date().toISOString() } as never)
                .eq("paddle_subscription_id", (event.data as { id: string }).id).eq("environment", env);
              break;
            case EventName.TransactionCompleted: await txCompleted(event.data, env); break;
            default: console.log("Unhandled event:", event.eventType);
          }
          return Response.json({ received: true });
        } catch (e) {
          console.error("Webhook error:", e);
          return new Response("Webhook error", { status: 400 });
        }
      },
    },
  },
});
