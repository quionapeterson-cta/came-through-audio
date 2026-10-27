import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/LegalPage";
import { PRIVACY } from "@/lib/legal-docs";
import { loadLegalOverrides } from "@/lib/legal-overrides";

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
  // Wording edited in Admin → Legal, loaded with the page so it never flashes the old text.
  loader: () => loadLegalOverrides("privacy"),
  component: Privacy,
});

function Privacy() {
  return (
    <LegalPage {...PRIVACY} overrides={Route.useLoaderData()} />
  );
}
