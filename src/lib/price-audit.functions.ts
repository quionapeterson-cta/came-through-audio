import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { canAuditPayments, resolveAccess } from "@/lib/departments";
import { getPaymentsEnvironment } from "@/lib/payments-env";
import { readCountedPaymentsEnvironment } from "@/lib/payments-env.server";
import { soldPrices } from "@/lib/price-list";
import { auditLivePrices, type AuditedPrice, type StripePriceLike } from "@/lib/price-audit";
import { createStripeClient, getStripeErrorMessage } from "@/lib/stripe.server";

/**
 * The staff half of the payments check (founder, 2026-11-20): Billing, Support, Software and super admins only, the
 * people who answer a failed purchase. Both reads are server-side so a member can never see the live account's state.
 */

const DENIED =
  "The payments check is for the Billing, Support and Software teams and super admins.";

type Ctx = {
  supabase: {
    from: (table: "user_roles") => {
      select: (columns: string) => {
        eq: (column: string, value: unknown) => PromiseLike<{ data: unknown }>;
      };
    };
  };
  userId: string;
};

async function requirePaymentsAudit(context: Ctx): Promise<void> {
  const { data } = await context.supabase
    .from("user_roles")
    .select("role, departments")
    .eq("user_id", context.userId);
  const access = resolveAccess((data ?? []) as { role: string; departments?: string[] | null }[]);
  if (!canAuditPayments(access)) throw new Error(DENIED);
}

export type PaymentModeStatus = {
  /** The mode this build checks out in (its Stripe key). */
  app: "sandbox" | "live";
  /** What site_settings `payments` says the database counts. */
  counted: "sandbox" | "live" | null;
  /** The setting couldn't be read, so checkout is refused whatever the build says. */
  readFailed: boolean;
  /** The build and the database disagree, so checkout is refused before Stripe is called. */
  mismatch: boolean;
};

/** Whether this build's payment mode and the database's counted environment agree. Read by the staff banner. */
export const paymentModeStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PaymentModeStatus> => {
    await requirePaymentsAudit(context as unknown as Ctx);
    const app = getPaymentsEnvironment();
    const counted = await readCountedPaymentsEnvironment();
    return {
      app,
      counted: counted.read ? counted.env : null,
      readFailed: !counted.read,
      mismatch: counted.read ? counted.env !== app : false,
    };
  });

export type LivePriceAuditResult = {
  /** The mode this build checks out in, so the panel can say which site it belongs to. */
  app: "sandbox" | "live";
  rows: AuditedPrice[];
  problems: string[];
  ok: boolean;
  checkedAt: string;
  /** Set when Stripe itself couldn't be read; the problems list carries the message too. */
  error: string | null;
};

/**
 * Every lookup key the site sells, checked against the live Stripe account: present, active, USD, the billing type the
 * key is sold as, and charging exactly the published amount. A failure here is the same refusal checkout would give at
 * Buy, reported before a member meets it.
 */
export const livePriceAudit = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<LivePriceAuditResult> => {
    await requirePaymentsAudit(context as unknown as Ctx);
    const app = getPaymentsEnvironment();
    const checkedAt = new Date().toISOString();
    try {
      const stripe = createStripeClient("live");
      const keys = soldPrices().map((row) => row.lookupKey);
      // One page holds every key the site sells (Stripe allows 100 lookup keys and one page is 100 prices).
      const { data } = await stripe.prices.list({ lookup_keys: keys, limit: 100 });
      const audit = auditLivePrices(data as StripePriceLike[]);
      return {
        app,
        rows: audit.rows,
        problems: audit.problems,
        ok: audit.ok,
        checkedAt,
        error: null,
      };
    } catch (e) {
      const reason = getStripeErrorMessage(e);
      console.error("Live price audit could not read Stripe:", reason, e);
      return {
        app,
        rows: [],
        problems: [
          `Couldn't read the live Stripe account (${reason}), so no price could be checked.`,
        ],
        ok: false,
        checkedAt,
        error: reason,
      };
    }
  });
