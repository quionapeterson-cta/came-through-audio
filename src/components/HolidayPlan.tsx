import { Badge } from "@/components/ui/badge";
import { COVERAGE_SECTIONS, HOLIDAY_BREAKS, HOLIDAY_PAY_STATUS } from "@/lib/holiday-coverage";

/**
 * Admin → Holiday Cover: how the team staffs a break and who covers what, for super admins and department leads.
 * Deliberately carries no pay figure: the rate is undecided until the founder approves one.
 */
export function HolidayPlan() {
  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="text-xl font-bold">Holiday coverage</h2>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          What happens to the queue when the team is off, and how anyone who wants to work the break is approved.
          Members are told we are away and given a typical wait, never a promise.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {HOLIDAY_BREAKS.map((b) => <Badge key={b} variant="secondary">{b}</Badge>)}
          <Badge variant="outline">Super admins and department leads</Badge>
          {HOLIDAY_PAY_STATUS === "undecided" && <Badge variant="outline">Holiday pay: undecided</Badge>}
        </div>
      </section>

      {COVERAGE_SECTIONS.map((section) => (
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
