import { useState } from "react";
import { ChevronDown, Menu } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { groupTabs, tabIcon, type NavTab } from "@/lib/admin-nav";
import { DEPARTMENT_LABEL, type Department, type StaffAccess } from "@/lib/departments";
import { cn } from "@/lib/utils";

type Props = { tabs: NavTab[]; active: string; onSelect: (value: string) => void; access: StaffAccess };

/** The grouped navigation itself, shared by the desktop rail and the phone sheet. */
function NavBody({ tabs, active, onSelect, access, compact = false }: Props & { compact?: boolean }) {
  const groups = groupTabs(tabs);
  const [closed, setClosed] = useState<Record<string, boolean>>({});
  return (
    <nav aria-label="Admin sections" className="space-y-5">
      {groups.map((g) => {
        const isClosed = !compact && closed[g.key];
        return (
          <section key={g.key}>
            <button
              type="button"
              onClick={() => setClosed({ ...closed, [g.key]: !isClosed })}
              aria-expanded={!isClosed}
              className="group flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-left text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-foreground"
            >
              <ChevronDown className={cn("h-3.5 w-3.5 transition-transform duration-200", isClosed && "-rotate-90")} />
              <span className="truncate">{g.label}</span>
            </button>
            <p className="px-2 pb-1 text-[11px] leading-tight text-muted-foreground/70">{g.hint}</p>
            {!isClosed && (
              <ul className="space-y-0.5">
                {g.tabs.map((t) => {
                  const Icon = tabIcon(t.value);
                  const on = t.value === active;
                  return (
                    <li key={t.value}>
                      <button
                        type="button"
                        onClick={() => onSelect(t.value)}
                        aria-current={on ? "page" : undefined}
                        className={cn(
                          "flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm transition-all duration-150",
                          on
                            ? "bg-primary/12 font-semibold text-foreground shadow-[inset_0_0_0_1px_var(--primary),0_0_18px_-8px_var(--primary)]"
                            : "text-muted-foreground hover:translate-x-0.5 hover:bg-accent/40 hover:text-foreground",
                        )}
                      >
                        <Icon className={cn("h-4 w-4 shrink-0", on ? "text-primary" : "opacity-70")} />
                        <span className="truncate">{t.label}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      })}
      {access.role !== "super_admin" && access.departments.length > 0 && (
        <div className="flex flex-wrap gap-1 px-1">
          {access.departments.slice(0, 3).map((d) => <Badge key={d} variant="secondary" className="text-[10px]">{DEPARTMENT_LABEL[d as Department]}</Badge>)}
        </div>
      )}
    </nav>
  );
}

/** The desktop rail: sticky, scrolling on its own so the page keeps its own scroll. */
export function AdminSidebar(props: Props) {
  return (
    <aside className="hidden w-64 shrink-0 lg:block">
      <div className="sticky top-6 max-h-[calc(100vh-3rem)] overflow-y-auto rounded-2xl border border-border bg-card/70 p-3 backdrop-blur">
        <NavBody {...props} />
      </div>
    </aside>
  );
}

/** Phones get the same groups in a sheet, so no tab is desktop-only. */
export function AdminNavMobile(props: Props) {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open the admin menu">
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[19rem] overflow-y-auto p-4">
        <SheetHeader className="px-1 pb-3">
          <SheetTitle className="text-left text-base">Admin sections</SheetTitle>
        </SheetHeader>
        <NavBody {...props} onSelect={(v) => { setOpen(false); props.onSelect(v); }} compact />
      </SheetContent>
    </Sheet>
  );
}
