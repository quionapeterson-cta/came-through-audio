import { ORGAN_NAME, type Finding } from "@/lib/royalty-checkup";

/**
 * The 30-second explainer for one finding: a few short scenes (the finding, what you'd notice, why, each treatment
 * step, then a calm close). Captions use the report's own numbers; the voice reads a shorter, friendlier version.
 * Free: animation is SVG/CSS and the voice is the device's own text-to-speech.
 */
export type SceneKind = "intro" | "symptom" | "cause" | "step" | "close";
export type Scene = { kind: SceneKind; title: string; caption: string; speech: string; step?: number };

const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

export function explainerScript(f: Finding): Scene[] {
  const organ = ORGAN_NAME[f.organ].toLowerCase();
  const scenes: Scene[] = [
    { kind: "intro", title: f.dx, caption: f.what, speech: `Let's take a look at your ${organ}. ${f.dx}` },
    { kind: "symptom", title: "What you'd notice", caption: f.symptom, speech: `Here's what you'd notice. ${f.symptom}` },
    { kind: "cause", title: "Why it's happening", caption: `${f.what} ${f.cause}`, speech: `Why? ${f.cause}` },
    ...f.steps.map((s, i): Scene => ({ kind: "step", step: i + 1, title: `Step ${i + 1} · ${s.title}`, caption: s.text, speech: `Step ${i + 1}. ${s.title}.` })),
  ];
  scenes.push({ kind: "close", title: "You've got this", caption: f.note ?? "Open the report to start. Every step has a button that takes you there.",
    speech: f.note ? `${f.note} You've got this.` : "That's it. Open the report to start, one step at a time. You've got this." });
  return scenes;
}

/** Seconds a scene stays up when the voice is off: about 2.6 words a second, at least 3 seconds. */
export const sceneSeconds = (s: Scene) => Math.max(3, Math.round(((s.caption.split(/\s+/).length + s.title.split(/\s+/).length) / 2.6) * 10) / 10);

type VoiceLike = Pick<SpeechSynthesisVoice, "name" | "lang" | "localService" | "voiceURI">;
/**
 * Ranks the device's voices from most natural to most robotic. Neural / "Natural" / "Online" voices (Edge, Windows),
 * Apple's Enhanced and Premium voices and Google's voices sound friendliest; novelty and eSpeak voices sound robotic.
 */
export function voiceScore(v: VoiceLike): number {
  let n = 0;
  const name = `${v.name} ${v.voiceURI}`;
  if (/^en-US/i.test(v.lang)) n += 30; else if (/^en-(GB|AU|CA|IE|NZ|ZA)/i.test(v.lang)) n += 20; else if (/^en/i.test(v.lang)) n += 10; else n -= 200;
  if (/natural|neural/i.test(name)) n += 60;
  if (/premium/i.test(name)) n += 50;
  if (/enhanced/i.test(name)) n += 40;
  if (/online/i.test(name)) n += 25;
  if (/google/i.test(name)) n += 25;
  if (/\b(ava|samantha|allison|susan|zoe|evan|nathan|joelle|nicky|aria|jenny|guy|michelle|emma|brian|andrew|serena|daniel|karen|moira|tessa)\b/i.test(name)) n += 20;
  if (/espeak|compact|\b(fred|albert|zarvox|bahh|bells|boing|bubbles|cellos|jester|organ|superstar|trinoids|whisper|wobble|bad news|good news|junior|ralph|kathy|princess)\b/i.test(name)) n -= 150;
  return n;
}
export const rankVoices = <V extends VoiceLike>(voices: V[]) => [...voices].filter((v) => voiceScore(v) > -100).sort((a, b) => voiceScore(b) - voiceScore(a));
