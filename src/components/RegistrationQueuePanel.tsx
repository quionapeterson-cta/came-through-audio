import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  ExternalLink,
  Flag,
  MailWarning,
  Unlock,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { downloadAgencyExport, type Agency } from "@/lib/agency-export";
import {
  AGENCY_EMAIL_KIND_LABEL,
  AGENCY_INVITE_STATUSES,
  AGENCY_INVITE_STATUS_HINT,
  AGENCY_INVITE_STATUS_LABEL,
  summariseInvites,
  type AgencyInviteStatus,
} from "@/lib/agency-invites";
import { reportRegistrationIssue } from "@/lib/board.functions";
import { SONG_STATUS_LABEL, writerLine, type SongStatus } from "@/lib/registration";
import {
  listAgencyInvites,
  listRegistrationQueue,
  markAllSongsRegistered,
  setAgencyInviteStatus,
  setRegistrationStatus,
  unlockRegistrationSong,
  type AgencyInviteRow,
  type QueueOrder,
  type QueueSong,
} from "@/lib/registration.functions";
import {
  BATCH_CONFIRMATION,
  ISSUE_WARNING,
  REGISTRATION_CONFIRMATION,
  canFinishGroup,
  groupOrdersByUser,
  progressLabel,
  verificationFor,
  type UserGroup,
} from "@/lib/registration-workflow";
import type { CatalogTrack } from "@/lib/catalog";

/**
 * Admin → Registrations (founder, 2026-11-18): every paid Expert Assistance order, grouped by the customer it belongs to.
 *
 * One card per person, however many orders they bought, because the work is a customer's catalog rather than a receipt.
 * The card carries their agency invitations, how many song/agency pairs are Registered, and the one-click batch finish.
 * A single song marked Registered is intercepted by the verification checklist; the batch finish has its own final check
 * and sends the celebratory email once.
 *
 * Report an Issue writes the issue and opens the board thread in one step, and optionally holds the song, which is what
 * the warning banner asks for instead of pretending the registration went through.
 */

/** Which existing export template each agency uses (ASCAP and BMI share the PRO cheat sheet). */
const EXPORT: Record<string, Agency> = { ASCAP: "pro", BMI: "pro", "The MLC": "mlc", SoundExchange: "soundexchange" };
const STATUSES: SongStatus[] = ["pending", "in_progress", "on_hold", "registered"];
const ISSUE_AGENCIES = ["SoundExchange", "BMI", "The MLC", "ASCAP", "Internal/Metadata"] as const;
type IssueAgency = (typeof ISSUE_AGENCIES)[number];
const isIssueAgency = (value: string): value is IssueAgency => (ISSUE_AGENCIES as readonly string[]).includes(value);
const day = (d: string | null) => (d ? new Date(d).toLocaleDateString() : "—");
const daysSince = (d: string) => Math.floor((Date.now() - Date.parse(d)) / 86400000);
const inviteTone = (status: AgencyInviteStatus) =>
  status === "representative_accepted" ? "default" : status === "action_needed" ? "destructive" : "secondary";

export function RegistrationQueuePanel({ focusPurchaseId }: { focusPurchaseId?: string | null }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["registration-queue"], queryFn: () => listRegistrationQueue() });
  const invites = useQuery({ queryKey: ["agency-invites"], queryFn: () => listAgencyInvites() });
  const [verifying, setVerifying] = useState<{ order: QueueOrder; song: QueueSong; agency: string } | null>(null);
  const [finishing, setFinishing] = useState<{ group: UserGroup<QueueOrder>; purchaseId: string } | null>(null);
  const [reporting, setReporting] = useState<{ order: QueueOrder; song: QueueSong } | null>(null);

  const groups = useMemo(() => groupOrdersByUser(q.data ?? []), [q.data]);
  const pendingInvites = (invites.data ?? []).filter((row) => row.status !== "representative_accepted");

  const refresh = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["registration-queue"] }),
      qc.invalidateQueries({ queryKey: ["agency-invites"] }),
      qc.invalidateQueries({ queryKey: ["board-threads"] }),
      qc.invalidateQueries({ queryKey: ["board-unread"] }),
    ]);
  };

  if (q.isLoading) return <p className="mt-6 text-muted-foreground">Loading…</p>;
  if (q.error) {
    return (
      <p className="mt-6 text-muted-foreground">
        ⚠️ Couldn't load the queue ({(q.error as Error).message}). If the registration tables are missing, run migration
        20261023090000.
      </p>
    );
  }

  return (
    <div className="mt-4 space-y-3">
      <PendingInvites
        rows={invites.data ?? []}
        failed={invites.isError}
        pending={pendingInvites.length}
        onChange={() => void refresh()}
      />
      <AgentTips />
      {groups.length ? (
        groups.map((group) => (
          <UserCard
            key={group.key}
            group={group}
            invites={(invites.data ?? []).filter(
              (row) => !!group.email && row.userEmail?.toLowerCase() === group.email.toLowerCase(),
            )}
            defaultOpen={
              !!focusPurchaseId && group.orders.some((order) => order.purchaseId === focusPurchaseId)
            }
            onVerify={setVerifying}
            onFinish={(purchaseId) => setFinishing({ group, purchaseId })}
            onReport={(order, song) => setReporting({ order, song })}
            onChange={() => void refresh()}
          />
        ))
      ) : (
        <p className="text-muted-foreground">No registration orders yet.</p>
      )}

      {verifying && (
        <VerifyDialog
          order={verifying.order}
          song={verifying.song}
          agency={verifying.agency}
          onClose={() => setVerifying(null)}
          onSaved={() => {
            setVerifying(null);
            void refresh();
          }}
        />
      )}
      {finishing && (
        <FinishDialog
          group={finishing.group}
          purchaseId={finishing.purchaseId}
          onClose={() => setFinishing(null)}
          onSaved={() => {
            setFinishing(null);
            void refresh();
          }}
        />
      )}
      {reporting && (
        <ReportIssueDialog
          order={reporting.order}
          song={reporting.song}
          onClose={() => setReporting(null)}
          onSaved={() => {
            setReporting(null);
            void refresh();
          }}
        />
      )}
    </div>
  );
}

/** What agents need at hand while registering (founder's testing and call with The MLC, 2026-10-27). */
const AGENT_TIPS = [
  "One customer at a time: click Start on them in My Queue first, and finish or pause them before opening another. An order with 🔒 belongs to a teammate.",
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
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 p-4 text-sm font-semibold [&::-webkit-details-marker]:hidden">
        Agent tips <span className="font-normal text-muted-foreground">{AGENT_TIPS.length} reminders</span>
      </summary>
      <ul className="list-disc space-y-1 border-t border-border p-4 pl-8 text-sm">
        {AGENT_TIPS.map((tip) => (
          <li key={tip}>{tip}</li>
        ))}
      </ul>
    </details>
  );
}

/** The invitation drawer: agency mail the worker filed, with the link and the acceptance status. */
function PendingInvites({
  rows,
  pending,
  failed,
  onChange,
}: {
  rows: AgencyInviteRow[];
  pending: number;
  failed: boolean;
  onChange: () => void;
}) {
  const setStatus = useServerFn(setAgencyInviteStatus);
  const [busy, setBusy] = useState<string | null>(null);

  const move = async (id: string, status: AgencyInviteStatus) => {
    setBusy(id);
    try {
      await setStatus({ data: { inviteId: id, status } });
      toast.success(AGENCY_INVITE_STATUS_LABEL[status]);
      onChange();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't save that.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <details className="rounded-xl border border-border bg-card" open={pending > 0}>
      <summary className="flex min-h-11 cursor-pointer list-none flex-wrap items-center justify-between gap-2 p-4 text-sm font-semibold [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-2">
          <MailWarning className="h-4 w-4 text-primary" />
          Pending agency invites
        </span>
        <span className="text-xs font-normal text-muted-foreground">
          {pending ? `${pending} waiting` : "Nothing waiting"}
        </span>
      </summary>
      <div className="space-y-3 border-t border-border p-4">
        <p className="text-xs text-muted-foreground">
          SoundExchange, The MLC and ASCAP invitations, filed from admin@ mail and kept in the Inbox too. Accept the
          invite in the agency's own portal, then record it here so the next person doesn't accept it twice.
        </p>
        {failed ? (
          <p className="text-sm text-destructive">
            Couldn't load agency invites. Run migration 20261118160000, then reload.
          </p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No agency invitations filed yet.</p>
        ) : (
          <ul className="space-y-2">
            {rows.map((row) => (
              <li key={row.id} className="rounded-lg border border-border bg-muted/40 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={inviteTone(row.status)}>{row.agency}</Badge>
                  <Badge variant="outline" className="text-[10px]">{AGENCY_EMAIL_KIND_LABEL[row.kind]}</Badge>
                  <span className="text-xs font-semibold">{AGENCY_INVITE_STATUS_LABEL[row.status]}</span>
                  <span className="text-xs text-muted-foreground">{day(row.receivedAt)}</span>
                </div>
                <p className="mt-1 break-words text-sm font-medium">{row.subject || "(no subject)"}</p>
                <p className="break-words text-xs text-muted-foreground">
                  {row.accountName ? `Account: ${row.accountName} · ` : ""}
                  {row.userEmail ?? "No invited address found in the mail"}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {row.verifyUrl ? (
                    <Button asChild size="sm" variant="outline" className="min-h-11">
                      <a href={row.verifyUrl} target="_blank" rel="noreferrer">
                        <ExternalLink className="h-4 w-4" />Open invite
                      </a>
                    </Button>
                  ) : null}
                  <label className="flex items-center gap-2 text-xs">
                    <span className="text-muted-foreground">Status</span>
                    <select
                      className="min-h-11 rounded-md border border-input bg-background px-2 text-xs"
                      value={row.status}
                      disabled={busy === row.id}
                      onChange={(event) => void move(row.id, event.target.value as AgencyInviteStatus)}
                    >
                      {AGENCY_INVITE_STATUSES.map((status) => (
                        <option key={status} value={status}>{AGENCY_INVITE_STATUS_LABEL[status]}</option>
                      ))}
                    </select>
                  </label>
                  <span className="text-[11px] text-muted-foreground">{AGENCY_INVITE_STATUS_HINT[row.status]}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </details>
  );
}

function InviteBadges({ rows }: { rows: AgencyInviteRow[] }) {
  const best = summariseInvites(rows.map((row) => ({ agency: row.agency, status: row.status, received_at: row.receivedAt })));
  if (!best.length) return null;
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      {best.map((invite) => (
        <Badge key={invite.agency} variant={inviteTone(invite.status)} className="text-[10px] font-semibold">
          {invite.agency}: {AGENCY_INVITE_STATUS_LABEL[invite.status]}
        </Badge>
      ))}
    </span>
  );
}

/** One customer: their orders, their songs, their invitations and the batch finish. */
function UserCard({
  group,
  invites,
  defaultOpen,
  onVerify,
  onFinish,
  onReport,
  onChange,
}: {
  group: UserGroup<QueueOrder>;
  invites: AgencyInviteRow[];
  defaultOpen: boolean;
  onVerify: (value: { order: QueueOrder; song: QueueSong; agency: string }) => void;
  onFinish: (purchaseId: string) => void;
  onReport: (order: QueueOrder, song: QueueSong) => void;
  onChange: () => void;
}) {
  return (
    <details
      className="group rounded-xl border border-border bg-card open:border-primary/60"
      key={`${group.key}-${defaultOpen ? "focus" : "rest"}`}
      open={defaultOpen || undefined}
    >
      <summary className="flex min-h-11 cursor-pointer list-none flex-wrap items-center gap-x-4 gap-y-2 p-4 text-sm [&::-webkit-details-marker]:hidden">
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold">{group.name}</span>
          <span className="block truncate text-xs font-normal text-muted-foreground">{group.email || "no email on file"}</span>
        </span>
        <InviteBadges rows={invites} />
        <span className="text-xs text-muted-foreground">
          {group.songs} {group.songs === 1 ? "song" : "songs"}
        </span>
        <span className="text-xs font-semibold">{progressLabel(group)}</span>
        {group.onHold > 0 && <Badge variant="destructive" className="text-[10px]">{group.onHold} on hold</Badge>}
        {group.batchDone ? (
          <Badge variant="default" className="text-[10px]">
            <CheckCircle2 className="h-3 w-3" /> Finished
          </Badge>
        ) : (
          <Button
            size="sm"
            className="min-h-11"
            disabled={!canFinishGroup(group)}
            onClick={(event) => {
              event.preventDefault();
              const first = group.orders.find((order) => !order.batchRegisteredAt) ?? group.orders[0];
              if (first) onFinish(first.purchaseId);
            }}
          >
            All Songs Registered
          </Button>
        )}
      </summary>
      <div className="space-y-4 border-t border-border p-4 text-sm">
        {!canFinishGroup(group) && !group.batchDone && (
          <p className="text-xs text-muted-foreground">
            The batch finish unlocks once every song is Registered at every agency this customer bought. Until then, work
            each song below.
          </p>
        )}
        {group.orders.map((order) => (
          <OrderBlock
            key={order.purchaseId}
            order={order}
            onVerify={onVerify}
            onReport={onReport}
            onChange={onChange}
          />
        ))}
      </div>
    </details>
  );
}

function OrderBlock({
  order,
  onVerify,
  onReport,
  onChange,
}: {
  order: QueueOrder;
  onVerify: (value: { order: QueueOrder; song: QueueSong; agency: string }) => void;
  onReport: (order: QueueOrder, song: QueueSong) => void;
  onChange: () => void;
}) {
  const setStatus = useServerFn(setRegistrationStatus);
  const unlock = useServerFn(unlockRegistrationSong);
  const submitted = order.songs.filter((song) => song.submitted).length;
  const accessDone = order.agencies.filter((agency) => order.access[agency]).length;
  const canWork = order.state !== "Waiting on customer";

  async function act(fn: () => Promise<unknown>, done: string) {
    try {
      await fn();
      toast.success(done);
      onChange();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't save.");
    }
  }

  async function exportFor(agency: string) {
    const tracks: CatalogTrack[] = order.songs
      .filter((song) => song.snapshot)
      .map((song) => ({ id: song.id, title: song.title, artist: song.snapshot!.artist, updatedAt: "", metadata: song.snapshot! }));
    const held = await downloadAgencyExport(EXPORT[agency]!, tracks, `${order.customer} - ${agency}`);
    if (held.length) toast.warning(`Held back: ${held.map((h) => h.track.title).join(", ")}`);
  }

  return (
    <div className="rounded-lg border border-border/70 p-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="font-semibold text-foreground">{order.agencies.join(", ")}</span>
        <span>Songs {submitted}/{order.songs.length} submitted</span>
        <span>Agreement {order.signedAt ? "✓" : "–"}</span>
        <span>Access {accessDone}/{order.agencies.length}</span>
        <Badge variant={canWork ? "default" : "secondary"}>{order.state}</Badge>
        {order.agent && (
          <span className={order.agent.me ? "font-semibold text-primary" : "font-semibold"}>
            {order.agent.me ? "You're on this" : `🔒 ${order.agent.name}`}
            {order.agent.state === "paused" ? " (paused)" : ""}
          </span>
        )}
        <span className="ml-auto">
          {order.stale ? "⚠️ " : ""}Ordered {day(order.createdAt)} · {daysSince(order.createdAt)} d
        </span>
      </div>

      {order.agent && !order.agent.me && (
        <p className="mt-2 rounded-lg border border-primary p-2 text-xs font-semibold">
          🔒 {order.agent.name} is working on this customer{order.agent.state === "paused" ? " (paused)" : ""}. Pick a
          different order so registrations don't get mixed up.
        </p>
      )}

      <div className="mt-2 flex flex-wrap gap-2">
        {order.agencies.map((agency) => (
          <Button
            key={agency}
            size="sm"
            variant="outline"
            className="min-h-11"
            disabled={!canWork}
            onClick={() => void exportFor(agency)}
          >
            <Download className="h-4 w-4" />Export for {agency}
          </Button>
        ))}
        {!canWork && (
          <span className="self-center text-xs text-muted-foreground">
            Exports unlock once every song is submitted, the agreement is signed and access is confirmed.
          </span>
        )}
      </div>

      <div className="mt-3 space-y-2">
        {order.songs.map((song) => (
          <div key={song.id} className="rounded-lg bg-muted p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <span className="min-w-0">
                <span className="block break-words font-semibold">{song.title}</span>
                <span className="block break-words text-xs text-muted-foreground">
                  {song.artist ? `${song.artist} · ` : ""}ISRC {song.isrc || "—"}
                </span>
              </span>
              {song.submitted ? (
                <Button
                  size="sm"
                  variant="ghost"
                  className="min-h-11"
                  onClick={() =>
                    void act(
                      () => unlock({ data: { songId: song.id } }),
                      "Unlocked: the customer can fix and resubmit it.",
                    )
                  }
                >
                  <Unlock className="h-4 w-4" />Unlock for a fix
                </Button>
              ) : (
                <span className="text-xs text-muted-foreground">Not submitted yet</span>
              )}
            </div>
            {song.snapshot && (
              <p className="mt-1 break-words text-xs text-muted-foreground">Writers: {writerLine(song.snapshot) || "—"}</p>
            )}
            {song.submitted && (
              <>
                <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {order.agencies.map((agency) => (
                    <label key={agency} className="flex min-w-0 flex-wrap items-center justify-between gap-2 text-xs">
                      <span className="font-medium">{agency}</span>
                      <select
                        className="min-h-11 rounded-md border border-input bg-background px-2"
                        value={song.status[agency] ?? "pending"}
                        disabled={!canWork}
                        onChange={(event) => {
                          const next = event.target.value as SongStatus;
                          if (next === "registered") {
                            // The checklist decides; the picker goes back to what is stored until it is ticked.
                            event.target.value = song.status[agency] ?? "pending";
                            onVerify({ order, song, agency });
                            return;
                          }
                          void act(
                            () => setStatus({ data: { songId: song.id, agency, status: next } }),
                            "Status saved.",
                          );
                        }}
                      >
                        {STATUSES.map((status) => (
                          <option key={status} value={status}>{SONG_STATUS_LABEL[status]}</option>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="min-h-11 border-destructive/60 text-destructive"
                    disabled={!canWork}
                    onClick={() => onReport(order, song)}
                  >
                    <Flag className="h-4 w-4" />Report an Issue
                  </Button>
                  <span className="text-[11px] text-muted-foreground">
                    {order.songs.indexOf(song) + 1} of {order.songs.length}
                  </span>
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      <p className="mt-2 text-xs text-muted-foreground">
        Ordered {day(order.createdAt)} · Agreement signed {day(order.signedAt)}
        {order.batchRegisteredAt ? ` · Finished ${day(order.batchRegisteredAt)}` : ""}
      </p>
    </div>
  );
}

/** The per-song checklist that stands between a picker and "Registered". */
function VerifyDialog({
  order,
  song,
  agency,
  onClose,
  onSaved,
}: {
  order: QueueOrder;
  song: QueueSong;
  agency: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const save = useServerFn(setRegistrationStatus);
  const lists = verificationFor(order.agencies);
  const primary = lists.find((list) => list.agency === agency);
  const others = lists.filter((list) => list.agency !== agency);
  const [ticked, setTicked] = useState<boolean[]>(() => (primary?.checks ?? []).map(() => false));
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const allTicked = ticked.length > 0 && ticked.every(Boolean);

  const submit = async () => {
    setBusy(true);
    try {
      await save({ data: { songId: song.id, agency, status: "registered", confirmed: true } });
      toast.success(`${agency}: ${song.title} is Registered.`);
      onSaved();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't save that.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] w-[calc(100vw-2rem)] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="break-words">Verify before marking Registered</DialogTitle>
          <DialogDescription className="break-words">
            {song.title} · {agency} · ISRC {song.isrc || "—"}
          </DialogDescription>
        </DialogHeader>

        <p className="rounded-lg border border-destructive bg-destructive/5 p-3 text-xs font-semibold text-destructive">
          {ISSUE_WARNING}
        </p>

        {primary && (
          <section className="space-y-2">
            <h3 className="text-sm font-bold">{primary.agency} checklist</h3>
            <p className="text-xs text-muted-foreground">{primary.intro}</p>
            <ul className="space-y-1.5">
              {primary.checks.map((check, index) => (
                <li key={check}>
                  <label className="flex min-h-11 items-start gap-2 rounded-lg border border-border p-2.5 text-sm">
                    <Checkbox
                      checked={ticked[index] ?? false}
                      onCheckedChange={(value) =>
                        setTicked((current) => current.map((was, at) => (at === index ? value === true : was)))
                      }
                      className="mt-0.5"
                    />
                    <span className="min-w-0 break-words">{check}</span>
                  </label>
                </li>
              ))}
            </ul>
          </section>
        )}

        {others.length > 0 && (
          <details className="rounded-lg border border-border p-3">
            <summary className="min-h-11 cursor-pointer text-sm font-semibold">
              Also check for {others.map((list) => list.agency).join(" and ")}
            </summary>
            <div className="mt-2 space-y-3">
              {others.map((list) => (
                <div key={list.agency}>
                  <p className="text-xs font-bold">{list.agency}</p>
                  <ul className="mt-1 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
                    {list.checks.map((check) => <li key={check}>{check}</li>)}
                  </ul>
                </div>
              ))}
            </div>
          </details>
        )}

        <label className="flex min-h-11 items-start gap-2 rounded-lg border border-primary/50 bg-primary/5 p-3 text-sm">
          <Checkbox checked={confirmed} onCheckedChange={(value) => setConfirmed(value === true)} className="mt-0.5" />
          <span className="min-w-0 break-words font-medium">{REGISTRATION_CONFIRMATION}</span>
        </label>

        <DialogFooter className="gap-2">
          <Button variant="ghost" className="min-h-11" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button className="min-h-11" onClick={() => void submit()} disabled={busy || !confirmed || !allTicked}>
            {busy ? "Saving…" : "Mark Registered"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** The whole customer, in one final check, ending in the celebratory email. */
function FinishDialog({
  group,
  purchaseId,
  onClose,
  onSaved,
}: {
  group: UserGroup<QueueOrder>;
  purchaseId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const finish = useServerFn(markAllSongsRegistered);
  const songs = group.orders.flatMap((row) => row.songs);
  // The whole customer, so the agencies are every order's, and the finish covers all of them at once.
  const groupAgencies = [...new Set(group.orders.flatMap((row) => row.agencies))];
  const lists = verificationFor(groupAgencies);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      const answer = await finish({ data: { purchaseId, confirmed: true } });
      toast.success(
        answer.emailed
          ? "Registration Successful. The celebratory email is on its way."
          : "Registration Successful. The email couldn't be sent — check Resend before telling the customer.",
      );
      onSaved();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't finish this customer.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] w-[calc(100vw-2rem)] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="break-words">All songs registered for {group.name}</DialogTitle>
          <DialogDescription className="break-words">
            {group.email || "no email on file"} · {songs.length} {songs.length === 1 ? "song" : "songs"} across{" "}
            {groupAgencies.join(", ")}
          </DialogDescription>
        </DialogHeader>

        <p className="rounded-lg border border-destructive bg-destructive/5 p-3 text-xs font-semibold text-destructive">
          {ISSUE_WARNING}
        </p>

        <section>
          <h3 className="text-sm font-bold">Songs in this finish</h3>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
            {songs.map((song) => (
              <li key={`${song.id}-${song.title}`} className="break-words">
                {song.title}
                {song.isrc ? <span className="text-xs text-muted-foreground"> · {song.isrc}</span> : null}
              </li>
            ))}
          </ul>
        </section>

        <section className="space-y-2">
          <h3 className="text-sm font-bold">One submission, every agency</h3>
          <p className="text-xs text-muted-foreground">{BATCH_CONFIRMATION}</p>
          {lists.map((list) => (
            <details key={list.agency} className="rounded-lg border border-border p-3">
              <summary className="min-h-11 cursor-pointer text-sm font-semibold">{list.agency}</summary>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
                {list.checks.map((check) => <li key={check}>{check}</li>)}
              </ul>
            </details>
          ))}
        </section>

        <label className="flex min-h-11 items-start gap-2 rounded-lg border border-primary/50 bg-primary/5 p-3 text-sm">
          <Checkbox checked={confirmed} onCheckedChange={(value) => setConfirmed(value === true)} className="mt-0.5" />
          <span className="min-w-0 break-words font-medium">
            Every song above is complete with zero errors, and I have verified each agency's submission.
          </span>
        </label>

        <DialogFooter className="gap-2">
          <Button variant="ghost" className="min-h-11" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button className="min-h-11" onClick={() => void submit()} disabled={busy || !confirmed}>
            {busy ? "Finishing…" : "Registration Successful"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Report an Issue: pre-filled from the song, filed to the board, optionally set On Hold. */
function ReportIssueDialog({
  order,
  song,
  onClose,
  onSaved,
}: {
  order: QueueOrder;
  song: QueueSong;
  onClose: () => void;
  onSaved: () => void;
}) {
  const report = useServerFn(reportRegistrationIssue);
  // The agency this order was actually bought for, so reporting a BMI problem doesn't open on SoundExchange.
  const [agency, setAgency] = useState<IssueAgency>(() =>
    order.agencies.find((name) => isIssueAgency(name) && name !== "Internal/Metadata") as IssueAgency | undefined
      ?? "Internal/Metadata",
  );
  const [detail, setDetail] = useState("");
  const [onHold, setOnHold] = useState(true);
  const [busy, setBusy] = useState(false);
  const currentStatus = Object.entries(song.status)
    .map(([name, value]) => `${name} ${SONG_STATUS_LABEL[value as SongStatus] ?? value}`)
    .join(" · ") || "Pending";

  const holdable = agency !== "Internal/Metadata";

  const submit = async () => {
    setBusy(true);
    try {
      const answer = await report({ data: { songId: song.id, agency, detail: detail.trim(), setOnHold: holdable && onHold } });
      toast.success(answer.held ? "Reported, and the song is On Hold." : "Reported. It's on the Message Board.");
      onSaved();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't file that.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] w-[calc(100vw-2rem)] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="break-words">Report an Issue</DialogTitle>
          <DialogDescription className="break-words">
            This opens a Reported Issue thread on the Message Board, linked back to this customer.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs">
          <p className="break-words"><span className="font-semibold">Customer:</span> {order.customer} · {order.email ?? "no email"}</p>
          <p className="break-words"><span className="font-semibold">Song:</span> {song.title}</p>
          <p className="break-words"><span className="font-semibold">ISRC:</span> {song.isrc || "—"}</p>
          <p className="break-words"><span className="font-semibold">Status:</span> {currentStatus}</p>
        </div>

        <label className="block text-sm">
          <span className="font-medium">Which agency is affected?</span>
          <select
            className="mt-1 min-h-11 w-full rounded-md border border-input bg-background px-2"
            value={agency}
            onChange={(event) => setAgency(event.target.value as IssueAgency)}
          >
            {ISSUE_AGENCIES.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
        </label>

        <label className="block text-sm">
          <span className="font-medium">What is blocking it?</span>
          <Textarea
            className="mt-1 min-h-28"
            value={detail}
            maxLength={4000}
            placeholder="Wrong IPI, split doesn't total 100%, the invited address is wrong, the portal won't accept the ISRC…"
            onChange={(event) => setDetail(event.target.value)}
          />
          <span className="text-xs text-muted-foreground">{detail.trim().length}/4000 · at least 10 characters</span>
        </label>

        {holdable && (
          <label className="flex min-h-11 items-start gap-2 rounded-lg border border-border p-3 text-sm">
            <Checkbox checked={onHold} onCheckedChange={(value) => setOnHold(value === true)} className="mt-0.5" />
            <span className="min-w-0 break-words">
              Switch {agency} to <strong>On Hold</strong> until this is resolved
            </span>
          </label>
        )}

        <p className="flex items-start gap-2 text-xs text-muted-foreground">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          A resolved issue is marked on the Message Board, which also settles the case here.
        </p>

        <DialogFooter className="gap-2">
          <Button variant="ghost" className="min-h-11" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button className="min-h-11" onClick={() => void submit()} disabled={busy || detail.trim().length < 10}>
            {busy ? "Filing…" : "Report an Issue"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
