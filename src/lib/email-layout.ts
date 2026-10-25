/**
 * Shared Came Through Audio email shell. Every outgoing email MUST use this so it carries
 * the brand header (dark logo on the white email background) and the compliant legal footer.
 */
export const SITE_URL = "https://pixel-perfect-studio-382.lovable.app";
export const BUSINESS_NAME = "Came Through Audio, LLC";
export const BUSINESS_ADDRESS = "789 Garden Walk Blvd, Atlanta, GA 30349";
export const SUPPORT_EMAIL = "support@camethroughaudio.com";
/** Billing and payments mail (renewals, failed payments, refunds) goes out from and comes back to this address. */
export const BILLING_EMAIL = "billing@camethroughaudio.com";
export const TAGLINE = "YOUR FIRST STOP BEFORE DISTRIBUTION";

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
  return `<!doctype html><html><body style="margin:0;background:#ffffff;font-family:Poppins,Arial,sans-serif;color:#0b0b0b">
<div style="max-width:560px;margin:0 auto;padding:32px 24px">
<div style="text-align:center;padding-bottom:20px;border-bottom:2px solid #004AAD;margin-bottom:24px">
<img src="${SITE_URL}/email-logo-dark.png" alt="Came Through Audio logo" width="120" style="display:block;margin:0 auto 10px;height:auto;border:0" />
<div style="font-size:20px;font-weight:700;color:#0b0b0b">Came Through <span style="color:#004AAD">Audio</span></div>
<div style="font-size:11px;font-weight:700;letter-spacing:2px;color:#004AAD;margin-top:4px">${TAGLINE}</div>
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
