import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Copy, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { listRetiredIscrs } from "@/lib/retired-isrcs.functions";
import { agencyRequestText } from "@/lib/retired-isrcs";

const fmt = (iso: string) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
};

/**
 * Admin → Retired ISRCs (founder, 2026-11-12): the queue of every song carrying an old code, so our team can put the new
 * ISRC on the recording without waiting for the member to send it in.
 *
 * The one rule on the page, said once and then repeated in the text staff copy: the agency adds the new code and keeps
 * the old one open. Nothing here asks an agency to remove a code, because money filed under it can still be found later.
 */
export function RetiredIscrsPanel() {
  const fetchQueue = useServerFn(listRetiredIscrs);
  const queue = useQuery({ queryKey: ["retired-isrcs"], queryFn: () => fetchQueue(), refetchOnWindowFocus: false });
  const [search, setSearch] = useState("");
  const rows = useMemo(() => queue.data ?? [], [queue.data]);

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => [r.title, r.artist, r.album, r.current, ...r.retired, r.owner, r.email].join(" ").toLowerCase().includes(q));
  }, [rows, search]);

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copied. Send it to the agency, or use it in their portal.");
    } catch {
      toast.error("Couldn't copy. Select the text on the card and copy it by hand.");
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold">Retired ISRCs</h2>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Every song that carries a code it used to have. The agency gets the current code added to the recording and keeps
          the old one open — a retired code can still carry uncollected royalties later, so it is never removed or closed.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search a member, song or code"
          aria-label="Search retired ISRCs" className="w-full sm:w-80" />
        <p className="text-sm text-muted-foreground">
          {queue.isError ? "Couldn't load this section." : queue.isLoading ? <Loader2 className="h-4 w-4 animate-spin" aria-label="Loading" /> : `${shown.length} song${shown.length === 1 ? "" : "s"}`}
        </p>
      </div>

      {!queue.isLoading && !queue.isError && !rows.length && (
        <p className="rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground">
          No song carries a retired ISRC yet. When a member adds one in Identifiers → Retired ISRC, it appears here.
        </p>
      )}

      <div className="grid gap-3 lg:grid-cols-2">
        {shown.map((row) => (
          <article key={row.id} className="rounded-2xl border border-border bg-card p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h3 className="font-bold">{row.title}</h3>
                <p className="text-sm text-muted-foreground">
                  {[row.artist, row.album, row.released && `released ${row.released}`].filter(Boolean).join(" · ") || "No artist or release yet"}
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={() => void copy(agencyRequestText(row))}>
                <Copy className="mr-1 h-3.5 w-3.5" /> Copy request
              </Button>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
              <Badge variant="outline">Now: {row.current || "no code"}</Badge>
              {row.retired.map((code) => <Badge key={code} variant="secondary">Retired: {code}</Badge>)}
            </div>

            <p className="mt-3 text-xs text-muted-foreground">
              {row.owner || "Member"} {row.email && `· ${row.email}`} · changed {fmt(row.updatedAt)}
            </p>
          </article>
        ))}
      </div>
    </div>
  );
}
