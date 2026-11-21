import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Badge } from "@/components/ui/badge";
import { getHolidayPlan } from "@/lib/holiday-coverage.functions";

/**
 * Admin → Holiday Cover: how the team staffs a break and who covers what, for super admins and department leads.
 * Deliberately carries no pay figure: the rate is undecided until the founder approves one.
 *
 * The plan's wording is fetched from the server (founder, 2026-11-21), so a restricted plan no longer ships inside the
 * public admin bundle; `getHolidayPlan` applies `canSeeHolidayPlan` before it answers.
 */
export function HolidayPlan() {
  const load = useServerFn(getHolidayPlan);
  const q = useQuery({ queryKey: ["holiday-plan"], queryFn: () => load(), staleTime: Infinity });
  if (q.isLoading) return <p className="mt-6 text-muted-foreground">Loading…</p>;
  if (q.isError || !q.data) return <p className="mt-6 text-destructive">Couldn't load the holiday plan.</p>;
  const { breaks, payStatus, sections } = q.data;
  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="text-xl font-bold">Holiday coverage</h2>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          What happens to the queue when the team is off, and how anyone who wants to work the break is approved.
          Members are told we are away and given a typical wait, never a promise.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {breaks.map((b) => <Badge key={b} variant="secondary">{b}</Badge>)}
          <Badge variant="outline">Super admins and department leads</Badge>
          {payStatus === "undecided" && <Badge variant="outline">Holiday pay: undecided</Badge>}
        </div>
      </section>

      {sections.map((section) => (
        <section key={section.title} className="rounded-2xl border border-border bg-card p-5">
          <h3 className="text-lg font-bold">{section.title}</h3>
          <ul className="mt-3 space-y-2 text-sm">
            {section.points.map((p) => (
              <li key={p} className="flex gap-2">
                <span aria-hidden className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                <span>{p}</span>
              </li>
            ))}
          </ul>
          {section.undecided && (
            <p className="mt-3 rounded-lg border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
              Undecided, waiting on the founder: {section.undecided}
            </p>
          )}
        </section>
      ))}

      <p className="text-xs text-muted-foreground">
        Nothing on this page is an offer or a rate. Agree the terms with the person in writing before they work a break,
        and record the approval with their lead.
      </p>
    </div>
  );
}
