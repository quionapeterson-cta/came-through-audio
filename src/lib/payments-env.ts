const clientToken = import.meta.env["VITE_PAYMENTS_CLIENT_TOKEN"] as string | undefined;

/** Test mode in the preview (Stripe pk_test_ key), live on the published site. Same answer in the browser and server. */
export function getPaymentsEnvironment(): "sandbox" | "live" {
  return clientToken?.startsWith("pk_live_") ? "live" : "sandbox";
}

/**
 * The two answers that decide whether a payment counts have to agree: the mode the app checks out in (the Stripe key),
 * and the environment the database counts (site_settings `payments`). When they disagree the checkout is refused
 * before Stripe is called, so nothing is ever charged for a plan that will not show — or handed out for free
 * (founder, 2026-11-12). An unset setting counts as a disagreement: that was the live bug.
 */
export function checkoutEnvironmentError(app: "sandbox" | "live", counted: "sandbox" | "live" | null): string | null {
  if (app === counted) return null;
  if (app === "live")
    return "Checkout isn't open yet: payments are still in test mode, so nothing was charged. Try again once we're live, or contact support and we'll help right away.";
  return "This preview takes test payments while the site is counting live ones, so nothing was charged. Buy it on the published site: it appears on this account the moment Stripe confirms the payment.";
}
