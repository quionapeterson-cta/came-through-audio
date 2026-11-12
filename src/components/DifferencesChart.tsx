import { Activity, ArrowUpRight, ExternalLink, GitBranch, Radio } from "lucide-react";
import { KIND_LABEL, RELEASE_STATE_LABEL, STATUS_LABEL, diffSegments, type DifferenceRow } from "@/lib/discrepancy-treatments";

/**
 * The comparison chart inside `DifferencesPanel` (founder, 2026-11-13).
 *
 * Seven columns, always in the same order, so the same question is answered in the same place on every row: the song, what
 * disagrees, your catalog's value, the agency's value, the release, the exact treatment, and what to do next. Values are
 * printed in a monospace readout and the characters that actually differ are marked, which is the whole point for an ISRC.
 */

const chip = "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold";

const kindTone = (kind: DifferenceRow["kind"]) =>
  kind === "missing-catalog-isrc" || kind === "missing-from-list" || kind === "missing-release"
    ? `${chip} border-slate-300 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300`
    : `${chip} border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-400/40 dark:bg-amber-400/10 dark:text-amber-300`;

const statusTone = (status: DifferenceRow["status"]) => {
  if (status === "both-registered") return `${chip} border-teal-300 bg-teal-50 text-teal-800 dark:border-cyan-400/40 dark:bg-cyan-400/10 dark:text-cyan-200`;
  if (status === "in-treatment") return `${chip} border-cyan-300 bg-cyan-50 text-cyan-800 dark:border-cyan-400/40 dark:bg-cyan-400/10 dark:text-cyan-200`;
  if (status === "waiting") return `${chip} border-slate-300 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400`;
  return `${chip} border-amber-400 bg-amber-50 text-amber-900 dark:border-amber-400/50 dark:bg-amber-400/10 dark:text-amber-300`;
};

const stateTone = (state: DifferenceRow["release"]["state"]) => {
  if (state === "current") return "text-teal-700 dark:text-cyan-300";
  if (state === "waiting") return "text-slate-500 dark:text-slate-400";
  return "text-amber-700 dark:text-amber-300";
};

/** One value, monospaced, with the characters that differ against the other side marked. */
function CodeValue({ value, against, muted = false }: { value: string; against?: string; muted?: boolean }) {
  if (!value) {
    return <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">None in catalog</span>;
  }
  const segments = against && against !== value ? diffSegments(value, against) : [{ value, changed: false }];
  return (
    <span className={`font-mono text-[12px] tabular-nums tracking-tight ${muted ? "text-slate-600 dark:text-slate-300" : "text-slate-900 dark:text-slate-100"}`}>
      {segments.map((s, i) =>
        s.changed ? (
          <mark key={i} className="rounded bg-amber-200/80 px-0.5 text-amber-900 dark:bg-amber-400/30 dark:text-amber-200">{s.value}</mark>
        ) : (
          <span key={i}>{s.value}</span>
        ),
      )}
    </span>
  );
}

export function DifferencesChart({ rows, busyKey, onFixCatalog, onAdopt, onKeepBoth }: {
  rows: DifferenceRow[];
  busyKey?: string | undefined;
  onFixCatalog: (row: DifferenceRow) => void;
  onAdopt: (row: DifferenceRow) => void;
  onKeepBoth: (row: DifferenceRow) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-[#111620]">
      <table className="w-full min-w-[1180px] border-collapse text-left align-top text-sm">
        <caption className="sr-only">Your catalog compared with each agency, and agencies compared with each other</caption>
        <thead>
          <tr className="border-b border-slate-200 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500 dark:border-slate-800 dark:text-slate-400">
            <th scope="col" className="px-3 py-2.5">Song</th>
            <th scope="col" className="px-3 py-2.5">What disagrees</th>
            <th scope="col" className="px-3 py-2.5">Your catalog</th>
            <th scope="col" className="px-3 py-2.5">The agency</th>
            <th scope="col" className="px-3 py-2.5">The release</th>
            <th scope="col" className="px-3 py-2.5">Exact treatment</th>
            <th scope="col" className="px-3 py-2.5">Status &amp; fix</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
          {rows.map((row) => {
            const against = row.claims[0]?.isrc ?? "";
            const busy = busyKey === row.key;
            const canAdopt = !row.catalogIsrc && !!against && row.kind !== "missing-from-list";
            const canKeepBoth = !!row.catalogIsrc && !!against && row.catalogIsrc.toUpperCase() !== against.toUpperCase();
            return (
              <tr key={row.key} className="group align-top transition-colors hover:bg-slate-50/80 dark:hover:bg-white/[0.03]">
                <td className="px-3 py-3">
                  <div className="flex items-start gap-2">
                    <Radio className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal-600 dark:text-cyan-300" aria-hidden />
                    <div className="min-w-0">
                      <span className="block truncate font-semibold text-slate-900 dark:text-slate-100">{row.title}</span>
                      <span className="block truncate text-xs text-slate-500 dark:text-slate-400">{row.artist || "—"}</span>
                      {row.occurrences > 1 && (
                        <span className="mt-1 inline-flex items-center rounded-full bg-slate-900 px-1.5 py-0.5 font-mono text-[10px] font-bold tabular-nums text-white dark:bg-cyan-400 dark:text-slate-900">
                          {row.occurrences}× in list
                        </span>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-3 py-3">
                  <span className={kindTone(row.kind)}>{KIND_LABEL[row.kind]}</span>
                  {row.issues.length > 0 && (
                    <ul className="mt-1.5 space-y-0.5 text-[11px] leading-snug text-slate-500 dark:text-slate-400">
                      {row.issues.slice(0, 2).map((i) => <li key={i}>{i}</li>)}
                    </ul>
                  )}
                </td>
                <td className="px-3 py-3">
                  <CodeValue value={row.catalogIsrc} against={against} />
                  {row.retiredIscrs.length > 0 && (
                    <div className="mt-1">
                      <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">Retired</span>
                      <div className="font-mono text-[11px] tabular-nums text-slate-500 line-through decoration-amber-500/70 dark:text-slate-400">
                        {row.retiredIscrs.join(" · ")}
                      </div>
                    </div>
                  )}
                </td>
                <td className="px-3 py-3">
                  <ul className="space-y-1.5">
                    {row.claims.map((c) => (
                      <li key={c.society + c.isrc}>
                        <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">{c.name}</span>
                        <div className="mt-0.5">
                          <CodeValue value={c.isrc} against={row.catalogIsrc} muted />
                          {!c.isrc && <span className="text-[11px] text-slate-500 dark:text-slate-400">No code on the list</span>}
                        </div>
                      </li>
                    ))}
                  </ul>
                </td>
                <td className="px-3 py-3">
                  <span className="block truncate text-[13px] font-semibold text-slate-900 dark:text-slate-100">{row.release.title || "No release"}</span>
                  <span className="block font-mono text-[11px] tabular-nums text-slate-500 dark:text-slate-400">{row.release.date || "No date"}</span>
                  {row.release.version && (
                    <span className="mt-1 inline-block rounded border border-slate-200 px-1.5 py-px text-[10px] font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-300">{row.release.version}</span>
                  )}
                  <span className={`mt-1 block text-[11px] font-semibold ${stateTone(row.release.state)}`}>{RELEASE_STATE_LABEL[row.release.state]}</span>
                </td>
                <td className="px-3 py-3">
                  <span className="block text-[13px] font-semibold text-slate-900 dark:text-slate-100">{row.treatment.headline}</span>
                  <span className="mt-0.5 block max-w-[34ch] text-[11px] leading-snug text-slate-500 dark:text-slate-400">{row.treatment.detail}</span>
                </td>
                <td className="px-3 py-3">
                  <span className={statusTone(row.status)}>{STATUS_LABEL[row.status]}</span>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <button type="button" onClick={() => onFixCatalog(row)} disabled={busy}
                      className="inline-flex items-center gap-1 rounded-md border border-teal-600/40 bg-teal-50 px-2 py-1 text-[11px] font-semibold text-teal-800 transition hover:bg-teal-100 disabled:opacity-50 dark:border-cyan-400/40 dark:bg-cyan-400/10 dark:text-cyan-200 dark:hover:bg-cyan-400/20">
                      <GitBranch className="h-3 w-3" aria-hidden />Fix in Catalog
                    </button>
                    {row.claims[0]?.url && (
                      <a href={row.claims[0].url} target="_blank" rel="noreferrer"
                        className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800">
                        <ExternalLink className="h-3 w-3" aria-hidden />Fix at Agency
                      </a>
                    )}
                    {canAdopt && (
                      <button type="button" onClick={() => onAdopt(row)} disabled={busy}
                        className="inline-flex items-center gap-1 rounded-md bg-slate-900 px-2 py-1 text-[11px] font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50 dark:bg-cyan-400 dark:text-slate-900 dark:hover:bg-cyan-300">
                        <ArrowUpRight className="h-3 w-3" aria-hidden />Adopt Agency ISRC
                      </button>
                    )}
                    {canKeepBoth && (
                      <button type="button" onClick={() => onKeepBoth(row)} disabled={busy}
                        className="inline-flex items-center gap-1 rounded-md border border-amber-400/60 bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-900 transition hover:bg-amber-100 disabled:opacity-50 dark:border-amber-400/40 dark:bg-amber-400/10 dark:text-amber-200 dark:hover:bg-amber-400/20">
                        <Activity className="h-3 w-3" aria-hidden />Keep Both &amp; Retire Old
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
