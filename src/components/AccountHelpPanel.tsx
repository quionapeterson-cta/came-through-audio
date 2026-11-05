import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { accountScope } from "@/lib/member-account";
import { findMemberAccount, memberCardLink, updateMemberProfile, type MemberAccount } from "@/lib/member-account.functions";
import type { StaffAccess } from "@/lib/departments";

const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString() : "—");

/**
 * Admin → Accounts (founder, 2026-11-05): Support fixes the person, Billing points them at the card page, super admins
 * do both. Nothing here changes a plan or a role, and no card number is ever typed by staff.
 */
export function AccountHelpPanel({ access }: { access: StaffAccess }) {
  const scope = accountScope(access);
  const [email, setEmail] = useState("");
  const [member, setMember] = useState<MemberAccount | null>(null);
  const [stage, setStage] = useState("");
  const [legal, setLegal] = useState("");
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState<string | null>(null);

  if (!scope) return null;

  async function find(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setLink(null);
    try {
      const found = await findMemberAccount({ data: { email } });
      setMember(found);
      setStage(found.stageName ?? "");
      setLegal(found.legalName ?? "");
    } catch (err) {
      setMember(null);
      toast.error(err instanceof Error ? err.message : "Couldn't find that account.");
    } finally { setBusy(false); }
  }

  async function save() {
    if (!member) return;
    setBusy(true);
    try {
      await updateMemberProfile({ data: { userId: member.userId, stageName: stage, legalName: legal } });
      setMember({ ...member, stageName: stage.trim() || null, legalName: legal.trim() || null });
      toast.success("Details saved.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save those details.");
    } finally { setBusy(false); }
  }

  async function cardLink() {
    if (!member) return;
    setBusy(true);
    try {
      const { url } = await memberCardLink({ data: { userId: member.userId } });
      setLink(url);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't open the billing page.");
    } finally { setBusy(false); }
  }

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="text-xl font-bold">Account help</h2>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Look a member up by the email they signed up with. {scope.label} can{" "}
          {scope.editProfile && scope.editPayment ? "correct their details and send the card-update link" : scope.editProfile ? "correct their names" : "send the card-update link"}.
          Plans still come from Stripe and staff access still comes from Admin → Staff.
        </p>
        <form onSubmit={find} className="mt-4 flex flex-wrap items-end gap-2">
          <div className="min-w-64 flex-1 space-y-2">
            <Label htmlFor="account-email">Member email</Label>
            <Input id="account-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="the email they signed up with" />
          </div>
          <Button type="submit" disabled={busy || email.trim().length < 3}>{busy ? "Looking…" : "Find account"}</Button>
        </form>
      </section>

      {member && (
        <section className="rounded-2xl border border-border bg-card p-5">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-bold">{member.stageName || member.legalName || member.email}</h3>
            <Badge variant="outline">{member.email}</Badge>
            {member.plan && <Badge variant="secondary">{member.plan.label} · {member.plan.status}</Badge>}
            {member.plan?.renewsOn && <span className="text-xs text-muted-foreground">renews {day(member.plan.renewsOn)}</span>}
          </div>

          {member.canEditProfile ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="stage-name">Stage name</Label>
                <Input id="stage-name" value={stage} onChange={(e) => setStage(e.target.value)} maxLength={120} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="legal-name">Legal name</Label>
                <Input id="legal-name" value={legal} onChange={(e) => setLegal(e.target.value)} maxLength={120} />
              </div>
              <div className="sm:col-span-2">
                <Button onClick={() => void save()} disabled={busy}>Save details</Button>
                <p className="mt-2 text-xs text-muted-foreground">
                  PRO, IPI numbers and splits are the member's own to change. Names here feed credits, exports and registration.
                </p>
              </div>
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">Billing can't change names. Ask Support if a name is wrong.</p>
          )}

          {member.canEditPayment && (
            <div className="mt-5 border-t border-border pt-4">
              <h4 className="font-semibold">Card on file</h4>
              <p className="mt-1 text-sm text-muted-foreground">
                Send the member this link. It opens Stripe's own page for their account, so staff never see or type a card number.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => void cardLink()} disabled={busy}>Send card-update link</Button>
                {link && (
                  <Button variant="ghost" onClick={() => { void navigator.clipboard.writeText(link); toast.success("Link copied."); }}>Copy link</Button>
                )}
              </div>
              {link && (
                <p className="mt-2 break-all rounded-lg bg-muted px-3 py-2 text-xs">{link}</p>
              )}
              <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
                {member.cardSteps.map((s) => <li key={s}>{s}</li>)}
              </ol>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
