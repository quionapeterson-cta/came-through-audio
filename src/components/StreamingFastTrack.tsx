import { useEffect, useState } from "react";
import { CloudDownload, Copy, ShieldCheck, ShieldQuestion, ShieldX, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UpgradeLock } from "@/components/UpgradeLock";
import { runStreamingFastTrack, type FastTrackResult } from "@/lib/fast-track.functions";
import type { ArtistCandidate } from "@/lib/discography";
import { MLC_SEARCH_URL, UNREGISTERED_DIAGNOSIS, compositionCounts } from "@/lib/composition";
import { listTracks, saveTrack, type CatalogTrack } from "@/lib/catalog";
import { loadProfile } from "@/lib/artist-profile";
import { prefillPlan, withStreamingDetails, type PrefillPlan } from "@/lib/fast-track-prefill";
import { SOVEREIGN_BACKUP } from "@/lib/copy";
import { clearIntake, readIntake, writeIntake } from "@/lib/intake-session";

/**
 * Streaming Profile — the Streaming Fast-Track intake (hub plan §4). The recording side is live on Deezer with no
 * account or key; the composition side says plainly what it does and does not know. A released track with no MLC
 * answer is "Not yet verified", never "unregistered", unless The MLC actually searched and found nothing.
 *
 * Independent artists usually share a name with someone, so a name search that is not uniquely matched shows the
 * candidates and asks which one is them. Nobody's catalog gets diagnosed against a stranger.
 */
type Ok = Extract<FastTrackResult, { ok: true; kind: "discography" }>;

/** What to do with a pulled song that matches one already in My Catalog. */
type Choice = "keep" | "streaming" | "both";

/** What the prefill did: songs added, songs left alone, and the first one, to open for audio. */
type SavedPull = { added: number; updated: number; kept: number; existing: number; matched: number; first?: string | undefined };
/** The sitting's pull, kept for the account so leaving the check-in doesn't throw it away. */
type StreamSession = {
  link: string;
  name: string;
  result?: Ok | undefined;
  candidates?: ArtistCandidate[] | undefined;
  saved?: SavedPull | undefined;
  later?: boolean | undefined;
  dismissed?: boolean | undefined;
};

/** Each recording once, however many releases list it: what the "Add" button can honestly promise. */
const uniqueRecordings = (r: Ok) => {
  const seen = new Set<string>();
  let n = 0;
  for (const release of r.discography.releases)
    for (const t of release.tracks) {
      const isrc = (t.isrc ?? "").trim().toUpperCase();
      if (isrc && seen.has(isrc)) continue;
      if (isrc) seen.add(isrc);
      n += 1;
    }
  return n;
};

export function StreamingFastTrack({ userId, canCatalog = false, onUpgrade, onUploadAudio, onSaved }: {
  userId?: string | undefined;
  /** Prefilling My Catalog is a paid feature (plan §4.6); the diagnosis itself is free on every plan (§4.8). */
  canCatalog?: boolean | undefined;
  onUpgrade?: ((priceId?: string) => void) | undefined;
  /** Opens My Catalog on a prefilled song, at its master upload. */
  onUploadAudio?: ((trackId?: string) => void) | undefined;
  /** Told after songs land in My Catalog, so the Doctor examines them in this same visit. */
  onSaved?: (() => void) | undefined;
}) {
  const [link, setLink] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [result, setResult] = useState<Ok | undefined>();
  const [candidates, setCandidates] = useState<ArtistCandidate[] | undefined>();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<SavedPull>();
  /** Songs that look like ones already in My Catalog, waiting on the member's choice before anything is written. */
  const [review, setReview] = useState<{ plan: PrefillPlan; tracks: CatalogTrack[]; choices: Choice[] }>();
  const [later, setLater] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // A pull is a sitting, not a page: switching intake, leaving the Hub or opening a second window used to empty it.
  // The result is public streaming data, so it stays on this device against the account until it is started over.
  const [restored, setRestored] = useState(false);
  useEffect(() => {
    const s = readIntake<StreamSession>(userId, "streaming");
    if (s) {
      setLink(s.link ?? "");
      setName(s.name ?? "");
      if (s.candidates?.length) setCandidates(s.candidates);
      else if (s.result) setResult(s.result);
      setSaved(s.saved);
      setLater(!!s.later);
      setDismissed(!!s.dismissed);
    }
    setRestored(true);
  }, [userId]);
  useEffect(() => {
    if (!restored || !userId) return;
    if (!link && !name && !result && !candidates) { clearIntake(userId, "streaming"); return; }
    writeIntake<StreamSession>(userId, "streaming", { link, name, result, candidates, saved, later, dismissed });
  }, [restored, userId, link, name, result, candidates, saved, later, dismissed]);

  function forget() {
    setResult(undefined);
    setCandidates(undefined);
    setError(undefined);
    setSaved(undefined);
    setReview(undefined);
    setLater(false);
    setDismissed(false);
  }

  /**
   * Prefills My Catalog with the pull (plan §4.6): recording details from streaming, composition details only from a
   * work The MLC actually returned, and blanks filled from the artist's profile. A song with the same ISRC is never
   * touched; one with the same title but another code waits for the member to choose, so a pull never overwrites an
   * entry on its own.
   */
  async function saveToCatalog() {
    if (!result || !userId) return;
    setSaving(true);
    try {
      const existing = await listTracks(userId);
      const plan = prefillPlan({
        discography: result.discography,
        matches: result.matches,
        existing: existing.map((t) => ({ id: t.id, title: t.title, artist: t.artist, isrc: t.metadata.isrc, album: t.metadata.album })),
        profile: loadProfile(userId),
      });
      if (plan.conflicts.length) setReview({ plan, tracks: existing, choices: plan.conflicts.map(() => "keep") });
      else await commit(plan, existing, []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't add these songs to your catalog. Try again.");
    } finally {
      setSaving(false);
    }
  }

  async function commit(plan: PrefillPlan, tracks: CatalogTrack[], choices: Choice[]) {
    let first: string | undefined;
    let updated = 0;
    let both = 0;
    for (const song of plan.songs) {
      const id = await saveTrack(song, userId!);
      first ??= id;
    }
    for (const [i, c] of plan.conflicts.entries()) {
      const choice = choices[i] ?? "keep";
      if (choice === "keep") continue;
      if (choice === "both") {
        const id = await saveTrack(c.song, userId!);
        first ??= id;
        both += 1;
        continue;
      }
      const mine = tracks.find((t) => t.id === c.existing.id);
      if (!mine) continue;
      await saveTrack(withStreamingDetails(mine.metadata, c.song), userId!, mine.id);
      updated += 1;
    }
    const added = plan.songs.length + both;
    const kept = plan.conflicts.length - updated - both;
    setSaved({ added, updated, kept, existing: plan.existingCount, matched: plan.matchedCount, first });
    setReview(undefined);
    setLater(false);
    if (added || updated) {
      toast.success([added && `${added} song${added === 1 ? "" : "s"} added`, updated && `${updated} updated`].filter(Boolean).join(", ") + " in My Catalog.");
      onSaved?.();
    } else {
      toast.success("Nothing changed: every track here is already in your catalog.");
    }
  }

  async function confirmReview() {
    if (!review) return;
    setSaving(true);
    try {
      await commit(review.plan, review.tracks, review.choices);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't add these songs to your catalog. Try again.");
    } finally {
      setSaving(false);
    }
  }

  async function run(pick?: ArtistCandidate) {
    setBusy(true);
    setError(undefined);
    try {
      const r = await runStreamingFastTrack({
        data: {
          ...(pick ? { artistId: pick.id } : {}),
          ...(!pick && link.trim() ? { link: link.trim() } : {}),
          ...(!pick && name.trim() ? { name: name.trim() } : {}),
        },
      });
      if (!r.ok) {
        setError(r.error);
        setResult(undefined);
        setCandidates(undefined);
        return;
      }
      if (r.kind === "choose") {
        setCandidates(r.candidates);
        setResult(undefined);
        return;
      }
      setCandidates(undefined);
      setResult(r);
      setSaved(undefined);
      setLater(false);
      setDismissed(false);
    } catch {
      setError("Couldn't reach the server. Try again in a moment.");
    } finally {
      setBusy(false);
    }
  }

  const counts = result ? compositionCounts(result.matches) : undefined;
  const sourceName = result?.discography.source === "spotify" ? "Spotify" : "Deezer";

  return (
    <div className="space-y-4">
      <p className="max-w-[70ch] text-sm text-muted-foreground">
        Paste your Deezer or Spotify artist link, or just type your artist name. We pull every
        released track with its ISRC, UPC, release date and artwork — no account and no approval
        needed.
      </p>

      <div className="grid gap-2 sm:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span className="font-semibold">Artist or release link</span>
          <Input
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="https://open.spotify.com/artist/…"
            inputMode="url"
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-semibold">Artist name</span>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your artist name"
          />
        </label>
      </div>
      <p className="text-xs text-muted-foreground">
        A link is the most exact way to say who you are — it names you, not just your name. Deezer
        links are read directly; Spotify links are read when our Spotify key is configured.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => void run()} disabled={busy || (!link.trim() && !name.trim())}>
          {busy ? <Loader2 className="animate-spin" /> : <CloudDownload />}
          {busy ? "Reading your releases…" : "Pull my streaming releases"}
        </Button>
        {(result || candidates) && (
          <Button variant="ghost" onClick={forget}>
            Start over
          </Button>
        )}
      </div>

      {error && (
        <p className="rounded-xl border border-border bg-muted/40 p-3 text-sm" role="alert">
          {error}
        </p>
      )}

      {candidates && (
        <div className="rounded-2xl border-2 border-primary/40 bg-card p-4">
          <p className="font-bold">Which one is you?</p>
          <p className="mt-1 text-sm text-muted-foreground">
            More than one artist uses this name. We won't guess — pick yourself, and every check
            after this is about your catalog only. A Deezer artist link would skip this step.
          </p>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {candidates.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void run(c)}
                  className="flex w-full items-center gap-3 rounded-xl border border-border p-3 text-left transition hover:border-primary disabled:opacity-50"
                >
                  {c.picture ? (
                    <img
                      src={c.picture}
                      alt=""
                      className="h-10 w-10 rounded-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <span className="h-10 w-10 rounded-full bg-muted" />
                  )}
                  <span className="min-w-0 flex-1">
                    <b className="block truncate">{c.name}</b>
                    <span className="text-xs text-muted-foreground">
                      {c.releaseCount ?? 0} release{(c.releaseCount ?? 0) === 1 ? "" : "s"}
                      {c.fans ? ` · ${c.fans.toLocaleString()} fans` : ""}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {result && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="flex flex-wrap items-center gap-3">
              {result.discography.artist.picture && (
                <img
                  src={result.discography.artist.picture}
                  alt=""
                  className="h-12 w-12 rounded-full object-cover"
                  loading="lazy"
                />
              )}
              <div className="min-w-0 flex-1">
                <b className="block text-lg">{result.discography.artist.name}</b>
                <span className="text-sm text-muted-foreground">
                  {result.discography.releases.length} release
                  {result.discography.releases.length === 1 ? "" : "s"} ·{" "}
                  {result.discography.trackCount} track
                  {result.discography.trackCount === 1 ? "" : "s"} · {result.discography.withIsrc}{" "}
                  with an ISRC
                  {result.discography.truncated ? " · newest releases only" : ""}
                </span>
              </div>
              <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                Recording side · {result.discography.source === "spotify" ? "Spotify" : "Deezer"}
              </span>
            </div>
          </div>

          {/* §4.6: paid accounts get the pull saved into My Catalog, then choose to upload audio now or later. */}
          {canCatalog ? (
            saved ? (
              <div className="rounded-2xl border-2 border-primary/40 bg-primary/5 p-4 text-sm">
                <p className="font-bold">Your catalog is prefilled</p>
                <p className="mt-1 text-muted-foreground">
                  {saved.added
                    ? `${saved.added} song${saved.added === 1 ? " is" : "s are"} in My Catalog with ${saved.added === 1 ? "its" : "their"} verified details${saved.matched ? `, ${saved.matched} with the writers and publishers on file at The MLC` : ""}. All you need to do is upload your masters, then embed and download them.`
                    : saved.updated ? "" : "Every track in this pull is already in My Catalog, so nothing was added."}
                  {saved.updated ? ` ${saved.updated} of your entries took ${sourceName}'s recording details (ISRC, UPC, release, track number), keeping your writers, lyrics and master.` : ""}
                  {saved.kept ? ` ${saved.kept} of your entries ${saved.kept === 1 ? "was" : "were"} kept as ${saved.kept === 1 ? "it is" : "they are"}, as you chose.` : ""}
                  {saved.existing ? ` ${saved.existing} song${saved.existing === 1 ? " was" : "s were"} already there with the same ISRC and left exactly as ${saved.existing === 1 ? "it is" : "they are"}.` : ""}
                </p>
                {later ? (
                  <p className="mt-2 text-muted-foreground">Kept for later: they're in My Catalog whenever you're ready to add the audio.</p>
                ) : (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Button onClick={() => onUploadAudio?.(saved.first)} disabled={!saved.first}>
                      <Upload />Upload audio now
                    </Button>
                    <Button variant="outline" onClick={() => setLater(true)}>Add Audio Later</Button>
                  </div>
                )}
                <p className="mt-2 text-xs text-muted-foreground">{SOVEREIGN_BACKUP}</p>
              </div>
            ) : review ? (
              <div className="rounded-2xl border-2 border-primary/40 bg-card p-4 text-sm">
                <p className="font-bold">
                  {review.plan.conflicts.length} song{review.plan.conflicts.length === 1 ? " looks" : "s look"} like {review.plan.conflicts.length === 1 ? "one" : "ones"} already in My Catalog
                </p>
                <p className="mt-1 max-w-[68ch] text-muted-foreground">
                  Same title, so this may be the entry you already have — with a different or missing ISRC, or a different
                  artist credit. Choose which entry you want for each. <b>Use {sourceName}&apos;s</b> puts the released
                  ISRC, UPC, release and track number on your entry and keeps your writers, lyrics and master. Nothing is
                  saved until you confirm.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => setReview({ ...review, choices: review.choices.map(() => "streaming") })}>Use {sourceName}&apos;s for all</Button>
                  <Button size="sm" variant="outline" onClick={() => setReview({ ...review, choices: review.choices.map(() => "keep") })}>Keep mine for all</Button>
                </div>
                <ul className="mt-3 grid gap-2">
                  {review.plan.conflicts.map((c, i) => (
                    <li key={`${c.existing.id}-${c.song.isrc}`} className="rounded-xl border border-border p-3">
                      <div className="grid gap-2 sm:grid-cols-2">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Yours</p>
                          <b className="block truncate">{c.existing.title}</b>
                          <span className="text-xs text-muted-foreground">{[c.existing.album, c.existing.isrc ? `ISRC ${c.existing.isrc}` : "No ISRC"].filter(Boolean).join(" · ")}</span>
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold uppercase tracking-wide text-primary">{sourceName}</p>
                          <b className="block truncate">{c.song.title}</b>
                          <span className="text-xs text-muted-foreground">{[c.song.album, c.song.releaseDate.slice(0, 4), c.song.isrc ? `ISRC ${c.song.isrc}` : ""].filter(Boolean).join(" · ")}</span>
                        </div>
                      </div>
                      <div role="radiogroup" aria-label={`What to do with ${c.existing.title}`} className="mt-2 flex flex-wrap gap-2">
                        {([["streaming", `Use ${sourceName}'s`], ["keep", "Keep mine"], ["both", "Keep both"]] as const).map(([value, label]) => (
                          <Button key={value} type="button" size="sm" role="radio" aria-checked={review.choices[i] === value}
                            variant={review.choices[i] === value ? "default" : "outline"}
                            onClick={() => setReview({ ...review, choices: review.choices.map((x, j) => (j === i ? value : x)) })}>
                            {label}
                          </Button>
                        ))}
                      </div>
                    </li>
                  ))}
                </ul>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Button onClick={() => void confirmReview()} disabled={saving}>
                    {saving ? <Loader2 className="animate-spin" /> : <CloudDownload />}
                    {saving ? "Saving to My Catalog…" : "Confirm and save"}
                  </Button>
                  <Button variant="ghost" onClick={() => setReview(undefined)} disabled={saving}>Cancel</Button>
                  <span className="text-xs text-muted-foreground">
                    {review.plan.songs.length} new song{review.plan.songs.length === 1 ? "" : "s"} will be added too.
                  </span>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-border bg-card p-4 text-sm">
                <p className="font-bold">Keep these releases in your own catalog</p>
                <p className="mt-1 max-w-[68ch] text-muted-foreground">
                  Every track can be saved to My Catalog with what streaming confirmed: title, artist, release, track
                  number, duration, ISRC, UPC and label. A song you already have with the same ISRC is left untouched;
                  one with the same title and another code is yours to choose. Then upload the masters now or later.
                </p>
                <Button className="mt-3" onClick={() => void saveToCatalog()} disabled={saving}>
                  {saving ? <Loader2 className="animate-spin" /> : <CloudDownload />}
                  {saving
                    ? "Adding to My Catalog…"
                    : `Add ${uniqueRecordings(result)} released track${uniqueRecordings(result) === 1 ? "" : "s"} to My Catalog`}
                </Button>
              </div>
            )
          ) : dismissed ? (
            <p className="rounded-xl border border-dashed border-border p-3 text-sm text-muted-foreground">
              Your diagnosis below is complete and free. Saving these releases to My Catalog starts with Catalog Plus.
            </p>
          ) : (
            <UpgradeLock
              tier="plus"
              title="Save these releases in your own catalog"
              text="Your diagnosis, report and prescriptions stay free. Saving pulled tracks to My Catalog and downloading embedded masters start with Catalog Plus."
              onUpgrade={() => onUpgrade?.()}
              free={{ label: "Not now", onClick: () => setDismissed(true) }}
            />
          )}

          {counts && !result.mlcActive && (
            <div className="rounded-2xl border border-border bg-muted/40 p-4 text-sm">
              <p className="font-semibold">
                Recording data verified. Composition checks not yet active.
              </p>
              <p className="mt-1 text-muted-foreground">
                Your released tracks and their ISRCs are confirmed. The musician-work side — writers
                as registered, publisher, IPI, ISWC — needs our MLC Public Search API access, which
                isn't active yet. Every work below is marked <b>Not yet verified</b> and opens The
                MLC's public search so you can confirm it yourself. None of them are being called
                missing.
              </p>
            </div>
          )}

          {result.discography.releases.map((release, ri) => (
            <div key={release.id} className="rounded-2xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-center gap-3">
                {release.cover && (
                  <img
                    src={release.cover}
                    alt=""
                    className="h-14 w-14 rounded-lg object-cover"
                    loading="lazy"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <b className="block">{release.title}</b>
                  <span className="text-xs text-muted-foreground">
                    {[
                      release.recordType,
                      release.releaseDate,
                      release.label,
                      release.upc ? `UPC ${release.upc}` : "no UPC",
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </div>
              </div>
              <ul className="mt-3 divide-y divide-border">
                {release.tracks.map((track, ti) => (
                  <li
                    key={`${release.id}-${track.deezerId ?? ti}`}
                    className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm"
                  >
                    <span className="min-w-0 flex-1 truncate">
                      <b className="font-semibold">{track.title}</b>
                      <span className="block text-xs text-muted-foreground">
                        {track.isrc ?? "no ISRC on this release"}
                      </span>
                    </span>
                    <CompositionChip
                      match={result.matches[indexOfTrack(result, ri, ti)]}
                      title={track.title}
                    />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Matches are returned in track order, so the flat position is the release's offset plus the track's index. */
function indexOfTrack(result: Ok, releaseIndex: number, trackIndex: number) {
  let n = 0;
  for (let i = 0; i < releaseIndex; i++) n += result.discography.releases[i]!.tracks.length;
  return n + trackIndex;
}

function CompositionChip({
  match,
  title,
}: {
  match: Ok["matches"][number] | undefined;
  title: string;
}) {
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(title);
      toast.success("Title copied — paste it into the MLC search.");
    } catch {
      toast.error("Couldn't copy. Select the title by hand.");
    }
  };

  if (!match) return null;
  if (match.status === "matched") {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary"
        title={match.note}
      >
        <ShieldCheck className="h-3.5 w-3.5" /> On file at The MLC
      </span>
    );
  }
  if (match.status === "unregistered") {
    return (
      <span className="inline-flex flex-col items-start gap-0.5 text-xs" title={match.note}>
        <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-3 py-1 font-semibold text-destructive">
          <ShieldX className="h-3.5 w-3.5" /> No work on file
        </span>
        <span className="text-muted-foreground">{UNREGISTERED_DIAGNOSIS}</span>
      </span>
    );
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-2 text-xs">
      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1 font-semibold text-muted-foreground">
        <ShieldQuestion className="h-3.5 w-3.5" /> Not yet verified
      </span>
      <a
        href={MLC_SEARCH_URL}
        target="_blank"
        rel="noreferrer"
        className="font-semibold text-primary underline-offset-2 hover:underline"
      >
        Check at The MLC
      </a>
      <button
        type="button"
        onClick={() => void copy()}
        className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
      >
        <Copy className="h-3.5 w-3.5" /> copy title
      </button>
    </span>
  );
}
