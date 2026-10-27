import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Unlock } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { downloadAgencyExport, type Agency } from "@/lib/agency-export";
import { listRegistrationQueue, setRegistrationStatus, unlockRegistrationSong, type QueueOrder } from "@/lib/registration.functions";
import { SONG_STATUS_LABEL, writerLine, type SongStatus } from "@/lib/registration";
import type { CatalogTrack } from "@/lib/catalog";

/** Which existing export template each agency uses (ASCAP and BMI share the PRO cheat sheet). */
const EXPORT: Record<string, Agency> = { ASCAP: "pro", BMI: "pro", "The MLC": "mlc", SoundExchange: "soundexchange" };
const STATUSES: SongStatus[] = ["pending", "in_progress", "registered"];
const day = (d: string | null) => (d ? new Date(d).toLocaleDateString() : "—");
const daysSince = (d: string) => Math.floor((Date.now() - Date.parse(d)) / 86400000);

/** Admin → Registrations: every paid Expert Assistance order, one-click exports from the submitted copies, status per song. */
export function RegistrationQueuePanel() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["registration-queue"], queryFn: () => listRegistrationQueue() });
  const refresh = () => qc.invalidateQueries({ queryKey: ["registration-queue"] });
  if (q.isLoading) return <p className="mt-6 text-muted-foreground">Loading…</p>;
  if (q.error) return <p className="mt-6 text-muted-foreground">⚠️ Couldn't load the queue ({(q.error as Error).message}). If the registration tables are missing, run migration 20261023090000.</p>;
  const orders = q.data ?? [];
  return <div className="mt-4 space-y-3">
    <AgentTips />
    {orders.length ? orders.map((o) => <OrderRow key={o.purchaseId} o={o} onChange={refresh} />) : <p className="text-muted-foreground">No registration orders yet.</p>}
  </div>;
}

/** What agents need at hand while registering (founder's testing and call with The MLC, 2026-10-27). */
const AGENT_TIPS = [
  "One customer at a time: click Start on the customer in My Queue first, and finish or pause them before opening another. An order with 🔒 belongs to a teammate.",
  "Match every agency invite to its order before accepting: the invite's account name should match the order's legal name (from the signed agreement) or artist name. Not sure? Don't accept it; ask in Support.",
  "Work on a laptop or desktop. The MLC's bulk registration doesn't work on a phone.",
  "Log in as registrations@camethroughaudio.com. When asked for two-step verification, choose email, then copy the code from the registrations@ inbox.",
  "The MLC: Member Settings is at the bottom left of the Members Hub.",
  "A field shows red? Check for spaces before or after the text and delete them.",
  "The MLC doesn't require an ISWC, but if the user has one, include it: it helps The MLC match the song more accurately.",
  "The MLC matches by artist name, song title and ISRC. Release date, duration and other recording details come from the streaming services.",
];

function AgentTips() {
  return (
    <details className="group rounded-xl border border-border bg-muted/40">
      <summary className="flex cursor-pointer list-none items-center justify-between p-4 text-sm font-semibold [&::-webkit-details-marker]:hidden">
        Agent tips <span className="font-normal text-muted-foreground">{AGENT_TIPS.length} reminders</span>
      </summary>
      <ul className="list-disc space-y-1 border-t border-border p-4 pl-8 text-sm">{AGENT_TIPS.map((t) => <li key={t}>{t}</li>)}</ul>
    </details>
  );
}

function OrderRow({ o, onChange }: { o: QueueOrder; onChange: () => void }) {
  const submitted = o.songs.filter((s) => s.submitted).length;
  const accessDone = o.agencies.filter((a) => o.access[a]).length;
  const canWork = o.state !== "Waiting on customer";

  async function exportFor(agency: string) {
    const tracks: CatalogTrack[] = o.songs.filter((s) => s.snapshot).map((s) => ({ id: s.id, title: s.title, artist: s.snapshot!.artist, updatedAt: "", metadata: s.snapshot! }));
    const held = await downloadAgencyExport(EXPORT[agency]!, tracks, `${o.customer} - ${agency}`);
    if (held.length) toast.warning(`Held back: ${held.map((h) => h.track.title).join(", ")}`);
  }
  async function act(fn: () => Promise<unknown>, done: string) {
    try { await fn(); toast.success(done); onChange(); } catch (e) { toast.error(e instanceof Error ? e.message : "Couldn't save."); }
  }

  return (
    <details className="group rounded-xl border border-border open:border-primary/60">
      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-6 gap-y-1 p-4 text-sm [&::-webkit-details-marker]:hidden">
        <span className="min-w-40 font-semibold">{o.customer}<span className="block text-xs font-normal text-muted-foreground">{o.email}{o.signedName ? ` · legal name ${o.signedName}` : ""}</span></span>
        <span>Songs {submitted}/{o.songs.length} submitted</span>
        <span>{o.agencies.join(", ")}</span>
        <span>Agreement {o.signedAt ? "✓" : "–"}</span>
        <span>Access {accessDone}/{o.agencies.length}</span>
        <Badge variant={canWork ? "default" : "secondary"}>{o.state}</Badge>
        {o.agent && <span className={o.agent.me ? "font-semibold text-primary" : "font-semibold"}>{o.agent.me ? "You're on this" : `🔒 ${o.agent.name}`}{o.agent.state === "paused" ? " (paused)" : ""}</span>}
        <span className="ml-auto text-muted-foreground">{o.stale ? "⚠️ " : ""}{daysSince(o.createdAt)} d</span>
      </summary>
      <div className="space-y-3 border-t border-border p-4 text-sm">
        {o.agent && !o.agent.me && <p className="rounded-lg border border-primary p-3 font-semibold">🔒 {o.agent.name} is working on this customer{o.agent.state === "paused" ? " (paused)" : ""}. Pick a different order so registrations don't get mixed up.</p>}
        {!o.agent && canWork && <p className="text-xs text-muted-foreground">Before you start: open My Queue and click Start on this customer, so the team sees you're on it.</p>}
        <div className="flex flex-wrap gap-2">
          {o.agencies.map((a) => <Button key={a} size="sm" variant="outline" disabled={!canWork} onClick={() => void exportFor(a)}><Download className="h-4 w-4" />Export for {a}</Button>)}
          {!canWork && <span className="self-center text-xs text-muted-foreground">Exports unlock once every song is submitted, the agreement is signed and access is confirmed.</span>}
        </div>
        {o.stale && <p className="text-xs">⚠️ Submitted over 30 days ago and not all registered (internal target).</p>}
        {o.songs.map((s) => (
          <div key={s.id} className="rounded-lg bg-muted p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-semibold">{s.title}</span>
              {s.submitted
                ? <Button size="sm" variant="ghost" onClick={() => void act(() => unlockRegistrationSong({ data: { songId: s.id } }), "Unlocked: the customer can fix and resubmit it.")}><Unlock className="h-4 w-4" />Unlock for a fix</Button>
                : <span className="text-xs text-muted-foreground">Not submitted yet</span>}
            </div>
            {s.snapshot && <p className="mt-1 text-xs text-muted-foreground">Writers: {writerLine(s.snapshot) || "—"} · ISRC {s.snapshot.isrc || "—"}</p>}
            {s.submitted && <div className="mt-2 flex flex-wrap gap-3">
              {o.agencies.map((a) => (
                <label key={a} className="flex items-center gap-2 text-xs">{a}
                  <select className="h-8 rounded-md border border-input bg-background px-2" value={s.status[a] ?? "pending"} disabled={!canWork}
                    onChange={(e) => void act(() => setRegistrationStatus({ data: { songId: s.id, agency: a, status: e.target.value as SongStatus } }), "Status saved.")}>
                    {STATUSES.map((x) => <option key={x} value={x}>{SONG_STATUS_LABEL[x]}</option>)}
                  </select>
                </label>
              ))}
            </div>}
          </div>
        ))}
        <p className="text-xs text-muted-foreground">Ordered {day(o.createdAt)} · Agreement signed {day(o.signedAt)}</p>
      </div>
    </details>
  );
}
