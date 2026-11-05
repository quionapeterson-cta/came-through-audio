import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { KeyRound } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { BrandLogo } from "@/components/BrandLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { forgetLoginEmail, lastLoginEmail, rememberLoginEmail } from "@/lib/login-memory";

export const Route = createFileRoute("/login")({
  // Signing in is a browser session, so there is nothing to render on the server.
  ssr: false,
  head: () => ({
    meta: [
      { title: "Log in — Came Through Audio" },
      { name: "description", content: "Log in to your Came Through Audio workspace." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Login,
});

/**
 * The dedicated log-in page (founder, 2026-11-05). A returning member lands here from "Log in" anywhere on the site,
 * finds the address they last used already filled in, and types only a password. The homepage box stays the sign-up
 * path for new members; this page is the one that never mixes the two.
 */
function Login() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [email, setEmail] = useState("");
  // True when the address came from this browser, not from typing: it changes the wording and offers "Use a different account".
  const [remembered, setRemembered] = useState(false);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const passwordRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const saved = lastLoginEmail();
    if (!saved) return;
    setEmail(saved);
    setRemembered(true);
    // The cursor starts where the work is: a returning member only has a password to type.
    passwordRef.current?.focus();
  }, []);

  // Already signed in (a bookmark, or a second tab): go straight to the workspace.
  useEffect(() => {
    if (!loading && user) navigate({ to: "/workspace", search: { tab: undefined }, replace: true });
  }, [loading, user, navigate]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw error;
      rememberLoginEmail(email);
      navigate({ to: "/workspace", search: { tab: undefined } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't log in. Check your email and password.");
    } finally {
      setBusy(false);
    }
  }

  async function sendReset() {
    if (!email.trim()) { toast.error("Type the email on your account first."); return; }
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/reset-password` });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    setResetSent(true);
  }

  return (
    <div className="min-h-screen bg-ink text-ink-foreground">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-4 py-5 sm:px-6">
        <BrandLogo />
        <Link to="/" className="text-sm font-semibold text-ink-muted hover:text-primary">Home</Link>
      </header>
      <main className="mx-auto max-w-md px-4 py-8 sm:px-6">
        <div className="rounded-2xl bg-background p-8 text-foreground shadow-2xl">
          <KeyRound className="h-8 w-8 text-primary" />
          {resetSent ? (
            <div className="mt-4 space-y-3">
              <h1 className="text-2xl font-bold">Check your email</h1>
              <p className="text-muted-foreground">
                If an account uses <span className="font-semibold text-foreground">{email}</span>, a reset link is on its
                way. It works once and expires in an hour.
              </p>
              <button type="button" className="text-sm font-semibold text-primary" onClick={() => setResetSent(false)}>Back to log in</button>
            </div>
          ) : (
            <form onSubmit={submit} className="mt-4 space-y-4">
              <div>
                <h1 className="text-2xl font-bold">Welcome back</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  {remembered ? "You signed in on this browser before. Your email is already in place — just enter your password." : "Log in to your catalog, splits and contracts."}
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="login-email">Email</Label>
                <Input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
                {remembered ? (
                  <button
                    type="button"
                    className="text-xs font-semibold text-primary"
                    onClick={() => { forgetLoginEmail(); setRemembered(false); setEmail(""); }}
                  >
                    Use a different account
                  </button>
                ) : null}
              </div>
              <div className="space-y-1.5">
                <div className="flex items-baseline justify-between">
                  <Label htmlFor="login-password">Password</Label>
                  <button type="button" className="text-xs font-semibold text-primary" onClick={() => void sendReset()}>Forgot password?</button>
                </div>
                <Input
                  id="login-password"
                  ref={passwordRef}
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="h-12 w-full text-base font-semibold" disabled={busy}>
                {busy ? "Please wait…" : "Log in"}
              </Button>
              <p className="text-center text-sm text-muted-foreground">
                New here?{" "}
                <Link to="/" className="font-semibold text-primary">Create a free account</Link>
              </p>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
