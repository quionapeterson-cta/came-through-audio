import { useMemo, useState } from "react";
import { Package } from "lucide-react";
import { toast } from "sonner";
import { LabDownloadMenu, type LabDownloadFormat } from "@/components/LabDownloadMenu";
import { useTaxTables } from "@/components/use-tax-tables";
import { myBrand } from "@/lib/brand-load";
import type { CatalogTrack } from "@/lib/catalog";
import { blueprintOf, planFromStore } from "@/lib/financial-lab-budgets";
import {
  labStorageKey,
  readLabJson,
  readLabStore,
  writeLabJson,
} from "@/lib/financial-lab-scenario";
import { sanitizeTaxSheet } from "@/lib/financial-lab-tax";
import {
  packetKinds,
  packetPlatforms,
  packetReleaseName,
  packetScopeSongs,
  packetTallySlot,
  packetTallyTotal,
  packetTallyUsed,
  packetYears,
  sanitizePacketTally,
  type PacketChoice,
  type PacketMode,
  type PacketSong,
  type PacketTally,
} from "@/lib/lab-packet";
import { downloadPacketPdf } from "@/lib/lab-packet-pdf";
import { downloadPacketSheetCsv, downloadPacketXlsx } from "@/lib/lab-packet-sheet";
import { catalogReleases, type RoutedKind } from "@/lib/release-routing";
import { PLATFORMS } from "@/lib/royalty-calc";

/**
 * The packet's controls, sitting beside the projection's own download: pick what the packet covers — the open song, one
 * release, a handful of songs or the whole catalog — pick the tax year, and build the one branded PDF a member can hand
 * to an accountant.
 *
 * The Lab tools each keep their own copy for one song. The packet reads what each of the chosen songs already saved, so
 * it never asks the member to type the same streams, costs or budget twice. The one exception is the scope's platform
 * tally: those totals only exist across songs, so they are entered here and saved for this scope and tax year.
 */
const MODES: { id: PacketMode; label: string }[] = [
  { id: "song", label: "This song" },
  { id: "release", label: "One release (EP or album)" },
  { id: "songs", label: "Pick songs" },
  { id: "catalog", label: "Entire catalog" },
];

const count = (n: number) => Math.round(n).toLocaleString("en-US");

/** One catalog song as the packet needs it: its saved numbers, its worksheet and its budget plan. */
function readSong(track: CatalogTrack, userId: string | undefined, kind: RoutedKind): PacketSong {
  const numbers = readLabStore(labStorageKey(userId, track.id, "royalty")).current;
  const tax = sanitizeTaxSheet(readLabJson(labStorageKey(userId, track.id, "tax")));
  const stored = planFromStore(readLabJson(labStorageKey(userId, track.id, "budgetPlan")));
  return {
    id: track.id,
    title: track.title,
    release: packetReleaseName(track),
    kind,
    numbers,
    tax,
    budget: stored
      ? { project: blueprintOf(stored.kind).name, target: stored.target, rows: stored.rows }
      : null,
  };
}

export function LabPacketExport({
  tracks,
  userId,
  songId,
}: {
  tracks: CatalogTrack[];
  userId: string | undefined;
  songId: string;
}) {
  const { tables } = useTaxTables();
  const kinds = useMemo(() => packetKinds(tracks), [tracks]);
  const releases = useMemo(
    () =>
      catalogReleases(
        tracks,
        (t) => t.metadata,
        (t) => t.id,
      ),
    [tracks],
  );
  const [mode, setMode] = useState<PacketMode>(songId ? "song" : "catalog");
  const [release, setRelease] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [year, setYear] = useState("");
  const [building, setBuilding] = useState(false);

  // With no song open there is nothing for "This song" to cover, so the choice falls back to the whole catalog.
  const effectiveMode: PacketMode = mode === "song" && !songId ? "catalog" : mode;
  const releaseValue = release || releases[0]?.album || "";
  const years = useMemo(() => packetYears(tables), [tables]);
  const openSong = tracks.find((track) => track.id === songId);
  const currentYear = useMemo(() => {
    if (openSong) {
      const tax = sanitizeTaxSheet(readLabJson(labStorageKey(userId, openSong.id, "tax")));
      const saved = Number(tax.year);
      if (Number.isInteger(saved) && saved > 2000 && saved < 2100) return saved;
    }
    const calendar = new Date().getFullYear();
    return years.includes(calendar) ? calendar : (years[0] ?? calendar);
  }, [openSong, userId, years]);
  const yearValue = Number(year || currentYear);
  const choice: PacketChoice = {
    mode: effectiveMode,
    songId,
    release: releaseValue,
    songIds: picked,
  };
  const scope = packetScopeSongs(tracks, choice);

  // The songs are read once per scope so the tally's placeholders can show each platform's saved streams.
  const scopeKey = scope.ids.join("|");
  const scopeSongs = useMemo(() => {
    if (!scopeKey) return [];
    const ids = new Set(scopeKey.split("|"));
    return tracks
      .filter((track) => ids.has(track.id))
      .map((track) => readSong(track, userId, kinds.get(track.id) ?? "Single"));
  }, [scopeKey, tracks, userId, kinds]);
  const savedPlatforms = useMemo(() => packetPlatforms(scopeSongs), [scopeSongs]);
  const savedStreams = savedPlatforms.reduce((sum, platform) => sum + platform.streams, 0);
  const scopeReleases = new Set(
    scope.ids
      .map((id) => tracks.find((track) => track.id === id))
      .filter((track): track is CatalogTrack => Boolean(track))
      .map((track) => packetReleaseName(track).trim().toLowerCase()),
  ).size;

  // A tally belongs to the scope and tax year on screen. Changing either loads that packet's own totals.
  const tallyKey = labStorageKey(userId, packetTallySlot(scope.ids, yearValue), "tally");
  const [loaded, setLoaded] = useState<{ key: string; tally: PacketTally }>(() => ({
    key: tallyKey,
    tally: sanitizePacketTally(readLabJson(tallyKey)),
  }));
  if (loaded.key !== tallyKey) {
    setLoaded({ key: tallyKey, tally: sanitizePacketTally(readLabJson(tallyKey)) });
  }
  const tally = loaded.tally;
  const tallied = packetTallyTotal(tally);

  function saveTally(next: PacketTally) {
    setLoaded({ key: tallyKey, tally: next });
    writeLabJson(tallyKey, next);
  }

  function start(next: PacketMode) {
    setMode(next);
    if (next === "songs" && !picked.length) setPicked(songId ? [songId] : []);
  }

  async function build(format: LabDownloadFormat) {
    if (!scopeSongs.length) {
      toast.error("Pick at least one song for the packet.");
      return;
    }
    setBuilding(true);
    try {
      // The server decides whether the member's own kit may print here; a null answer keeps our header.
      const brand = await myBrand("lab");
      const meta = {
        label: scope.label,
        year: yearValue,
        tables,
        brand,
        ...(packetTallyUsed(tally) ? { tally } : {}),
      };
      if (format === "pdf") await downloadPacketPdf(scopeSongs, meta);
      else if (format === "sheets") downloadPacketSheetCsv(scopeSongs, meta);
      else await downloadPacketXlsx(scopeSongs, meta);
      const kind =
        format === "pdf" ? "Packet" : format === "sheets" ? "Google Sheet" : "Excel packet";
      toast.success(
        `${kind} downloaded — ${count(scopeSongs.length)} ${scopeSongs.length === 1 ? "song" : "songs"}. Email a copy to yourself and your accountant.`,
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't build the packet.");
    } finally {
      setBuilding(false);
    }
  }

  return (
    <section className="mt-3 space-y-3 rounded-xl border border-border/60 bg-background/40 p-3">
      <div>
        <p className="flex items-center gap-2 text-sm font-semibold">
          <Package className="h-4 w-4" aria-hidden="true" />
          Financial Lab packet
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          One branded PDF: totals summary, tax worksheet, production budget, a fillable platform
          tally and the royalty projection for the same songs and tax year.
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <label className="block space-y-1 text-xs font-semibold">
          What it covers
          <select
            className="fl-select w-full"
            value={effectiveMode}
            onChange={(event) => start(event.target.value as PacketMode)}
          >
            {MODES.map((item) => (
              <option key={item.id} value={item.id} disabled={item.id === "song" && !songId}>
                {item.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block space-y-1 text-xs font-semibold">
          Tax year
          <select
            className="fl-select w-full"
            value={yearValue}
            onChange={(event) => setYear(event.target.value)}
          >
            {[...new Set([yearValue, ...years])].map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>

        {effectiveMode === "release" && (
          <label className="block space-y-1 text-xs font-semibold sm:col-span-2">
            Release
            <select
              className="fl-select w-full"
              value={releaseValue}
              onChange={(event) => setRelease(event.target.value)}
            >
              {releases.map((item) => (
                <option key={item.album} value={item.album}>
                  {item.album} · {item.kind}
                </option>
              ))}
            </select>
          </label>
        )}

        {effectiveMode === "songs" && (
          <div className="space-y-1 text-xs font-semibold sm:col-span-2">
            <div className="flex items-center justify-between gap-2">
              <span>Songs</span>
              <button
                type="button"
                className="text-[0.7rem] font-semibold text-muted-foreground underline-offset-2 hover:underline"
                onClick={() =>
                  setPicked(picked.length === tracks.length ? [] : tracks.map((t) => t.id))
                }
              >
                {picked.length === tracks.length ? "Clear" : "Select all"}
              </button>
            </div>
            <div className="max-h-44 space-y-1 overflow-y-auto rounded-md border border-border/60 p-2 font-normal">
              {tracks.map((track) => (
                <label key={track.id} className="flex items-start gap-2 text-xs">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={picked.includes(track.id)}
                    onChange={(event) =>
                      setPicked((current) =>
                        event.target.checked
                          ? [...current, track.id]
                          : current.filter((id) => id !== track.id),
                      )
                    }
                  />
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{track.title || "Untitled"}</span>
                    <span className="block truncate text-[0.7rem] text-muted-foreground">
                      {packetReleaseName(track)} · {kinds.get(track.id) ?? "Single"}
                    </span>
                  </span>
                </label>
              ))}
              {!tracks.length && (
                <p className="text-xs text-muted-foreground">No songs in the catalog yet.</p>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="rounded-md bg-muted/50 px-2.5 py-2 text-xs text-muted-foreground">
        <span className="font-semibold text-foreground">
          {count(scope.ids.length)} {scope.ids.length === 1 ? "song" : "songs"} in scope
        </span>
        {scope.ids.length
          ? ` · ${count(scopeReleases)} ${scopeReleases === 1 ? "release" : "releases"}`
          : ""}
        <span className="mt-1 block">
          These are the scope's report totals; they price the packet's projection. The per-song
          sheet above keeps its own streams, and each song still keeps its saved figures.
        </span>
      </div>

      <details className="rounded-lg border border-border/60">
        <summary className="cursor-pointer px-2.5 py-2 text-xs font-semibold">
          Platform tally for this scope
          <span className="ml-1 font-normal text-muted-foreground">
            {tallied ? `· ${count(tallied)} tallied` : "· optional"}
          </span>
        </summary>
        <div className="space-y-2 border-t border-border/60 p-2.5">
          <p className="text-[0.7rem] leading-relaxed text-muted-foreground">
            Type each platform&apos;s total from its report. The packet&apos;s tally page adds them
            up itself, and its projection uses these streams. Leave a platform blank to keep its
            saved streams.
          </p>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {PLATFORMS.map((platform) => {
              const saved = savedPlatforms.find((row) => row.id === platform.id)?.streams ?? 0;
              return (
                <label
                  key={platform.id}
                  className="flex items-center justify-between gap-2 rounded-md border border-border/50 bg-background/60 px-2 py-1 text-xs"
                >
                  <span className="min-w-0 truncate font-medium">{platform.name}</span>
                  <input
                    className="fl-input fl-mono h-7 w-20 text-right"
                    inputMode="numeric"
                    placeholder={saved ? count(saved) : "—"}
                    aria-label={`${platform.name} streams tallied`}
                    value={tally[platform.id] ?? ""}
                    onChange={(event) => {
                      const digits = event.target.value.replace(/\D/g, "").slice(0, 12);
                      const next = { ...tally };
                      if (digits) next[platform.id] = digits;
                      else delete next[platform.id];
                      saveTally(next);
                    }}
                  />
                </label>
              );
            })}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span>
              Tallied total <strong className="fl-mono">{tallied ? count(tallied) : "—"}</strong>
              {savedStreams ? (
                <span className="ml-2 text-muted-foreground">
                  saved in the Lab: {count(savedStreams)}
                </span>
              ) : null}
            </span>
            {tallied ? (
              <button
                type="button"
                className="text-[0.7rem] font-semibold text-muted-foreground underline-offset-2 hover:underline"
                onClick={() => saveTally({})}
              >
                Clear tally
              </button>
            ) : null}
          </div>
        </div>
      </details>

      <div className="flex flex-wrap items-center gap-2">
        <LabDownloadMenu
          label="Download packet"
          busy={building}
          onPick={(format) => void build(format)}
          hints={{
            pdf: "The full packet as a branded PDF, with a fillable tally page that totals itself",
            sheets: "A .csv for Google Sheets with the tally and projection as live formulas",
            excel: "A .xlsx workbook with a sheet for each packet section and live formulas",
          }}
        />
        <span className="fl-platform-note !mt-0">
          Download it, then email a copy to yourself and your accountant. Nothing is sent for you.
        </span>
      </div>
    </section>
  );
}
