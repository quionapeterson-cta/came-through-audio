import { useEffect, useState, type ReactNode } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { CelebrationStage, SharePanel, type ShareInfo } from "@/components/BadgeCelebration";

/** Full-screen close-up of a badge or avatar on a transparent stage. With `share`, the badge rains and a share panel appears. */
/** What a badge is and how often it was earned, shown under it on the share screen (founder, 2026-10-27). */
export type BadgeAbout = { description: string; times: number; earnedAt?: string | undefined };

export function BadgeViewer({ src, name, round, share, about, actions, onClose }: { src?: string | undefined; name?: string | undefined; round?: boolean | undefined; share?: ShareInfo | undefined; about?: BadgeAbout | undefined; actions?: ReactNode; onClose: () => void }) {
  return (
    <Dialog open={!!src} onOpenChange={(o) => !o && onClose()}>
      {/* With share, the dialog fills the screen and scrolls itself, so the full-screen rain is never clipped to a shorter box on phones. */}
      <DialogContent onClick={(e) => { if (share && e.target === e.currentTarget) onClose(); }}
        className={`overflow-y-auto border-0 bg-transparent p-0 shadow-none [&>button]:!bg-transparent [&>button]:!text-white [&>button]:opacity-90 ${share ? "h-full max-h-none max-w-none sm:rounded-none" : "max-h-[95vh] max-w-[min(90vw,44rem)]"}`}>
        <DialogTitle className="sr-only">{name ?? "Badge"}</DialogTitle>
        <DialogDescription className="sr-only">{share ? "Full-size view with sharing options" : "Full-size view"}</DialogDescription>
        <div onClick={(e) => { if (share && e.target === e.currentTarget) onClose(); }}
          // "safe" centering: when the badge and share panel are taller than the screen they start at the top and scroll,
          // instead of being centered past the top edge where nothing can scroll to (founder, 2026-10-27: badge cut off at the top).
          className={share ? "mx-auto grid min-h-full w-full max-w-[min(94vw,64rem)] gap-5 px-2 py-12 [align-content:safe_center] [align-items:safe_center] md:grid-cols-2 md:gap-8" : ""}>
          {src && share ? <div className="space-y-4">
            <CelebrationStage src={src} name={name} round={round} />
            {about && <div className="mx-auto max-w-md space-y-3 text-center">
              {about.times > 1 && <CoinStack src={src} times={about.times} />}
              <p className="text-base text-white/85">{about.description}</p>
              {about.earnedAt && <p className="text-sm text-white/60">Earned {new Date(about.earnedAt).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}{about.times > 1 ? ` · ${about.times} times` : ""}</p>}
              {actions && <div className="flex flex-wrap justify-center gap-2">{actions}</div>}
            </div>}
          </div> : <figure className="flex flex-col items-center gap-6">
            {src && <img src={src} alt={name ?? "Badge"} className={round ? "aspect-square w-[min(80vw,32rem,70svh)] rounded-full border-4 border-primary object-cover" : "max-h-[75svh] w-full object-contain drop-shadow-2xl"} />}
            {name && <figcaption className="text-2xl font-bold tracking-tight text-white">{name}</figcaption>}
          </figure>}
          {src && share && <SharePanel avatar={src} round={round} share={share} />}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Badges earned more than once collect like coins: copies slide in and stack, and the count runs up to the total.
 * Still for people who turn off motion.
 */
function CoinStack({ src, times }: { src: string; times: number }) {
  const coins = Math.min(times, 5);
  const [n, setN] = useState(1);
  useEffect(() => {
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) { setN(times); return; }
    setN(1);
    const step = Math.max(1, Math.ceil(times / 20));
    const t = setInterval(() => setN((v) => { const next = Math.min(times, v + step); if (next >= times) clearInterval(t); return next; }), 45);
    return () => clearInterval(t);
  }, [times]);
  return (
    <div className="flex items-center justify-center gap-3" aria-label={`Earned ${times} times`}>
      <span className="relative h-12" style={{ width: 48 + (coins - 1) * 12 }} aria-hidden>
        {Array.from({ length: coins }, (_, i) => (
          <img key={i} src={src} alt="" className="cta-coin absolute top-0 h-12 w-12 object-contain drop-shadow-lg"
            style={{ left: i * 12, animationDelay: `${i * 90}ms`, ["--from" as string]: `${(coins - i) * 30}px` }} />
        ))}
      </span>
      <span className="text-3xl font-extrabold tabular-nums text-white">×{n}</span>
    </div>
  );
}
