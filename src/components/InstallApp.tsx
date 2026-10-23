import { useEffect, useState } from "react";
import { PlusSquare, Share } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

/** Chrome and Edge's install prompt. It fires once, often before the workspace loads, so it's caught here at import. */
type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };
let deferred: InstallPrompt | null = null;
const subscribers = new Set<() => void>();
const notify = () => subscribers.forEach((f) => f());
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferred = e as InstallPrompt; notify(); });
  window.addEventListener("appinstalled", () => { deferred = null; notify(); });
}

const isInstalled = () => window.matchMedia?.("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
/** iPhone and iPad (iPadOS reports itself as a Mac with touch). They have no install prompt, only Share → Add to Home Screen. */
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

/**
 * Whether to offer "Install the app": never once it's installed; on Android and computers only when the browser offers
 * an install prompt; on iPhone and iPad always (with Add to Home Screen steps).
 */
export function useInstallApp() {
  const [, rerender] = useState(0);
  const [iosHelp, setIosHelp] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const f = () => rerender((n) => n + 1);
    subscribers.add(f);
    setReady(true);
    return () => { subscribers.delete(f); };
  }, []);
  const canInstall = ready && !isInstalled() && (!!deferred || isIOS());
  const install = async () => {
    if (deferred) {
      await deferred.prompt();
      await deferred.userChoice;
      deferred = null;
      notify();
    } else setIosHelp(true);
  };
  return { canInstall, install, iosHelp, setIosHelp };
}

/** The Add to Home Screen steps for iPhone and iPad, where browsers can't show an install prompt. */
export function IosInstallHelp({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Install Came Through</DialogTitle>
          <DialogDescription>Add it to your home screen to open it like an app, full screen.</DialogDescription>
        </DialogHeader>
        <ol className="space-y-3 text-sm">
          <li className="flex items-center gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">1</span>
            <span>Tap the <Share className="inline h-4 w-4 align-text-bottom text-primary" aria-label="Share" /> <span className="font-semibold">Share</span> button. In Safari it's at the bottom of the screen (at the top on iPad).</span></li>
          <li className="flex items-center gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">2</span>
            <span>Scroll and tap <PlusSquare className="inline h-4 w-4 align-text-bottom text-primary" aria-hidden /> <span className="font-semibold">Add to Home Screen</span>.</span></li>
          <li className="flex items-center gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">3</span>
            <span>Tap <span className="font-semibold">Add</span>. Came Through appears on your home screen.</span></li>
        </ol>
        <Button variant="outline" onClick={() => onOpenChange(false)}>Got it</Button>
      </DialogContent>
    </Dialog>
  );
}
