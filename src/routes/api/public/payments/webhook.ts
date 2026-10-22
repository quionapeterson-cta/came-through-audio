import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type Stripe from "stripe";
import { createStripeClient, verifyWebhook, type StripeEnv } from "@/lib/stripe.server";
import { purchaseRow, subscriptionRow, type StripeSubscriptionLike } from "@/lib/stripe-mapping";

let _sb: ReturnType<typeof createClient> | null = null;
function db() {
  if (!_sb) _sb = createClient(process.env['SUPABASE_URL']!, process.env['SUPABASE_SERVICE_ROLE_KEY']!);
  return _sb;
}

/** Writes the subscription's current state. Fetched fresh from Stripe so out-of-order events can't roll it back. */
async function syncSubscription(env: StripeEnv, subscriptionId: string) {
  const sub = await createStripeClient(env).subscriptions.retrieve(subscriptionId);
  await saveSubscription(sub as unknown as StripeSubscriptionLike, env);
}

async function saveSubscription(sub: StripeSubscriptionLike, env: StripeEnv, deleted = false) {
  const row = subscriptionRow(sub, env, deleted);
  if (!row) return console.warn(`Skipping subscription ${sub.id}: price has no plan lookup key`);
  const userId = sub.metadata?.["userId"];
  if (userId) {
    const { error } = await db().from("subscriptions").upsert({ ...row, user_id: userId } as never, { onConflict: "stripe_subscription_id" });
    if (error) throw error;
  } else {
    // Created outside our checkout (e.g. in the Stripe dashboard): only update a row we already know.
    const { error } = await db().from("subscriptions").update(row as never).eq("stripe_subscription_id", sub.id);
    if (error) throw error;
  }
}

async function checkoutCompleted(session: Stripe.Checkout.Session, env: StripeEnv) {
  if (session.mode === "subscription" && session.subscription) {
    return syncSubscription(env, typeof session.subscription === "string" ? session.subscription : session.subscription.id);
  }
  const row = purchaseRow(session as Parameters<typeof purchaseRow>[0], env);
  if (!row) return console.warn(`Checkout ${session.id} has no paid one-time purchase to record`);
  const { data: saved, error } = await db().from("purchases").upsert(row as never, { onConflict: "stripe_session_id" }).select("id, user_id, details").single();
  if (error) throw error;
  const purchase = saved as unknown as { id: string; user_id: string; details: Record<string, string> } | null;
  // Renew now paid: move the next charge a year past the renewal it paid for. 500 on failure so Stripe retries.
  if (row.kind === "renew" && purchase) {
    const { admin, applyEarlyRenewal } = await import("@/lib/retention.server");
    await applyEarlyRenewal(await admin(), purchase, env);
    return;
  }
  // Vault fee paid: start the pause it bought. A failure returns 500 so Stripe retries (it's paid for).
  if (row.kind === "vault" && purchase) {
    const { admin, startPause } = await import("@/lib/retention.server");
    await startPause(await admin(), purchase, env);
    return;
  }
  // Expert Assistance: set up the intake, check every paid song and alert the user right away.
  if (row.kind === "expert" && purchase) {
    // Never fails the payment: if this can't run now, the checklist sets it up when the user opens it.
    try {
      const { admin, startRegistration } = await import("@/lib/registration.server");
      await startRegistration(await admin(), purchase);
    } catch (e) { console.error(`Registration intake for ${purchase.id} failed:`, e); }
  }
}

/** Marks the one-time purchase paid by this charge as refunded (kept for history, no longer unlocks anything). */
async function markRefunded(env: StripeEnv, charge: Stripe.Charge) {
  const pi = typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id;
  if (!pi) return;
  const sessions = await createStripeClient(env).checkout.sessions.list({ payment_intent: pi, limit: 1 });
  const sessionId = sessions.data[0]?.id;
  if (!sessionId) return;
  const { data: row } = await db().from("purchases").select("id, user_id, kind, details").eq("stripe_session_id", sessionId).maybeSingle();
  const purchase = row as { id: string; user_id: string; kind: string; details: Record<string, string> } | null;
  if (!purchase) return;
  const { error } = await db().from("purchases")
    .update({ details: { ...purchase.details, refunded_at: new Date().toISOString() } } as never).eq("id", purchase.id);
  if (error) throw error;
  if (purchase.kind === "renew") {
    const { undoEarlyRenewal } = await import("@/lib/retention.server");
    await undoEarlyRenewal(purchase, env);
  }
}

/** A subscription just set to cancel (it wasn't before this event) gets the "your plan ends on DATE" email once. */
async function cancelNotice(env: StripeEnv, sub: StripeSubscriptionLike, previous: Record<string, unknown> | undefined) {
  const now = !!sub.cancel_at_period_end || !!sub.cancel_at;
  const was = previous && (("cancel_at_period_end" in previous && previous["cancel_at_period_end"] === false) || ("cancel_at" in previous && previous["cancel_at"] === null));
  if (!now || !was) return;
  const row = subscriptionRow(sub, env);
  let userId = sub.metadata?.["userId"];
  if (!userId) {
    const { data } = await db().from("subscriptions").select("user_id").eq("stripe_subscription_id", sub.id).maybeSingle();
    userId = (data as { user_id?: string } | null)?.user_id;
  }
  const endsOn = sub.cancel_at ? new Date(sub.cancel_at * 1000).toISOString() : row?.current_period_end;
  if (!userId || !endsOn) return;
  const { admin, sendCancelledEmail } = await import("@/lib/retention.server");
  await sendCancelledEmail(await admin(), userId, sub.id, endsOn);
}

/** Renewals: the invoice points at its subscription (location differs by Stripe API version). */
function invoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  const i = invoice as unknown as { subscription?: string | { id: string } | null; parent?: { subscription_details?: { subscription?: string | { id: string } } | null } | null };
  const s = i.parent?.subscription_details?.subscription ?? i.subscription;
  return typeof s === "string" ? s : s?.id ?? null;
}

export const Route = createFileRoute("/api/public/payments/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const env: StripeEnv = new URL(request.url).searchParams.get("env") === "live" ? "live" : "sandbox";
        let event: { type: string; data: { object: any; previous_attributes?: Record<string, unknown> } }; // eslint-disable-line @typescript-eslint/no-explicit-any
        try {
          event = await verifyWebhook(request, env);
        } catch (e) {
          console.error("Webhook signature check failed:", e);
          return new Response("Invalid webhook signature", { status: 400 });
        }
        try {
          switch (event.type) {
            case "checkout.session.completed":
              await checkoutCompleted(event.data.object, env);
              break;
            case "customer.subscription.created":
              await syncSubscription(env, event.data.object.id);
              break;
            case "customer.subscription.updated":
              await syncSubscription(env, event.data.object.id);
              // Never fails the event: the email is a courtesy, the plan state is already saved.
              try { await cancelNotice(env, event.data.object as StripeSubscriptionLike, event.data.previous_attributes); }
              catch (e) { console.error("Cancel email failed:", e); }
              break;
            case "customer.subscription.deleted":
              await saveSubscription(event.data.object as unknown as StripeSubscriptionLike, env, true);
              break;
            case "invoice.paid": {
              const id = invoiceSubscriptionId(event.data.object);
              if (id) await syncSubscription(env, id);
              break;
            }
            case "invoice.payment_failed": {
              // A yearly renewal that didn't go through: tell them, with Update card, Need more time and Pause.
              const invoice = event.data.object as Stripe.Invoice;
              const id = invoiceSubscriptionId(invoice);
              if (id && invoice.billing_reason === "subscription_cycle") {
                await syncSubscription(env, id);
                const { data } = await db().from("subscriptions").select("user_id, price_id").eq("stripe_subscription_id", id).maybeSingle();
                const sub = data as { user_id: string; price_id: string } | null;
                if (sub) {
                  try {
                    const { sendPaymentFailedEmail } = await import("@/lib/retention.server");
                    await sendPaymentFailedEmail(sub.user_id, sub.price_id, invoice.id ?? id, invoice.attempt_count ?? 1);
                  } catch (e) { console.error("Payment failed email failed:", e); }
                }
              }
              break;
            }
            case "charge.refunded": {
              const charge = event.data.object as Stripe.Charge;
              // Only a full refund ends the purchase; partial refunds keep access.
              if (charge.refunded) await markRefunded(env, charge);
              break;
            }
            default:
              console.log("Unhandled event:", event.type);
          }
          return Response.json({ received: true });
        } catch (e) {
          // 500 so Stripe retries later.
          console.error(`Webhook ${event.type} failed:`, e);
          return new Response("Webhook error", { status: 500 });
        }
      },
    },
  },
});
