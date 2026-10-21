import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { emailLayout, escapeHtml, SITE_URL } from "./email-layout";
import { cleanInviteText, inviteBlockReason, trustedOrigin } from "./invite-limits";

const FROM = "Came Through Audio <collaborate@camethroughaudio.com>";
const esc = escapeHtml;

/**
 * Emails a collaborator their split-sheet signing link. The row must be readable by the caller (RLS = owner only).
 * Limits (see invite-limits.ts) count the server's own send log, so re-sending a row can't get around them.
 */
export const sendSplitInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ rowId: z.string().uuid(), origin: z.string().url() }).parse(d))
  .handler(async ({ data, context }) => {
    const key = process.env["RESEND_API_KEY"] || process.env["CameThroughAudio"];
    if (!key) throw new Error("Email sending is not configured yet.");
    const { data: canCollect, error: tierErr } = await context.supabase.rpc("has_tier" as never, { _uid: context.userId, _needed: "collaborate" } as never);
    // A failed plan check is reported as such, not as "upgrade", so a database problem can't pass for a plan block.
    if (tierErr) {
      console.error("has_tier failed:", tierErr);
      throw new Error(`Couldn't check your plan (${tierErr.message}). Contact support and we'll help right away.`);
    }
    if (!canCollect) throw new Error("Collaborator e-signature requests are included with Catalog & Collaborate.");

    const { data: row, error } = await context.supabase
      .from("split_sheets")
      .select("id, catalog_id, collaborator_email, legal_name, role, assigned_percentage, signed_at")
      .eq("id", data.rowId)
      .maybeSingle();
    if (error || !row) throw new Error("Split sheet request not found.");
    if (row.signed_at) throw new Error("This collaborator already signed.");
    const email = row.collaborator_email.trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("Add a valid collaborator email first.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { optOutToken } = await import("./invite-optout.server");
    const recipient = email.toLowerCase();
    const since = new Date(Date.now() - 86400000).toISOString();
    const sends = () => supabaseAdmin.from("invite_sends" as never);
    const [senderToday, rowSends, recipientToday, blocked] = await Promise.all([
      sends().select("id", { count: "exact", head: true }).eq("sender_id" as never, context.userId as never).gte("sent_at" as never, since as never),
      sends().select("sent_at").eq("split_row_id" as never, row.id as never),
      sends().select("id", { count: "exact", head: true }).eq("recipient_email" as never, recipient as never).gte("sent_at" as never, since as never),
      supabaseAdmin.from("invite_blocklist" as never).select("email").eq("email" as never, recipient as never).maybeSingle(),
    ]);
    const reason = inviteBlockReason({
      senderToday: senderToday.count ?? 0,
      rowSends: ((rowSends.data ?? []) as { sent_at: string }[]).map((r) => r.sent_at),
      recipientToday: recipientToday.count ?? 0,
      blocked: !!blocked.data,
    });
    if (reason) throw new Error(reason);

    const { data: track } = await context.supabase.from("catalogs").select("*").eq("id", row.catalog_id ?? "").maybeSingle();
    const t = (track ?? {}) as Record<string, unknown>;
    // Sender-typed text goes into the email, so web addresses are stripped and it's kept short.
    const title = cleanInviteText(String(t["title"] ?? t["track_title"] ?? "")) || "your song";
    const artist = cleanInviteText(String(t["artist"] ?? t["artist_name"] ?? ""));
    const origin = trustedOrigin(data.origin, SITE_URL);
    const link = `${origin}/sign/${row.id}`;
    const optOutUrl = `${origin}/invites/stop?e=${encodeURIComponent(recipient)}&t=${optOutToken(recipient)}`;
    const name = cleanInviteText(row.legal_name) || "there";

    const html = emailLayout(`<p style="font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#004AAD;margin:0">Split Sheet Signature Request</p>
<h1 style="font-size:24px;margin:8px 0 16px">Hi ${esc(name)}, please sign your split for "${esc(title)}"</h1>
<p style="font-size:15px;line-height:1.6">${artist ? esc(artist) + " has" : "You've been"} listed you as a collaborator on this song.</p>
<div style="border:2px solid #004AAD;border-radius:12px;padding:16px;margin:20px 0">
<p style="margin:0;font-size:14px;color:#555">Your share</p>
<p style="margin:4px 0 0;font-size:22px;font-weight:700">${Number(row.assigned_percentage)}% · ${esc(row.role)}</p></div>
<a href="${link}" style="display:inline-block;background:#004AAD;color:#ffffff;text-decoration:none;font-weight:700;padding:14px 28px;border-radius:8px">Review &amp; Sign</a>
<p style="font-size:13px;line-height:1.6;color:#555;margin-top:24px"><b>Signing is always 100% free.</b> When you activate your account with this email (<b>${esc(email)}</b>), you’ll also receive a complimentary <b>30-day Catalog &amp; Collaborate Trial</b>—giving you full creator access to split sheets, catalog tools, and metadata embedding with no credit card required. Review the split sheet to confirm your credits, and add your PRO and IPI numbers to secure your royalties.</p>
`, { reason: `You're receiving this because ${artist || "a Came Through Audio member"} invited you to review and sign a split sheet.`, optOutUrl });

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM, to: [email], subject: `Please sign the split sheet for "${title}"`, html }),
    });
    if (!res.ok) {
      const body = await res.text();
      console.error(`Resend failed [${res.status}]: ${body}`);
      // Resend refuses mail from a domain it hasn't verified yet; say so instead of a bare status code.
      if (res.status === 403 && /domain/i.test(body)) throw new Error("Email could not be sent: the camethroughaudio.com sending domain isn't verified in Resend yet. Copy the signing link and send it yourself for now.");
      throw new Error(`Email could not be sent (${res.status}). Copy the signing link and send it yourself for now.`);
    }
    await sends().insert({ sender_id: context.userId, split_row_id: row.id, recipient_email: recipient } as never);
    await context.supabase.from("split_sheets").update({ invited_at: new Date().toISOString() }).eq("id", row.id);
    return { ok: true };
  });

/** "Don't send me invites" from an invite's footer. The token proves the link came from an email sent to this address. */
export const stopInvites = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ email: z.string().email().max(320), token: z.string().max(64) }).parse(d))
  .handler(async ({ data }) => {
    const { validOptOutToken } = await import("./invite-optout.server");
    const email = data.email.trim().toLowerCase();
    if (!validOptOutToken(email, data.token)) throw new Error("This link is incomplete. Open it again from the invite email.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("invite_blocklist" as never).upsert({ email } as never, { onConflict: "email", ignoreDuplicates: true });
    if (error) throw new Error("Couldn't save that. Please try again.");
    return { ok: true };
  });
