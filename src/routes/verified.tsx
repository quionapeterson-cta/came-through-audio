import { safeRedirectPath } from "@/lib/safe-redirect";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BrandLogo } from "@/components/BrandLogo";
import { takeReturn } from "@/lib/password";

function safeNext(n: unknown): string {
  return safeRedirectPath(n, "/workspace");
}

export const Route = createFileRoute("/verified")({
  head: () => ({
    meta: [
      { title: "Email Verified — Came Through Audio" },
      { name: "description", content: "Your Came Through Audio email is verified. Log in to open your workspace." },
      { property: "og:title", content: "Email Verified — Came Through Audio" },
      { property: "og:description", content: "Your account is ready. Log in to start protecting your music." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  validateSearch: (s: Record<string, unknown>) => ({ next: typeof s["next"] === "string" ? (s["next"] as string) : undefined } as { next?: string | undefined }),
  component: Verified,
});

function Verified() {
  const navigate = useNavigate();
  const { next } = Route.useSearch();
  const dest = next ? safeNext(next) : safeNext(takeReturn() ?? "/workspace");
  const [signedIn, setSignedIn] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSignedIn(!!s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const go = () => { window.location.href = dest; };

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    go();
  }

  return (
    <div className="min-h-screen bg-ink text-ink-foreground">
      <header className="mx-auto max-w-7xl px-6 py-4"><BrandLogo /></header>
      <main className="mx-auto flex max-w-md flex-col items-center px-6 py-12">
        <div className="w-full rounded-2xl bg-background p-8 text-foreground shadow-2xl">
          <div className="flex flex-col items-center text-center">
            <CheckCircle2 className="h-14 w-14 text-primary" />
            <h1 className="mt-4 text-2xl font-bold">Email verified!</h1>
            <p className="mt-2 text-muted-foreground">Your Came Through Audio account is ready.</p>
          </div>
          {signedIn ? (
            <Button onClick={go} className="mt-6 h-12 w-full text-base font-semibold">Enter my workspace</Button>
          ) : (
            <form onSubmit={login} className="mt-6 space-y-4">
              <p className="text-center text-sm font-semibold">Log in to continue</p>
              <div className="space-y-1.5">
                <Label htmlFor="v-email">Email</Label>
                <Input id="v-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="v-pass">Password</Label>
                <Input id="v-pass" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              </div>
              <Button type="submit" disabled={busy} className="h-12 w-full text-base font-semibold">{busy ? "Please wait…" : "Log in"}</Button>
              <button type="button" onClick={() => navigate({ to: "/" })} className="block w-full text-center text-sm text-muted-foreground">Back to home</button>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
