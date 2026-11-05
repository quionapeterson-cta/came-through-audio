import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cancelStaffDeparture, listStaffDepartures, type StaffDeparture } from "@/lib/staff-departures.functions";
import { SECURE_COPY } from "@/lib/offboarding";

const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString() : "—");

function Status({ d }: { d: StaffDeparture }) {
  if (d.deletedAt) return <Badge variant="outline">Deleted {day(d.deletedAt)}</Badge>;
  if (d.cancelledAt) return <Badge variant="secondary">Deletion cancelled</Badge>;
  if (d.deleteOn) return <Badge variant="outline">Deletes {day(d.deleteOn)}</Badge>;
  return <Badge variant="secondary">Plan runs to period end</Badge>;
}

/**
 * Staff → Departures (founder, 2026-11-05): every scheduled deletion on one screen, with the 30 days shown as the chance
 * to pay and keep the account first, and the deletion as what happens if nothing is paid.
 */
export function StaffDeparturesPanel() {
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ["staff-departures"], queryFn: () => listStaffDepartures() });
  const cancel = useMutation({
    mutationFn: (id: string) => cancelStaffDeparture({ data: { id } }),
    onSuccess: () => { toast.success("Deletion cancelled. The account stays."); qc.invalidateQueries({ queryKey: ["staff-departures"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Couldn't cancel that deletion."),
  });

  return (
    <section className="mt-10 rounded-xl border border-border p-5">
      <h2 className="text-lg font-bold">Departures</h2>
      <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
        Leaving inside the first 90 days ends access the same day. The 30 days after that are the chance to keep the
        account: <span className="font-medium text-foreground">{SECURE_COPY}</span> If nothing is paid, the account and
        everything in it is deleted on the date shown. Past 90 days the plan runs to the end of its period and then bills
        as a normal plan; nothing is deleted.
      </p>
      {list.isError && <p className="mt-3 text-sm text-destructive">Couldn't load departures.</p>}
      {!list.isLoading && !list.data?.departures.length && <p className="mt-3 text-sm text-muted-foreground">Nobody is scheduled for deletion.</p>}
      {!!list.data?.departures.length && (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground">
              <tr>{["Email", "Access ended", "Keep it by", "Status", ""].map((h) => <th key={h} className="py-2 pr-4 font-semibold">{h}</th>)}</tr>
            </thead>
            <tbody>
              {list.data.departures.map((d) => (
                <tr key={d.id} className="border-t border-border">
                  <td className="py-2 pr-4 font-medium">{d.email}</td>
                  <td className="py-2 pr-4">{day(d.accessEndedAt)}</td>
                  <td className="py-2 pr-4">{d.deleteOn ? `Paying before ${day(d.deleteOn)}` : "—"}</td>
                  <td className="py-2 pr-4"><Status d={d} /></td>
                  <td className="py-2 text-right">
                    {d.deleteOn && !d.deletedAt && !d.cancelledAt && (
                      <Button size="sm" variant="outline" disabled={cancel.isPending} onClick={() => cancel.mutate(d.id)}>Cancel deletion</Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
