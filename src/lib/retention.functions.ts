import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getPaymentsEnvironment } from "@/lib/payments-env";
import { getStripeErrorMessage } from "@/lib/stripe.server";

/**
 * Need more time, Resume now, Cancel plan and Keep my plan, always for the signed-in user. Pause is bought through
 * checkout (kind "vault") and started by the payment webhook. Every rule is re-checked on the server.
 */
async function run<T>(what: string, fn: () => Promise<T>): Promise<T> {
  try { return await fn(); } catch (e) {
    const reason = getStripeErrorMessage(e);
    console.error(`${what} failed:`, reason, e);
    // Rule messages (once a year, window not open…) are written for the user; anything else names the reason.
    if (e instanceof Error && !("raw" in e)) throw e;
    throw new Error(`${what} didn't go through (${reason.slice(0, 160)}). Try again, or contact support and we'll help right away.`);
  }
}

export const needMoreTime = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => run("Need more time", async () => {
    const { admin, extend } = await import("@/lib/retention.server");
    return extend(await admin(), context.userId, getPaymentsEnvironment());
  }));

export const resumeNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => run("Resume", async () => {
    const { admin, resume } = await import("@/lib/retention.server");
    await resume(await admin(), context.userId, getPaymentsEnvironment());
    return { ok: true };
  }));

export const setPlanCancelling = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ cancel: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => run(data.cancel ? "Cancelling" : "Keeping your plan", async () => {
    const { admin, setCancelling } = await import("@/lib/retention.server");
    await setCancelling(await admin(), context.userId, getPaymentsEnvironment(), data.cancel);
    return { ok: true };
  }));
