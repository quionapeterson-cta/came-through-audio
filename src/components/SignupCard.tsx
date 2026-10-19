import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { passwordValid, rememberReturn } from "@/lib/password";
import { PasswordField } from "@/components/PasswordField";

export function SignupCard({ returnPath, onAuthed, inviteMode }: { returnPath?: string; onAuthed?: () => void; inviteMode?: boolean } = {}) {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signup" | "login" | "forgot">("signup");
  const [stageName, setStageName] = useState("");
  const [legalName, setLegalName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (mode === "signup" && !passwordValid(password)) { toast.error("Your password needs to pass every check below."); return; }
    if (returnPath) rememberReturn(returnPath);
    setBusy(true);
    try {
      if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/reset-password` });
        if (error) throw error;
        setSent(true);
      } else if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/verified?next=${encodeURIComponent(returnPath ?? "/workspace?tab=health")}`,
            data: { stage_name: stageName, legal_name: legalName },
          },
        });
        if (error) throw error;
        if (data.session) { if (onAuthed) onAuthed(); else navigate({ to: "/workspace", search: { tab: "health" } }); }
        else setSent(true);
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        if (onAuthed) onAuthed(); else navigate({ to: "/workspace", search: { tab: undefined } });
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
          {mode === "forgot" ? (
            // Same message whether or not an account exists, so this form can't be used to discover who has one.
            <p className="text-muted-foreground">If an account uses <span className="font-semibold text-foreground">{email}</span>, we sent a link to reset your password. It expires in one hour.</p>
          ) : (
            <p className="text-muted-foreground">
              We sent a confirmation link to <span className="font-semibold text-foreground">{email}</span>. Click it to open your workspace.
            </p>
          )}
          {mode === "forgot" && <button type="button" className="text-sm font-semibold text-primary" onClick={() => { setSent(false); setMode("login"); }}>Back to log in</button>}
        </div>
      ) : (
        <>
          <h2 className="text-2xl font-bold leading-tight">
            {mode === "signup" ? (
              <>Musicians, sign up free.<span className="mt-1 block text-lg font-normal text-primary">Includes Free Unlimited Royalty Health Checks.</span></>
            ) : mode === "forgot" ? (
              <>Reset your password<span className="mt-1 block text-base font-normal text-muted-foreground">Enter your account email and we'll send you a reset link.</span></>
            ) : (
              "Welcome back"
            )}
          </h2>
          <form onSubmit={submit} className="mt-6 space-y-4">
            {mode === "signup" && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="stage">Artist name</Label>
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
              {inviteMode && <p className="text-xs font-medium text-primary">Use your invite email: the same address your signature request was sent to.</p>}
            </div>
            {mode === "signup" ? <PasswordField id="password" value={password} onChange={setPassword} />
              : mode === "login" && (
              <div className="space-y-1.5">
                <div className="flex items-baseline justify-between">
                  <Label htmlFor="password">Password</Label>
                  <button type="button" className="text-xs font-semibold text-primary" onClick={() => setMode("forgot")}>Forgot password?</button>
                </div>
                <Input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              </div>
            )}
            <Button type="submit" disabled={busy} className="h-12 w-full text-base font-semibold">
              {busy ? "Please wait…" : mode === "signup" ? "Create my free account" : mode === "forgot" ? "Send reset link" : "Log in"}
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            {mode === "signup" ? "Already have an account?" : mode === "forgot" ? "Remembered it?" : "New here?"}{" "}
            <button type="button" className="font-semibold text-primary" onClick={() => setMode(mode === "signup" ? "login" : mode === "forgot" ? "login" : "signup")}>
              {mode === "signup" || mode === "forgot" ? "Log in" : "Sign up free"}
            </button>
          </p>
        </>
      )}
    </div>
  );
}
