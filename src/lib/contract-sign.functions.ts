import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { emailLayout, escapeHtml, SITE_URL } from "./email-layout";
import { trustedOrigin } from "./invite-limits";
import { COMPANY_LEGAL_NAME } from "./contract-blueprints";
import type { ContractInvite } from "./contracts";

/**
 * Company agreements signed without an account (PLAN-admin-contracts §3): the private link proves the signer got
 * the email, and a 6-digit code sent to the same address proves it again at signing. Customer contracts and split
 * sheets still sign through a logged-in account.
 */

const FROM = "Came Through Audio <collaborate@camethroughaudio.com>";
const CODE_MINUTES = 10;
const CODE_TRIES = 5;
const esc = escapeHtml;

const linkInput = z.object({ partyId: z.string().uuid(), token: z.string().min(16).max(64) });

type Party = { id: string; contract_id: string; legal_name: string; email: string; role: string; is_owner: boolean; position: number; signed_at: string | null; signature_name: string | null; signature_hash: string | null; created_at: string };
type CompanyContract = { id: string; title: string; blueprint: string; body: string; body_hash: string | null; status: "draft" | "sent" | "signed"; sent_at: string | null; completed_at: string | null; is_company: boolean };

async function admin() {
  return (await import("@/integrations/supabase/client.server")).supabaseAdmin;
}

/** The party and its company agreement, once the link checks out. One error for every failure, so links can't be probed. */
async function openByLink(partyId: string, token: string) {
  const { validSignLinkToken } = await import("./contract-sign.server");
  const fail = new Error("This signing link isn't valid. Use the newest link from your email.");
  if (!validSignLinkToken(partyId, token)) throw fail;
  const db = await admin();
  const { data: party } = await db.from("contract_parties" as never).select("*").eq("id", partyId).maybeSingle();
  const p = party as Party | null;
  if (!p) throw fail;
  const { data: contract } = await db.from("contracts" as never).select("id, title, blueprint, body, body_hash, status, sent_at, completed_at, is_company").eq("id", p.contract_id).maybeSingle();
  const k = contract as CompanyContract | null;
  if (!k?.is_company) throw fail;
  if (k.status === "draft") throw new Error("This agreement is being edited. Try your link again later.");
  return { db, p, k };
}

async function sendEmail(to: string, subject: string, html: string) {
  const key = process.env["RESEND_API_KEY"] || process.env["CameThroughAudio"];
  if (!key) throw new Error("Email sending is not configured yet.");
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM, to: [to], subject, html }),
  });
  if (!res.ok) {
    console.error(`Resend failed [${res.status}]: ${await res.text()}`);
    throw new Error(`Email could not be sent (${res.status}).`);
  }
}

/** The agreement as the signing page shows it. */
export const openSignLink = createServerFn({ method: "POST" })
  .inputValidator((d) => linkInput.parse(d))
  .handler(async ({ data }) => {
    const { maskEmail } = await import("./contract-sign.server");
    const { db, p, k } = await openByLink(data.partyId, data.token);
    const { data: all } = await db.from("contract_parties" as never).select("*").eq("contract_id", k.id);
    const parties = ((all ?? []) as Party[]).sort((a, b) => a.position - b.position || a.created_at.localeCompare(b.created_at));
    const invite: ContractInvite & { email_hint: string } = {
      party_id: p.id, contract_id: k.id, title: k.title, blueprint: k.blueprint, body: k.body, body_hash: k.body_hash ?? "",
      status: k.status, sent_at: k.sent_at, completed_at: k.completed_at, legal_name: p.legal_name, role: p.role, signed_at: p.signed_at,
      can_sign: k.status === "sent" && !p.signed_at,
      parties: parties.map((x) => ({ name: x.legal_name, role: x.role, signed_at: x.signed_at, signature_name: x.signature_name, signature_hash: x.signature_hash })),
      email_hint: maskEmail(p.email),
    };
    return invite;
  });

/** Emails a 6-digit code to the invited address. One live code per party; a new one replaces the last. */
export const sendSignCode = createServerFn({ method: "POST" })
  .inputValidator((d) => linkInput.parse(d))
  .handler(async ({ data }) => {
    const { newSignCode, hashSignCode } = await import("./contract-sign.server");
    const { db, p, k } = await openByLink(data.partyId, data.token);
    if (p.signed_at || k.status !== "sent") throw new Error("This agreement is already signed.");
    const codes = () => db.from("contract_sign_codes" as never);
    const { data: last } = await codes().select("sent_at").eq("party_id", p.id).maybeSingle();
    const lastAt = (last as { sent_at: string } | null)?.sent_at;
    if (lastAt && Date.now() - new Date(lastAt).getTime() < 60_000) throw new Error("A code was just sent. Check your inbox (and spam), or try again in a minute.");

    const code = newSignCode();
    const { error } = await codes().upsert({
      party_id: p.id, code_hash: hashSignCode(p.id, code), attempts: 0,
      expires_at: new Date(Date.now() + CODE_MINUTES * 60_000).toISOString(), sent_at: new Date().toISOString(),
    } as never);
    if (error) {
      console.error("Sign code save failed:", error);
      throw new Error(/contract_sign_codes/.test(error.message) ? "Signing without an account needs the latest database update (migration 20261024120000)." : "Couldn't create a code. Try again.");
    }
    const html = emailLayout(`<p style="font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#004AAD;margin:0">Your signing code</p>
<h1 style="font-size:24px;margin:8px 0 16px">${code.slice(0, 3)} ${code.slice(3)}</h1>
<p style="font-size:15px;line-height:1.6">Enter this code to sign "${esc(k.title)}" with ${esc(COMPANY_LEGAL_NAME)}. It works for ${CODE_MINUTES} minutes.</p>
<p style="font-size:13px;line-height:1.6;color:#555">Didn't ask for it? You can ignore this email; nothing is signed without the code.</p>
`, { reason: `You're receiving this because a code was requested to sign an agreement sent to this address.` });
    await sendEmail(p.email.trim(), `Your signing code: ${code}`, html);
    return { ok: true };
  });

/** Checks the code, then signs. When the last party signs, everyone gets an email with their link to the signed copy. */
export const signByLink = createServerFn({ method: "POST" })
  .inputValidator((d) => linkInput.extend({
    code: z.string().regex(/^\d{6}$/, "Enter the 6-digit code from your email."),
    signatureName: z.string().min(1).max(200),
    consent: z.literal(true, { message: "Agree to sign electronically first." }),
    origin: z.string().url(),
  }).parse(d))
  .handler(async ({ data }) => {
    const { hashSignCode, signLink } = await import("./contract-sign.server");
    const { hashIp } = await import("./collab-trial.server");
    const { db, p, k } = await openByLink(data.partyId, data.token);
    if (p.signed_at) throw new Error("Already signed.");

    const codes = () => db.from("contract_sign_codes" as never);
    const { data: row } = await codes().select("code_hash, expires_at, attempts").eq("party_id", p.id).maybeSingle();
    const c = row as { code_hash: string; expires_at: string; attempts: number } | null;
    if (!c || new Date(c.expires_at).getTime() < Date.now()) throw new Error("That code expired. Send yourself a new one.");
    if (c.attempts >= CODE_TRIES) throw new Error("Too many tries. Send yourself a new code.");
    if (c.code_hash !== hashSignCode(p.id, data.code)) {
      await codes().update({ attempts: c.attempts + 1 } as never).eq("party_id", p.id);
      throw new Error(`That code doesn't match. ${CODE_TRIES - c.attempts - 1} tries left.`);
    }

    const { getRequestHeader, getRequestIP } = await import("@tanstack/react-start/server");
    const ip = getRequestHeader("cf-connecting-ip") ?? getRequestIP({ xForwardedFor: true }) ?? "";
    const { data: result, error } = await db.rpc("sign_contract_by_link" as never, {
      _party_id: p.id, _signature_name: data.signatureName, _ip_hash: ip ? hashIp(ip) : null, _user_agent: getRequestHeader("user-agent") ?? "",
    } as never);
    if (error) throw new Error(error.message);
    await codes().delete().eq("party_id", p.id);

    if ((result as { completed?: boolean } | null)?.completed) {
      const origin = trustedOrigin(data.origin, SITE_URL);
      const { data: all } = await db.from("contract_parties" as never).select("id, legal_name, email, is_owner").eq("contract_id", k.id);
      for (const x of (all ?? []) as Pick<Party, "id" | "legal_name" | "email" | "is_owner">[]) {
        const link = x.is_owner ? `${origin}/admin` : signLink(origin, x.id);
        const html = emailLayout(`<p style="font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#004AAD;margin:0">Fully signed</p>
<h1 style="font-size:24px;margin:8px 0 16px">Everyone signed "${esc(k.title)}"</h1>
<p style="font-size:15px;line-height:1.6">Hi ${esc(x.legal_name || "there")}, every party has signed. Download the signed copy for your records.</p>
<a href="${link}" style="display:inline-block;background:#004AAD;color:#ffffff;text-decoration:none;font-weight:700;padding:14px 28px;border-radius:8px">Get the signed copy</a>
`, { reason: `You're receiving this because you're a party to an agreement with ${COMPANY_LEGAL_NAME}.` });
        await sendEmail(x.email.trim(), `Signed: "${k.title}"`, html).catch((e) => console.error("Signed-copy email failed:", e));
      }
    }
    return { ok: true };
  });

/** Admin: the private signing link for a company agreement party, for Copy link. */
export const companySignLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ partyId: z.string().uuid(), origin: z.string().url() }).parse(d))
  .handler(async ({ data, context }) => {
    // RLS: only the agreement's owner can read the party.
    const { data: party } = await context.supabase.from("contract_parties" as never).select("id, contract_id").eq("id", data.partyId).maybeSingle();
    if (!party) throw new Error("Signature request not found.");
    const { data: contract } = await context.supabase.from("contracts" as never).select("is_company").eq("id", (party as { contract_id: string }).contract_id).maybeSingle();
    if (!(contract as { is_company?: boolean } | null)?.is_company) throw new Error("Only company agreements have private signing links.");
    const { signLink } = await import("./contract-sign.server");
    return { link: signLink(trustedOrigin(data.origin, SITE_URL), data.partyId) };
  });
