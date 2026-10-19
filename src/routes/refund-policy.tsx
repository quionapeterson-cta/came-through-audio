import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/LegalPage";

const d = "Came Through Audio offers a 30-day refund window on subscriptions and packages, processed by Paddle.";

export const Route = createFileRoute("/refund-policy")({
  head: () => ({
    meta: [
      { title: "Refund Policy — Came Through Audio" },
      { name: "description", content: d },
      { property: "og:title", content: "Refund Policy — Came Through Audio" },
      { property: "og:description", content: d },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Refund,
});

function Refund() {
  return (
    <LegalPage
      title="Refund Policy"
      updated="October 12, 2026"
      intro={<p>We want you to have complete peace of mind when organizing your music. We offer a 30-day refund window, structured as follows.</p>}
      sections={[
        { heading: "Catalog Plus Subscriptions", body: <p>If you are unsatisfied with your annual Catalog Plus subscription, you may request a full refund within 30 days of your order date. If you upgrade from a starter plan, we will refund the exact pricing difference when the upgrade is made within 30 days of your original payment.</p> },
        { heading: "AI Protection Hub Packages", body: <p>Individual packages — Single ($2.99), EP up to 6 songs ($9.99), Album up to 12 songs ($16.99), and Album+ up to 20 songs ($24.99) — are eligible for a refund within 30 days of purchase, provided the proof certificate has not yet been generated. Once the PDF Proof Certificate, validation QR code, or timestamp has been produced, the digital service is considered delivered.</p> },
        { heading: "How to Request a Refund", body: <p>Refunds are processed by our payment provider and Merchant of Record, Paddle, and credited to your original payment method. To request a refund, visit <a className="text-primary underline" href="https://paddle.net" target="_blank" rel="noreferrer">paddle.net</a> or email <a className="text-primary underline" href="mailto:support@camethroughaudio.com">support@camethroughaudio.com</a> with your order details. See also <a className="text-primary underline" href="https://www.paddle.com/legal/refund-policy" target="_blank" rel="noreferrer">Paddle's Refund Policy</a>.</p> },
      ]}
    />
  );
}
