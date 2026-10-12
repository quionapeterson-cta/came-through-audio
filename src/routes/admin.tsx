import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, type ReactNode } from "react";
import { ShieldCheck, Building2, FileSignature, Receipt, Users, ArrowLeft, Lock } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { BrandLogo } from "@/components/BrandLogo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getAdminOverview, getStaffRole } from "@/lib/admin.functions";

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
  const overview = useQuery({ queryKey: ["admin-overview"], queryFn: () => getAdminOverview(), enabled: !!role.data });

  if (loading || !user || role.isLoading) return <Center>Loading…</Center>;
  if (!role.data) {
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

  return (
    <div className="min-h-screen bg-background">
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
            <Badge variant="outline" className="border-ink-border text-ink-foreground">{role.data === "super_admin" ? "Super Admin" : "Employee"}</Badge>
            <Button asChild variant="ghost" className="text-ink-muted hover:bg-ink-border hover:text-ink-foreground">
              <Link to="/workspace"><ArrowLeft className="h-4 w-4" />Workspace</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Stat icon={<ShieldCheck />} label="AI certificates" value={d?.certificates.length} />
          <Stat icon={<Building2 />} label="Registrations pending" value={d?.registrations.filter((r) => r.status === "pending_review").length} />
          <Stat icon={<FileSignature />} label="Signatures pending" value={pendingSigs} />
          <Stat icon={<Receipt />} label="Purchases" value={d?.purchases.length} />
        </div>

        {overview.isError && <p className="mt-6 text-destructive">Couldn't load dashboard data.</p>}

        <Tabs defaultValue="ai" className="mt-8">
          <TabsList className="h-auto flex-wrap justify-start gap-1 bg-muted p-1">
            {[["ai", "AI Protection"], ["reg", "Registrations"], ["splits", "Split Sheets"], ["purchases", "Purchases"], ["staff", "Staff"]].map(([v, l]) => (
              <TabsTrigger key={v} value={v!} className="font-semibold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">{l}</TabsTrigger>
            ))}
          </TabsList>
          <TabsContent value="ai">
            <Table head={["Track", "Artist", "Package", "Blockchain", "Verified", "Issued"]}
              rows={d?.certificates.map((c) => [c.track_title ?? "—", c.artist_name ?? "—", c.format_type, c.blockchain_status, c.is_verified ? "Yes" : "No", fmt(c.issued_at)])} />
          </TabsContent>
          <TabsContent value="reg">
            <Table head={["Agency", "Status", "Authorization signed", "Created"]}
              rows={d?.registrations.map((r) => [r.target_agency, r.status ?? "—", r.has_signed_authorization ? "Yes" : "No", fmt(r.created_at)])} />
          </TabsContent>
          <TabsContent value="splits">
            <Table head={["Email", "Role", "Share", "Type", "Status"]}
              rows={d?.splits.map((s) => [s.collaborator_email, s.role, `${s.assigned_percentage}%`, s.is_owner ? "Owner" : "Collaborator", s.signed_at ? `Signed ${fmt(s.signed_at)}` : "Pending"])} />
          </TabsContent>
          <TabsContent value="purchases">
            <Table head={["Type", "Mode", "Date"]} rows={d?.purchases.map((p) => [p.kind, p.environment, fmt(p.created_at)])} />
          </TabsContent>
          <TabsContent value="staff">
            <Table head={["Email", "Role", "Added"]} rows={d?.staff.map((s) => [s.email, s.assigned_role ?? "—", fmt(s.created_at)])} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function Center({ children }: { children: ReactNode }) {
  return <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background text-muted-foreground">{children}</div>;
}

function Stat({ icon, label, value }: { icon: ReactNode; label: string; value?: number }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center gap-2 text-primary [&_svg]:h-5 [&_svg]:w-5">{icon}<span className="text-sm text-muted-foreground">{label}</span></div>
      <div className="mt-2 text-3xl font-bold text-foreground">{value ?? "—"}</div>
    </div>
  );
}

function Table({ head, rows }: { head: string[]; rows?: string[][] }) {
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
