import { AUDIT_LABEL, AUDIT_SCREENS, nextAuditHref, nextAuditSong, type AuditScreen, type AuditTrail } from "@/lib/audit-mode";

/** The way back from a fix: the list the member was working, named under the trail. */
export type AuditBackLink = { href: string; label: string; detail?: string | undefined };

/**
 * The Audit Mode bar (founder, 2026-11-14).
 *
 * One cobalt bar above the workspace's tabs for as long as an audit is open: the first row names the three stops, links
 * every stop already visited back to its exact address, and carries "Next song" through the finding; the second row is
 * the way back to the list being worked, right above the work. "End audit" closes it; nothing else changes when it does.
 */
export function AuditBar({ trail, active, songTitle, back, onEnd }: {
  trail: AuditTrail;
  active: AuditScreen;
  songTitle?: string | undefined;
  back?: AuditBackLink | undefined;
  onEnd: () => void;
}) {
  const next = nextAuditSong(trail, trail.songId);
  return (
    <div role="region" aria-label="Audit Mode"
      className="mb-4 overflow-hidden rounded-xl bg-[linear-gradient(90deg,#001a3d,#004AAD_72%)] text-white shadow-lg shadow-black/20">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5">
        <span className="rounded-full bg-white/15 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.14em]">Audit Mode</span>
        {(trail.title || songTitle) && (
          <span className="max-w-[18rem] truncate text-xs font-medium text-white/85" title={trail.title ?? songTitle}>{trail.title ?? songTitle}</span>
        )}
        <div className="ml-auto flex flex-wrap items-center gap-1.5 text-xs">
          {AUDIT_SCREENS.map((screen, i) => {
            const href = trail.hrefs[screen];
            const current = screen === active;
            const tone = current ? "bg-white text-[#004AAD]" : href ? "bg-white/15 text-white/90 hover:bg-white/25" : "bg-white/5 text-white/40";
            const label = `${i + 1} ${AUDIT_LABEL[screen]}`;
            return (
              <span key={screen} className="flex items-center gap-1.5">
                {i > 0 && <span aria-hidden="true" className="hidden text-white/40 sm:inline">›</span>}
                {current
                  ? <span aria-current="step" className={`rounded-full px-2.5 py-1 font-semibold ${tone}`}>{label}</span>
                  : href
                    ? <a href={href} className={`rounded-full px-2.5 py-1 font-semibold ${tone}`}>{label}</a>
                    : <span aria-disabled="true" className={`rounded-full px-2.5 py-1 font-semibold ${tone}`}>{label}</span>}
              </span>
            );
          })}
          {next && (
            <a href={nextAuditHref(next)} className="ml-1.5 rounded-full bg-[#4D8CFF] px-3 py-1 font-semibold text-[#04122b] hover:bg-[#7aa9ff]">Next song →</a>
          )}
          <button type="button" onClick={onEnd}
            className="ml-1 rounded-full px-2.5 py-1 font-semibold text-white/80 underline-offset-4 hover:text-white hover:underline">End audit</button>
        </div>
      </div>
      {back && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-white/15 bg-[#03122b]/55 px-4 py-2 text-sm">
          <a href={back.href}
            className="rounded-full border border-white/45 px-3 py-1 font-semibold text-white underline-offset-4 hover:bg-white/10">← {back.label}</a>
          {back.detail && <span className="min-w-0 truncate text-xs text-white/75">{back.detail}</span>}
          <span className="ml-auto hidden text-xs text-white/55 sm:inline">Or press Esc to leave the audit</span>
        </div>
      )}
    </div>
  );
}
