import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/privacy-notice")({
  beforeLoad: () => {
    throw redirect({ to: "/privacy-policy", statusCode: 301 });
  },
});
