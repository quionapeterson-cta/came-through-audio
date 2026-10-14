import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { emailLayout, escapeHtml } from "./email-layout";

const FROM = "Came Through Audio <collaborate@camethroughaudio.com>";
const esc = escapeHtml;

/** Emails a collaborator their split-sheet signing link. The row must be readable by the caller (RLS = owner only). */
export const sendSplitInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ rowId: z.string().uuid(), origin: z.string().url() }).parse(d))
  .handler(async ({ data, context }) => {
    const key = process.env["RESEND_API_KEY"] || process.env["CameThroughAudio"];
    if (!key) throw new Error("Email sending is not configured yet.");

    const { data: row, error } = await context.supabase
      .from("split_sheets")
      .select("id, catalog_id, collaborator_email, legal_name, role, assigned_percentage, signed_at")
      .eq("id", data.rowId)
      .maybeSingle();
    if (error || !row) throw new Error("Split sheet request not found.");
    if (row.signed_at) throw new Error("This collaborator already signed.");
    const email = row.collaborator_email.trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("Add a valid collaborator email first.");

    const { data: track } = await context.supabase.from("catalogs").select("*").eq("id", row.catalog_id ?? "").maybeSingle();
    const t = (track ?? {}) as Record<string, unknown>;
    const title = String(t["title"] ?? t["track_title"] ?? "your song");
    const artist = String(t["artist"] ?? t["artist_name"] ?? "");
    const link = `${new URL(data.origin).origin}/sign/${row.id}`;
    const name = row.legal_name ?? "there";

    const html = emailLayout(`<p style="font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#004AAD;margin:0">Split Sheet Signature Request</p>
<h1 style="font-size:24px;margin:8px 0 16px">Hi ${esc(name)}, please sign your split for "${esc(title)}"</h1>
<p style="font-size:15px;line-height:1.6">${artist ? esc(artist) + " has" : "You've been"} listed you as a collaborator on this song.</p>
<div style="border:2px solid #004AAD;border-radius:12px;padding:16px;margin:20px 0">
<p style="margin:0;font-size:14px;color:#555">Your share</p>
<p style="margin:4px 0 0;font-size:22px;font-weight:700">${Number(row.assigned_percentage)}% · ${esc(row.role)}</p></div>
<a href="${link}" style="display:inline-block;background:#004AAD;color:#ffffff;text-decoration:none;font-weight:700;padding:14px 28px;border-radius:8px">Review &amp; Sign</a>
<p style="font-size:13px;line-height:1.6;color:#555;margin-top:24px"><b>Signing is always 100% free.</b> When you activate your account with this email (<b>${esc(email)}</b>), you’ll also receive a complimentary <b>30-day Catalog &amp; Collaborate Trial</b>—giving you full creator access to split sheets, catalog tools, and metadata embedding with no credit card required. Review the split sheet to confirm your credits, and add your PRO and IPI numbers to secure your royalties.</p>
`, { reason: `You're receiving this because ${artist || "a Came Through Audio member"} invited you to review and sign a split sheet.` });

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM, to: [email], subject: `Please sign the split sheet for "${title}"`, html }),
    });
    if (!res.ok) {
      const body = await res.text();
      console.error(`Resend failed [${res.status}]: ${body}`);
      throw new Error(`Email could not be sent (${res.status}).`);
    }
    await context.supabase.from("split_sheets").update({ invited_at: new Date().toISOString() }).eq("id", row.id);
    return { ok: true };
  });
