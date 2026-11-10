import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InfoTip } from "@/components/InfoTip";
import type { CatalogTrack } from "@/lib/catalog";
import type { SongStatus } from "@/lib/health-songs";
import { CREDIT_KEYS, parseWriters, readCopies, withCopy, writersText } from "@/lib/credit-copies";
import { creditCheck, masterCheck, masterLine, type LookupResult, type ProcessCheck, type WorkCopy } from "@/lib/process-check";

const today = () => new Date().toISOString().slice(0, 10);
const field = "flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const STATE_WORDS = { agree: "The three copies agree", difference: "Differences to fix", unknown: "Couldn't check everything" } as const;

/**
 * The credit check (§11) inside the Royalty Health Hub: the catalog, the registration and the release, side by side.
 * It opens on the differences, never claims a lookup it didn't run, and stores its inputs with the song's Hub state.
 */
export function CreditCheck({ track, status, onStatus, onFix }: {
  track: CatalogTrack;
  status: SongStatus;
  onStatus: (s: SongStatus) => void;
  onFix: (field: string) => void;
}) {
  const saved = useMemo(() => readCopies(status.steps), [status.steps]);
  const m = track.metadata;
  const [agencyResult, setAgencyResult] = useState<LookupResult>(saved.agency?.result ?? "found");
  // The copies start empty with the catalog's value only as a placeholder: a field prefilled with the catalog would
  // let "Run the credit check" record an agreement nobody entered.
  const [agencyTitle, setAgencyTitle] = useState(saved.agency?.title ?? "");
  const [agencyIswc, setAgencyIswc] = useState(saved.agency?.iswc ?? "");
  const [agencyIsrc, setAgencyIsrc] = useState(saved.agency?.isrc ?? "");
  const catalogWriters = m.writers.filter((w) => w.legalName?.trim()).map((w) => ({ legalName: w.legalName!.trim(), ...(w.ipi ? { ipi: w.ipi } : {}), ...(w.percentage ? { share: w.percentage } : {}) }));
  const [agencyWriters, setAgencyWriters] = useState(writersText(saved.agency?.writers));
  const [releaseTitle, setReleaseTitle] = useState(saved.release?.title ?? "");
  const [releaseWriters, setReleaseWriters] = useState(writersText(saved.release?.writers));
  const [readingAt, setReadingAt] = useState(saved.reading?.at ?? "");
  const [readingStreams, setReadingStreams] = useState(saved.reading ? String(saved.reading.streams) : "");
  const [result, setResult] = useState<ProcessCheck | undefined>();
  const [master, setMaster] = useState<ProcessCheck | undefined>();

  const run = () => {
    // A copy is stored and compared only when the member entered something in it. Nothing is filled in from the
    // catalog: that would report an agreement nobody checked and put words in the artist's release.
    const entered = (title: string, writers: string) => !!title.trim() || !!writers.trim();
    const agency: WorkCopy | null = entered(agencyTitle, agencyWriters) ? {
      name: "The registration", at: today(), verified: false, result: agencyResult, title: agencyTitle.trim(),
      ...(agencyIswc.trim() ? { iswc: agencyIswc.trim() } : {}), ...(agencyIsrc.trim() ? { isrc: agencyIsrc.trim() } : {}),
      writers: parseWriters(agencyWriters),
    } : null;
    const release: WorkCopy | null = entered(releaseTitle, releaseWriters)
      ? { name: "the release", at: today(), verified: false, result: "found", title: releaseTitle.trim(), writers: parseWriters(releaseWriters) }
      : null;
    const withAgency = withCopy(status, "agency", agency);
    onStatus(withCopy(withAgency, "release", release));
    setResult(creditCheck(m, agency, release));
  };

  const checkMaster = () => {
    const streams = Number(readingStreams);
    const reading = readingAt && Number.isFinite(streams) ? { at: readingAt, streams } : null;
    if (reading) onStatus(withCopy(status, "reading", reading));
    setMaster(masterCheck(m, reading));
  };

  const dealRecorded = !!(m.dealType || m.dealDate || m.dealStreams || m.dealContract);
  const shown = result ?? creditCheck(m, saved.agency, saved.release);
  const masterShown = master ?? masterCheck(m, saved.reading ?? null);
  const differences = shown.findings.filter((f) => f.state === "difference");
  const unknowns = shown.findings.filter((f) => f.state === "unknown");
  const matches = shown.facts.filter((f) => f.state === "match");

  return <div className="rounded-2xl border border-border p-4">
    <div className="flex flex-wrap items-center gap-2">
      <h5 className="text-sm font-extrabold uppercase tracking-[2px] text-primary">Credit check</h5>
      <InfoTip text="The same song exists three times: in your catalog, in the agency's registration and on the artist's release. This compares the three and names the copy to fix. A registration is what the PRO and The MLC pay on; a release credit is what listeners see." />
    </div>
    <p className="mt-1 text-sm text-muted-foreground">Your catalog is the copy you control. Fix that one first; the registration and the release belong to the other side.</p>

    <div className="mt-3 grid gap-3 lg:grid-cols-2">
      <details className="rounded-xl border border-border p-3" open={!saved.agency}>
        <summary className="cursor-pointer text-sm font-semibold">The registration</summary>
        <p className="mt-1 text-xs text-muted-foreground">Copy it from The MLC Public Search or your PRO's repertoire. Entered here is a claim, not a verified lookup.</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <label className="space-y-1 text-xs"><span className="font-semibold">What the agency's record says</span>
            <select aria-label="Registration lookup result" className={field} value={agencyResult} onChange={(e) => setAgencyResult(e.target.value as LookupResult)}>
              <option value="found">Found it</option>
              <option value="empty">The lookup ran and found nothing</option>
              <option value="unknown">Couldn't check</option>
            </select></label>
          <label className="space-y-1 text-xs"><span className="font-semibold">Title on the registration</span>
            <Input aria-label="Title on the registration" placeholder={m.title} value={agencyTitle} onChange={(e) => setAgencyTitle(e.target.value)} /></label>
          <label className="space-y-1 text-xs"><span className="font-semibold">ISWC</span>
            <Input aria-label="ISWC on the registration" placeholder={m.iswc} value={agencyIswc} onChange={(e) => setAgencyIswc(e.target.value)} /></label>
          <label className="space-y-1 text-xs"><span className="font-semibold">ISRC</span>
            <Input aria-label="ISRC on the registration" placeholder={m.isrc} value={agencyIsrc} onChange={(e) => setAgencyIsrc(e.target.value)} /></label>
        </div>
        <label className="mt-2 block space-y-1 text-xs"><span className="font-semibold">Writers, one per line: legal name | IPI | share</span>
          <textarea aria-label="Writers on the registration" rows={3} placeholder={writersText(catalogWriters)} className="w-full rounded-md border border-input bg-background p-2 text-sm" value={agencyWriters} onChange={(e) => setAgencyWriters(e.target.value)} /></label>
      </details>

      <details className="rounded-xl border border-border p-3" open={!saved.release}>
        <summary className="cursor-pointer text-sm font-semibold">The release credits</summary>
        <p className="mt-1 text-xs text-muted-foreground">The credit line the artist's distributor shows. Type it as released, spelling and all.</p>
        <div className="mt-2 grid gap-2">
          <label className="space-y-1 text-xs"><span className="font-semibold">Title on the release</span>
            <Input aria-label="Title on the release" placeholder={m.title} value={releaseTitle} onChange={(e) => setReleaseTitle(e.target.value)} /></label>
          <label className="space-y-1 text-xs"><span className="font-semibold">Writers credited, one per line</span>
            <textarea aria-label="Writers credited on the release" rows={3} placeholder={writersText(catalogWriters)} className="w-full rounded-md border border-input bg-background p-2 text-sm" value={releaseWriters} onChange={(e) => setReleaseWriters(e.target.value)} /></label>
        </div>
      </details>
    </div>

    <div className="mt-3 flex flex-wrap items-center gap-3">
      <Button type="button" size="sm" onClick={run}>Run the credit check</Button>
      {(saved.release?.at ?? saved.agency?.at) && <span className="text-xs text-muted-foreground">Last saved {saved.release?.at ?? saved.agency?.at} · entered, not verified by a lookup</span>}
    </div>

    <div className="mt-3 rounded-xl bg-muted p-3" aria-live="polite">
      <p className="text-sm font-semibold">{shown.state === "waiting" ? `Waiting on the ${shown.waitingFor ?? "release"}` : STATE_WORDS[shown.state]}</p>
      <p className="mt-1 text-sm text-muted-foreground">{shown.next}</p>
      {!!differences.length && <ul className="mt-2 space-y-2">
        {differences.map((f) => <li key={f.id} className="rounded-lg border border-border bg-card p-2 text-sm">
          <div className="font-semibold">⚠️ {f.title}</div>
          <div className="mt-1 text-xs text-muted-foreground">{f.detail}</div>
          {f.values && <div className="mt-1 grid gap-1 text-xs sm:grid-cols-3">
            <span><b>Catalog:</b> {f.values.catalog || "blank"}</span>
            <span><b>Registration:</b> {f.values.agency || "blank"}</span>
            <span><b>Release:</b> {f.values.release || "blank"}</span>
          </div>}
          {f.field && <Button type="button" size="sm" variant="outline" className="mt-2" onClick={() => onFix(f.field!)}>Fix in my catalog</Button>}
        </li>)}
      </ul>}
      {!!unknowns.length && <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
        {unknowns.map((f) => <li key={f.id}>• {f.title}: {f.detail}</li>)}
      </ul>}
      {!!matches.length && <details className="mt-2 text-sm"><summary className="cursor-pointer text-muted-foreground">{matches.length} fact{matches.length === 1 ? "" : "s"} agree</summary>
        <ul className="mt-1 space-y-1 text-xs text-muted-foreground">{matches.map((f) => <li key={f.key}>✓ {f.label}: {f.catalog}</li>)}</ul>
      </details>}
    </div>

    {dealRecorded && <div className="mt-4 rounded-xl border border-border p-3">
      <h6 className="text-sm font-semibold">Master checkup</h6>
      <p className="mt-1 text-xs text-muted-foreground">Where the recording stands against the deal's cap. The app never reads a distributor and never estimates a count: enter the reading you have.</p>
      <div className="mt-2 grid gap-2 sm:grid-cols-3">
        <label className="space-y-1 text-xs"><span className="font-semibold">Reading date</span>
          <Input aria-label="Reading date" type="date" value={readingAt} onChange={(e) => setReadingAt(e.target.value)} /></label>
        <label className="space-y-1 text-xs"><span className="font-semibold">Streams</span>
          <Input aria-label="Streams on the reading" inputMode="numeric" value={readingStreams} onChange={(e) => setReadingStreams(e.target.value.replace(/\D/g, "").slice(0, 12))} /></label>
        <div className="flex items-end"><Button type="button" size="sm" variant="outline" onClick={checkMaster}>Check the master</Button></div>
      </div>
      <p className="mt-2 text-sm">{masterLine(m, saved.reading ?? null)}</p>
      <p className="mt-1 text-xs text-muted-foreground">{masterShown.next}</p>
      {masterShown.findings.some((f) => f.id === "cap" && f.state === "difference") && <p className="mt-1 text-sm font-semibold text-primary">⚠️ {masterShown.findings.find((f) => f.id === "cap")!.title}</p>}
    </div>}
  </div>;
}
