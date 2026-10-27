import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/LegalPage";
import { REFUNDS } from "@/lib/legal-docs";
import { loadLegalOverrides } from "@/lib/legal-overrides";

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
  // Wording edited in Admin → Legal, loaded with the page so it never flashes the old text.
  loader: () => loadLegalOverrides("refunds"),
  component: Refund,
});

function Refund() {
  return (
    <LegalPage {...REFUNDS} overrides={Route.useLoaderData()} />
  );
}
