import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { passwordValid, rememberReturn } from "@/lib/password";
import { rememberLoginEmail } from "@/lib/login-memory";
import { PasswordField } from "@/components/PasswordField";
import { PLAN_INTENT_EVENT, PLAN_TIERS, PRICE_TIER, TIER_LABEL, peekPlanIntent, planIntentFromSearch, planSignupNext, rememberPlanIntent, takePlanIntent } from "@/lib/plans";
import { openCheckout } from "@/lib/checkout";

export function SignupCard({ returnPath, onAuthed, inviteMode }: { returnPath?: string; onAuthed?: () => void; inviteMode?: boolean } = {}) {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signup" | "login" | "forgot">("signup");
  const [stageName, setStageName] = useState("");
  const [legalName, setLegalName] = useState("");
  const [email, setEmail] = useState("");
  // Password rules stay hidden behind the strength bar until a signup attempt fails them.
  const [showRules, setShowRules] = useState(false);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  // A paid tier picked on the plan cards: this is that tier's sign-up, and its checkout opens right after.
  const [intent, setIntent] = useState<string | null>(null);
  useEffect(() => {
    // The plan can arrive in the URL (a link that names it) as well as in this browser, so the form still knows which
    // tier it is signing up for when storage was blocked or the link came from somewhere else.
    const read = () => setIntent(inviteMode ? null : (planIntentFromSearch(new URLSearchParams(window.location.search).get("plan")) ?? peekPlanIntent()));
    read();
    window.addEventListener(PLAN_INTENT_EVENT, read);
    return () => window.removeEventListener(PLAN_INTENT_EVENT, read);
  }, [inviteMode]);
  const paid = intent ? PLAN_TIERS.find((t) => t.priceId === intent) : undefined;

  /**
   * The account exists and is signed in: paying for the plan they picked is part of this same step (founder, 2026-11-06),
   * so Stripe opens right here over the page they signed up on. If it cannot open, the plan is kept and the workspace
   * shows it waiting, rather than dropping them into a free account with the purchase forgotten.
   */
  async function afterAuth() {
    rememberLoginEmail(email);
    if (onAuthed) { onAuthed(); return; }
    if (intent) {
      try { await openCheckout({ kind: "plan", priceId: intent }); takePlanIntent(); return; }
      catch (e) {
        rememberPlanIntent(intent);
        toast.error(e instanceof Error ? e.message : "Checkout could not open. Your plan is saved — finish it in your workspace.");
      }
    }
    navigate({ to: "/workspace", search: { tab: "health", plan: intent ?? undefined } });
  }

  /** Back from the inbox: refresh the session so a confirmed address counts, then carry on where they were going. */
  async function continueAfterConfirm() {
    await supabase.auth.refreshSession();
    if (onAuthed) onAuthed();
    else navigate({ to: "/workspace", search: { tab: undefined } });
  }

  async function resendConfirmation() {
    const { error } = await supabase.auth.resend({ type: "signup", email: email.trim() });
    if (error) toast.error(error.message);
    else toast.success(`Sent again to ${email.trim()}.`);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (mode === "signup" && !passwordValid(password)) { setShowRules(true); toast.error("Your password needs to pass every check below."); return; }
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
            // The link names the plan, so confirming on another device still resumes the purchase in the workspace.
            emailRedirectTo: `${window.location.origin}/verified?next=${encodeURIComponent(planSignupNext(intent, returnPath ?? "/workspace?tab=health"))}`,
            data: { stage_name: stageName, legal_name: legalName },
          },
        });
        if (error) throw error;
        // Supabase hands back no session while "Confirm email" is on, and paying must not wait for the link (founder,
        // 2026-11-05): unverified sign-ins are allowed, so sign the new account in here and let the plan's checkout
        // open in this same sitting. The confirmation email is already on its way. If the sign-in is refused, the
        // inbox screen below is the fallback.
        if (data.session) await afterAuth();
        else {
          const { data: signedIn, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
          if (signInError || !signedIn.session) { setSent(true); return; }
          await afterAuth();
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        // So /login fills this address in next time, whichever box they used today.
        await afterAuth();
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
              We sent a confirmation link to <span className="font-semibold text-foreground">{email}</span>.{" "}
              {paid
                ? `${TIER_LABEL[PRICE_TIER[intent!]!]} checkout opens by itself the moment you click it, on this device or any other — no need to come back to this page.`
                : "Click it to open your workspace."}
            </p>
          )}
          {/* A buyer waiting on their inbox is where this flow loses people, so it gets a way forward, not just an
              instruction: the button re-checks the address and carries on to checkout (founder, 2026-11-05). */}
          {mode === "signup" && (
            <div className="space-y-2 pt-1">
              <Button className="w-full" onClick={() => void continueAfterConfirm()}>{paid ? "I've confirmed — open checkout" : "I've confirmed — open my workspace"}</Button>
              <button type="button" className="text-sm font-semibold text-primary" onClick={() => void resendConfirmation()}>Send the link again</button>
            </div>
          )}
          {mode === "forgot" && <button type="button" className="text-sm font-semibold text-primary" onClick={() => { setSent(false); setMode("login"); }}>Back to log in</button>}
        </div>
      ) : (
        <>
          <h2 className="text-2xl font-bold leading-tight">
            {mode === "signup" ? (
              paid
                ? <>Sign up and pay for {TIER_LABEL[PRICE_TIER[intent!]!]}<span className="mt-1 block text-lg font-normal text-primary">{paid.price} a year. Your account is created, then Stripe&apos;s checkout opens in the same step.</span></>
                : <>Musicians, sign up free.<span className="mt-1 block text-lg font-normal text-primary">Includes Free Unlimited Royalty Health Checks.</span></>
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
            {mode === "signup" ? <PasswordField id="password" value={password} onChange={setPassword} rules={showRules} />
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
              {busy ? "Please wait…" : mode === "signup" ? (paid ? `Sign up & pay ${paid.price}` : "Create my free account") : mode === "forgot" ? "Send reset link" : "Log in"}
            </Button>
            {mode === "signup" && (paid
              ? <p className="text-center text-xs text-muted-foreground">One step: your account is created, then you pay. Card details stay in Stripe.</p>
              : <p className="text-center text-xs text-muted-foreground">Free forever plan. No card needed.</p>)}
            {mode === "signup" && (
              <p className="text-center text-xs text-muted-foreground">
                By creating an account you agree to our{" "}
                <a className="font-semibold text-primary underline" href="/terms-of-service" target="_blank" rel="noreferrer">Terms of Service</a>{" "}
                and{" "}
                <a className="font-semibold text-primary underline" href="/privacy-policy" target="_blank" rel="noreferrer">Privacy Policy</a>,
                including how an artist seat shares catalog, split-sheet and contract access with the account that pays for it.
              </p>
            )}
          </form>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            {mode === "signup" ? "Already have an account?" : mode === "forgot" ? "Remembered it?" : "New here?"}{" "}
            <button type="button" className="font-semibold text-primary" onClick={() => setMode(mode === "signup" ? "login" : mode === "forgot" ? "login" : "signup")}>
              {mode === "signup" || mode === "forgot" ? "Log in" : paid ? "Sign up" : "Sign up free"}
            </button>
          </p>
        </>
      )}
    </div>
  );
}
