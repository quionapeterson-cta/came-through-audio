import { createFileRoute, Link } from "@tanstack/react-router";
import { MyQueue } from "@/components/MyQueue";
import { AdminNavMobile, AdminSidebar } from "@/components/AdminSidebar";
import { TeamBoard } from "@/components/TeamBoard";
import { WinFeed } from "@/components/WinFeed";
import { tabLabel } from "@/lib/admin-nav";
import { Handbook } from "@/components/Handbook";
import { PdfTools } from "@/components/PdfTools";
import { LegalEditor } from "@/components/LegalEditor";
import { AdminCalendar } from "@/components/AdminCalendar";
import { MyRecognition } from "@/components/MyRecognition";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { ShieldCheck, Building2, FileSignature, Receipt, Users, ArrowLeft, Lock } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Contracts } from "@/components/Contracts";
import { CompanyMail } from "@/components/CompanyMail";
import { BrandLogo } from "@/components/BrandLogo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { getAdminOverview, getStaffRole } from "@/lib/admin.functions";
import { ASSIGNABLE_DEPARTMENTS, DEPARTMENTS, DEPARTMENT_LABEL, ROLE_LABEL, viewDepartments, visibleTabs, type Department } from "@/lib/departments";
import { SupportTicketsPanel } from "@/components/SupportTicketsPanel";
import { SupportScriptsPanel } from "@/components/SupportScriptsPanel";
import { BadgeSwitchboard } from "@/components/BadgeSwitchboard";
import { BadgeProtocolPanel } from "@/components/BadgeProtocolPanel";
import { StaffSubmissionsPanel } from "@/components/StaffSubmissionsPanel";
import { BillingConsolePanel } from "@/components/BillingConsolePanel";
import { PlansPanel } from "@/components/PlansPanel";
import { TestimonialFilterPanel } from "@/components/TestimonialFilterPanel";
import { TestimonialsEditor } from "@/components/TestimonialsEditor";
import { AdminWelcome, TaskBell, WelcomeSwitch } from "@/components/AdminWelcome";
import { AccountHelpPanel } from "@/components/AccountHelpPanel";
import { HolidayPlan } from "@/components/HolidayPlan";
import { StaffPlanPanel } from "@/components/StaffPlanPanel";
import { TaskBankPanel } from "@/components/TaskBankPanel";
import { RegistrationQueuePanel } from "@/components/RegistrationQueuePanel";
import { PriceList } from "@/components/PriceList";
import { SocialPanel } from "@/components/SocialPanel";
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

  const role = useQuery({ queryKey: ["staff-role", user?.id], queryFn: () => getStaffRole(), enabled: !!user });
  const access = role.data;
  const overview = useQuery({ queryKey: ["admin-overview", user?.id], queryFn: () => getAdminOverview(), enabled: !!access && access.role !== "hr_admin" });
  const [view, setView] = useState<Department | "all">("all");
  const [activeTab, setActiveTab] = useState<string>();
  useEffect(() => setActiveTab(undefined), [view]);

  if (loading || role.isLoading) return <Center>Loading…</Center>;
  // Signed out used to bounce straight to the homepage with no explanation, so a bookmarked /admin looked broken. It now
  // says what Admin needs and offers the way in; a member account without a role still lands on the staff gate below.
  if (!user) {
    return (
      <Center>
        <Lock className="h-8 w-8 text-primary" />
        <p className="font-semibold">Staff sign-in needed</p>
        <p className="max-w-sm text-center text-sm text-muted-foreground">
          Admin is separate from a member account. Log in with the work email your invite was sent to.
        </p>
        <Button asChild><Link to="/login">Log in</Link></Button>
        <Link to="/" className="text-sm font-semibold text-primary">Back to the site</Link>
      </Center>
    );
  }
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
  // Undefined while the overview is loading or has failed, so the tile reads "—" like the others instead of a wrong 0
  // for a backlog that does exist (the database held 1 unsigned split while this showed 0).
  const pendingSigs = d ? d.splits.filter((s) => !s.is_owner && !s.signed_at).length : undefined;
  const tabs = visibleTabs(access, view);
  const show = (value: string) => tabs.some((t) => t.value === value);
  const isSuper = access.role === "super_admin";
  const current = activeTab && show(activeTab) ? activeTab : (tabs[0]?.value ?? "");
  // Only the tabs whose numbers come from the overview carry its tiles and its error. A failed overview used to sit above
  // unrelated work — Handbook, Email, My Queue — and made the whole dashboard read as broken.
  const usesOverview = ["ai", "reg", "splits", "purchases"].includes(current);

  return (
    <div className="min-h-screen bg-background">
      {show("tasks") && <AdminWelcome me={user.id} onOpenTasks={() => setActiveTab("tasks")} />}
      <header className="bg-ink text-ink-foreground">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-3">
            <BrandLogo showName={false} />
            <AdminNavMobile tabs={tabs} active={current} onSelect={setActiveTab} access={access} />
            <div>
              <div className="text-xs uppercase tracking-widest text-ink-muted">Came Through Audio</div>
              <div className="text-xl font-bold">Admin Dashboard</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {show("tasks") && <WelcomeSwitch />}
            <WinFeed me={user.id} />
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

      <div className="mx-auto flex max-w-[100rem] gap-8 px-4 py-6 sm:px-6">
        <AdminSidebar tabs={tabs} active={current} onSelect={setActiveTab} access={access} />
        <main className="min-w-0 flex-1">
        <h1 className="text-2xl font-bold tracking-tight">{tabLabel(tabs, current)}</h1>
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
        {usesOverview && <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {show("ai") && <Stat icon={<ShieldCheck />} label="AI certificates" value={d?.certificates.length} />}
          {show("reg") && <Stat icon={<Building2 />} label="Registrations pending" value={d?.registrations.filter((r) => r.status === "pending_review").length} />}
          {show("splits") && <Stat icon={<FileSignature />} label="Signatures pending" value={pendingSigs} />}
          {show("purchases") && <Stat icon={<Receipt />} label="Purchases" value={d?.purchases.length} />}
        </div>}

        {usesOverview && overview.isError && <p className="mt-6 text-destructive">Couldn't load dashboard data.</p>}

        <Tabs key={view} value={current} onValueChange={setActiveTab} className="mt-6">
          <TabsContent value="ai">
            <Table head={["Track", "Artist", "Package", "Blockchain", "Verified", "Issued"]} failed={overview.isError}
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
            <Table head={["Email", "Role", "Share", "Type", "Status"]} failed={overview.isError}
              rows={d?.splits.map((s) => [s.collaborator_email, s.role, `${s.assigned_percentage}%`, s.is_owner ? "Owner" : "Collaborator", s.signed_at ? `Signed ${fmt(s.signed_at)}` : "Pending"])} />
          </TabsContent>
          <TabsContent value="purchases">
            <FoundingSeats />
            <Table head={["Type", "Mode", "Status", "Date"]} failed={overview.isError} rows={d?.purchases.map((p) => [p.type, p.environment, p.status, fmt(p.created_at)])} />
          </TabsContent>
          {show("billing") && <TabsContent value="billing"><BillingConsolePanel isSuper={isSuper} /></TabsContent>}
          {show("support") && <TabsContent value="support"><SupportTicketsPanel scope={access.departments.includes("support") ? "all" : "billing"} /></TabsContent>}
          {show("badges") && <TabsContent value="badges"><BadgeSwitchboard /><BadgeProtocolPanel isSuper={isSuper} /></TabsContent>}
          {show("homepage") && <TabsContent value="homepage"><TestimonialsEditor /><TestimonialFilterPanel /><SocialPanel /></TabsContent>}
          {show("tasks") && <TabsContent value="tasks"><TaskBankPanel departments={access.allTeams && access.role !== "super_admin" ? [...ASSIGNABLE_DEPARTMENTS] : viewDepartments(access, view)} editable={viewDepartments(access, view)} /></TabsContent>}
          {show("company") && <TabsContent value="company"><Contracts userId={user.id} unlocked company onUpgrade={() => {}} /></TabsContent>}
          {show("submissions") && <TabsContent value="submissions"><StaffSubmissionsPanel isSuper={isSuper} /></TabsContent>}
          {show("plans") && <TabsContent value="plans"><PlansPanel /></TabsContent>}
          {show("accounts") && <TabsContent value="accounts"><AccountHelpPanel access={access} /></TabsContent>}
          {show("holiday") && <TabsContent value="holiday"><HolidayPlan /></TabsContent>}
          {show("calendar") && <TabsContent value="calendar"><AdminCalendar me={user.id} access={access} /></TabsContent>}
          {show("recognition") && <TabsContent value="recognition"><MyRecognition /></TabsContent>}
          {show("queue") && <TabsContent value="queue"><MyQueue me={user.id} access={access} onOpen={setActiveTab} /></TabsContent>}
          {show("team") && <TabsContent value="team"><TeamBoard /></TabsContent>}
          {show("handbook") && <TabsContent value="handbook"><Handbook /></TabsContent>}
          {show("staff-plan") && <TabsContent value="staff-plan"><StaffPlanPanel access={access} /></TabsContent>}
          {show("scripts") && <TabsContent value="scripts"><SupportScriptsPanel /></TabsContent>}
          {show("prices") && <TabsContent value="prices"><PriceList /></TabsContent>}
          {show("pdf") && <TabsContent value="pdf"><PdfTools /></TabsContent>}
          {show("email") && <TabsContent value="email"><CompanyMail /></TabsContent>}
          {show("legal") && <TabsContent value="legal"><LegalEditor /></TabsContent>}
        </Tabs>
        </>)}
        </main>
      </div>
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

function Table({ head, rows, failed }: { head: string[]; rows: string[][] | undefined; failed?: boolean }) {
  // A failed overview used to sit on "Loading…" forever, so the tab read as broken rather than as a section that
  // couldn't load. The failure now says so, and only a real fetch in flight shows "Loading…".
  if (failed && !rows) return <p className="mt-6 text-destructive">Couldn't load this section.</p>;
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
