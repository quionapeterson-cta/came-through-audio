const clientToken = import.meta.env["VITE_PAYMENTS_CLIENT_TOKEN"] as string | undefined;

/** Test mode in the preview (Stripe pk_test_ key), live on the published site. Same answer in the browser and server. */
export function getPaymentsEnvironment(): "sandbox" | "live" {
  return clientToken?.startsWith("pk_live_") ? "live" : "sandbox";
}

/** What a member reads when the site is running live keys but isn't open for sales yet (the database still counts test payments). */
export const CHECKOUT_CLOSED =
  "Checkout isn't open yet, so nothing was charged. Try again once we're live, or contact support and we'll help right away.";

/** What a member reads when the counted environment couldn't be read at all: nothing is charged rather than risk charging for nothing. */
export const CHECKOUT_UNAVAILABLE =
  "Checkout can't open right now, so nothing was charged. Try again in a moment, or contact support and we'll help right away.";

/**
 * The two answers that decide whether a payment counts have to agree: the mode the app checks out in (the Stripe key),
 * and the environment the database counts (site_settings `payments`). When they disagree the checkout is refused
 * before Stripe is called, so nothing is ever charged for a plan that will not show — or handed out for free
 * (founder, 2026-11-12). An unset setting counts as a disagreement: that was the live bug, and it is what keeps the
 * published link from taking real money until the switch is deliberate.
 */
export function checkoutEnvironmentError(app: "sandbox" | "live", counted: "sandbox" | "live" | null): string | null {
  if (app === counted) return null;
  if (app === "live") return CHECKOUT_CLOSED;
  return "This preview takes test payments while the site is counting live ones, so nothing was charged. Buy it on the published site: it appears on this account the moment Stripe confirms the payment.";
}
