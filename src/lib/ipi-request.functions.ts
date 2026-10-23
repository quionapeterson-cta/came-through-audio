import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { emailLayout, escapeHtml, SITE_URL } from "./email-layout";
import { cleanInviteText, inviteBlockReason, trustedOrigin } from "./invite-limits";

const FROM = "Came Through Audio <collaborate@camethroughaudio.com>";
const esc = escapeHtml;

/**
 * Emails a co-writer the link to add their PRO and IPI (PLAN-cowriter-ipi-request.md). Same limits, blocklist and
 * opt-out as split-sheet invites, counted from the server's own send log. Catalog & Collaborate and up.
 */
export const sendIpiRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid(), origin: z.string().url() }).parse(d))
  .handler(async ({ data, context }) => {
    const key = process.env["RESEND_API_KEY"] || process.env["CameThroughAudio"];
    if (!key) throw new Error("Email sending is not configured yet.");
    const { data: canSend, error: tierErr } = await context.supabase.rpc("has_tier" as never, { _uid: context.userId, _needed: "collaborate" } as never);
    if (tierErr) {
      console.error("has_tier failed:", tierErr);
      throw new Error(`Couldn't check your plan (${tierErr.message}). Contact support and we'll help right away.`);
    }
    if (!canSend) throw new Error("Co-writer requests are included with Catalog & Collaborate.");

    const { data: req, error } = await context.supabase.from("ipi_requests" as never)
      .select("id, writer_name, role, email, songs, artist_name, status").eq("id", data.id).maybeSingle();
    const row = req as { id: string; writer_name: string; role: string; email: string; songs: { title: string }[]; artist_name: string; status: string } | null;
    if (error || !row) throw new Error("Request not found.");
    if (row.status !== "pending") throw new Error("They already answered this request.");
    const recipient = row.email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(recipient)) throw new Error("Add a valid email first.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { optOutToken } = await import("./invite-optout.server");
    const since = new Date(Date.now() - 86400000).toISOString();
    const sends = () => supabaseAdmin.from("invite_sends" as never);
    const [senderToday, rowSends, recipientToday, blocked] = await Promise.all([
      sends().select("id", { count: "exact", head: true }).eq("sender_id" as never, context.userId as never).gte("sent_at" as never, since as never),
      sends().select("sent_at").eq("ipi_request_id" as never, row.id as never),
      sends().select("id", { count: "exact", head: true }).eq("recipient_email" as never, recipient as never).gte("sent_at" as never, since as never),
      supabaseAdmin.from("invite_blocklist" as never).select("email").eq("email" as never, recipient as never).maybeSingle(),
    ]);
    const reason = inviteBlockReason({
      senderToday: senderToday.count ?? 0,
      rowSends: ((rowSends.data ?? []) as { sent_at: string }[]).map((r) => r.sent_at),
      recipientToday: recipientToday.count ?? 0,
      blocked: !!blocked.data,
    });
    if (reason) throw new Error(reason.replace("split-sheet invite emails. Contact them directly to sign.", "invite emails. Copy the link and send it to them yourself."));

    // Sender-typed text goes into the email, so web addresses are stripped and it's kept short.
    const name = cleanInviteText(row.writer_name) || "there";
    const artist = cleanInviteText(row.artist_name) || "A Came Through Audio member";
    const titles = row.songs.map((s) => cleanInviteText(s.title)).filter(Boolean);
    const shown = titles.slice(0, 5);
    const role = cleanInviteText(row.role);
    const origin = trustedOrigin(data.origin, SITE_URL);
    const link = `${origin}/ipi/${row.id}`;
    const optOutUrl = `${origin}/invites/stop?e=${encodeURIComponent(recipient)}&t=${optOutToken(recipient)}`;

    const html = emailLayout(`<p style="font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#004AAD;margin:0">Co-writer details request</p>
<h1 style="font-size:24px;margin:8px 0 16px">Hi ${esc(name)}, add your PRO and IPI so your writer share gets paid</h1>
<p style="font-size:15px;line-height:1.6">${esc(artist)} is getting ${titles.length === 1 ? "this song" : "these songs"} ready to register with the agencies that pay songwriters. Your share can only reach you if each registration has your PRO and your IPI number.</p>
<div style="border:2px solid #004AAD;border-radius:12px;padding:16px;margin:20px 0">
<p style="margin:0;font-size:14px;color:#555">${titles.length === 1 ? "Song" : "Songs"} you're credited on</p>
<p style="margin:6px 0 0;font-size:17px;font-weight:700;line-height:1.5">${shown.map((t) => `"${esc(t)}"`).join("<br>")}${titles.length > shown.length ? `<br><span style="font-weight:400;color:#555">and ${titles.length - shown.length} more</span>` : ""}</p>
<p style="margin:10px 0 0;font-size:14px;color:#555">Listed as: <b style="color:#0b0b0b">${esc(name)}${role ? ` · ${esc(role)}` : ""}</b></p></div>
<a href="${link}" style="display:inline-block;background:#004AAD;color:#ffffff;text-decoration:none;font-weight:700;padding:14px 28px;border-radius:8px">Add my PRO &amp; IPI</a>
<p style="font-size:13px;line-height:1.6;color:#555;margin-top:24px"><b>Adding your details is always 100% free.</b> Create your free account with this email (<b>${esc(recipient)}</b>) and you'll also get a complimentary <b>30-day Catalog &amp; Collaborate Trial</b>: split sheets, catalog tools and metadata embedding, no credit card required.</p>
<p style="font-size:13px;line-height:1.6;color:#555">It takes about a minute. Your IPI number is in your PRO account (ASCAP, BMI, SESAC or your country's society). Not in a PRO yet? Just say so; you can join one and add it later.</p>
<p style="font-size:13px;line-height:1.6;color:#555">Only ${esc(artist)} sees what you enter. It's used to register these songs and is never published or added to the music files.</p>`,
      { reason: `You're receiving this because ${artist} listed you as a co-writer and asked for your PRO and IPI details.`, optOutUrl });

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM, to: [recipient], subject: `${artist} needs your PRO and IPI for ${titles.length === 1 ? `"${titles[0]}"` : `${titles.length} songs`}`, html }),
    });
    if (!res.ok) {
      const body = await res.text();
      console.error(`Resend failed [${res.status}]: ${body}`);
      if (res.status === 403 && /domain/i.test(body)) throw new Error("Email could not be sent: the sending domain isn't verified in Resend yet. Copy the link and send it yourself for now.");
      throw new Error(`Email could not be sent (${res.status}). Copy the link and send it yourself for now.`);
    }
    await sends().insert({ sender_id: context.userId, ipi_request_id: row.id, recipient_email: recipient } as never);
    await supabaseAdmin.from("ipi_requests" as never).update({ sent_at: new Date().toISOString() } as never).eq("id", row.id);
    return { ok: true };
  });
