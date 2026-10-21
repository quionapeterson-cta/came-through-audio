import { showCheckout } from "@/components/CheckoutHost";
import { createCheckoutSession, openBillingPortal } from "@/lib/payments.functions";
import type { CheckoutInput } from "@/lib/stripe-mapping";

export { getPaymentsEnvironment } from "@/lib/payments-env";

const isFramed = () => { try { return window.top !== window.self; } catch { return true; } };

/**
 * Stripe's billing portal refuses to load inside a frame, so in the Lovable preview (an iframe) it opens in a new
 * tab; on the real site the current page goes there.
 */
function goToPortal(url: string, tab?: Window | null) {
  if (tab) { tab.opener = null; tab.location.href = url; return; }
  if (!isFramed()) { window.location.assign(url); return; }
  const opened = window.open(url, "_blank");
  if (!opened) throw new Error("Your browser blocked the billing page. Open it from Profile → Manage billing.");
  opened.opener = null;
}

/** Opens Stripe's payment form on the page. Someone who already has a plan goes to the billing portal to switch plans. */
export async function openCheckout(input: CheckoutInput) {
  const result = await createCheckoutSession({ data: input });
  if ("portalUrl" in result) return goToPortal(result.portalUrl);
  if (!showCheckout(result.clientSecret)) throw new Error("Checkout could not open. Refresh the page and try again.");
}

/** Opens Stripe's billing page for this account: cancel, change the card, download invoices, switch plans. */
export async function openBilling() {
  // Opened during the click so the browser allows the new tab, then pointed at the portal.
  const tab = isFramed() ? window.open("", "_blank") : null;
  try {
    const { url } = await openBillingPortal();
    goToPortal(url, tab);
  } catch (e) {
    tab?.close();
    throw e;
  }
}
