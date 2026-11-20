import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BrandLogo } from "@/components/BrandLogo";
import { Button } from "@/components/ui/button";
import { googleLandingPath, oauthError } from "@/lib/google-auth";
import { rememberLoginEmail } from "@/lib/login-memory";
import { takePlanIntent } from "@/lib/plans";
import { takeReturn } from "@/lib/password";
import { safeRedirectPath } from "@/lib/safe-redirect";

export const Route = createFileRoute("/auth/callback")({
  // The session arrives in the browser's own session, so there is nothing for the server to render here.
  ssr: false,
  head: () => ({
    meta: [
      { title: "Signing in — Came Through Audio" },
      { name: "description", content: "Finishing your Came Through Audio sign-in." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthCallback,
});

/**
 * The return leg of a Google sign-in (founder, 2026-11-20). Supabase reads the returning session out of the address
 * itself, and asking for it is what waits for that to finish — so the page does nothing but wait, then hand over to the
 * workspace with the plan and the saved return path the member left with.
 */
function AuthCallback() {
  const [error, setError] = useState<string | null>(() => oauthError(window.location.search));

  useEffect(() => {
    if (error) return;
    let active = true;
    supabase.auth
      .getSession()
      .then(({ data, error: sessionError }) => {
        if (!active) return;
        const session = data.session;
        if (sessionError || !session) {
          setError(
            oauthError(window.location.search) ??
              "That sign-in didn't finish. Try again, or log in with your email and password.",
          );
          return;
        }
        // The remembered email on /login is the address this browser now signs in with.
        rememberLoginEmail(session.user.email ?? "");
        const landing = safeRedirectPath(
          googleLandingPath(takePlanIntent(), takeReturn()),
          "/workspace",
        );
        // A full load, not a router push: the app boots with the new session already in place.
        window.location.replace(landing);
      })
      .catch(() => {
        if (active)
          setError(
            "That sign-in didn't finish. Try again, or log in with your email and password.",
          );
      });
    return () => {
      active = false;
    };
  }, [error]);

  return (
    <div className="min-h-screen bg-ink text-ink-foreground">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-4 py-5 sm:px-6">
        <BrandLogo />
        <Link to="/" className="text-sm font-semibold text-ink-muted hover:text-primary">
          Home
        </Link>
      </header>
      <main className="mx-auto max-w-md px-4 py-8 sm:px-6">
        <div className="rounded-2xl bg-background p-8 text-foreground shadow-2xl">
          {error ? (
            <div className="space-y-3">
              <h1 className="text-2xl font-bold">Sign-in didn&apos;t finish</h1>
              <p className="text-muted-foreground">{error}</p>
              <p className="text-sm text-muted-foreground">
                Your account is safe. Logging in with your email and password works exactly as
                before.
              </p>
              <Button asChild className="h-11 w-full text-base font-semibold">
                <Link to="/login">Back to log in</Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-3 text-center">
              <span
                className="mx-auto block h-8 w-8 animate-spin rounded-full border-2 border-primary/25 border-t-primary"
                aria-hidden
              />
              <h1 className="text-2xl font-bold">Signing you in</h1>
              <p className="text-muted-foreground">One moment — your workspace is opening.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
