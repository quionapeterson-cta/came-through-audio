import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/**
 * The sky celebration (founder, 2026-11-06): a dark sky of twinkling stars, shooting stars crossing it, and — when the
 * moment is a launch — a rocket lifting off through them. It is used twice, and only twice: both profile defaults
 * finished ("Zero to one."), and the last signature landing on a contract ("It's a done deal!").
 *
 * It never carries a count, a date or a promise, just the line. A click, Escape or the button closes it, and the caller
 * decides what happens next (the badge check, for instance). Motion is dropped entirely when the visitor asked for less.
 *
 * Timings (reviewed 2026-11-06): the sky fades in over 0.45 s, the line lands at 0.35 s, the sub-line at 1.05 s and the
 * button at 1.75 s. A rocket idles on the pad for 0.55 s, then the flight takes 3.3 s with an accelerating curve, so it
 * clears the top around 3.9 s and the words stay on their own for the rest of the hold (8 s by default).
 */

/** How long the overlay takes to fade out before the caller's `onDone` runs. */
const EXIT_MS = 320;

/** A star field laid out once, so it never jumps between renders. */
function useStars(count: number) {
  return useMemo(() => {
    // A fixed seed keeps the sky identical on every render and on both celebrations.
    let seed = 20261106;
    const next = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      left: next() * 100,
      top: next() * 100,
      size: 1 + next() * 2.2,
      delay: next() * 3.2,
      duration: 2.6 + next() * 3.2,
      bright: next() > 0.82,
    }));
  }, [count]);
}

function Rocket() {
  return (
    <svg viewBox="0 0 64 120" aria-hidden className="h-24 w-auto sm:h-32">
      <defs>
        <linearGradient id="cta-rocket-body" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="55%" stopColor="#dfe8ff" />
          <stop offset="100%" stopColor="#9fb8ff" />
        </linearGradient>
        <linearGradient id="cta-rocket-flame" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFD700" />
          <stop offset="60%" stopColor="#ff8a3d" />
          <stop offset="100%" stopColor="#ff3d3d" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* Flame, drawn first so it sits behind the hull. */}
      <path className="cta-sky-flame" d="M32 92c7 0 12 8 12 14 0 7-6 12-12 12s-12-5-12-12c0-6 5-14 12-14Z" fill="url(#cta-rocket-flame)" />
      <path d="M32 4c10 12 14 28 14 48v34a6 6 0 0 1-6 6H24a6 6 0 0 1-6-6V52C18 32 22 16 32 4Z" fill="url(#cta-rocket-body)" stroke="#0b0b0b" strokeWidth="2" />
      <circle cx="32" cy="42" r="8" fill="#004AAD" stroke="#0b0b0b" strokeWidth="2" />
      <circle cx="29.5" cy="39.5" r="2.4" fill="#ffffff" opacity=".7" />
      <path d="M18 62c-7 6-9 16-9 26l9-7V62Zm28 0c7 6 9 16 9 26l-9-7V62Z" fill="#4D8CFF" stroke="#0b0b0b" strokeWidth="2" />
      <path d="M26 92h12l-6 12-6-12Z" fill="#FFD700" stroke="#0b0b0b" strokeWidth="2" />
    </svg>
  );
}

const KEYFRAMES = `
@keyframes cta-sky-in { from { opacity: 0 } to { opacity: 1 } }
@keyframes cta-sky-twinkle { 0%, 100% { opacity: .22 } 50% { opacity: 1 } }
/* A streak that crosses fast, then waits off-screen: 26% of a 4.4 s cycle is the flight itself. */
@keyframes cta-sky-shoot {
  0% { transform: translate3d(0, 0, 0) rotate(20deg) scaleX(.35); opacity: 0 }
  3% { opacity: 1 }
  20% { transform: translate3d(62vw, 26vh, 0) rotate(20deg) scaleX(1); opacity: 1 }
  26%, 100% { transform: translate3d(62vw, 26vh, 0) rotate(20deg) scaleX(1); opacity: 0 }
}
/* Idle on the pad, a small settle as the flame catches, then a long accelerating climb. Easing applies between every
   keyframe, so the launch reads as slow-then-fast instead of a constant slide. */
@keyframes cta-sky-launch {
  0% { transform: translate3d(0, 0, 0) scale(.92); opacity: 0 }
  6% { opacity: 1; transform: translate3d(0, -2vh, 0) scale(.94) }
  16% { transform: translate3d(0, -7vh, 0) scale(.97) }
  100% { transform: translate3d(0, -128vh, 0) scale(1.07); opacity: 1 }
}
@keyframes cta-sky-flame { 0%, 100% { transform: scaleY(.68) } 50% { transform: scaleY(1.18) } }
@keyframes cta-sky-arrive { from { opacity: 0; transform: translateY(10px) } to { opacity: 1; transform: none } }
@keyframes cta-sky-line { from { opacity: 0; transform: translateY(14px) scale(.97) } to { opacity: 1; transform: none } }
@media (prefers-reduced-motion: reduce) {
  .cta-sky-star, .cta-sky-shoot, .cta-sky-rocket, .cta-sky-flame, .cta-sky-line { animation: none !important }
  .cta-sky-rocket, .cta-sky-shoot { display: none !important }
}
`;

export function StarSky({ message, sub, rocket = false, holdMs = 8000, onDone }: {
  /** The line written in the stars. */
  message: string;
  /** One sentence underneath it, in plain words. */
  sub?: string;
  /** Lift a rocket through the sky (the defaults moment). */
  rocket?: boolean;
  /** How long it waits for anyone who does not click. */
  holdMs?: number;
  onDone: () => void;
}) {
  const stars = useStars(rocket ? 150 : 110);
  const button = useRef<HTMLButtonElement>(null);
  const [leaving, setLeaving] = useState(false);

  // Every way out fades the sky first, so it never cuts to black between two celebrations (the sky, then the badge).
  const close = useCallback(() => {
    setLeaving(true);
    window.setTimeout(onDone, EXIT_MS);
  }, [onDone]);

  useEffect(() => {
    button.current?.focus();
    const timer = window.setTimeout(close, holdMs);
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", key);
    return () => { window.clearTimeout(timer); window.removeEventListener("keydown", key); };
  }, [holdMs, close]);

  return (
    <div role="dialog" aria-modal="true" aria-label={message} onClick={close}
      className={`fixed inset-0 z-[95] overflow-hidden bg-[#05070f] text-white transition-opacity duration-300 ${leaving ? "pointer-events-none opacity-0" : "opacity-100"}`}
      style={{ animation: "cta-sky-in .45s ease-out" }}>
      <style>{KEYFRAMES}</style>
      {/* The night itself: a deep cobalt glow where the rocket leaves. */}
      <div aria-hidden className="absolute inset-0 bg-[radial-gradient(120%_80%_at_50%_120%,#123a7a_0%,#0a1630_45%,#05070f_100%)]" />
      {stars.map((s) => (
        <span key={s.id} aria-hidden className={`cta-sky-star absolute rounded-full bg-white ${s.bright ? "shadow-[0_0_8px_2px_rgba(255,255,255,.6)]" : ""}`}
          style={{ left: `${s.left}%`, top: `${s.top}%`, width: `${s.size}px`, height: `${s.size}px`, animation: `cta-sky-twinkle ${s.duration}s ease-in-out ${s.delay}s infinite` }} />
      ))}
      {/* Three shooting stars: short, quick streaks a few seconds apart, never crossing the line while it is read. */}
      {[0, 1, 2].map((i) => (
        <span key={i} aria-hidden className="cta-sky-shoot absolute h-[2px] w-40 rounded-full bg-gradient-to-r from-transparent via-[#9fbcff] to-white shadow-[0_0_10px_rgba(159,188,255,.9)]"
          style={{ left: `${6 + i * 20}%`, top: `${8 + i * 11}%`, animation: `cta-sky-shoot 4.4s cubic-bezier(.3,.5,.5,1) ${0.9 + i * 1.5}s infinite`, opacity: 0 }} />
      ))}
      {rocket && (
        <div aria-hidden className="cta-sky-rocket absolute bottom-0 left-1/2 -translate-x-1/2" style={{ animation: "cta-sky-launch 3.3s cubic-bezier(.62,.04,.9,.42) .55s forwards", opacity: 0 }}>
          <Rocket />
        </div>
      )}

      <div className="relative flex h-full flex-col items-center justify-center gap-5 px-6 text-center">
        <p className="cta-sky-line text-xs font-bold uppercase tracking-[0.35em] text-[#9fbcff]" style={{ animation: "cta-sky-line .6s ease-out .1s both" }}>Came Through Audio</p>
        <h2 className="cta-sky-line max-w-[18ch] text-balance text-4xl font-bold leading-tight drop-shadow-[0_0_24px_rgba(159,188,255,.45)] sm:text-6xl" style={{ animation: "cta-sky-line .9s cubic-bezier(.2,.7,.3,1) .35s both" }}>
          {message}
        </h2>
        {sub && <p className="cta-sky-line max-w-md text-base text-white/75 sm:text-lg" style={{ animation: "cta-sky-line .8s ease-out 1.05s both" }}>{sub}</p>}
        <button ref={button} type="button" onClick={(e) => { e.stopPropagation(); close(); }}
          className="cta-sky-line mt-4 rounded-full border border-white/40 px-6 py-2.5 text-sm font-semibold text-white transition hover:border-white hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          style={{ animation: "cta-sky-line .7s ease-out 1.75s both" }}>
          Keep going
        </button>
      </div>
    </div>
  );
}
