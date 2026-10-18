import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { CelebrationStage, SharePanel, type ShareInfo } from "@/components/BadgeCelebration";

/** Full-screen close-up of a badge or avatar on a transparent stage. With `share`, the badge rains and a share panel appears. */
export function BadgeViewer({ src, name, round, share, onClose }: { src?: string | undefined; name?: string | undefined; round?: boolean | undefined; share?: ShareInfo | undefined; onClose: () => void }) {
  return (
    <Dialog open={!!src} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className={`max-h-[95vh] overflow-y-auto border-0 bg-transparent p-0 shadow-none [&>button]:!bg-transparent [&>button]:!text-white [&>button]:opacity-90 ${share ? "max-w-[min(94vw,64rem)]" : "max-w-[min(90vw,44rem)]"}`}>
        <DialogTitle className="sr-only">{name ?? "Badge"}</DialogTitle>
        <DialogDescription className="sr-only">{share ? "Full-size view with sharing options" : "Full-size view"}</DialogDescription>
        <div className={share ? "grid items-center gap-8 p-2 md:grid-cols-2" : ""}>
          {src && share ? <CelebrationStage src={src} name={name} round={round} /> : <figure className="flex flex-col items-center gap-6">
            {src && <img src={src} alt={name ?? "Badge"} className={round ? "aspect-square w-[min(80vw,32rem)] rounded-full border-4 border-primary object-cover" : "max-h-[75vh] w-full object-contain drop-shadow-2xl"} />}
            {name && <figcaption className="text-2xl font-bold tracking-tight text-white">{name}</figcaption>}
          </figure>}
          {src && share && <SharePanel avatar={src} round={round} share={share} />}
        </div>
      </DialogContent>
    </Dialog>
  );
}
