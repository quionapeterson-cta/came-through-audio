import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ConfirmHost } from "@/components/ConfirmHost";
import { CheckoutHost } from "@/components/CheckoutHost";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import { Toaster } from "@/components/ui/sonner";
import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { supabase } from "@/integrations/supabase/client";
import { takeReturn } from "@/lib/password";
import { redirect } from "@tanstack/react-router";
import { getGateStatus } from "@/lib/gate.functions";
// Listens for the browser's one-time install prompt from the first page, for "Install the app" in the workspace.
import "@/components/InstallApp";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

/** Open during pre-launch so Paddle's website review can see the business (founder, 2026-10-20). Search engines stay blocked. */
const REVIEW_PAGES = new Set(["/", "/plans", "/contact", "/terms-of-service", "/terms-and-conditions", "/privacy-policy", "/privacy-notice", "/refund-policy"]);

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  // Staging passcode gate: clear SITE_PASSWORD to open the site at launch.
  beforeLoad: async ({ location }) => {
    // Public share cards stay reachable so social sites can read their preview image; they show only the card.
    // Password reset links stay reachable so the one-time token in the link isn't lost on a detour through /unlock.
    // Invite opt-out links stay reachable so anyone who got an invite can stop them without a passcode.
    if (location.pathname === "/unlock" || location.pathname === "/reset-password" || location.pathname === "/invites/stop" || location.pathname.startsWith("/share/")) return { siteLocked: false };
    const { unlocked } = await getGateStatus();
    // The pages a payment provider reviews (product, pricing, legal, contact) are open to everyone; signup on them
    // waits until launch (siteLocked). The workspace, admin and everything else stay behind the passcode.
    if (!unlocked && !REVIEW_PAGES.has(location.pathname) && !location.pathname.startsWith("/docs/")) throw redirect({ to: "/unlock", search: { next: location.href } });
    return { siteLocked: !unlocked };
  },
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      // Development-stage shield: remove before public launch.
      { name: "robots", content: "noindex, nofollow" },
      { title: "Came Through Audio" },
      { name: "description", content: "Embed metadata, organize your catalog and check your royalty health." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      // Installable app (PWA): home-screen name and status bar color on phones.
      { name: "theme-color", content: "#0b0b0b" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-title", content: "Came Through" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap" },
      { rel: "icon", href: "/favicon.png", type: "image/png" },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  // Send people back to the page they were invited to (e.g. a split sheet) after login or email confirmation.
  useEffect(() => {
    const path = window.location.pathname;
    const hash = window.location.hash;
    const search = window.location.search;
    const fromEmail = hash.includes("access_token") || hash.includes("type=signup") || search.includes("code=");
    if (path === "/" && fromEmail) {
      const ret = takeReturn();
      window.location.replace(`/verified${ret ? `?next=${encodeURIComponent(ret)}` : ""}${hash}`);
      return;
    }
    // Supabase also fires SIGNED_IN when an existing session is restored (tab refocus, preview login sharing),
    // so only follow the saved path on a real logged-out → logged-in change.
    let hadSession: boolean | null = null;
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      const wasSignedIn = hadSession;
      hadSession = !!session;
      if (event !== "SIGNED_IN" || wasSignedIn !== false) return;
      const ret = takeReturn();
      if (ret && window.location.pathname !== ret && window.location.pathname !== "/verified") window.location.assign(ret);
    });
    return () => sub.subscription.unsubscribe();
  }, []);


  return (
    <QueryClientProvider client={queryClient}>
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
      <Toaster />
      <ConfirmHost />
      <CheckoutHost />
    </QueryClientProvider>
  );
}
