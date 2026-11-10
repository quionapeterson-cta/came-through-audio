import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { emailLayout, escapeHtml, SITE_URL } from "./email-layout";
import { mailKey } from "./mailer";
import { cleanInviteText, trustedOrigin } from "./invite-limits";
import { ARTIST_SEAT_PRICES, TIER_LABEL } from "./plans";

const FROM = "Came Through Audio <collaborate@camethroughaudio.com>";
const esc = escapeHtml;

/**
 * The owner's offer (founder, 2026-11-08): "this plan is yours if you want it". It changes nothing in billing; the
 * artist still completes the same seat-handoff checkout, and withdrawing it changes nothing either.
 */
export const offerSeatHandoff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ seatId: z.string().uuid(), offer: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: seat, error } = await context.supabase.from("artist_seats" as never)
      .select("id, owner_id, status, member_user_id, current_period_end")
      .eq("id" as never, data.seatId as never).maybeSingle();
    if (error) throw new Error(`Couldn't open that seat (${error.message}).`);
    const s = seat as { id: string; owner_id: string; status: string; member_user_id: string | null; current_period_end: string | null } | null;
    if (!s || s.owner_id !== context.userId) throw new Error("That seat isn't on your account.");
    if (s.status === "handed_off") throw new Error("The artist pays for this plan themselves now.");
    if (s.status === "ended") throw new Error("That seat has ended.");
    if (!s.member_user_id) throw new Error("Send the seat invite first: an offer needs the artist on the seat.");
    // An offer on a seat whose paid year is over would only lead the artist to a checkout that refuses them.
    if (!s.current_period_end || new Date(s.current_period_end) <= new Date()) {
      throw new Error("This seat's paid year has ended, so there is nothing to offer. Buy a new seat to add the artist.");
    }
    const { error: saveError } = await context.supabase.from("artist_seats" as never)
      .update({ handoff_offered_at: data.offer ? new Date().toISOString() : null, updated_at: new Date().toISOString() } as never)
      .eq("id" as never, s.id as never);
    if (saveError) throw new Error(saveError.message);
    return { offered: data.offer };
  });

/**
 * Sends an add-on artist seat to the artist's email (founder, 2026-11-04). The seat must be one the caller paid for;
 * RLS on artist_seats means a seat belonging to someone else is simply not found. The email carries a link to
 * /seat/<id>, where the artist signs up with that address and accepts, the same way an invited signature works.
 */
export const inviteSeatArtist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    seatId: z.string().uuid(),
    email: z.string().trim().email(),
    artistName: z.string().trim().min(1).max(80),
    origin: z.string().url(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: seat, error } = await context.supabase.from("artist_seats" as never)
      .select("id, owner_id, tier, status, member_user_id, stripe_subscription_id")
      .eq("id" as never, data.seatId as never).maybeSingle();
    if (error) throw new Error(`Couldn't open that seat (${error.message}).`);
    const s = seat as { id: string; owner_id: string; tier: string; status: string; member_user_id: string | null; stripe_subscription_id: string | null } | null;
    if (!s) throw new Error("That seat wasn't found on your account.");
    if (s.status === "ended") throw new Error("That seat has ended. Buy a new one to add another artist.");
    if (s.member_user_id) throw new Error("That artist has already accepted this seat.");
    // A seat only exists once Stripe has taken the payment, so this can't email an unpaid invite.
    if (!s.stripe_subscription_id) throw new Error("This seat isn't paid for yet. Finish the checkout first.");

    const email = data.email.toLowerCase();
    const name = cleanInviteText(data.artistName);
    const tierLabel = TIER_LABEL[s.tier as keyof typeof TIER_LABEL] ?? s.tier;
    const price = ARTIST_SEAT_PRICES.find((p) => p.tier === s.tier)?.price ?? "";
    const origin = trustedOrigin(data.origin, SITE_URL);
    const link = `${origin}/seat/${s.id}`;
    const { data: me } = await context.supabase.from("profiles").select("stage_name, legal_name").eq("id", context.userId).maybeSingle();
    const owner = cleanInviteText(String((me as { stage_name?: string; legal_name?: string } | null)?.stage_name
      ?? (me as { legal_name?: string } | null)?.legal_name ?? ""));

    const key = process.env["RESEND_API_KEY"] || process.env["CameThroughAudio"];
    if (!key) throw new Error("Email sending is not configured yet. Copy the invite link and send it yourself.");

    const html = emailLayout(`<p style="font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#004AAD;margin:0">Add-On Artist Invitation</p>
<h1 style="font-size:24px;margin:8px 0 16px">${owner ? esc(owner) + " added you" : "You've been added"} as an artist</h1>
<p style="font-size:15px;line-height:1.6">${owner ? esc(owner) + " has" : "Someone has"} paid for an add-on artist seat for <b>${esc(name)}</b> and sent it to this address.</p>
<div style="border:2px solid #004AAD;border-radius:12px;padding:16px;margin:20px 0">
<p style="margin:0;font-size:14px;color:#555">Your artist account</p>
<p style="margin:4px 0 0;font-size:22px;font-weight:700">${esc(name)} · ${esc(tierLabel)}</p>
<p style="margin:6px 0 0;font-size:13px;color:#555">${esc(price)} a year, paid by ${owner ? esc(owner) : "the catalog owner"}</p></div>
<p style="font-size:15px;line-height:1.6">Click below, sign up with <b>${esc(email)}</b>, and accept the seat. Your catalog, embedding and the tools included with ${esc(tierLabel)} are yours while the seat is paid for.</p>
<a href="${link}" style="display:inline-block;background:#004AAD;color:#ffffff;text-decoration:none;font-weight:700;padding:14px 28px;border-radius:8px">Accept your artist seat</a>
<p style="font-size:13px;line-height:1.6;color:#555;margin-top:24px">Sign up with this exact email address: the seat can only be accepted by the inbox it was sent to.</p>
`, { reason: `You're receiving this because ${owner || "a Came Through Audio member"} bought an add-on artist seat for ${name}.` });

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "Idempotency-Key": mailKey("seat-invite", s.id) },
      body: JSON.stringify({ from: FROM, to: [email], subject: `Your artist seat for ${name}`, html }),
    });
    if (!res.ok) {
      const body = await res.text();
      console.error(`Resend failed [${res.status}]: ${body}`);
      if (res.status === 403 && /domain/i.test(body)) throw new Error("Email could not be sent: the camethroughaudio.com sending domain isn't verified in Resend yet. Copy the invite link and send it yourself for now.");
      throw new Error(`Email could not be sent (${res.status}). Copy the invite link and send it yourself for now.`);
    }

    const { error: saveErr } = await context.supabase.from("artist_seats" as never)
      .update({ artist_name: name, invite_email: email, status: "invited", invited_at: new Date().toISOString(), updated_at: new Date().toISOString() } as never)
      .eq("id" as never, s.id as never);
    if (saveErr) console.error("Seat saved but its invite details didn't stick:", saveErr.message);
    return { ok: true, link };
  });
