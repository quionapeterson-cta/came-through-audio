import { useEffect, useState } from "react";
import { Download, Globe, PlusSquare, Share } from "lucide-react";
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
  /** What came of the attempt, so a caller can tell an install apart from a dismissed prompt or the manual steps. */
  const install = async (): Promise<"accepted" | "dismissed" | "help"> => {
    if (deferred) {
      await deferred.prompt();
      const { outcome } = await deferred.userChoice;
      deferred = null;
      notify();
      return outcome;
    }
    setIosHelp(true);
    return "help";
  };
  return { canInstall, installed, install, iosHelp, setIosHelp };
}

/** The Add to Home Screen steps for iPhone and iPad, where browsers can't show an install prompt. */
export function IosInstallHelp({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Install Came Through Audio</DialogTitle>
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

/** The steps for a browser that never offers the one-tap install, from its own menu. */
export function InstallSteps({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Install Came Through Audio</DialogTitle>
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
        <Button variant="outline" onClick={() => onOpenChange(false)}>Got it</Button>
      </DialogContent>
    </Dialog>
  );
}

/** Where the answer is kept, so the question is asked once rather than on every visit. */
const ENTRY_KEY = "cta-entry";

/**
 * The entrance screen (founder, 2026-11-04; made a standalone screen 2026-11-05): put Came Through Audio on the home
 * screen, or go straight into the site in the browser. It covers the whole viewport and holds the page still behind
 * it, so the question is a decision rather than a section to scroll past: the site is only reachable once one of the
 * two answers is given. The answer is remembered, so it is asked once, and someone running the installed app skips it
 * outright.
 */
export function AppOrBrowserGate() {
  const { canInstall, install, iosHelp, setIosHelp } = useInstallApp();
  const [asking, setAsking] = useState(true);
  const [steps, setSteps] = useState(false);
  useEffect(() => {
    let chosen: string | null = null;
    try { chosen = window.localStorage.getItem(ENTRY_KEY); } catch { chosen = null; }
    if (chosen || isInstalled()) setAsking(false);
  }, []);
  // No scrolling past the question: the page behind it stays where it is until an answer is given.
  useEffect(() => {
    if (!asking) return;
    const { body } = document;
    const previous = body.style.overflow;
    body.style.overflow = "hidden";
    return () => { body.style.overflow = previous; };
  }, [asking]);
  const choose = (how: "app" | "browser") => {
    try { window.localStorage.setItem(ENTRY_KEY, how); } catch { /* private browsing: they'll be asked again */ }
    setAsking(false);
    window.scrollTo({ top: 0 });
  };
  /** Only an accepted install counts as choosing the app; a dismissed prompt leaves the question open. */
  const addToPhone = () => {
    if (!canInstall) { setSteps(true); return; }
    void install().then((outcome) => { if (outcome === "accepted") choose("app"); });
  };
  if (!asking) return null;
  return (
    <div role="dialog" aria-modal="true" aria-label="Choose how to open Came Through Audio" className="fixed inset-0 z-50 overflow-y-auto bg-ink text-ink-foreground">
      <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col items-center justify-center gap-5 px-6 py-14 text-center">
        <img src="/icon-192.png" alt="Came Through Audio" width={80} height={80} className="h-20 w-20 rounded-[22px] shadow-lg" />
        <p className="text-sm font-bold uppercase tracking-[2px] text-ink-foreground/70">Welcome to Came Through Audio</p>
        <h1 className="text-4xl font-extrabold tracking-tight md:text-5xl">How do you want to come through?</h1>
        <p className="max-w-xl text-lg text-ink-foreground/80">Put Came Through Audio on your home screen and it opens full screen like any app, or keep going right here in your browser. Same account, same catalog, either way.</p>
        <div className="mt-2 grid w-full gap-3 sm:grid-cols-2">
          <Button size="lg" className="h-auto flex-col items-start gap-1 px-5 py-4 text-left" onClick={addToPhone}>
            <span className="flex items-center gap-2 text-base font-bold"><Download className="h-5 w-5" aria-hidden />Add to home screen</span>
            <span className="text-xs font-medium opacity-80">Opens full screen, one tap away, and it's free.</span>
          </Button>
          <Button size="lg" variant="outline" className="h-auto flex-col items-start gap-1 border-ink-foreground/30 bg-transparent px-5 py-4 text-left text-ink-foreground hover:bg-ink-foreground/10 hover:text-ink-foreground" onClick={() => choose("browser")}>
            <span className="flex items-center gap-2 text-base font-bold"><Globe className="h-5 w-5" aria-hidden />Continue in browser</span>
            <span className="text-xs font-medium opacity-80">Nothing to install, nothing to accept.</span>
          </Button>
        </div>
        <p className="text-xs text-ink-foreground/60">You can add it later from the workspace.</p>
      </div>
      {/* Followed the steps to the end: that is the app, so the site opens rather than asking again. */}
      <IosInstallHelp open={iosHelp} onOpenChange={(v) => { setIosHelp(v); if (!v) choose("app"); }} />
      <InstallSteps open={steps} onOpenChange={(v) => { setSteps(v); if (!v) choose("app"); }} />
    </div>
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
        {/* The app icon itself, and the same offer as the button below (founder, 2026-11-05): tapping it installs the
            app rather than downloading a picture of it. It is the 512px icon the home screen uses, drawn at 88px, so it
            stays sharp on a retina phone; the button, not the image, carries the label for screen readers. */}
        <button
          type="button"
          onClick={offer}
          aria-label="Download the app"
          title="Download the app"
          className="group rounded-[22px] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-4 focus-visible:ring-offset-background"
        >
          <img
            src="/icon-512.png"
            alt=""
            width={88}
            height={88}
            draggable={false}
            className="h-[88px] w-[88px] rounded-[22px] shadow-lg transition group-hover:-translate-y-0.5 group-hover:shadow-xl group-active:translate-y-0"
          />
        </button>
        <h2 className="text-3xl font-extrabold md:text-4xl">Take Came Through with you</h2>
        <p className="max-w-xl text-lg text-muted-foreground">Install the app for a full-screen home on your phone or computer, or keep working in your browser. Same account, same catalog, either way.</p>
        <div className="mt-2 flex flex-wrap justify-center gap-3">
          <Button size="lg" className="text-base font-bold" onClick={offer}><Download />Download the app</Button>
          <Button size="lg" variant="outline" className="text-base" onClick={() => { setBrowsing(true); document.getElementById("signup")?.scrollIntoView({ behavior: "smooth", block: "center" }); }}><Globe />Continue in browser</Button>
        </div>
        <p className="text-sm text-muted-foreground">Android and computers install in one tap. On iPhone it's Share &rarr; Add to Home Screen, and the steps are one tap away on the download button.</p>
      </div>
      <IosInstallHelp open={iosHelp} onOpenChange={setIosHelp} />
      <InstallSteps open={steps} onOpenChange={setSteps} />
    </section>
  );
}
