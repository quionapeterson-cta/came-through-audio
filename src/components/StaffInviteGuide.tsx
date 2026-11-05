import { Badge } from "@/components/ui/badge";
import { ACCEPT_STEPS, INVITE_STEPS, STAFF_EMAIL_RULE } from "@/lib/staff-invites";

/**
 * Admin → Staff, above the list: the exact order an invite goes in, for HR and super admins, so the person who joins
 * isn't the one figuring out what to do when the link opens.
 */
export function StaffInviteGuide() {
  return (
    <section className="mt-6 rounded-2xl border border-border bg-card p-5">
      <h2 className="text-lg font-bold">How to invite someone</h2>
      <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{STAFF_EMAIL_RULE}</p>
      <div className="mt-4 grid gap-5 md:grid-cols-2">
        <div>
          <h3 className="text-sm font-semibold">HR or super admin</h3>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
            {INVITE_STEPS.map((s) => <li key={s}>{s}</li>)}
          </ol>
        </div>
        <div>
          <h3 className="text-sm font-semibold">What the new starter does</h3>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
            {ACCEPT_STEPS.map((s) => <li key={s}>{s}</li>)}
          </ol>
          <p className="mt-3 text-xs text-muted-foreground">
            The link opens our own page, never a sign-up form. If it expires, Forgot password on the login page sends a
            branded email from admin@camethroughaudio.com.
          </p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Badge variant="outline">One email, one identity</Badge>
        <Badge variant="secondary">Invite expires</Badge>
        <Badge variant="secondary">Separate from any member account</Badge>
      </div>
    </section>
  );
}
