import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/LegalPage";

const d = "Came Through Audio offers a 30-day refund window on plans, packages and Expert Registration Assistance, processed by Stripe.";

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
      updated="October 22, 2026"
      intro={<p>We want you to have complete peace of mind when organizing your music. We offer a 30-day refund window, structured as follows.</p>}
      sections={[
        { heading: "Plans (Catalog Plus, Catalog & Collaborate, Catalog Management)", body: <p>If you are unsatisfied with your annual plan, you may request a full refund within 30 days of your order date. When you switch to a higher plan, you pay only the prorated difference at the time of the switch. A refund ends the plan right away, and once a plan ends its catalog is emptied, so download your masters, cover art, lyrics and catalog PDF before you request a refund or let your plan end. We keep your catalog for 30 days after a plan ends, read-only so you can download it, then empty it. Signed split sheets, signed contracts and AI Protection certificates are kept.</p> },
        { heading: "AI Protection Hub Packages", body: <p>Individual packages — Single ($2.99 per song, up to 3), EP up to 6 songs ($9.99), Album up to 12 songs ($16.99), and Album+ up to 20 songs ($24.99) — are eligible for a refund within 30 days of purchase, provided the proof certificate has not yet been generated. Once the PDF Proof Certificate, validation QR code, or timestamp has been produced, the digital service is considered delivered.</p> },
        { heading: "Expert Registration Assistance", body: <p>You may request a full refund within 30 days of purchase, as long as our team hasn't started work on your registrations. Once work has started, the service is considered delivered.</p> },
        { heading: "How to Request a Refund", body: <p>Email <a className="text-primary underline" href="mailto:support@camethroughaudio.com">support@camethroughaudio.com</a> with the email on your account and what you bought. Approved refunds go back to your original payment method, usually within 5–10 business days. For purchases sold through Link, you can also ask Link support at <a className="text-primary underline" href="https://support.link.com" target="_blank" rel="noreferrer">support.link.com</a>.</p> },
      ]}
    />
  );
}
