/**
 * The signing-link email (founder, 2026-11-15).
 *
 * Both the first send and "Email the link again" write the same message, so the words live here once. The link is passed
 * in already resolved by the server, which is what keeps a preview host out of a client's inbox.
 */
import { emailLayout, escapeHtml } from "./email-layout";

export type PacketEmailInput = {
  /** The packet's title, which is also the email's heading. */
  title: string;
  recipientName: string;
  /** The public signing page, built by the server from the canonical origin. */
  link: string;
};

export function packetEmailSubject(title: string) {
  return `Signature needed: ${title}`;
}

export function packetEmailHtml({ title, recipientName, link }: PacketEmailInput) {
  const first = recipientName.trim().split(/\s+/)[0] || recipientName.trim();
  return emailLayout(
    `<p style="font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#004AAD;margin:0">Came Through Audio</p>
<h1 style="font-size:22px;margin:8px 0 16px">${escapeHtml(title)}</h1>
<p style="font-size:15px;line-height:1.6">Hi ${escapeHtml(first)},</p>
<p style="font-size:15px;line-height:1.6">Your signature is needed on this packet. Open your own signing page, fill in what applies to you and sign — it takes a few minutes, nothing to install.</p>
<p style="margin:24px 0"><a href="${escapeHtml(link)}" style="background:#004AAD;color:#FFFFFF;padding:12px 22px;border-radius:6px;font-weight:700;text-decoration:none">Review &amp; sign</a></p>
<p style="font-size:13px;line-height:1.6;color:#555">If the button doesn't open, paste this link into your browser:<br><span style="word-break:break-all">${escapeHtml(link)}</span></p>`,
    { reason: "You're receiving this because Came Through Audio sent you a document to sign." },
  );
}
