import { useState, useCallback } from "react";
import { StripeEmbeddedCheckout, type CheckoutItem } from "@/components/StripeEmbeddedCheckout";

export interface CheckoutOptions {
  items: CheckoutItem[];
  customerEmail?: string;
  userId?: string;
  customData?: Record<string, string>;
  returnUrl?: string;
}

/**
 * Opens Stripe embedded checkout inline on the page. Render `checkoutElement` where the
 * payment form should appear (it renders nothing while closed).
 */
export function useStripeCheckout() {
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState<CheckoutOptions | null>(null);

  const openCheckout = useCallback((opts: CheckoutOptions) => {
    setOptions(opts);
    setIsOpen(true);
  }, []);

  const closeCheckout = useCallback(() => {
    setIsOpen(false);
    setOptions(null);
  }, []);

  const checkoutElement = isOpen && options
    ? <StripeEmbeddedCheckout {...options} />
    : null;

  return { openCheckout, closeCheckout, isOpen, checkoutElement };
}
