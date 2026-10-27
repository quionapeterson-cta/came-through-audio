import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/LegalPage";
import { TERMS } from "@/lib/legal-docs";
import { loadLegalOverrides } from "@/lib/legal-overrides";

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
  // Wording edited in Admin → Legal, loaded with the page so it never flashes the old text.
  loader: () => loadLegalOverrides("terms"),
  component: Terms,
});

function Terms() {
  return (
    <LegalPage {...TERMS} overrides={Route.useLoaderData()} />
  );
}
