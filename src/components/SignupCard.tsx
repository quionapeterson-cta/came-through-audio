import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function SignupCard() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signup" | "login">("signup");
  const [stageName, setStageName] = useState("");
  const [legalName, setLegalName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/workspace`,
            data: { stage_name: stageName, legal_name: legalName },
          },
        });
        if (error) throw error;
        if (data.session) navigate({ to: "/workspace" });
        else setSent(true);
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/workspace" });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl bg-background p-8 text-foreground shadow-2xl">
      {sent ? (
        <div className="space-y-3 text-center">
          <h2 className="text-2xl font-bold">Check your email</h2>
          <p className="text-muted-foreground">
            We sent a confirmation link to <span className="font-semibold text-foreground">{email}</span>. Click it to open your workspace.
          </p>
        </div>
      ) : (
        <>
          <h2 className="text-2xl font-bold leading-tight">
            {mode === "signup" ? (
              <>Musicians - Sign Up Now</>
            ) : (
              "Welcome back"
            )}
          </h2>
          <form onSubmit={submit} className="mt-6 space-y-4">
            {mode === "signup" && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="stage">Stage name</Label>
                  <Input id="stage" value={stageName} onChange={(e) => setStageName(e.target.value)} required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="legal">Legal name</Label>
                  <Input id="legal" value={legalName} onChange={(e) => setLegalName(e.target.value)} required />
                </div>
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <Button type="submit" disabled={busy} className="h-12 w-full text-base font-semibold">
              {busy ? "Please wait…" : mode === "signup" ? "Create my free account" : "Log in"}
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            {mode === "signup" ? "Already have an account?" : "New here?"}{" "}
            <button type="button" className="font-semibold text-primary" onClick={() => setMode(mode === "signup" ? "login" : "signup")}>
              {mode === "signup" ? "Log in" : "Sign up free"}
            </button>
          </p>
        </>
      )}
    </div>
  );
}
