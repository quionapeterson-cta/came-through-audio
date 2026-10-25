import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState, type ReactNode } from "react";
import { ArrowLeft, Lock, Pencil, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { BrandLogo } from "@/components/BrandLogo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getStaffRole } from "@/lib/admin.functions";
import { inviteStaff, listStaff, removeStaff, updateStaff, type StaffMember } from "@/lib/staff.functions";
import { DEPARTMENTS, DEPARTMENT_LABEL, MANAGED_ROLES, ROLE_LABEL, type Department, type ManagedRole, ASSIGNABLE_DEPARTMENTS } from "@/lib/departments";

// Staff management. Sits under the root /unlock gate like every route; access is super_admin or hr_admin.
export const Route = createFileRoute("/admin_/staff")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Staff Management — Came Through Audio" },
      { name: "description", content: "Invite employees and assign roles and departments." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: StaffPage,
});

type Editing = { mode: "invite" } | { mode: "edit"; member: StaffMember };

function StaffPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  useEffect(() => { if (!loading && !user) navigate({ to: "/" }); }, [loading, user, navigate]);

  const role = useQuery({ queryKey: ["staff-role", user?.id], queryFn: () => getStaffRole(), enabled: !!user });
  const fetchStaff = useServerFn(listStaff);
  const staff = useQuery({ queryKey: ["staff-list"], queryFn: () => fetchStaff(), enabled: !!role.data?.canManageStaff });
  const [editing, setEditing] = useState<Editing | null>(null);
  const [removing, setRemoving] = useState<StaffMember | null>(null);

  const qc = useQueryClient();
  const remove = useServerFn(removeStaff);
  const removeMut = useMutation({
    mutationFn: (m: StaffMember) => remove({ data: { userId: m.userId } }),
    onSuccess: (_r, m) => { toast.success(`${m.email} no longer has staff access.`); qc.invalidateQueries({ queryKey: ["staff-list"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Couldn't remove staff access."),
    onSettled: () => setRemoving(null),
  });

  if (loading || !user || role.isLoading) return <Center>Loading…</Center>;
  if (!role.data?.canManageStaff) {
    return (
      <Center>
        <Lock className="h-8 w-8 text-primary" />
        <p className="font-semibold">Super Admin or HR Admin only</p>
        <Button asChild><Link to="/admin">Back to dashboard</Link></Button>
      </Center>
    );
  }

  const data = staff.data;
  const canEdit = (m: StaffMember) => !!data && m.userId !== data.me && m.role !== "super_admin" && (data.actorIsSuper || m.role !== "hr_admin");

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-ink text-ink-foreground">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-3">
            <BrandLogo showName={false} />
            <div>
              <div className="text-xs uppercase tracking-widest text-ink-muted">Came Through Audio · HR</div>
              <div className="text-xl font-bold">Staff Management</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="border-ink-border text-ink-foreground">{ROLE_LABEL[role.data.role]}</Badge>
            <Button asChild variant="ghost" className="text-ink-muted hover:bg-ink-border hover:text-ink-foreground">
              <Link to="/admin"><ArrowLeft className="h-4 w-4" />Dashboard</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="text-muted-foreground">Invite employees and choose what they can see. Changes apply on their next page load.</p>
          <Button onClick={() => setEditing({ mode: "invite" })}><UserPlus className="h-4 w-4" />Invite Employee</Button>
        </div>

        {staff.isError && <p className="mt-6 text-destructive">Couldn't load staff.</p>}
        {!data && !staff.isError && <p className="mt-6 text-muted-foreground">Loading…</p>}
        {data && (
          <div className="mt-6 overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted text-left">
                <tr>{["Email", "Name", "Role", "Departments", "Status", ""].map((h) => <th key={h} className="px-4 py-3 font-semibold">{h}</th>)}</tr>
              </thead>
              <tbody>
                {data.members.map((m) => (
                  <tr key={m.userId} className="border-t border-border align-top">
                    <td className="px-4 py-3 font-medium">{m.email}{m.userId === data.me && <span className="text-muted-foreground"> (you)</span>}</td>
                    <td className="px-4 py-3">{m.name ?? "—"}</td>
                    <td className="px-4 py-3"><Badge variant="outline" className="border-primary text-primary">{ROLE_LABEL[m.role]}</Badge></td>
                    <td className="px-4 py-3">
                      {m.role === "super_admin" ? <span className="text-muted-foreground">All departments</span> : (
                        <div className="flex flex-wrap gap-1">{m.departments.map((d) => <Badge key={d} variant="secondary">{DEPARTMENT_LABEL[d]}</Badge>)}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">{m.joined ? "Active" : <span className="text-muted-foreground">Invited</span>}</td>
                    <td className="px-4 py-3">
                      {canEdit(m) && (
                        <div className="flex justify-end gap-1">
                          <Button size="icon" variant="ghost" aria-label={`Edit ${m.email}`} onClick={() => setEditing({ mode: "edit", member: m })}><Pencil className="h-4 w-4" /></Button>
                          <Button size="icon" variant="ghost" aria-label={`Remove ${m.email}`} className="text-destructive hover:text-destructive" onClick={() => setRemoving(m)}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {editing && <StaffDialog editing={editing} actorIsSuper={!!data?.actorIsSuper} onClose={() => setEditing(null)} />}

      <AlertDialog open={!!removing} onOpenChange={(o) => { if (!o) setRemoving(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {removing?.email} from staff?</AlertDialogTitle>
            <AlertDialogDescription>They lose dashboard access right away. Their regular account stays.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" disabled={removeMut.isPending}
              onClick={(e) => { e.preventDefault(); if (removing) removeMut.mutate(removing); }}>Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function StaffDialog({ editing, actorIsSuper, onClose }: { editing: Editing; actorIsSuper: boolean; onClose: () => void }) {
  const member = editing.mode === "edit" ? editing.member : null;
  const [email, setEmail] = useState(member?.email ?? "");
  const [role, setRole] = useState<ManagedRole>(member && member.role !== "super_admin" ? member.role : "employee");
  const [departments, setDepartments] = useState<Department[]>(member?.departments ?? []);
  const isHr = role === "hr_admin";

  const qc = useQueryClient();
  const invite = useServerFn(inviteStaff);
  const update = useServerFn(updateStaff);
  const save = useMutation({
    mutationFn: async () => {
      if (member) { await update({ data: { userId: member.userId, role, departments } }); return null; }
      return invite({ data: { email, role, departments } });
    },
    onSuccess: (res) => {
      if (!member) toast.success(res?.emailed ? `Invite sent to ${email}.` : `${email} added. The invite email couldn't be sent — ask them to sign in with this email.`);
      else toast.success("Access updated.");
      qc.invalidateQueries({ queryKey: ["staff-list"] });
      onClose();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Couldn't save."),
  });

  const toggle = (d: Department, on: boolean) => setDepartments((cur) => (on ? [...cur, d] : cur.filter((x) => x !== d)));
  const valid = (member || /\S+@\S+\.\S+/.test(email)) && (isHr || departments.length > 0);

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent>
        <form onSubmit={(e) => { e.preventDefault(); if (valid) save.mutate(); }} className="space-y-5">
          <DialogHeader>
            <DialogTitle>{member ? "Edit staff access" : "Invite Employee"}</DialogTitle>
            <DialogDescription>{member ? member.email : "We'll email them a branded invite to set up their account."}</DialogDescription>
          </DialogHeader>

          {!member && (
            <div className="space-y-2">
              <Label htmlFor="staff-email">Email</Label>
              <Input id="staff-email" type="email" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@camethroughaudio.com" />
            </div>
          )}

          <div className="space-y-2">
            <Label>Role</Label>
            <Select value={role} onValueChange={(v) => setRole(v as ManagedRole)}>
              <SelectTrigger aria-label="Role"><SelectValue /></SelectTrigger>
              <SelectContent>
                {MANAGED_ROLES.map((r) => (
                  <SelectItem key={r} value={r} disabled={r === "hr_admin" && !actorIsSuper}>
                    {ROLE_LABEL[r]}{r === "hr_admin" && !actorIsSuper ? " (super admin only)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Departments</legend>
            {isHr ? (
              <p className="text-sm text-muted-foreground">HR Admins manage staff only — they don't see Finance, settings or department queues.</p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {ASSIGNABLE_DEPARTMENTS.map((d) => (
                  <label key={d} className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm has-[:checked]:border-primary">
                    <Checkbox checked={departments.includes(d)} onCheckedChange={(v) => toggle(d, v === true)} />
                    {DEPARTMENT_LABEL[d]}
                  </label>
                ))}
              </div>
            )}
          </fieldset>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={!valid || save.isPending}>{save.isPending ? "Saving…" : member ? "Save" : "Send invite"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Center({ children }: { children: ReactNode }) {
  return <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background text-muted-foreground">{children}</div>;
}
