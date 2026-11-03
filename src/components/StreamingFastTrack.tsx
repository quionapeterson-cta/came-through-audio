import { useState } from "react";
import { CloudDownload, Copy, ShieldCheck, ShieldQuestion, ShieldX, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { runStreamingFastTrack, type FastTrackResult } from "@/lib/fast-track.functions";
import type { ArtistCandidate } from "@/lib/discography";
import { MLC_SEARCH_URL, UNREGISTERED_DIAGNOSIS, compositionCounts } from "@/lib/composition";

/**
 * Streaming Profile — the Streaming Fast-Track intake (hub plan §4). The recording side is live on Deezer with no
 * account or key; the composition side says plainly what it does and does not know. A released track with no MLC
 * answer is "Not yet verified", never "unregistered", unless The MLC actually searched and found nothing.
 *
 * Independent artists usually share a name with someone, so a name search that is not uniquely matched shows the
 * candidates and asks which one is them. Nobody's catalog gets diagnosed against a stranger.
 */
type Ok = Extract<FastTrackResult, { ok: true; kind: "discography" }>;

export function StreamingFastTrack() {
  const [link, setLink] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [result, setResult] = useState<Ok | undefined>();
  const [candidates, setCandidates] = useState<ArtistCandidate[] | undefined>();

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
    } catch {
      setError("Couldn't reach the server. Try again in a moment.");
    } finally {
      setBusy(false);
    }
  }

  const counts = result ? compositionCounts(result.matches) : undefined;

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
          <Button
            variant="ghost"
            onClick={() => {
              setResult(undefined);
              setCandidates(undefined);
              setError(undefined);
            }}
          >
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
