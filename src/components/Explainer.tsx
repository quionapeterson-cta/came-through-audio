import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Pause, Play, RotateCcw, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { MONITOR, OrganIcon, Scan, Tool } from "@/components/royalty-art";
import { explainerScript, rankVoices, sceneSeconds } from "@/lib/explainer";
import type { Finding, Organ } from "@/lib/royalty-checkup";

const VOICE_KEY = "cta-explainer-voice";
const VOICE_ON_KEY = "cta-explainer-voice-on";
const read = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const write = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* private mode: just don't remember */ } };
/** "Microsoft Aria Online (Natural) - English (United States)" → "Aria (Natural)". */
const voiceLabel = (v: SpeechSynthesisVoice) => {
  const natural = /natural|neural|premium|enhanced/i.exec(v.name)?.[0];
  const base = v.name.replace(/^(Microsoft|Google|Apple)\s+/i, "").replace(/\s*\(.*$|\s+-\s+.*$|\s+Online.*$/i, "").trim() || v.name;
  return natural ? `${base} (${natural.charAt(0).toUpperCase()}${natural.slice(1).toLowerCase()})` : base;
};

/** Voices load late in some browsers; this keeps the ranked list current. */
function useVoices() {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const load = () => setVoices(rankVoices(window.speechSynthesis.getVoices()));
    load();
    window.speechSynthesis.addEventListener("voiceschanged", load);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", load);
  }, []);
  return voices;
}

/**
 * The 30-second explainer for one finding: animated scenes with captions, read aloud by the device's most natural voice.
 * Free to run (no video files, no paid voice service). Captions are always on; the voice can be switched off or changed.
 */
export function Explainer({ finding, organ, onClose }: { finding: Finding | null; organ?: Organ | undefined; onClose: () => void }) {
  const scenes = useMemo(() => (finding ? explainerScript(finding) : []), [finding]);
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(true);
  const voices = useVoices();
  const [voiceOn, setVoiceOn] = useState(() => read(VOICE_ON_KEY) !== "off");
  const [voiceId, setVoiceId] = useState(() => read(VOICE_KEY) ?? "");
  const voice = voices.find((v) => v.voiceURI === voiceId) ?? voices[0];
  const timer = useRef<number | undefined>(undefined);
  const canSpeak = typeof window !== "undefined" && "speechSynthesis" in window && voices.length > 0;

  useEffect(() => { setI(0); setPlaying(true); }, [finding]);
  const stop = () => { window.clearTimeout(timer.current); if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel(); };
  useEffect(() => stop, []);

  // Plays the current scene: the voice leads when it's on (with a safety timer), otherwise a reading-pace timer.
  useEffect(() => {
    stop();
    const scene = scenes[i];
    if (!scene || !playing) return;
    const next = () => { if (i < scenes.length - 1) setI(i + 1); else setPlaying(false); };
    const secs = sceneSeconds(scene);
    if (voiceOn && canSpeak && voice) {
      const u = new SpeechSynthesisUtterance(scene.speech);
      u.voice = voice; u.lang = voice.lang; u.rate = 0.97; u.pitch = 1.02;
      u.onend = () => { window.clearTimeout(timer.current); timer.current = window.setTimeout(next, 450); };
      window.speechSynthesis.speak(u);
      timer.current = window.setTimeout(next, (secs + 4) * 1000);
    } else timer.current = window.setTimeout(next, secs * 1000);
  }, [i, playing, voiceOn, voice, scenes]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!finding) return null;
  const scene = scenes[i]!;
  const steps = finding.steps.length;
  const healed = scene.kind === "close" ? 1 : scene.kind === "step" ? (scene.step! - 1) / steps : 0;
  const o = organ ?? { id: finding.organ, broken: finding.id === "broken" };
  const go = (n: number) => { setI(Math.max(0, Math.min(scenes.length - 1, n))); setPlaying(true); };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) { stop(); onClose(); } }}>
      <DialogContent className="rr max-w-2xl gap-0 overflow-hidden p-0">
        <DialogTitle className="sr-only">Explainer: {finding.dx}</DialogTitle>
        <DialogDescription className="sr-only">A short animated explanation of this finding and how to fix it, with captions.</DialogDescription>
        <div className="rr-stage" aria-hidden="true">
          <div key={i} className="rr-scene">
            {scene.kind === "intro" && <div className="rr-pop flex flex-col items-center gap-3"><div className="rr-beat-loop"><OrganIcon organ={o} className="h-36 w-36" /></div></div>}
            {scene.kind === "symptom" && <div className="rr-pop w-full max-w-md"><Scan condition={finding.scan} label="SYMPTOM" /></div>}
            {scene.kind === "cause" && <div className="w-full max-w-md overflow-hidden rounded-2xl"><div className="rr-zoom"><Scan condition={finding.scan} label="CAUSE" /></div></div>}
            {scene.kind === "step" && <div className="flex items-center gap-8">
              <div className="rr-pop relative"><Tool kind={finding.steps[scene.step! - 1]?.action?.kind} big />
                <span className="absolute -left-3 -top-3 flex h-10 w-10 items-center justify-center rounded-full text-lg font-extrabold" style={{ background: "var(--rr-prestige)", color: "var(--rr-prestige-ink)" }}>{scene.step}</span></div>
              <div className="flex flex-col items-center gap-2"><OrganIcon organ={o} className="h-24 w-24 transition-[filter] duration-700" style={{ filter: `grayscale(${1 - healed})` }} />
                <span className="text-xs text-white/70">Healing · step {scene.step} of {steps}</span>
                <span className="h-1.5 w-28 rounded-full bg-white/15"><span className="block h-1.5 rounded-full transition-[width] duration-700" style={{ width: `${Math.round((scene.step! / steps) * 100)}%`, background: "var(--rr-prestige)" }} /></span></div>
            </div>}
            {scene.kind === "close" && <div className="flex w-full flex-col items-center gap-3">
              <div className="rr-pop"><OrganIcon organ={{ id: o.id, broken: false }} className="h-32 w-32" /></div>
              <svg viewBox="0 0 400 60" className="h-12 w-full max-w-md" preserveAspectRatio="none"><path className="rr-ekg" d={MONITOR.healthy} fill="none" stroke="#4D8CFF" strokeWidth="3" strokeLinejoin="round" /></svg>
            </div>}
          </div>
        </div>

        <div className="space-y-3 p-5">
          <div className="flex gap-1" aria-hidden="true">{scenes.map((_, n) => <span key={n} className="h-1 flex-1 rounded-full" style={{ background: n <= i ? "var(--rr-prestige)" : "var(--border)" }} />)}</div>
          <div aria-live="polite" className="min-h-24">
            <div className="text-lg font-extrabold leading-snug">{scene.title}</div>
            <p className="mt-1 text-muted-foreground">{scene.caption}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="icon" variant="outline" aria-label="Back" disabled={i === 0} onClick={() => go(i - 1)}><ChevronLeft /></Button>
            {!playing && i === scenes.length - 1
              ? <Button onClick={() => go(0)}><RotateCcw />Replay</Button>
              : <Button onClick={() => setPlaying(!playing)}>{playing ? <><Pause />Pause</> : <><Play />Play</>}</Button>}
            <Button size="icon" variant="outline" aria-label="Next" disabled={i === scenes.length - 1} onClick={() => go(i + 1)}><ChevronRight /></Button>
            <span className="flex-1" />
            {canSpeak && <>
              <Button size="icon" variant="ghost" aria-label={voiceOn ? "Turn the voice off" : "Turn the voice on"} aria-pressed={voiceOn}
                onClick={() => { const on = !voiceOn; setVoiceOn(on); write(VOICE_ON_KEY, on ? "on" : "off"); }}>{voiceOn ? <Volume2 /> : <VolumeX />}</Button>
              {voiceOn && voices.length > 1 && <select aria-label="Voice" value={voice?.voiceURI ?? ""} onChange={(e) => { setVoiceId(e.target.value); write(VOICE_KEY, e.target.value); }}
                className="h-9 max-w-44 rounded-md border border-input bg-background px-2 text-sm">
                {voices.slice(0, 8).map((v) => <option key={v.voiceURI} value={v.voiceURI}>{voiceLabel(v)}</option>)}
              </select>}
            </>}
          </div>
          {voiceOn && canSpeak && voice && !/natural|neural|premium|enhanced|online|google/i.test(voice.name) &&
            <p className="text-xs text-muted-foreground">Tip: for a more natural voice, use Microsoft Edge, or on iPhone and Mac download an Enhanced voice in Settings → Accessibility → Spoken Content → Voices.</p>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
