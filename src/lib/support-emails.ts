/**
 * The mail a native reply sends (founder, 2026-11-08): the member gets the words, a branded shell, and one button that
 * opens their own ticket with the message box ready — so answering is a click, not a hunt through the workspace.
 *
 * Wording rules unchanged: a typical wait, never a promise; no number, date or entitlement that the founder has not
 * approved. Staff-only notes never reach this file's callers.
 */
import { resendKey } from "./collab-trial.server";
import { BILLING_EMAIL, emailLayout, escapeHtml, INFO_EMAIL, SITE_URL, SUPPORT_EMAIL } from "./email-layout";
import { inboxFor, replyParagraphs, replySubject, ticketLink, type TicketRecord } from "./support-replies";

export type ReplyEmailResult = { emailed: boolean; reason?: string };

/** Sends one staff reply to the member. Never throws at the caller: a failed email is reported, not turned into a loss. */
export async function sendTicketReplyEmail(
  ticket: TicketRecord,
  body: string,
  messageId: string,
): Promise<ReplyEmailResult> {
  const key = resendKey();
  if (!key) return { emailed: false, reason: "no-key" };
  const inbox = inboxFor(ticket.category);
  const html = emailLayout(
    `<p style="font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#004AAD;margin:0">Your support ticket</p>
<h1 style="font-size:22px;margin:8px 0 16px">${escapeHtml(ticket.subject)}</h1>
${replyParagraphs(body, escapeHtml)}
<p style="margin:24px 0"><a href="${ticketLink(SITE_URL, ticket.id)}" style="background:#004AAD;color:#ffffff;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:8px;display:inline-block">Open your ticket and reply</a></p>
<p style="font-size:13px;line-height:1.6;color:#666">Replying to this email also lands on the same ticket. The button opens it in your workspace with the message box ready, so you never have to look for it.</p>`,
    { reason: "You're receiving this because you opened a support ticket with Came Through Audio." },
  );
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        // One id per stored message: a retried request can't send the same reply twice.
        "Idempotency-Key": `ticket-reply-${messageId}`,
      },
      body: JSON.stringify({
        from: `Came Through Audio ${inbox === BILLING_EMAIL ? "Billing" : "Support"} <${inbox}>`,
        to: [ticket.email],
        reply_to: inbox,
        subject: replySubject(ticket),
        html,
      }),
    });
    if (!res.ok) {
      console.error(`Ticket reply email failed [${res.status}]`);
      return { emailed: false, reason: `status-${res.status}` };
    }
    return { emailed: true };
  } catch (e) {
    console.error("Ticket reply email failed", e);
    return { emailed: false, reason: "network" };
  }
}

/**
 * A member wrote back on their ticket: the queue already shows it, and this puts the same line in the inbox the team
 * already watches, so nothing sits unanswered because nobody opened the panel.
 */
export async function sendMemberReplyNotice(
  ticket: TicketRecord,
  body: string,
): Promise<ReplyEmailResult> {
  const key = resendKey();
  if (!key) return { emailed: false, reason: "no-key" };
  const to = ticket.category.trim().toLowerCase().startsWith("account & billing") ? BILLING_EMAIL : SUPPORT_EMAIL;
  const html = emailLayout(
    `<p style="font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#004AAD;margin:0">Member replied</p>
<h1 style="font-size:22px;margin:8px 0 16px">${escapeHtml(ticket.subject)}</h1>
<p style="font-size:14px;margin:0 0 14px"><b>From:</b> ${escapeHtml(ticket.name)} (${escapeHtml(ticket.email)})<br/><b>Category:</b> ${escapeHtml(ticket.category)}</p>
${replyParagraphs(body, escapeHtml)}
<p style="font-size:13px;line-height:1.6;color:#666">Answer in Admin → Support Tickets. The reply is already on the ticket.</p>`,
    { reason: "You're receiving this staff notice because a member answered a support ticket." },
  );
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: `Came Through Audio <${INFO_EMAIL}>`,
        to: [to],
        reply_to: ticket.email,
        subject: `[Member reply #${ticket.id.slice(0, 6).toUpperCase()}] ${ticket.subject}`,
        html,
      }),
    });
    if (!res.ok) console.error(`Member reply notice failed [${res.status}]`);
    return { emailed: res.ok };
  } catch (e) {
    console.error("Member reply notice failed", e);
    return { emailed: false, reason: "network" };
  }
}
