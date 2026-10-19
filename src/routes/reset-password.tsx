import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { KeyRound, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { BrandLogo } from "@/components/BrandLogo";
import { PasswordField } from "@/components/PasswordField";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { passwordValid } from "@/lib/password";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Reset Password — Came Through Audio" },
      { name: "description", content: "Choose a new password for your Came Through Audio account." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ResetPassword,
});

/**
 * Landing page for the emailed reset link. Supabase signs the person in from the link's recovery token; they then
 * pick a new password that passes every check. Without a valid link, they can request a fresh one.
 */
function ResetPassword() {
  const navigate = useNavigate();
  const [state, setState] = useState<"checking" | "ready" | "expired">("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || (session && event === "SIGNED_IN")) setState("ready");
    });
    // The token in the link is processed on load; give it a moment before calling the link expired.
    const t = setTimeout(() => {
      void supabase.auth.getSession().then(({ data }) => setState((s) => (s === "checking" ? (data.session ? "ready" : "expired") : s)));
    }, 1500);
    return () => { sub.subscription.unsubscribe(); clearTimeout(t); };
  }, []);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!passwordValid(password)) { toast.error("Your new password needs to pass every check."); return; }
    if (password !== confirm) { toast.error("The passwords don't match."); return; }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Password updated. You're logged in.");
    navigate({ to: "/workspace", search: { tab: undefined } });
  }

  async function resend(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/reset-password` });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    setSent(true);
  }

  return (
    <div className="min-h-screen bg-ink text-ink-foreground">
      <header className="mx-auto flex max-w-5xl items-center px-4 py-5 sm:px-6"><BrandLogo /></header>
      <main className="mx-auto max-w-md px-4 py-10 sm:px-6">
        <div className="rounded-2xl bg-background p-8 text-foreground shadow-2xl">
          <KeyRound className="h-8 w-8 text-primary" />
          {state === "checking" ? (
            <p className="mt-4 flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Checking your reset link…</p>
          ) : state === "ready" ? (
            <form onSubmit={save} className="mt-4 space-y-4">
              <h1 className="text-2xl font-bold">Choose a new password</h1>
              <PasswordField id="new-password" label="New password" value={password} onChange={setPassword} />
              <div className="space-y-1.5">
                <Label htmlFor="confirm-password">Confirm new password</Label>
                <Input id="confirm-password" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
                {confirm && <p className={`text-xs ${confirm === password ? "text-primary" : "text-destructive"}`}>{confirm === password ? "Passwords match" : "Passwords don't match yet"}</p>}
              </div>
              <Button type="submit" className="h-12 w-full" disabled={busy || !passwordValid(password) || password !== confirm}>{busy ? "Saving…" : "Save new password"}</Button>
            </form>
          ) : sent ? (
            <div className="mt-4 space-y-2">
              <h1 className="text-2xl font-bold">Check your email</h1>
              <p className="text-muted-foreground">If an account uses that email, a new reset link is on its way. It expires in one hour.</p>
            </div>
          ) : (
            <form onSubmit={resend} className="mt-4 space-y-4">
              <h1 className="text-2xl font-bold">This reset link expired</h1>
              <p className="text-sm text-muted-foreground">Reset links work once and expire after an hour. Enter your email for a new one.</p>
              <div className="space-y-1.5"><Label htmlFor="reset-email">Email</Label><Input id="reset-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
              <Button type="submit" className="h-12 w-full" disabled={busy}>{busy ? "Sending…" : "Send a new link"}</Button>
              <p className="text-center text-sm"><Link to="/" className="font-semibold text-primary">Back to home</Link></p>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
