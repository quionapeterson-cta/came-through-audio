import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { emailLayout, escapeHtml, SITE_URL } from "./email-layout";
import { COMPANY_LEGAL_NAME } from "./contract-blueprints";
import { getPaymentsEnvironment } from "./payments-env";

/**
 * The launch gift promised in the testimonial release (§11): a free 3-month Catalog Plus account. Granted by a super
 * admin from Admin → Company Contracts once a release is fully signed, and only to an account using the signer's
 * email. Like collaborator trials, it's a server-written plan row the browser can never write: its id
 * `launch_gift_<party id>` links it to the signed release (one gift per release) and records who granted it.
 */
const RELEASE = "company-testimonial-release";
const GIFT_MONTHS = 3;
const giftId = (partyId: string) => `launch_gift_${partyId}`;

export type LaunchGiftRow = {
  partyId: string; contractTitle: string; name: string; email: string; signedAt: string;
  hasAccount: boolean; giftEndsAt: string | null;
};

async function superAdminDb(context: { supabase: { rpc: (fn: "has_role", args: { _user_id: string; _role: "super_admin" }) => PromiseLike<{ data: unknown }> }; userId: string }) {
  const { data: isSuper } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "super_admin" });
  if (!isSuper) throw new Error("Only super admins can grant launch gifts.");
  return (await import("@/integrations/supabase/client.server")).supabaseAdmin;
}

type SignedParty = { id: string; legal_name: string; email: string; is_owner: boolean; signed_at: string | null; contracts: { title: string; blueprint: string; status: string; is_company: boolean } };

/** Every participant who fully signed a testimonial release, whether they have an account yet, and their gift. */
export const listLaunchGifts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<LaunchGiftRow[]> => {
    const db = await superAdminDb(context);
    const { data, error } = await db.from("contract_parties" as never)
      .select("id, legal_name, email, is_owner, signed_at, contracts!inner(title, blueprint, status, is_company)")
      .eq("is_owner", false).eq("contracts.blueprint", RELEASE).eq("contracts.is_company", true).eq("contracts.status", "signed");
    if (error) throw new Error("Couldn't load signed releases.");
    const parties = (data ?? []) as unknown as SignedParty[];
    const { data: gifts } = await db.from("subscriptions").select("paddle_subscription_id, current_period_end").in("paddle_subscription_id", parties.map((p) => giftId(p.id)));
    const ends = new Map((gifts ?? []).map((g) => [g.paddle_subscription_id, g.current_period_end]));
    return Promise.all(parties.map(async (p) => {
      const { data: uid } = await db.rpc("user_id_by_email" as never, { _email: p.email.trim() } as never);
      return { partyId: p.id, contractTitle: p.contracts.title, name: p.legal_name, email: p.email, signedAt: p.signed_at ?? "", hasAccount: !!uid, giftEndsAt: ends.get(giftId(p.id)) ?? null };
    }));
  });

/** Starts the 3-month Catalog Plus gift today for a signed release's participant, and emails them. Runs once per release. */
export const grantLaunchGift = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { partyId: string }) => z.object({ partyId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const db = await superAdminDb(context);
    const { data: row } = await db.from("contract_parties" as never)
      .select("id, legal_name, email, is_owner, signed_at, contracts!inner(title, blueprint, status, is_company)").eq("id", data.partyId).maybeSingle();
    const p = row as unknown as SignedParty | null;
    if (!p || p.is_owner || !p.signed_at || p.contracts.blueprint !== RELEASE || !p.contracts.is_company || p.contracts.status !== "signed") {
      throw new Error("Launch gifts are only for participants of a fully signed testimonial release.");
    }
    const { data: existing } = await db.from("subscriptions").select("current_period_end").eq("paddle_subscription_id", giftId(p.id)).maybeSingle();
    if (existing) throw new Error("This release's launch gift was already granted.");
    const { data: userId } = await db.rpc("user_id_by_email" as never, { _email: p.email.trim() } as never);
    if (!userId) throw new Error(`No account uses ${p.email} yet. Ask them to sign up free with that email, then grant the gift.`);

    const start = new Date();
    const end = new Date(start); end.setMonth(end.getMonth() + GIFT_MONTHS);
    const { error } = await db.from("subscriptions").insert({
      user_id: userId as unknown as string,
      paddle_subscription_id: giftId(p.id),
      paddle_customer_id: `granted_by_${context.userId}`,
      product_id: "launch_gift",
      price_id: "catalog_plus_yearly",
      status: "active",
      cancel_at_period_end: true,
      current_period_start: start.toISOString(),
      current_period_end: end.toISOString(),
      environment: getPaymentsEnvironment(),
    });
    if (error) throw new Error("Couldn't grant the gift. Try again.");

    const key = process.env["RESEND_API_KEY"];
    if (key) {
      const until = end.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
      const html = emailLayout(`<p style="font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#004AAD;margin:0">Your launch gift</p>
<h1 style="font-size:24px;margin:8px 0 16px">Came Through Audio Came Through for you</h1>
<p style="font-size:15px;line-height:1.6">Hi ${escapeHtml(p.legal_name || "there")}, thank you for being part of our launch. Your free Catalog Plus account is active now, through ${until}. Embed your metadata, build your catalog and keep every song ready to register.</p>
<a href="${SITE_URL}/workspace" style="display:inline-block;background:#004AAD;color:#ffffff;text-decoration:none;font-weight:700;padding:14px 28px;border-radius:8px">Open your workspace</a>
<p style="font-size:13px;line-height:1.6;color:#555">It ends on its own; you won't be charged.</p>
`, { reason: `You're receiving this because you signed a testimonial release with ${COMPANY_LEGAL_NAME}, which includes this launch gift.` });
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: "Came Through Audio <collaborate@camethroughaudio.com>", to: [p.email.trim()], subject: "Your free Catalog Plus is active", html }),
      }).catch((e) => console.error("Launch gift email failed:", e));
    }
    return { endsAt: end.toISOString() };
  });
