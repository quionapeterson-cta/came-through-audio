import { describe, it, expect } from "vitest";
import { explainerScript, rankVoices, sceneSeconds } from "@/lib/explainer";
import type { Finding } from "@/lib/royalty-checkup";

const finding: Finding = {
  id: "artery-left", organ: "heart", severity: "treat", scan: "artery-left", songs: [{ id: "a", title: "Midnight", why: "IPI missing" }],
  dx: "Blockage in the left heart artery.", what: "3 of 8 songs can't pay your writer share from ASCAP.", symptom: "No writer royalties from ASCAP for these songs.",
  cause: "Your IPI number is missing.", note: "Strong, even breaths: one song at a time.",
  steps: [{ title: "Add your IPI", text: "Add it once in Catalog Profile." }, { title: "Download your ASCAP cheat sheet", text: "Every field ASCAP asks for." }, { title: "Register at ASCAP", text: "In ASCAP Member Access." }, { title: "Tick Registered", text: "We'll remind you." }],
};

describe("explainer", () => {
  it("walks through the finding, symptom, cause, every step and a calm close, in about 30 seconds", () => {
    const s = explainerScript(finding);
    expect(s.map((x) => x.kind)).toEqual(["intro", "symptom", "cause", "step", "step", "step", "step", "close"]);
    expect(s[0]!.speech).toBe("Let's take a look at your heart. Blockage in the left heart artery.");
    expect(s[3]).toMatchObject({ title: "Step 1 · Add your IPI", speech: "Step 1. Add your IPI." });
    expect(s.at(-1)!.speech).toBe("Strong, even breaths: one song at a time. You've got this.");
    const total = s.reduce((n, x) => n + sceneSeconds(x), 0);
    expect(total).toBeLessThanOrEqual(40);
  });

  it("prefers natural voices and drops the robotic ones", () => {
    const v = (name: string, lang = "en-US") => ({ name, lang, localService: true, voiceURI: name });
    const ranked = rankVoices([v("Fred"), v("Google UK English Female", "en-GB"), v("Microsoft Aria Online (Natural) - English (United States)"), v("Samantha"), v("Ava (Premium)"), v("Amélie", "fr-CA")]);
    expect(ranked.map((x) => x.name)).toEqual(["Microsoft Aria Online (Natural) - English (United States)", "Ava (Premium)", "Samantha", "Google UK English Female"]);
  });
});
