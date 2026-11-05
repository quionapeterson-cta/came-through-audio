import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveAccess, type StaffAccess } from "./departments";
import { getPaymentsEnvironment } from "./payments-env";
import { createBillingStripeClient, getStripeErrorMessage } from "./stripe.server";
import { CARD_UPDATE_STEPS, accountScope, profileEditError, profilePatch, type AccountScope } from "./member-account";
import { PRICE_TIER, TIER_LABEL } from "./plans";
import { SITE_URL } from "./email-layout";

/**
 * Account help for staff (founder, 2026-11-05): Support corrects a member's names, Billing sends the Stripe link that
 * changes the card, super admins do both. The browser names the member; the server decides what the caller may change.
 * Plan state still comes from Stripe and roles still come from Admin → Staff — nothing here can grant access or a tier.
 */
async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

type Ctx = {
  supabase: {
    from: (table: "user_roles") => {
      select: (columns: string) => {
        eq: (column: string, value: unknown) => PromiseLike<{ data: unknown }>;
      };
    };
  };
  userId: string;
  claims?: { email?: string };
};

async function requireAccount(context: Ctx): Promise<{ access: StaffAccess; scope: AccountScope }> {
  const { data } = await context.supabase.from("user_roles").select("role, departments").eq("user_id", context.userId);
  const access = resolveAccess((data ?? []) as { role: string; departments?: string[] | null }[]);
  const scope = accountScope(access);
  if (!access || !scope) throw new Error("Account help is for Support, Billing and super admins.");
  return { access, scope };
}

export type MemberAccount = {
  userId: string;
  email: string;
  stageName: string | null;
  legalName: string | null;
  plan: { label: string; status: string; renewsOn: string | null } | null;
  canEditProfile: boolean;
  canEditPayment: boolean;
  cardSteps: readonly string[];
};

type SubRow = { price_id: string; status: string; current_period_end: string | null };

/** One member by the email they signed up with, with the plan in force and what this caller may change. */
export const findMemberAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ email: z.string().trim().min(3, "Enter an email").max(320) }).parse(d))
  .handler(async ({ data, context }): Promise<MemberAccount> => {
    const { scope } = await requireAccount(context as unknown as Ctx);
    const d = await db();
    const env = getPaymentsEnvironment();
    const { data: found } = await d.rpc("billing_find_user" as never, { _email: data.email } as never);
    const userId = typeof found === "string" ? found : null;
    if (!userId) throw new Error("No account with that email. Use the address they signed up with.");
    const [{ data: profile }, { data: subs }] = await Promise.all([
      d.from("profiles").select("stage_name, legal_name").eq("id", userId).maybeSingle(),
      d.from("subscriptions").select("price_id, status, current_period_end")
        .eq("user_id", userId).eq("environment", env).not("stripe_subscription_id", "is", null)
        .order("created_at", { ascending: false }).limit(1),
    ]);
    const prof = profile as { stage_name: string | null; legal_name: string | null } | null;
    const sub = ((subs ?? []) as SubRow[])[0] ?? null;
    const tier = sub ? PRICE_TIER[sub.price_id] : undefined;
    return {
      userId,
      email: data.email.trim(),
      stageName: prof?.stage_name ?? null,
      legalName: prof?.legal_name ?? null,
      plan: sub ? { label: tier ? TIER_LABEL[tier] : sub.price_id, status: sub.status, renewsOn: sub.current_period_end } : null,
      canEditProfile: scope.editProfile,
      canEditPayment: scope.editPayment,
      cardSteps: CARD_UPDATE_STEPS,
    };
  });

/** Corrects the two names Support may fix. PRO, IPI and splits stay the member's own to change. */
export const updateMemberProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    userId: z.string().uuid(),
    stageName: z.string().max(200).optional(),
    legalName: z.string().max(200).optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { scope } = await requireAccount(context as unknown as Ctx);
    if (!scope.editProfile) throw new Error("Only Support and super admins can change a member's details.");
    const problem = profileEditError(data);
    if (problem) throw new Error(problem);
    const patch = profilePatch(data);
    const d = await db();
    const { error } = await d.from("profiles").update(patch as never).eq("id", data.userId);
    if (error) throw new Error("Couldn't save those details.");
    console.info("Member details corrected", { by: context.claims?.email ?? context.userId, userId: data.userId, fields: Object.keys(patch) });
    return { ok: true as const, ...patch };
  });

/** The Stripe page where the member changes the card, for staff to send. The card never passes through us. */
export const memberCardLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ userId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<{ url: string; steps: readonly string[] }> => {
    const { scope } = await requireAccount(context as unknown as Ctx);
    if (!scope.editPayment) throw new Error("Only Billing and super admins can send a card-update link.");
    const d = await db();
    const env = getPaymentsEnvironment();
    const { data: sub } = await d.from("subscriptions").select("stripe_customer_id")
      .eq("user_id", data.userId).eq("environment", env).not("stripe_customer_id", "is", null)
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    const customer = (sub as { stripe_customer_id?: string | null } | null)?.stripe_customer_id ?? null;
    if (!customer) throw new Error("No card on file yet. They can add one the first time they buy a plan.");
    try {
      const portal = await createBillingStripeClient(env).billingPortal.sessions.create({ customer, return_url: `${SITE_URL}/profile` });
      return { url: portal.url, steps: CARD_UPDATE_STEPS };
    } catch (e) {
      throw new Error(`Stripe couldn't open the billing page: ${getStripeErrorMessage(e)}`);
    }
  });
