import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/LegalPage";

const d = "The terms that govern your use of Came Through Audio, operated by Came Through Audio, LLC.";

export const Route = createFileRoute("/terms-of-service")({
  head: () => ({
    meta: [
      { title: "Terms of Service — Came Through Audio" },
      { name: "description", content: d },
      { property: "og:title", content: "Terms of Service — Came Through Audio" },
      { property: "og:description", content: d },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Terms,
});

function Terms() {
  return (
    <LegalPage
      title="Terms of Service"
      updated="October 21, 2026"
      intro={<p>Welcome to Came Through Audio. By accessing or continuing to use our website, internal portal, dashboard tools, or metadata encoding engines (collectively, the "Service"), you agree to be bound by these Terms of Service. The Service is operated by Came Through Audio, LLC ("Came Through Audio", "CTA", "CTAudio", "Company", "we", "us", or "our"). When you use the Service, you are contracting with Came Through Audio, LLC.</p>}
      sections={[
        { heading: "1. The Service", body: <p>Came Through Audio provides tools for musicians to embed metadata into audio files, organize a music catalog, run royalty health checks, create split sheets, generate creation-proof certificates through the AI Protection Hub, and access educational content.</p> },
        { heading: "2. Payment Processing and Merchant of Record", body: <>
          <p>Payments are processed by Stripe. Subscriptions and AI Protection Hub packages are sold through Link, Stripe's checkout service, which acts as the merchant of record for those orders. Your receipt will say "Sold through Link," and your card statement will show a charge beginning with LINK.COM*. Link calculates and collects any sales tax, VAT or GST, sends your receipts and invoices, and answers payment questions.</p>
          <p>Expert Registration Assistance and other services delivered by our team are sold directly by Came Through Audio, LLC, with payment processed by Stripe. Sales tax is added at checkout where required.</p>
          <p>Came Through Audio, LLC remains responsible for the service itself: platform operation, digital delivery, customer support and storage of your assets. You can manage renewals, cancellations, your card and invoices from Profile → Manage billing, or at <a className="text-primary underline" href="https://link.com" target="_blank" rel="noreferrer">link.com</a> for purchases sold through Link.</p>
        </> },
        { heading: "3. Accounts, Security and Data Accuracy", body: <p>You must be of legal age (or have authority to bind your organization) to register. You are responsible for keeping your login credentials confidential and for all activity under your account. You agree to provide current, complete, and accurate legal names for all track writers, composers, and producers. Using stage pseudonyms or false information within legal attestation modules is prohibited.</p> },
        { heading: "4. Acceptable Use", body: <p>You must not misuse the Service, including by: using it unlawfully; committing fraud or sending spam; uploading content that infringes anyone's intellectual property; distributing malware, probing, scraping, or interfering with the Service's security; bypassing checkout screens or forging transaction tokens; or exceeding file limits (such as the 15-second limit for DAW Proof and Draft History Proof recordings).</p> },
        { heading: "5. Your Content", body: <p>You retain all copyright ownership of the audio, masters, lyrics, and cover art you upload. You grant Came Through Audio a limited, non-exclusive license to host, process, hash, and embed metadata into your files solely to provide the features you request. We do not claim ownership, distribution, or licensing rights over your music.</p> },
        { heading: "6. Our Intellectual Property", body: <p>Came Through Audio and its licensors retain all ownership of the Service, including its software, documentation, design, and branding. You may not copy, reverse engineer, resell, or redistribute the Service.</p> },
        { heading: "7. Service Availability", body: <p>We work to keep the Service reliable, but we do not guarantee it will be uninterrupted or error-free. To the fullest extent permitted by law, the Service is provided "as is" without implied warranties, and our total liability is limited to the fees you paid in the 12 months before the claim. Nothing limits liability for fraud, death, or personal injury where the law does not allow it.</p> },
        { heading: "8. Suspension and Termination", body: <p>We may suspend or terminate your access for material breach of these terms, non-payment, security or fraud risk, or repeated or serious policy violations. You may close your account at any time and download your data before doing so.</p> },
        { heading: "9. Governing Law", body: <p>These terms are governed by the laws of the State of Georgia, United States, without regard to conflict-of-law principles. Legal actions arising under these terms shall be brought exclusively in courts located in Georgia.</p> },
        { heading: "10. Contact", body: <p>Questions? Email <a className="text-primary underline" href="mailto:support@camethroughaudio.com">support@camethroughaudio.com</a>.</p> },
      ]}
    />
  );
}
