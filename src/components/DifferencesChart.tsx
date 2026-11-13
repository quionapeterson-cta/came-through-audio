import { useState } from "react";
import { AudioWaveform, ChevronDown, ChevronUp, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  KIND_LABEL, RELEASE_STATE_LABEL, STATUS_LABEL, diffSegments, diffWords, fieldFor, repertoireUrl, signInFor,
  summaryFor, treatmentText, type DifferenceRow, type RowFix,
} from "@/lib/discrepancy-treatments";

/**
 * The Differences card list (founder, 2026-11-13).
 *
 * Every difference is one card of three zones, so nothing sits off the right edge of a desktop screen and nothing needs a
 * horizontal scroll: the song and what is wrong, the two values side by side, and the exact treatment with the one click
 * that checks it in the public repertoire. Light and dark are the brand's own cobalt on white and electric cobalt on
 * obsidian; the classes below are the whole palette.
 */

const CARD = "grid grid-cols-1 gap-6 rounded-xl border p-5 transition-all duration-200 lg:grid-cols-12 bg-[#FFFFFF] border-[#E5E4E2] hover:border-[#4D8CFF]/60 hover:shadow-[0_4px_24px_rgba(0,74,173,0.10)] dark:bg-[#141414] dark:border-[#E5E4E2]/15 dark:hover:border-[#4D8CFF]/70 dark:hover:shadow-[0_0_28px_rgba(77,140,255,0.18)]";

const PILL = "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold";

const TAG = `${PILL} border-[#4D8CFF]/40 bg-[#004AAD]/10 text-[#004AAD] dark:border-[#4D8CFF]/35 dark:bg-[#4D8CFF]/15 dark:text-[#4D8CFF]`;

const PLATINUM = `${PILL} border-[#E5E4E2] bg-[#E5E4E2]/60 text-[#0b0b0b] dark:border-[#E5E4E2]/20 dark:bg-[#E5E4E2]/15 dark:text-[#E5E4E2]`;

const statusPill = (status: DifferenceRow["status"]) =>
  status === "waiting" || status === "both-registered"
    ? PLATINUM
    : `${PILL} border-[#4D8CFF]/40 bg-[#4D8CFF]/15 text-[#004AAD] shadow-[0_0_12px_rgba(77,140,255,0.2)] dark:border-[#4D8CFF]/45 dark:bg-[#4D8CFF]/20 dark:text-[#4D8CFF] dark:shadow-[0_0_14px_rgba(77,140,255,0.25)]`;

const PRIMARY = "inline-flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition bg-[#004AAD] text-[#FFFFFF] shadow-[0_0_14px_rgba(0,74,173,0.25)] hover:bg-[#4D8CFF] hover:shadow-[0_0_20px_rgba(77,140,255,0.55)] disabled:opacity-60 dark:bg-[#4D8CFF] dark:text-[#0b0b0b] dark:font-semibold dark:shadow-[0_0_18px_rgba(77,140,255,0.45)] dark:hover:bg-[#4D8CFF]/90 dark:hover:shadow-[0_0_26px_rgba(77,140,255,0.75)]";

const SECONDARY = "inline-flex w-full items-center justify-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-semibold transition border-[#004AAD]/30 text-[#004AAD] hover:border-[#4D8CFF]/60 hover:bg-[#004AAD]/[0.06] dark:border-[#4D8CFF]/35 dark:text-[#4D8CFF] dark:hover:bg-[#4D8CFF]/10";

/** One value in the brand's monospace, with the characters that differ against the other side marked. */
function Isrc({ value, against }: { value: string; against?: string | undefined }) {
  const segments = against && against !== value ? diffSegments(value, against) : [{ value, changed: false }];
  return (
    <span className="block break-all font-mono text-xs text-[#0b0b0b] dark:text-[#FFFFFF]">
      {segments.map((s, i) =>
        s.changed ? (
          <mark key={i} className="rounded bg-[#004AAD]/10 px-1.5 py-0.5 font-medium text-[#004AAD] dark:bg-[#4D8CFF]/20 dark:text-[#4D8CFF]">{s.value}</mark>
        ) : (
          <span key={i}>{s.value}</span>
        ),
      )}
    </span>
  );
}

/** A title, with the words the other side does not hold marked, so a renamed copy jumps out. */
function Title({ value, against, emphasise }: { value: string; against: string; emphasise: boolean }) {
  if (!emphasise) return <span className="block text-xs text-[#0b0b0b]/80 dark:text-[#E5E4E2]/80">{value}</span>;
  return (
    <span className="block text-xs text-[#0b0b0b]/80 dark:text-[#E5E4E2]/80">
      {diffWords(value, against).map((w, i) => w.changed && w.value.trim()
        ? <mark key={i} className="rounded bg-[#004AAD]/10 px-1.5 py-0.5 font-medium text-[#004AAD] dark:bg-[#4D8CFF]/20 dark:text-[#4D8CFF]">{w.value}</mark>
        : <span key={i}>{w.value}</span>)}
    </span>
  );
}

/** Comparability for one field: case and runs of spaces never make two readings different. */
const canon = (s: string) => (s ?? "").toLowerCase().replace(/\s+/g, " ").trim();

/** One compared field: its name, and its value marked in cobalt when the two sides disagree. */
function Field({ label, differs, children }: { label: string; differs: boolean; children: React.ReactNode }) {
  return (
    <div className={differs
      ? "rounded border-l-2 border-[#004AAD] bg-[#004AAD]/[0.06] px-1.5 py-1 dark:border-[#4D8CFF] dark:bg-[#4D8CFF]/10"
      : "px-1.5 py-1"}>
      <span className={`block text-[9px] font-bold uppercase tracking-wider ${differs ? "text-[#004AAD] dark:text-[#4D8CFF]" : "text-[#0b0b0b]/50 dark:text-[#E5E4E2]/50"}`}>{label}</span>
      {children}
    </div>
  );
}

/** A plain field value, or the honest reason there isn't one. */
function Value({ text, empty }: { text: string; empty: string }) {
  return text.trim()
    ? <span className="block break-words text-xs text-[#0b0b0b]/85 dark:text-[#E5E4E2]/85">{text}</span>
    : <span className="block text-[11px] italic text-[#0b0b0b]/45 dark:text-[#E5E4E2]/45">{empty}</span>;
}

export function DifferencesChart({ rows, busyKey, onFixCatalog, onAdopt, onKeepBoth }: {
  rows: DifferenceRow[];
  busyKey?: string | undefined;
  onFixCatalog: (row: DifferenceRow, field?: string) => void;
  onAdopt: (row: DifferenceRow) => void;
  onKeepBoth: (row: DifferenceRow) => void;
}) {
  // Each song can be folded away (founder, 2026-11-14): a long list consolidates to its titles, and the card being worked
  // on stays open. Nothing is remembered across visits, so the list always opens readably.
  const [hidden, setHidden] = useState<ReadonlySet<string>>(new Set());
  const toggle = (key: string) => setHidden((set) => {
    const next = new Set(set);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });
  /** The one click that checks a code: the code is copied and the public search opens in a new tab. */
  function copyAndOpen(value: string, url: string, what: string) {
    window.open(url, "_blank", "noopener,noreferrer");
    const copy = navigator.clipboard?.writeText(value);
    if (!copy) { toast.error(`Couldn't copy ${what} automatically: ${value}`); return; }
    copy.then(() => toast.success(`Copied ${what} ${value}. The public repertoire search is open in a new tab.`))
      .catch(() => toast.error(`Couldn't copy ${what} automatically: ${value}`));
  }

  return (
    <ul className="space-y-3">
      {rows.map((row) => {
        const busy = busyKey === row.key;
        const agencyIsrc = row.claims.find((c) => c.isrc)?.isrc ?? "";
        const agencyTitle = row.claims[0]?.title ?? "";
        const titlesDisagree = !!agencyTitle && canon(agencyTitle) !== canon(row.title);
        const codesDiffer = !!row.catalogIsrc && !!agencyIsrc && row.catalogIsrc.toUpperCase() !== agencyIsrc.toUpperCase();
        // A version or an artist the list doesn't name is not a difference: only two values that are both there can disagree.
        const versionsDisagreeFor = (agencyVersion: string) => !!agencyVersion.trim() && !!row.versions.catalog.trim() && canon(agencyVersion) !== canon(row.versions.catalog);
        const artistsDisagreeFor = (agencyArtist: string) => !!agencyArtist.trim() && !!row.artists.catalog.trim() && canon(agencyArtist) !== canon(row.artists.catalog);
        const code = agencyIsrc || row.catalogIsrc;
        const url = repertoireUrl(row.claims[0]?.society ?? "");
        // The member's own account at the agency: looking a code up and registering it are different pages.
        const portal = signInFor(row.claims[0]?.society ?? "", row.claims[0]?.url ?? "");
        // A version the agency names and the catalog doesn't, or two recordings under one title: Add Version is offered
        // on top of whatever else the card says (founder, 2026-11-14).
        const canAddVersion = row.treatment.action !== "add-version"
          && (row.agencyCodes.length > 1 || (!!row.versions.agency.trim() && !!row.versions.catalog.trim() && canon(row.versions.agency) !== canon(row.versions.catalog)));
        const canAdopt = !row.catalogIsrc && !!agencyIsrc && row.kind !== "missing-from-list";
        const canKeepBoth = codesDiffer && row.treatment.action !== "keep-both";
        const waiting = row.treatment.action === "waiting";

        /** The row's own copy value: never an ISRC on a composition card, whatever a fix's own words say. */
        const copied = row.copy?.primary;
        // A check is offered once, whatever it is called: the same agency and the same value is the same click
        // (founder, 2026-11-14). This is the set the per-difference buttons are checked against.
        const offered = new Set<string>([
          `${row.treatment.primary}|${copied?.value ?? (agencyIsrc || row.catalogIsrc || row.title)}`,
          ...(row.copy?.secondary ? [`${row.copy.secondary.label}|${row.copy.secondary.value}`] : []),
          ...(row.treatment.secondary ? [`${row.treatment.secondary}|${url}`] : []),
        ]);
        /** True when this check is not already one of the card's own buttons. */
        const takeLink = (label: string, value: string) => {
          const key = `${label}|${value}`;
          if (offered.has(key)) return false;
          offered.add(key);
          return true;
        };

        /** The one click each difference takes, from the rule that difference was given. */
        const runFix = (fix: RowFix) => {
          if (fix.treatment.action === "waiting") return;
          if (copied) return copyAndOpen(copied.value, url, copied.what);
          if (fix.treatment.action === "keep-both") return onKeepBoth(row);
          if (fix.treatment.action === "add-version") return onFixCatalog(row, "version");
          copyAndOpen(fix.code || row.title, url, fix.code ? "ISRC" : "title");
        };

        const primary = () => {
          if (waiting) return;
          if (copied) return copyAndOpen(copied.value, url, copied.what);
          if (row.treatment.action === "keep-both") return onKeepBoth(row);
          if (row.treatment.action === "add-version") return onFixCatalog(row, "version");
          copyAndOpen(code || row.title, url, code ? "ISRC" : "title");
        };

        return (
          <li key={row.key} className={CARD}>
            {/* Zone 1 — the song and what disagrees, in plain English. */}
            <div className={`min-w-0 ${hidden.has(row.key) ? "lg:col-span-12" : "lg:col-span-4"}`}>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className={statusPill(row.status)}>{STATUS_LABEL[row.status]}</span>
                <span className={TAG}>{KIND_LABEL[row.kind]}</span>
                {row.occurrences > 1 && <span className={PLATINUM}>{row.occurrences}× in list</span>}
                <button type="button" onClick={() => toggle(row.key)} aria-expanded={!hidden.has(row.key)}
                  aria-label={`${hidden.has(row.key) ? "Show" : "Hide"} ${row.title}`}
                  className="ml-auto inline-flex items-center gap-1 rounded-full border border-[#E5E4E2] px-2 py-0.5 text-[11px] font-semibold text-[#0b0b0b]/70 transition hover:border-[#4D8CFF]/60 hover:text-[#004AAD] dark:border-[#E5E4E2]/20 dark:text-[#E5E4E2]/70 dark:hover:text-[#4D8CFF]">
                  {hidden.has(row.key) ? <ChevronDown className="h-3 w-3" aria-hidden /> : <ChevronUp className="h-3 w-3" aria-hidden />}
                  {hidden.has(row.key) ? "Show" : "Hide"}
                </button>
              </div>
              <h3 className="mt-2 flex items-start gap-1.5 text-sm font-semibold leading-snug text-[#0b0b0b] dark:text-[#FFFFFF]">
                <AudioWaveform className="mt-0.5 h-4 w-4 shrink-0 text-[#004AAD] dark:text-[#4D8CFF]" aria-hidden />
                <span className="min-w-0 break-words">{row.title}</span>
              </h3>
              <p className="mt-0.5 text-xs text-[#0b0b0b]/65 dark:text-[#E5E4E2]/65">{row.artist || "No artist listed"}</p>
              <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px] text-[#0b0b0b]/65 dark:text-[#E5E4E2]/65">
                <span className="font-mono tabular-nums">{row.release.date || "No release date"}</span>
                <span aria-hidden>·</span>
                <span className={row.release.state === "current" ? "font-semibold text-[#004AAD] dark:text-[#4D8CFF]" : "font-semibold"}>{RELEASE_STATE_LABEL[row.release.state]}</span>
                {row.release.version && <span className="rounded border border-[#E5E4E2] px-1.5 py-px dark:border-[#E5E4E2]/15">{row.release.version}</span>}
              </p>
              <p className="mt-2 text-xs leading-relaxed text-[#0b0b0b]/70 dark:text-[#E5E4E2]/70">{summaryFor(row)}</p>
            </div>

            {/* Zone 2 — the fields side by side, with the one that disagrees marked (founder, 2026-11-14). */}
            {!hidden.has(row.key) && <div className="min-w-0 lg:col-span-8">
              <div className="rounded-lg border border-[#E5E4E2] bg-[#E5E4E2]/30 dark:border-[#E5E4E2]/15 dark:bg-[#0b0b0b]">
                <div className="grid grid-cols-2 gap-3 p-3">
                  <div className="min-w-0 space-y-1.5">
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-[#0b0b0b]/55 dark:text-[#E5E4E2]/55">Your catalog</span>
                    <Field label="Title" differs={titlesDisagree}><Title value={row.title} against={agencyTitle} emphasise={titlesDisagree} /></Field>
                    {row.composition && (
                      <>
                        <Field label="ISWC" differs={!!row.composition.agency.iswc && !!row.composition.catalog.iswc && canon(row.composition.agency.iswc) !== canon(row.composition.catalog.iswc)}><Value text={row.composition.catalog.iswc} empty="No ISWC in your catalog" /></Field>
                        <Field label="Writers" differs={!!row.composition.agency.writers && !!row.composition.catalog.writers && canon(row.composition.agency.writers) !== canon(row.composition.catalog.writers)}><Value text={row.composition.catalog.writers} empty="No writers in your catalog" /></Field>
                      </>
                    )}
                    {!row.composition && <>
                    <Field label="Version" differs={versionsDisagreeFor(row.versions.catalog)}><Value text={row.versions.catalog} empty="Not named" /></Field>
                    <Field label="Artist" differs={false}><Value text={row.artist} empty="No artist listed" /></Field>
                    <Field label="ISRC" differs={codesDiffer}>
                      {row.catalogIsrc
                        ? <Isrc value={row.catalogIsrc} against={agencyIsrc} />
                        : <Value text="" empty="No ISRC in your catalog" />}
                      {row.retiredIscrs.length > 0 && (
                        <span className="mt-1 block font-mono text-[11px] tabular-nums text-[#0b0b0b]/45 line-through dark:text-[#E5E4E2]/45">{row.retiredIscrs.join(" · ")}</span>
                      )}
                    </Field>
                    </>}
                  </div>
                  <div className="min-w-0 space-y-1.5 border-l border-[#E5E4E2] pl-3 dark:border-[#E5E4E2]/15">
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-[#0b0b0b]/55 dark:text-[#E5E4E2]/55">The agency</span>
                    {row.claims.map((c) => (
                      <div key={c.society + c.isrc + c.title} className="space-y-1.5">
                        <span className="block text-[10px] font-semibold uppercase tracking-wide text-[#004AAD] dark:text-[#4D8CFF]">{c.name}</span>
                        <Field label="Title" differs={titlesDisagree}><Title value={c.title || row.title} against={row.title} emphasise={titlesDisagree} /></Field>
                        {row.composition && (
                          <>
                            <Field label="ISWC" differs={!!c.iswc && !!row.composition.catalog.iswc && canon(c.iswc) !== canon(row.composition.catalog.iswc)}><Value text={c.iswc ?? ""} empty="No ISWC on the list" /></Field>
                            <Field label="Writers" differs={false}><Value text={(c.writers ?? []).join(" · ")} empty="No writers on the list" /></Field>
                          </>
                        )}
                        {!row.composition && <>
                        <Field label="Version" differs={versionsDisagreeFor(c.version ?? "")}><Value text={c.version ?? ""} empty="Not named" /></Field>
                        <Field label="Artist" differs={artistsDisagreeFor(c.artist ?? "")}><Value text={c.artist ?? ""} empty="Not on the list" /></Field>
                        <Field label="ISRC" differs={codesDiffer}>
                          {c.isrc
                            ? <Isrc value={c.isrc} against={row.catalogIsrc} />
                            : <Value text="" empty="No ISRC on the list" />}
                          {/* Two codes under one title are two recordings: the second is shown, never hidden behind the first. Each
                              code now has its own claim, so this only draws for a row that still holds them all under one. */}
                          {row.claims.length === 1 && row.agencyCodes.filter((x) => x.isrc && x.isrc.toUpperCase() !== (c.isrc || "").toUpperCase()).map((x) => (
                            <span key={x.isrc} className="mt-1 block">
                              <Isrc value={x.isrc} against={row.catalogIsrc} />
                              <span className="mt-0.5 block text-[10px] text-[#0b0b0b]/55 dark:text-[#E5E4E2]/55">
                                {x.version ? `Second code · ${x.version}` : "Second code on the list"}
                              </span>
                            </span>
                          ))}
                        </Field>
                        </>}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>}

            {/* Zone 3 — the exact treatment and the one click that checks it, the full width of the card beneath both
                sides (founder, 2026-11-14), so it can be read instead of squeezed into a third column. */}
            {!hidden.has(row.key) && <div className="flex min-w-0 flex-col lg:col-span-12">
              <div className="flex h-full flex-col justify-between rounded-lg border p-4 transition-all border-[#004AAD]/25 bg-[#004AAD]/[0.04] shadow-[inset_0_0_20px_rgba(77,140,255,0.06)] dark:border-[#4D8CFF]/30 dark:bg-[#4D8CFF]/[0.08] dark:shadow-[inset_0_0_24px_rgba(77,140,255,0.10)]">
                <div className="lg:flex lg:items-start lg:gap-8">
                <div className="min-w-0 lg:flex-1">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-[#004AAD] dark:text-[#4D8CFF]">Exact treatment</p>
                  <p className="mt-1 text-sm font-semibold text-[#0b0b0b] dark:text-[#FFFFFF]">{row.treatment.headline}</p>
                  <p className="mt-1 text-xs leading-relaxed text-[#0b0b0b]/70 dark:text-[#E5E4E2]/70">{treatmentText(row.treatment, code)}</p>
                </div>
                <div className="mt-3 space-y-2 lg:mt-0 lg:w-80 lg:shrink-0">
                  {waiting
                    ? <span className={PLATINUM}>Waiting for the release</span>
                    : <button type="button" className={PRIMARY} onClick={primary} disabled={busy}>
                        {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
                        {row.treatment.primary}
                      </button>}
                  {/* One second link, never two (founder, 2026-11-14): a composition's copy-and-check, a recording's
                      repertoire search, or the catalog field — whichever this card has, drawn once. */}
                  {row.copy?.secondary
                    ? <button type="button" className={SECONDARY} onClick={() => copyAndOpen(row.copy!.secondary!.value, url, row.copy!.secondary!.what)} disabled={busy}>
                        {row.copy.secondary.label}
                      </button>
                    : row.treatment.secondary.includes("Repertoire")
                    ? <a href={url} target="_blank" rel="noreferrer" className={SECONDARY}>
                        <ExternalLink className="h-3.5 w-3.5" aria-hidden />{row.treatment.secondary}
                      </a>
                    : <button type="button" className={SECONDARY} onClick={() => onFixCatalog(row, fieldFor(row))} disabled={busy}>
                        {row.treatment.secondary}
                      </button>}
                  {!waiting && portal.signIn && (
                    <a href={portal.signIn} target="_blank" rel="noreferrer" className={SECONDARY}>
                      <ExternalLink className="h-3.5 w-3.5" aria-hidden />Sign in to {portal.name}
                    </a>
                  )}
                  {canAddVersion && (
                    <button type="button" onClick={() => onFixCatalog(row, "version")} disabled={busy}
                      className="w-full text-center text-[11px] font-semibold text-[#004AAD] underline decoration-[#4D8CFF]/50 underline-offset-4 hover:text-[#4D8CFF] dark:text-[#4D8CFF]">
                      + Add Version to Catalog
                    </button>
                  )}
                  {canAdopt && (
                    <button type="button" onClick={() => onAdopt(row)} disabled={busy}
                      className="w-full text-center text-[11px] font-semibold text-[#004AAD] underline decoration-[#4D8CFF]/50 underline-offset-4 hover:text-[#4D8CFF] dark:text-[#4D8CFF]">
                      Use the agency&apos;s ISRC in my catalog
                    </button>
                  )}
                  {canKeepBoth && (
                    <button type="button" onClick={() => onKeepBoth(row)} disabled={busy}
                      className="w-full text-center text-[11px] font-semibold text-[#004AAD] underline decoration-[#4D8CFF]/50 underline-offset-4 hover:text-[#4D8CFF] dark:text-[#4D8CFF]">
                      Keep both ISRCs &amp; retire the old one
                    </button>
                  )}
                </div>
                </div>
                {/* Every difference on the recording, never just the first: each one is listed with its own treatment and
                    its own fix, so a song with a wrong ISWC and a missing writer is not fixed only halfway. A fix that is
                    already the card's own button is not drawn a second time (founder, 2026-11-14): "Copy ISRC & Check
                    Repertoire" appears once per card, however many differences list it. */}
                {row.fixes.length > 1 && (() => {
                  return (
                  <div className="mt-3 border-t border-[#004AAD]/20 pt-3 dark:border-[#4D8CFF]/25">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-[#004AAD] dark:text-[#4D8CFF]">
                      All {row.fixes.length} differences on {row.composition ? "this work" : "this recording"}
                    </p>
                    <ol className="mt-2 space-y-3">
                      {row.fixes.map((fix, i) => {
                        // A check the card already offers is not offered again: same agency, same value, one click.
                        const repeat = !takeLink(fix.treatment.primary, copied?.value ?? (fix.code || row.title));
                        return (
                        <li key={fix.issue}>
                          <p className="text-[11px] leading-snug text-[#0b0b0b]/65 dark:text-[#E5E4E2]/65">{i + 1}. {fix.issue}</p>
                          <p className="mt-0.5 text-xs font-semibold text-[#0b0b0b] dark:text-[#FFFFFF]">{fix.headline}</p>
                          <p className="mt-0.5 text-[11px] leading-relaxed text-[#0b0b0b]/70 dark:text-[#E5E4E2]/70">{fix.text}</p>
                          {!repeat && (
                            <button type="button" onClick={() => runFix(fix)} disabled={busy}
                              className="mt-1 text-[11px] font-semibold text-[#004AAD] underline decoration-[#4D8CFF]/50 underline-offset-4 hover:text-[#4D8CFF] disabled:opacity-60 dark:text-[#4D8CFF]">
                              {fix.treatment.primary}
                            </button>
                          )}
                        </li>
                        );
                      })}
                    </ol>
                  </div>
                  );
                })()}
              </div>
            </div>}
          </li>
        );
      })}
    </ul>
  );
}
