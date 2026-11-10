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

/**
 * The member's own copy of "we have it" (founder, 2026-11-10): nothing used to reach them until a staff reply arrived,
 * so a ticket opened on a Friday looked lost. It repeats the typical wait, never a promise, and — for a support ticket —
 * links straight to the thread so answering is a click. A Contact Us message gets the same courtesy without a thread.
 * One idempotency key per ticket, so a retried submit cannot send it twice.
 */
export async function sendTicketReceivedEmail(input: {
  id: string; kind: string; name: string; email: string; category: string; subject: string;
}): Promise<ReplyEmailResult> {
  const key = resendKey();
  if (!key) return { emailed: false, reason: "no-key" };
  const support = input.kind === "support";
  const inbox = support ? inboxFor(input.category) : INFO_EMAIL;
  const first = input.name.trim().split(/\s+/)[0] || "there";
  const html = emailLayout(
    `<p style="font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#004AAD;margin:0">${support ? "Support ticket received" : "Message received"}</p>
<h1 style="font-size:22px;margin:8px 0 16px">${support ? `We've got your ticket, ${escapeHtml(first)}` : `Thanks for writing, ${escapeHtml(first)}`}</h1>
<p style="font-size:15px;line-height:1.6"><b>${escapeHtml(input.subject)}</b><br/><span style="color:#666">${escapeHtml(input.category)}</span></p>
<p style="font-size:15px;line-height:1.6">It's in the queue and Support will take it from here. Most replies go out in about 48 hours; a high-volume week or a holiday break can take longer, and we'll always come back to you.</p>
${support
    ? `<p style="margin:24px 0"><a href="${ticketLink(SITE_URL, input.id)}" style="background:#004AAD;color:#ffffff;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:8px;display:inline-block">Open your ticket</a></p>
<p style="font-size:13px;line-height:1.6;color:#666">You can read the thread and answer any time in the Support tab of your workspace. Replying to this email lands on the same ticket, so nothing gets lost.</p>`
    : `<p style="font-size:13px;line-height:1.6;color:#666">We'll reply to this address. If you have an account, a ticket from the Support tab keeps everything in one thread.</p>`}`,
    { hideAddress: true, reason: support ? "You're receiving this because you opened a support ticket with Came Through Audio." : "You're receiving this because you sent Came Through Audio a message from our Contact page." },
  );
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `ticket-received-${input.id}`,
      },
      body: JSON.stringify({
        from: support ? `Came Through Audio ${inbox === BILLING_EMAIL ? "Billing" : "Support"} <${inbox}>` : `Came Through Audio <${INFO_EMAIL}>`,
        to: [input.email],
        reply_to: inbox,
        subject: `${support ? "We've got your ticket" : "We've got your message"}: ${input.subject}`.slice(0, 200),
        html,
      }),
    });
    if (!res.ok) {
      console.error(`Ticket receipt failed [${res.status}]`);
      return { emailed: false, reason: `status-${res.status}` };
    }
    return { emailed: true };
  } catch (e) {
    console.error("Ticket receipt failed", e);
    return { emailed: false, reason: "network" };
  }
}

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
    { hideAddress: true, reason: "You're receiving this because you opened a support ticket with Came Through Audio." },
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
  messageId: string,
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
    { hideAddress: true, reason: "You're receiving this staff notice because a member answered a support ticket." },
  );
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      // One id per stored message: a retried notice can't email the team about the same reply twice.
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "Idempotency-Key": `member-reply-${messageId}` },
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
