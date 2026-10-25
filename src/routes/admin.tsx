import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { ShieldCheck, Building2, FileSignature, Receipt, Users, ArrowLeft, Lock } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Contracts } from "@/components/Contracts";
import { BrandLogo } from "@/components/BrandLogo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getAdminOverview, getStaffRole } from "@/lib/admin.functions";
import { DEPARTMENTS, DEPARTMENT_LABEL, ROLE_LABEL, viewDepartments, visibleTabs, type Department } from "@/lib/departments";
import { SupportTicketsPanel } from "@/components/SupportTicketsPanel";
import { BadgeSwitchboard } from "@/components/BadgeSwitchboard";
import { PlansPanel } from "@/components/PlansPanel";
import { TestimonialFilterPanel } from "@/components/TestimonialFilterPanel";
import { TestimonialsEditor } from "@/components/TestimonialsEditor";
import { AdminWelcome, TaskBell } from "@/components/AdminWelcome";
import { TaskBankPanel } from "@/components/TaskBankPanel";
import { RegistrationQueuePanel } from "@/components/RegistrationQueuePanel";
import { supabase } from "@/integrations/supabase/client";

/** Founding 100 seats used in each mode (PLAN-founding-upgrades); hidden until the migration runs. */
function FoundingSeats() {
  const { data } = useQuery({
    queryKey: ["founding-spots"],
    queryFn: async () => {
      const rows = await Promise.all((["live", "sandbox"] as const).map(async (env) => {
        const { data: r } = await supabase.rpc("founding_spots" as never, { _env: env } as never);
        return ((r ?? []) as unknown as { paid_tier: string; taken: number }[]).map((x) => ({ env, ...x }));
      }));
      return rows.flat();
    },
  });
  if (!data?.length) return null;
  const seats = (env: string, t: string) => data.find((x) => x.env === env && x.paid_tier === t)?.taken ?? 0;
  return (
    <p className="mb-4 text-sm text-muted-foreground">
      Founding seats: live Plus {seats("live", "plus")}/100 · live Collaborate {seats("live", "collaborate")}/100 · sandbox Plus {seats("sandbox", "plus")} · sandbox Collaborate {seats("sandbox", "collaborate")}
    </p>
  );
}

export const Route = createFileRoute("/admin")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Admin Dashboard — Came Through Audio" },
      { name: "description", content: "Staff dashboard for AI protection, agency registrations, split sheets and purchases." },
      { property: "og:title", content: "Admin Dashboard — Came Through Audio" },
      { property: "og:description", content: "Internal staff dashboard for Came Through Audio." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPage,
});

const fmt = (d?: string | null) => (d ? new Date(d).toLocaleDateString() : "—");

function AdminPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  useEffect(() => { if (!loading && !user) navigate({ to: "/" }); }, [loading, user, navigate]);

  const role = useQuery({ queryKey: ["staff-role", user?.id], queryFn: () => getStaffRole(), enabled: !!user });
  const access = role.data;
  const overview = useQuery({ queryKey: ["admin-overview", user?.id], queryFn: () => getAdminOverview(), enabled: !!access && access.role !== "hr_admin" });
  const [view, setView] = useState<Department | "all">("all");
  const [activeTab, setActiveTab] = useState<string>();
  useEffect(() => setActiveTab(undefined), [view]);

  if (loading || !user || role.isLoading) return <Center>Loading…</Center>;
  if (!access) {
    return (
      <Center>
        <Lock className="h-8 w-8 text-primary" />
        <p className="font-semibold">Staff access only</p>
        <Button asChild><Link to="/workspace">Back to workspace</Link></Button>
      </Center>
    );
  }

  const d = overview.data;
  const pendingSigs = d?.splits.filter((s) => !s.is_owner && !s.signed_at).length ?? 0;
  const tabs = visibleTabs(access, view);
  const show = (value: string) => tabs.some((t) => t.value === value);
  const isSuper = access.role === "super_admin";

  return (
    <div className="min-h-screen bg-background">
      {show("tasks") && <AdminWelcome me={user.id} onOpenTasks={() => setActiveTab("tasks")} />}
      <header className="bg-ink text-ink-foreground">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-3">
            <BrandLogo showName={false} />
            <div>
              <div className="text-xs uppercase tracking-widest text-ink-muted">Came Through Audio</div>
              <div className="text-xl font-bold">Admin Dashboard</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {show("tasks") && <TaskBell me={user.id} onOpenTasks={() => setActiveTab("tasks")} />}
            {isSuper && (
              <Select value={view} onValueChange={(v) => setView(v as Department | "all")}>
                <SelectTrigger aria-label="Department" className="w-48 border-ink-border bg-transparent text-ink-foreground"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DEPARTMENTS.map((dep) => <SelectItem key={dep} value={dep}>{DEPARTMENT_LABEL[dep]}</SelectItem>)}
                  <SelectItem value="all">All departments</SelectItem>
                </SelectContent>
              </Select>
            )}
            <Badge variant="outline" className="border-ink-border text-ink-foreground">{ROLE_LABEL[access.role]}</Badge>
            {access.canManageStaff && (
              <Button asChild variant="ghost" className="text-ink-muted hover:bg-ink-border hover:text-ink-foreground">
                <Link to="/admin/staff"><Users className="h-4 w-4" />Staff</Link>
              </Button>
            )}
            <Button asChild variant="ghost" className="text-ink-muted hover:bg-ink-border hover:text-ink-foreground">
              <Link to="/workspace"><ArrowLeft className="h-4 w-4" />Workspace</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">
        {!isSuper && (
          <div className="mb-6 flex flex-wrap gap-2">
            {access.departments.map((dep) => <Badge key={dep} variant="secondary">{DEPARTMENT_LABEL[dep]}</Badge>)}
          </div>
        )}

        {!tabs.length ? (
          <div className="rounded-2xl border border-border bg-card p-8 text-center text-muted-foreground">
            {access.canManageStaff && view === "all"
              ? <>Manage employees, roles and departments from <Link to="/admin/staff" className="font-semibold text-primary">Staff</Link>.</>
              : access.departments.length ? "No dashboard tools for this department yet." : "You haven't been assigned a department yet. Ask HR or an admin."}
          </div>
        ) : (<>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {show("ai") && <Stat icon={<ShieldCheck />} label="AI certificates" value={d?.certificates.length} />}
          {show("reg") && <Stat icon={<Building2 />} label="Registrations pending" value={d?.registrations.filter((r) => r.status === "pending_review").length} />}
          {show("splits") && <Stat icon={<FileSignature />} label="Signatures pending" value={pendingSigs} />}
          {show("purchases") && <Stat icon={<Receipt />} label="Purchases" value={d?.purchases.length} />}
        </div>

        {overview.isError && <p className="mt-6 text-destructive">Couldn't load dashboard data.</p>}

        <Tabs key={view} value={activeTab && show(activeTab) ? activeTab : tabs[0]!.value} onValueChange={setActiveTab} className="mt-8">
          <TabsList className="h-auto flex-wrap justify-start gap-1 bg-muted p-1">
            {tabs.map((t) => (
              <TabsTrigger key={t.value} value={t.value} className="font-semibold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">{t.label}</TabsTrigger>
            ))}
          </TabsList>
          <TabsContent value="ai">
            <Table head={["Track", "Artist", "Package", "Blockchain", "Verified", "Issued"]}
              rows={d?.certificates.map((c) => [c.track_title ?? "—", c.artist_name ?? "—", c.format_type, c.blockchain_status, c.is_verified ? "Yes" : "No", fmt(c.issued_at)])} />
          </TabsContent>
          <TabsContent value="reg">
            {show("reg") && <RegistrationQueuePanel />}
            {!!d?.registrations.length && <>
              <h3 className="mt-8 font-semibold">Earlier requests</h3>
              <Table head={["Agency", "Status", "Authorization signed", "Created"]}
                rows={d.registrations.map((r) => [r.target_agency, r.status ?? "—", r.has_signed_authorization ? "Yes" : "No", fmt(r.created_at)])} />
            </>}
          </TabsContent>
          <TabsContent value="splits">
            <Table head={["Email", "Role", "Share", "Type", "Status"]}
              rows={d?.splits.map((s) => [s.collaborator_email, s.role, `${s.assigned_percentage}%`, s.is_owner ? "Owner" : "Collaborator", s.signed_at ? `Signed ${fmt(s.signed_at)}` : "Pending"])} />
          </TabsContent>
          <TabsContent value="purchases">
            <FoundingSeats />
            <Table head={["Type", "Mode", "Status", "Date"]} rows={d?.purchases.map((p) => [p.type, p.environment, p.status, fmt(p.created_at)])} />
          </TabsContent>
          {show("support") && <TabsContent value="support"><SupportTicketsPanel /></TabsContent>}
          {show("badges") && <TabsContent value="badges"><BadgeSwitchboard /></TabsContent>}
          {show("homepage") && <TabsContent value="homepage"><TestimonialsEditor /><TestimonialFilterPanel /></TabsContent>}
          {show("tasks") && <TabsContent value="tasks"><TaskBankPanel departments={viewDepartments(access, view)} /></TabsContent>}
          {show("company") && <TabsContent value="company"><Contracts userId={user.id} unlocked company onUpgrade={() => {}} /></TabsContent>}
          {show("plans") && <TabsContent value="plans"><PlansPanel /></TabsContent>}
        </Tabs>
        </>)}
      </main>
    </div>
  );
}

function Center({ children }: { children: ReactNode }) {
  return <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background text-muted-foreground">{children}</div>;
}

function Stat({ icon, label, value }: { icon: ReactNode; label: string; value: number | undefined }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center gap-2 text-primary [&_svg]:h-5 [&_svg]:w-5">{icon}<span className="text-sm text-muted-foreground">{label}</span></div>
      <div className="mt-2 text-3xl font-bold text-foreground">{value ?? "—"}</div>
    </div>
  );
}

function Table({ head, rows }: { head: string[]; rows: string[][] | undefined }) {
  if (!rows) return <p className="mt-6 text-muted-foreground">Loading…</p>;
  if (!rows.length) return <p className="mt-6 text-muted-foreground">Nothing here yet.</p>;
  return (
    <div className="mt-4 overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted text-left"><tr>{head.map((h) => <th key={h} className="px-4 py-3 font-semibold">{h}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i} className="border-t border-border">{r.map((c, j) => <td key={j} className="px-4 py-3">{c}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}
