/**
 * The two notes a seat handoff sends (founder, 2026-11-08): the artist confirming they now pay for the plan themselves,
 * and the owner confirming their access and their seat payment end with the period already paid for. Dates come from
 * Stripe's own period end, never from copy.
 *
 * Never throws to the webhook: the handoff is already recorded when this runs, and the notes are a courtesy.
 */
import { emailLayout, escapeHtml } from "./email-layout";
import { TIER_LABEL } from "./plans";

const FROM = "Came Through Audio <collaborate@camethroughaudio.com>";
const esc = escapeHtml;

const longDay = (iso: string | null) => (iso
  ? new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" })
  : null);

export async function sendSeatHandoffEmails(i: {
  artistEmail: string | null;
  ownerEmail: string | null;
  artistName: string;
  tier: string;
  periodEnd: string | null;
}) {
  const key = process.env["RESEND_API_KEY"] || process.env["CameThroughAudio"];
  if (!key) return console.warn("Seat handoff emails skipped: email sending is not configured");
  const tier = TIER_LABEL[i.tier as keyof typeof TIER_LABEL] ?? i.tier;
  const name = i.artistName || "Your artist";
  const day = longDay(i.periodEnd);

  const send = async (to: string, subject: string, html: string) => {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: FROM, to: [to], subject, html }),
      });
      if (!res.ok) console.error(`Seat handoff email to ${to} failed [${res.status}]: ${await res.text()}`);
    } catch (e) {
      console.error(`Seat handoff email to ${to} failed:`, e);
    }
  };

  if (i.artistEmail) {
    await send(
      i.artistEmail,
      `Your ${tier} plan is yours from ${day ?? "your seat's renewal"}`,
      emailLayout(`<p style="font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#004AAD;margin:0">Seat handed over</p>
<h1 style="font-size:24px;margin:8px 0 16px">This plan is yours now</h1>
<p style="font-size:15px;line-height:1.6">Your <b>${esc(tier)}</b> plan now belongs to your account instead of an add-on artist seat. Everything you work in stays where it is: your catalog, your splits, your badges.</p>
<div style="border:2px solid #004AAD;border-radius:12px;padding:16px;margin:20px 0">
<p style="margin:0;font-size:14px;color:#555">Your plan</p>
<p style="margin:4px 0 0;font-size:22px;font-weight:700">${esc(tier)}</p>
${day ? `<p style="margin:6px 0 0;font-size:13px;color:#555">The plan you were on is paid through ${esc(day)}. Nothing is charged before then.</p>` : ""}</div>
<p style="font-size:15px;line-height:1.6">The card you just entered is kept for the renewal. From that renewal on, the plan is billed to you, and the account that used to pay for the seat is no longer charged for it.</p>
<p style="font-size:15px;line-height:1.6">You can see the date and change the card any time in Profile under Manage billing.</p>
`, { reason: `You're receiving this because you took over the ${tier} plan on your artist seat.` }),
    );
  }

  if (i.ownerEmail) {
    await send(
      i.ownerEmail,
      `${name} is paying for their own plan now`,
      emailLayout(`<p style="font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#004AAD;margin:0">Artist seat handed over</p>
<h1 style="font-size:24px;margin:8px 0 16px">${esc(name)} took the plan over</h1>
<p style="font-size:15px;line-height:1.6">${esc(name)} is now paying for their own <b>${esc(tier)}</b> plan. The artist seat you were paying for has been handed over.</p>
<div style="border:2px solid #004AAD;border-radius:12px;padding:16px;margin:20px 0">
<p style="margin:0;font-size:14px;color:#555">What changes</p>
<p style="margin:4px 0 0;font-size:15px;line-height:1.6">Your access to their catalog, split sheets and contracts ends here.${day ? ` The seat you paid for runs to ${esc(day)}, and nothing further is charged for it after that.` : ""}</p>
<p style="margin:8px 0 0;font-size:15px;line-height:1.6">There is no refund or credit for the period already paid, and the artist was not charged for it either.</p></div>
<p style="font-size:15px;line-height:1.6">Your own plan, and every other artist on your seats, are unchanged.</p>
`, { reason: `You're receiving this because ${name} took over the artist seat you paid for.` }),
    );
  }
}
