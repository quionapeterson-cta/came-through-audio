import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { emailLayout, escapeHtml } from "./email-layout";

const FROM = "Came Through Audio <collaborate@camethroughaudio.com>";
const esc = escapeHtml;

/** Emails a contract party their signing link. Both rows must be readable by the caller (RLS = contract owner only). */
export const sendContractInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ partyId: z.string().uuid(), origin: z.string().url() }).parse(d))
  .handler(async ({ data, context }) => {
    const key = process.env["RESEND_API_KEY"] || process.env["CameThroughAudio"];
    if (!key) throw new Error("Email sending is not configured yet.");

    const { data: party, error } = await context.supabase
      .from("contract_parties" as never)
      .select("id, contract_id, legal_name, email, role, signed_at")
      .eq("id", data.partyId)
      .maybeSingle();
    const p = party as { id: string; contract_id: string; legal_name: string; email: string; role: string; signed_at: string | null } | null;
    if (error || !p) throw new Error("Signature request not found.");
    if (p.signed_at) throw new Error("This party already signed.");
    const email = p.email.trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("Add a valid email for this party first.");

    const { data: contract } = await context.supabase.from("contracts" as never).select("title, status").eq("id", p.contract_id).maybeSingle();
    const k = contract as { title: string; status: string } | null;
    if (!k || k.status !== "sent") throw new Error("Send the contract for signature first.");

    const { data: owner } = await context.supabase.from("profiles").select("stage_name, legal_name").eq("id", context.userId).maybeSingle();
    const from = owner?.stage_name || owner?.legal_name || "A Came Through Audio member";
    const link = `${new URL(data.origin).origin}/contract/${p.id}`;

    const html = emailLayout(`<p style="font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#004AAD;margin:0">Contract Signature Request</p>
<h1 style="font-size:24px;margin:8px 0 16px">Hi ${esc(p.legal_name || "there")}, please review and sign "${esc(k.title)}"</h1>
<p style="font-size:15px;line-height:1.6">${esc(from)} sent you a contract to sign as <b>${esc(p.role)}</b>.</p>
<a href="${link}" style="display:inline-block;background:#004AAD;color:#ffffff;text-decoration:none;font-weight:700;padding:14px 28px;border-radius:8px">Review &amp; Sign</a>
<p style="font-size:13px;line-height:1.6;color:#555;margin-top:24px"><b>Signing is always free.</b> Log in or create a free account with this email (<b>${esc(email)}</b>) to read the full contract and sign. Your signature is time-stamped and secured with a verification hash, and you can download the signed copy when everyone has signed. Take your time, and talk to an attorney if you have questions before signing.</p>
`, { reason: `You're receiving this because ${from} listed you as a party on a contract in Came Through Audio.` });

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM, to: [email], subject: `Please review and sign "${k.title}"`, html }),
    });
    if (!res.ok) {
      const body = await res.text();
      console.error(`Resend failed [${res.status}]: ${body}`);
      throw new Error(`Email could not be sent (${res.status}).`);
    }
    await context.supabase.from("contract_parties" as never).update({ invited_at: new Date().toISOString() } as never).eq("id", p.id);
    return { ok: true };
  });
