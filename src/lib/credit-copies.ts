import type { SongStatus } from "@/lib/health-songs";
import type { LookupResult, StreamReading, WorkCopy, WriterCopy } from "@/lib/process-check";

/**
 * The credit check's inputs, kept with the song's Hub state (`health_song_status.steps`) so they follow the member to
 * any device without a new table. Each copy is stored as JSON under its own key; a step the member never filled in is
 * simply absent, which is not the same as an empty answer.
 */
export const CREDIT_KEYS = { agency: "credit:agency", release: "credit:release", reading: "credit:reading" } as const;

/** One writer per line: `Legal name | IPI | share`. Blanks are allowed and simply stay unset. */
export function parseWriters(text: string): WriterCopy[] {
  return text.split("\n").map((line) => line.trim()).filter(Boolean).map((line) => {
    const [legalName = "", ipi = "", share = ""] = line.split("|").map((v) => v.trim());
    return { legalName, ...(ipi ? { ipi } : {}), ...(share ? { share } : {}) };
  }).filter((w) => !!w.legalName);
}

export function writersText(rows: WriterCopy[] | undefined): string {
  return (rows ?? []).filter((r) => r.legalName.trim()).map((r) => [r.legalName.trim(), r.ipi?.trim() ?? "", r.share?.trim() ?? ""].filter(Boolean).join(" | ")).join("\n");
}

const isResult = (v: unknown): v is LookupResult => v === "found" || v === "empty" || v === "unknown";

function parseWork(raw: string | undefined): WorkCopy | undefined {
  if (!raw) return undefined;
  try {
    const v = JSON.parse(raw) as Partial<WorkCopy>;
    if (!v || typeof v !== "object" || typeof v.title !== "string" || typeof v.at !== "string") return undefined;
    return {
      name: typeof v.name === "string" ? v.name : "the registration",
      at: v.at,
      verified: v.verified === true,
      result: isResult(v.result) ? v.result : "found",
      title: v.title,
      ...(typeof v.iswc === "string" && v.iswc ? { iswc: v.iswc } : {}),
      ...(typeof v.isrc === "string" && v.isrc ? { isrc: v.isrc } : {}),
      writers: Array.isArray(v.writers) ? v.writers.filter((w) => w && typeof w.legalName === "string").map((w) => ({ legalName: w.legalName, ...(w.ipi ? { ipi: w.ipi } : {}), ...(w.share ? { share: w.share } : {}) })) : [],
    };
  } catch { return undefined; }
}

function parseReading(raw: string | undefined): StreamReading | undefined {
  if (!raw) return undefined;
  try {
    const v = JSON.parse(raw) as Partial<StreamReading>;
    if (!v || typeof v.at !== "string" || typeof v.streams !== "number" || !Number.isFinite(v.streams)) return undefined;
    return { at: v.at, streams: v.streams };
  } catch { return undefined; }
}

export function readCopies(steps: Record<string, string>): { agency?: WorkCopy | undefined; release?: WorkCopy | undefined; reading?: StreamReading | undefined } {
  return { agency: parseWork(steps[CREDIT_KEYS.agency]), release: parseWork(steps[CREDIT_KEYS.release]), reading: parseReading(steps[CREDIT_KEYS.reading]) };
}

/** A copy replaces its own key and nothing else, so the checklist ticks beside it are never touched. */
export function withCopy(status: SongStatus, key: keyof typeof CREDIT_KEYS, value: WorkCopy | StreamReading | null): SongStatus {
  const steps = { ...status.steps };
  if (value) steps[CREDIT_KEYS[key]] = JSON.stringify(value); else delete steps[CREDIT_KEYS[key]];
  return { ...status, steps };
}
