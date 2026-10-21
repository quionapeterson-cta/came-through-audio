import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/LegalPage";

const d = "How Came Through Audio, LLC collects, uses and protects your personal data and music assets.";

export const Route = createFileRoute("/privacy-policy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — Came Through Audio" },
      { name: "description", content: d },
      { property: "og:title", content: "Privacy Policy — Came Through Audio" },
      { property: "og:description", content: d },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Privacy,
});

function Privacy() {
  return (
    <LegalPage
      title="Privacy Policy"
      updated="October 21, 2026"
      sections={[
        { heading: "1. Who We Are", body: <p>Came Through Audio, LLC ("Came Through Audio") is the data controller for the personal information, account profiles, lyrics, track metadata identifiers (ISRC, UPC, ISWC), and file hashes you provide on our platform. Contact: <a className="text-primary underline" href="mailto:support@camethroughaudio.com">support@camethroughaudio.com</a>.</p> },
        { heading: "2. Data We Collect", body: <ul className="list-disc space-y-1 pl-5">
          <li>Account data: stage name, legal name, email, login credentials.</li>
          <li>Music data: track details, contributor legal names, splits, identifiers, lyrics, audio, cover art, and session recordings.</li>
          <li>Support messages you send us.</li>
          <li>Technical data: IP address, device and browser identifiers, and usage information.</li>
        </ul> },
        { heading: "3. How We Use It and Why", body: <ul className="list-disc space-y-1 pl-5">
          <li>Creating your account and providing the Service — embedding metadata, organizing your catalog, generating certificates and split sheets (contract performance).</li>
          <li>Verifying your production timeline with SHA-256 session hashes (contract performance).</li>
          <li>Security, fraud prevention, and improving the Service (legitimate interests).</li>
          <li>Customer support (contract performance) and product updates or marketing where you have agreed (consent).</li>
          <li>Meeting legal requirements (legal obligation).</li>
        </ul> },
        { heading: "4. Payments and Stripe", body: <p>Payments are processed by Stripe and, for purchases sold through Link, by Link as merchant of record. Your card and billing details go directly to Stripe and Link, which handle them under their own privacy policies (<a className="text-primary underline" href="https://stripe.com/privacy" target="_blank" rel="noreferrer">stripe.com/privacy</a>, <a className="text-primary underline" href="https://link.com/privacy" target="_blank" rel="noreferrer">link.com/privacy</a>). We receive only what we need to give you access: your name, email address, what you bought, the amount, and your subscription status. We never see or store your full card or bank numbers.</p> },
        { heading: "5. Who We Share Data With", body: <p>We share data only with: service providers that host and run our platform (including our cloud database and file storage provider); Stripe and Link, which process payments; professional advisers such as lawyers and accountants; and authorities where required by law. We do not sell your data.</p> },
        { heading: "6. Retention", body: <p>We keep your data while your account is active so you can download your masters, cover art, lyrics, and certificates at any time. When data is no longer needed, or after you close your account, we delete or anonymise it unless we must keep it by law.</p> },
        { heading: "7. Security", body: <p>We use appropriate technical and organisational measures, including encryption in transit, access controls that limit each account to its own records, and secure cloud storage.</p> },
        { heading: "8. Your Rights", body: <p>Depending on where you live, you may have the right to access, correct, delete, restrict, or export your data, to object to processing, and to withdraw consent. Email us to make a request; you may also complain to your local data protection authority. If your data is transferred outside your country, we rely on appropriate safeguards such as standard contractual clauses.</p> },
        { heading: "9. Cookies", body: <p>We use essential cookies and local storage to keep you signed in and the Service working. We do not use advertising cookies. You can clear cookies in your browser settings, though you may then need to sign in again.</p> },
      ]}
    />
  );
}
