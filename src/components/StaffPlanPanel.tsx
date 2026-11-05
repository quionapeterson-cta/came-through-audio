import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ALBUM_SONGS, STAFF_AI_CREDITS, STAFF_PLAN_TIER, STAFF_REGISTRATION_BATCH_MAX, STAFF_REGISTRATION_CREDITS, staffPlanLabel } from "@/lib/staff-plan";
import { decideStaffPlan, myStaffPlan, reportStaffMemberEmail, staffPlanQueue, type StaffGrant } from "@/lib/staff-plan.functions";
import { TIER_LABEL } from "@/lib/plans";
import type { StaffAccess } from "@/lib/departments";

const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString() : "—");

function Status({ grant }: { grant: StaffGrant }) {
  return (
    <Badge variant={grant.status === "active" ? "secondary" : "outline"}>
      {grant.status === "active" ? `Free until ${day(grant.endsAt)}` : grant.status === "pending" ? "Waiting for a super admin" : "Declined"}
    </Badge>
  );
}

/**
 * Admin → Staff Plan (founder, 2026-11-05): what the job includes, and the one thing each person has to do — report the
 * member account they already use, so it is marked staff and stops charging them. Super admins and HR review the queue.
 */
export function StaffPlanPanel({ access }: { access: StaffAccess }) {
  const qc = useQueryClient();
  const mine = useQuery({ queryKey: ["staff-plan-mine"], queryFn: () => myStaffPlan() });
  const queue = useQuery({ queryKey: ["staff-plan-queue"], queryFn: () => staffPlanQueue(), enabled: access.canManageStaff && access.role !== "employee" && access.role !== "department_lead" && access.role !== "project_manager" });
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = () => { void qc.invalidateQueries({ queryKey: ["staff-plan-mine"] }); void qc.invalidateQueries({ queryKey: ["staff-plan-queue"] }); };

  async function report(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await reportStaffMemberEmail({ data: { email } });
      setEmail("");
      toast.success("Reported. A super admin will mark it staff.");
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't report that email.");
    } finally { setBusy(false); }
  }

  async function decide(userId: string, approve: boolean) {
    setBusy(true);
    try {
      const res = await decideStaffPlan({ data: { userId, approve } });
      toast.success(approve ? "Marked as staff. They keep their paid year first." : "Declined.");
      if (approve && res.window) toast.info(`Free from ${day(res.window.startsAt)} until ${day(res.window.endsAt)}.`);
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save that decision.");
    } finally { setBusy(false); }
  }

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="text-xl font-bold">Your staff plan</h2>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          {TIER_LABEL[STAFF_PLAN_TIER]} is free while you work at Came Through Audio ({STAFF_PLAN_TIER}), with the brand kit
          and the contract generator included. On top of that: one album of AI Protection credits a year, and two albums of
          song registrations a year, spent one song at a time but never more than {STAFF_REGISTRATION_BATCH_MAX} in one batch.
          The founder issues those; ask before you rely on them.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Badge variant="secondary">Brand kit included</Badge>
          <Badge variant="secondary">Contract generator included</Badge>
          <Badge variant="outline">AI credits · {STAFF_AI_CREDITS} songs</Badge>
          <Badge variant="outline">Registrations · {STAFF_REGISTRATION_CREDITS} songs a year</Badge>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          One album is {ALBUM_SONGS} songs — the same size as our Album package, not a new number.
        </p>
        {mine.data?.own && (
          <p className="mt-4 text-sm"><span className="font-semibold">This account:</span> {staffPlanLabel(mine.data.own.startsAt && mine.data.own.endsAt ? { starts_at: mine.data.own.startsAt, ends_at: mine.data.own.endsAt } : null)} <Status grant={mine.data.own} /></p>
        )}
      </section>

      <section className="rounded-2xl border border-border bg-card p-5">
        <h3 className="text-lg font-bold">Already have a member account?</h3>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Your staff login is separate. If you also have the artist account you had before, report its email here: it gets
          marked as staff and moves to the free staff plan. You finish the year you already paid for first, and the staff
          year is measured from that billing cycle's start.
        </p>
        <form onSubmit={report} className="mt-3 flex flex-wrap items-end gap-2">
          <div className="min-w-64 flex-1 space-y-2">
            <Label htmlFor="staff-member-email">Your member account email</Label>
            <Input id="staff-member-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="the email you use as an artist" />
          </div>
          <Button type="submit" disabled={busy || email.trim().length < 3}>{busy ? "Sending…" : "Report email"}</Button>
        </form>
        {!!mine.data?.reported.length && (
          <ul className="mt-3 space-y-1 text-sm">
            {mine.data.reported.map((g) => (
              <li key={g.userId} className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{g.memberEmail}</span><Status grant={g} />
                {g.status === "active" && g.startsAt && <span className="text-xs text-muted-foreground">starts {day(g.startsAt)}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>

      {access.canManageStaff && (
        <section className="rounded-2xl border border-border bg-card p-5">
          <h3 className="text-lg font-bold">Reported accounts</h3>
          <p className="mt-1 text-sm text-muted-foreground">A super admin or HR marks each account as staff. Approving keeps any paid time in place first.</p>
          {queue.isError && <p className="mt-3 text-sm text-destructive">Couldn't load the queue.</p>}
          {!queue.data?.grants.length && !queue.isError && <p className="mt-3 text-sm text-muted-foreground">Nothing reported yet.</p>}
          <ul className="mt-3 divide-y divide-border">
            {queue.data?.grants.map((g) => (
              <li key={g.userId} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <div>
                  <div className="font-medium">{g.memberEmail}</div>
                  <div className="text-xs text-muted-foreground">
                    {g.status} · {g.status === "active" ? `${day(g.startsAt)} to ${day(g.endsAt)}` : `reported ${day(g.reportedAt)}`}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Status grant={g} />
                  {g.status === "pending" && (
                    <>
                      <Button size="sm" disabled={busy} onClick={() => void decide(g.userId, true)}>Mark staff</Button>
                      <Button size="sm" variant="outline" disabled={busy} onClick={() => void decide(g.userId, false)}>Decline</Button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
