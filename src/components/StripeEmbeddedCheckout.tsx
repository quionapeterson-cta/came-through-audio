import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { getStripe } from "@/lib/stripe";

/** Stripe's payment form, shown inside our page. The session is created on the server (createCheckoutSession). */
export function StripeEmbeddedCheckout({ clientSecret }: { clientSecret: string }) {
  return (
    <div id="checkout">
      <EmbeddedCheckoutProvider stripe={getStripe()} options={{ fetchClientSecret: () => Promise.resolve(clientSecret) }}>
        <EmbeddedCheckout />
      </EmbeddedCheckoutProvider>
    </div>
  );
}
