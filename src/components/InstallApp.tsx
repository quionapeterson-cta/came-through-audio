import { useEffect, useState } from "react";
import { Download, Globe, PlusSquare, Share, Smartphone } from "lucide-react";
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
  const installed = ready && isInstalled();
  const canInstall = ready && !installed && (!!deferred || isIOS());
  const install = async () => {
    if (deferred) {
      await deferred.prompt();
      await deferred.userChoice;
      deferred = null;
      notify();
    } else setIosHelp(true);
  };
  return { canInstall, installed, install, iosHelp, setIosHelp };
}

/** The Add to Home Screen steps for iPhone and iPad, where browsers can't show an install prompt. */
export function IosInstallHelp({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Install CTAudio</DialogTitle>
          <DialogDescription>Add it to your home screen to open it like an app, full screen.</DialogDescription>
        </DialogHeader>
        <ol className="space-y-3 text-sm">
          <li className="flex items-center gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">1</span>
            <span>Tap the <Share className="inline h-4 w-4 align-text-bottom text-primary" aria-label="Share" /> <span className="font-semibold">Share</span> button. In Safari it's at the bottom of the screen (at the top on iPad).</span></li>
          <li className="flex items-center gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">2</span>
            <span>Scroll and tap <PlusSquare className="inline h-4 w-4 align-text-bottom text-primary" aria-hidden /> <span className="font-semibold">Add to Home Screen</span>.</span></li>
          <li className="flex items-center gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">3</span>
            <span>Tap <span className="font-semibold">Add</span>. CTAudio appears on your home screen.</span></li>
        </ol>
        <Button variant="outline" onClick={() => onOpenChange(false)}>Got it</Button>
      </DialogContent>
    </Dialog>
  );
}

/**
 * The homepage's "take it with you" band (founder, 2026-11-04): install the app, or stay in the browser. Both are
 * offered plainly, with the steps at hand, because the one-tap prompt only fires when the browser feels like it and
 * iPhone never fires one at all.
 */
export function DownloadApp() {
  const { canInstall, installed, install, iosHelp, setIosHelp } = useInstallApp();
  const [steps, setSteps] = useState(false);
  const [browsing, setBrowsing] = useState(false);
  const offer = () => { if (canInstall) void install(); else setSteps(true); };
  if (installed || browsing) return null;
  return (
    <section className="border-b border-border bg-background">
      <div className="mx-auto flex max-w-4xl flex-col items-center gap-4 px-6 py-16 text-center">
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/15"><Smartphone className="h-6 w-6 text-primary" aria-hidden /></span>
        <h2 className="text-3xl font-extrabold md:text-4xl">Take CTAudio with you</h2>
        <p className="max-w-xl text-lg text-muted-foreground">Install the app for a full-screen home on your phone or computer, or keep working in your browser. Same account, same catalog, either way.</p>
        <div className="mt-2 flex flex-wrap justify-center gap-3">
          <Button size="lg" className="text-base font-bold" onClick={offer}><Download />Download the app</Button>
          <Button size="lg" variant="outline" className="text-base" onClick={() => { setBrowsing(true); document.getElementById("signup")?.scrollIntoView({ behavior: "smooth", block: "center" }); }}><Globe />Continue in browser</Button>
        </div>
        <p className="text-sm text-muted-foreground">Android and computers install in one tap. On iPhone it's Share &rarr; Add to Home Screen, and the steps are one tap away on the download button.</p>
      </div>
      <IosInstallHelp open={iosHelp} onOpenChange={setIosHelp} />
      <Dialog open={steps} onOpenChange={setSteps}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Install CTAudio</DialogTitle>
            <DialogDescription>Your browser didn't offer the one-tap install, so add it from its own menu. It takes a few seconds.</DialogDescription>
          </DialogHeader>
          <ol className="space-y-3 text-sm">
            <li className="flex gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">1</span>
              <span>Open this site in Chrome, Edge or Samsung Internet: the browsers that can install it.</span></li>
            <li className="flex gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">2</span>
              <span>Tap the browser menu and choose <span className="font-semibold">Install app</span> or <span className="font-semibold">Add to Home screen</span>. On a computer it's the install icon in the address bar.</span></li>
            <li className="flex gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">3</span>
              <span>On iPhone or iPad: tap <Share className="inline h-4 w-4 align-text-bottom text-primary" aria-label="Share" /> <span className="font-semibold">Share</span>, then <span className="font-semibold">Add to Home Screen</span>.</span></li>
          </ol>
          <Button variant="outline" onClick={() => setSteps(false)}>Got it</Button>
        </DialogContent>
      </Dialog>
    </section>
  );
}
