/**
 * Shared Came Through Audio email shell. Every outgoing email MUST use this so it carries
 * the brand header (dark logo on the white email background, linking to the homepage) and the compliant legal footer.
 */
/** Where the live site is until camethroughaudio.com moves (PLAN-cloudflare-hosting.md). */
const PUBLISHED_SITE_URL = "https://pixel-perfect-studio-382.lovable.app";

/**
 * The address that goes into emails, PDFs and share links: whichever host is actually serving this build. A Cloudflare
 * deployment sets `SITE_URL`, so a beta build links to its own address instead of sending a password reset to the
 * Lovable site, and the cutover becomes a variable change rather than a code change (founder, 2026-11-05). Unset keeps
 * the published address, which is what the Lovable build, the browser bundle and the tests expect.
 */
export function resolveSiteUrl(raw: string | undefined = typeof process === "undefined" ? undefined : process.env["SITE_URL"]): string {
  const value = raw?.trim();
  return (value || PUBLISHED_SITE_URL).replace(/\/+$/, "");
}

export const SITE_URL = resolveSiteUrl();
export const BUSINESS_NAME = "Came Through Audio, LLC";
export const BUSINESS_ADDRESS = "789 Garden Walk Blvd, Atlanta, GA 30349";
/** Company mailboxes (founder, 2026-10-25). Each kind of mail goes to and from its own box. */
export const SUPPORT_EMAIL = "support@camethroughaudio.com";
export const INFO_EMAIL = "info@camethroughaudio.com";
export const LEGAL_EMAIL = "legal@camethroughaudio.com";
export const ADMIN_EMAIL = "admin@camethroughaudio.com";
/** Billing and payments mail (renewals, failed payments, refunds) goes out from and comes back to this address. */
export const BILLING_EMAIL = "billing@camethroughaudio.com";
export const TAGLINE = "YOUR FIRST STOP BEFORE DISTRIBUTION";
/**
 * The C in "Came" is the mark image, so its ink has to sit at the cap height of the wordmark, not above it. The header
 * came down a notch (founder, 2026-11-05): the logo and the wordmark were running wider than the copy under them.
 *
 * The header now reads like the homepage's (founder, 2026-11-10): the name leads, left-aligned, and the CTA script logo
 * sits underneath it, with the tagline under that. Centring the block is what put the logo above the name and made the
 * header read as two logos stacked.
 *
 * The script logo is back at twice the width it was halved to (founder, 2026-11-10): the signature is the brand's own
 * mark, so it draws at its full size under the name and the block stays left-aligned, the way it sat before the halving.
 */
export const EMAIL_LOGO_WIDTH = 96;
export const WORDMARK_MARK_PX = 14;
export const WORDMARK_FONT_PX = 18;

export const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export type EmailKind = "transactional" | "marketing";

export interface EmailLayoutOptions {
  /** Plain-text sentence explaining why the recipient got this email. */
  reason: string;
  /** Marketing emails must include an opt-out link. */
  kind?: EmailKind;
  unsubscribeUrl?: string;
  /** Transactional invites: a link that stops further invites to this address. */
  optOutUrl?: string;
}

export function emailLayout(bodyHtml: string, opts: EmailLayoutOptions): string {
  const kind = opts.kind ?? "transactional";
  if (kind === "marketing" && !opts.unsubscribeUrl) throw new Error("Marketing emails require an unsubscribe link.");
  const year = new Date().getFullYear();
  const optOut =
    kind === "marketing"
      ? `<p style="margin:8px 0 0"><a href="${opts.unsubscribeUrl}" style="color:#004AAD">Unsubscribe</a> from these emails at any time.</p>`
      : `<p style="margin:8px 0 0">If you weren't expecting this, you can safely ignore it or contact <a href="mailto:${SUPPORT_EMAIL}" style="color:#004AAD">${SUPPORT_EMAIL}</a>.</p>`;
  const invites = opts.optOutUrl ? `<p style="margin:8px 0 0">Don't want these? <a href="${opts.optOutUrl}" style="color:#004AAD">Don't send me invites</a>.</p>` : "";
  // Light mode everywhere (founder, 2026-11-04). These tags and bgcolor attributes are what stop Gmail, Apple Mail and
  // Outlook from inverting the white shell in a dark inbox, so every email looks the way it was designed.
  return `<!doctype html><html lang="en"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /><meta name="color-scheme" content="light only" /><meta name="supported-color-schemes" content="light only" /><title>Came Through Audio</title><style>:root{color-scheme:light only;supported-color-schemes:light only}body{background:#ffffff !important;color:#0b0b0b !important}</style></head>
<body style="margin:0;padding:0;background:#ffffff;font-family:Poppins,Arial,sans-serif;color:#0b0b0b" bgcolor="#ffffff">
<div style="max-width:560px;margin:0 auto;padding:32px 24px;background:#ffffff" bgcolor="#ffffff">
<div style="padding-bottom:20px;border-bottom:2px solid #004AAD;margin-bottom:24px">
<a href="${SITE_URL}/" style="text-decoration:none;color:#0b0b0b;display:block">
<div style="font-size:${WORDMARK_FONT_PX}px;font-weight:700;color:#0b0b0b"><img src="${SITE_URL}/cta-mark-dark.png" alt="" width="${WORDMARK_MARK_PX}" height="${WORDMARK_MARK_PX}" style="display:inline-block;vertical-align:-1px;border:0;margin-right:-1px" />ame Through <span style="color:#004AAD">Audio</span></div>
<img src="${SITE_URL}/email-logo-dark.png" alt="Came Through Audio logo" width="${EMAIL_LOGO_WIDTH}" style="display:block;margin:10px 0 0;height:auto;border:0" />
<div style="font-size:11px;font-weight:700;letter-spacing:2px;color:#004AAD;margin-top:8px">${TAGLINE}</div>
</a>
</div>
${bodyHtml}
<div style="margin-top:32px;padding-top:16px;border-top:1px solid #e5e5e5;font-size:12px;line-height:1.6;color:#666">
<p style="margin:0"><b>${BUSINESS_NAME}</b> · ${BUSINESS_ADDRESS}</p>
<p style="margin:8px 0 0">${escapeHtml(opts.reason)}</p>
${optOut}
${invites}
<p style="margin:8px 0 0"><a href="${SITE_URL}/privacy-policy" style="color:#004AAD">Privacy Policy</a> · <a href="${SITE_URL}/terms-of-service" style="color:#004AAD">Terms of Service</a> · <a href="${SITE_URL}/contact" style="color:#004AAD">Contact Us</a></p>
<p style="margin:8px 0 0">© ${year} ${BUSINESS_NAME}. All rights reserved.</p>
</div>
</div></body></html>`;
}
