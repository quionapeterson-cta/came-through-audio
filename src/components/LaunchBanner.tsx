import { useEffect, useRef, useState } from "react";
import { usePrelaunchGuard } from "@/hooks/usePrelaunchGuard";
import { IS_PRELAUNCH, TESTER_PASSKEY } from "@/lib/prelaunch";

// The whole gate follows these two: set IS_PRELAUNCH to false on launch day (or empty TESTER_PASSKEY to close passkey
// entry), and nothing in this file renders.
export { IS_PRELAUNCH, TESTER_PASSKEY };

const WAVE_CSS = `
@keyframes cta-wave-bar { 0%, 100% { transform: scaleY(0.28); } 50% { transform: scaleY(1); } }
@keyframes cta-status-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }
.cta-wave span { display: block; width: 2px; height: 14px; border-radius: 9999px; background: currentColor; transform-origin: center; animation: cta-wave-bar 1.1s ease-in-out infinite; }
.cta-wave span:nth-child(2) { animation-delay: 0.12s; }
.cta-wave span:nth-child(3) { animation-delay: 0.24s; }
.cta-wave span:nth-child(4) { animation-delay: 0.36s; }
.cta-wave span:nth-child(5) { animation-delay: 0.48s; }
.cta-pulse { animation: cta-status-pulse 2s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce) {
  .cta-wave span, .cta-pulse { animation: none; }
}
`;

/**
 * The pre-launch banner (founder, 2026-11-12): sits above every page, tells visitors the build isn't finished, and
 * shows a tester which mode they are looking at. It disappears completely when `IS_PRELAUNCH` is false.
 */
export function LaunchBanner() {
  const { unlocked, lock, unlock } = usePrelaunchGuard();
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  if (!IS_PRELAUNCH) return null;

  async function copyLink() {
    const link = window.location.origin;
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      // Older browsers and blocked clipboard permissions: the selection route still copies it.
      const box = document.createElement("textarea");
      box.value = link;
      box.setAttribute("readonly", "");
      box.style.position = "fixed";
      box.style.opacity = "0";
      document.body.appendChild(box);
      box.select();
      document.execCommand("copy");
      document.body.removeChild(box);
    }
    setCopied(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="sticky top-0 z-50 w-full border-b border-[#E2E8F0] bg-[rgba(255,255,255,0.94)] text-foreground backdrop-blur-md dark:border-[#1E293B] dark:bg-[rgba(10,13,18,0.94)]"
    >
      <style>{WAVE_CSS}</style>
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2 sm:px-6">
        <span className="cta-wave flex h-4 items-center gap-[3px] text-[#1D4ED8] dark:text-[#00F0FF]" aria-hidden>
          <span /><span /><span /><span /><span />
        </span>

        {unlocked ? (
          <span className="inline-flex items-center gap-2 rounded-full border border-[#1D4ED8] bg-[#1D4ED8]/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.09em] text-[#1D4ED8] dark:border-[#00F0FF]/60 dark:bg-[#00F0FF]/10 dark:text-[#00F0FF]">
            <span className="cta-pulse h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
            Tester mode unlocked <span className="opacity-50">•</span> Public locked
            <button
              type="button"
              onClick={lock}
              className="ml-1 rounded-full border border-current/40 px-2 py-[1px] text-[10px] font-bold uppercase tracking-[0.06em] normal-case hover:bg-current/10"
            >
              Lock
            </button>
          </span>
        ) : (
          <span className="inline-flex items-center gap-2 rounded-full border border-[#D97706] bg-[#FEF3C7] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.09em] text-[#92400E] dark:border-[#F59E0B]/70 dark:bg-[#F59E0B]/15 dark:text-[#F59E0B]">
            <span className="cta-pulse h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
            Pre-launch build <span className="opacity-50">•</span> Do not register or pay yet
          </span>
        )}

        <p className="min-w-[14rem] flex-1 text-xs leading-snug text-[#334155] dark:text-[#CBD5E1] sm:text-[13px]">
          {unlocked
            ? "You're seeing the build as a tester can: sign-up, sign-in and checkout all work. Lock it to see what a visitor sees."
            : "Came Through Audio is currently under construction — please do not sign up or submit payments yet. We're putting on the finishing touches, so check back soon for our official launch!"}
        </p>

        {unlocked ? (
          <button
            type="button"
            onClick={unlock}
            disabled
            className="hidden rounded-full border border-[#E2E8F0] px-3 py-1 text-[11px] font-semibold text-[#94A3B8] dark:border-[#1E293B] dark:text-[#64748B] sm:inline-flex"
            aria-hidden
            tabIndex={-1}
          >
            Tester session
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void copyLink()}
            className="ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[#E2E8F0] px-3 py-1 text-[11px] font-semibold text-[#1D4ED8] transition-colors hover:border-[#1D4ED8] hover:bg-[#1D4ED8]/5 dark:border-[#1E293B] dark:text-[#00F0FF] dark:hover:border-[#00F0FF]/60 dark:hover:bg-[#00F0FF]/10"
          >
            {copied ? "Copied!" : "Copy Site Link"}
          </button>
        )}
      </div>
    </div>
  );
}
