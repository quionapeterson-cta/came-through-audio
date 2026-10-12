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
      updated="October 12, 2026"
      intro={<p>Welcome to Came Through Audio. By accessing or continuing to use our website, internal portal, dashboard tools, or metadata encoding engines (collectively, the "Service"), you agree to be bound by these Terms of Service. The Service is operated by Came Through Audio, LLC ("Came Through Audio", "CTA", "CTAudio", "Company", "we", "us", or "our"). When you use the Service, you are contracting with Came Through Audio, LLC.</p>}
      sections={[
        { heading: "1. The Service", body: <p>Came Through Audio provides tools for musicians to embed metadata into audio files, organize a music catalog, run royalty health checks, create split sheets, generate creation-proof certificates through the AI Protection Hub, and access educational content.</p> },
        { heading: "2. Payment Processing and Merchant of Record", body: <>
          <p>Our order process is conducted by our online reseller Paddle.com. Paddle.com is the Merchant of Record for all our orders. Paddle provides all customer service inquiries and handles returns.</p>
          <p>Paddle.com Market Limited ("Paddle") is the legal merchant of record for all digital products, individual transactional packages, micro-transactions, and recurring subscriptions sold on Came Through Audio, and your statement will reflect a charge from Paddle. Payment, billing, taxes, renewals, cancellations, and refunds are governed by <a className="text-primary underline" href="https://www.paddle.com/legal/checkout-buyer-terms" target="_blank" rel="noreferrer">Paddle's Buyer Terms</a> in addition to these terms. Came Through Audio remains responsible for digital delivery, platform operation, customer support, and asset storage.</p>
        </> },
        { heading: "3. Accounts, Security and Data Accuracy", body: <p>You must be of legal age (or have authority to bind your organization) to register. You are responsible for keeping your login credentials confidential and for all activity under your account. You agree to provide current, complete, and accurate legal names for all track writers, composers, and producers. Using stage pseudonyms or false information within legal attestation modules is prohibited.</p> },
        { heading: "4. Acceptable Use", body: <p>You must not misuse the Service, including by: using it unlawfully; committing fraud or sending spam; uploading content that infringes anyone's intellectual property; distributing malware, probing, scraping, or interfering with the Service's security; bypassing checkout screens or forging transaction tokens; or exceeding file limits (such as the 15-second limit for DAW Proof and Draft History Proof recordings).</p> },
        { heading: "5. Your Content", body: <p>You retain all copyright ownership of the audio, masters, lyrics, and cover art you upload. You grant Came Through Audio a limited, non-exclusive license to host, process, hash, and embed metadata into your files solely to provide the features you request. We do not claim ownership, distribution, or licensing rights over your music.</p> },
        { heading: "6. Our Intellectual Property", body: <p>Came Through Audio and its licensors retain all ownership of the Service, including its software, documentation, design, and branding. You may not copy, reverse engineer, resell, or redistribute the Service.</p> },
        { heading: "7. Service Availability", body: <p>We work to keep the Service reliable, but we do not guarantee it will be uninterrupted or error-free. To the fullest extent permitted by law, the Service is provided "as is" without implied warranties, and our total liability is limited to the fees you paid in the 12 months before the claim. Nothing limits liability for fraud, death, or personal injury where the law does not allow it.</p> },
        { heading: "8. Suspension and Termination", body: <p>We may suspend or terminate your access for material breach of these terms, non-payment, security or fraud risk, or repeated or serious policy violations. You may close your account at any time and download your data before doing so.</p> },
        { heading: "9. Governing Law", body: <p>These terms are governed by the laws of the State of Georgia, United States, without regard to conflict-of-law principles. Legal actions arising under these terms shall be brought exclusively in courts located in Georgia.</p> },
        { heading: "10. Contact", body: <p>Questions? Email <a className="text-primary underline" href="mailto:camethroughaudio.com@gmail.com">camethroughaudio.com@gmail.com</a>.</p> },
      ]}
    />
  );
}
