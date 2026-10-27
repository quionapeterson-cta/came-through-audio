import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { CelebrationStage, SharePanel, type ShareInfo } from "@/components/BadgeCelebration";

/** Full-screen close-up of a badge or avatar on a transparent stage. With `share`, the badge rains and a share panel appears. */
export function BadgeViewer({ src, name, round, share, onClose }: { src?: string | undefined; name?: string | undefined; round?: boolean | undefined; share?: ShareInfo | undefined; onClose: () => void }) {
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
          {src && share ? <CelebrationStage src={src} name={name} round={round} /> : <figure className="flex flex-col items-center gap-6">
            {src && <img src={src} alt={name ?? "Badge"} className={round ? "aspect-square w-[min(80vw,32rem,70svh)] rounded-full border-4 border-primary object-cover" : "max-h-[75svh] w-full object-contain drop-shadow-2xl"} />}
            {name && <figcaption className="text-2xl font-bold tracking-tight text-white">{name}</figcaption>}
          </figure>}
          {src && share && <SharePanel avatar={src} round={round} share={share} />}
        </div>
      </DialogContent>
    </Dialog>
  );
}
