import { useState } from "react";
import { MailCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

/**
 * The confirmation link is a reminder, not a gate (founder, 2026-11-05): paying comes first, so this sits above the
 * workspace until the address is confirmed. Everything they paid for already works; confirming is what keeps the login
 * and the password reset reaching them.
 */
export function EmailConfirmBanner({ email }: { email?: string | null | undefined }) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  if (done) return null;

  async function resend() {
    if (!email) return;
    setBusy(true);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email,
        options: { emailRedirectTo: `${window.location.origin}/verified?next=/workspace` },
      });
      if (error) toast.error(error.message);
      else toast.success(`Sent again to ${email}.`);
    } catch (err) {
      // A dropped request must not leave the button disabled for the rest of the visit.
      toast.error(err instanceof Error ? err.message : "Couldn't send it again. Try once more.");
    } finally {
      setBusy(false);
    }
  }

  async function check() {
    setBusy(true);
    try {
      const { data } = await supabase.auth.refreshSession();
      if (data.user?.email_confirmed_at) {
        setDone(true);
        toast.success("Email confirmed. You're all set.");
      } else toast.error("Not confirmed yet. Open the link in your inbox, then try again.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't check that. Try once more.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/40 bg-primary/10 px-4 py-3">
      <p className="flex items-center gap-2 text-sm">
        <MailCheck className="h-4 w-4 shrink-0 text-primary" />
        <span>
          We emailed a confirmation link to <span className="font-semibold">{email}</span>.
          Everything on your account works now; confirming the address is what keeps your login and
          password reset reaching you.
        </span>
      </p>
      <div className="flex shrink-0 gap-2">
        <Button size="sm" variant="outline" disabled={busy} onClick={() => void resend()}>
          Send it again
        </Button>
        <Button size="sm" disabled={busy} onClick={() => void check()}>
          I&apos;ve confirmed
        </Button>
      </div>
    </div>
  );
}
