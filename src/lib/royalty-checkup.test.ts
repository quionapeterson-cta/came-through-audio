import { describe, it, expect } from "vitest";
import { emptyMetadata } from "@/lib/metadata";
import { trackReport } from "@/lib/health";
import { songChecklist } from "@/lib/health-checklist";
import { emptyStatus, type SongStatus } from "@/lib/health-songs";
import { countryByCode } from "@/lib/repertoires";
import { royaltyCheckup, sinceLast, summarize } from "@/lib/royalty-checkup";

const us = countryByCode("US")!;
const writer = (extra = {}) => ({ name: "", legalName: "Ann Lee", role: "Author/Composer", pro: "ASCAP", ipi: "00123456789", percentage: "100", ...extra });
const track = (id: string, extra = {}) => ({ id, title: id, artist: "Q", updatedAt: "", metadata: { ...emptyMetadata(), title: id, artist: "Q", isrc: `USCTA26000${id.length}${id.charCodeAt(0) % 10}`,
  upc: "123456789012", duration: "3:10", primaryGenre: "Hip-Hop/Rap", samples: "No" as const, writtenFor: "No" as const, composers: [],
  writers: [writer()], publishers: [{ name: "Lee Songs", pro: "ASCAP", ipi: "00987654321", percentage: "100" }], ...extra } });
type T = ReturnType<typeof track>;
const registeredAll = (id: string, at = "2026-10-01T00:00:00Z"): SongStatus => ({ ...emptyStatus(id), steps: { "registered:ascap": at, "registered:mlc": at, "registered:soundexchange": at } });
const run = (tracks: T[], statuses: SongStatus[] = [], signedSheets?: Map<string, boolean>, today = "2026-10-23T00:00:00Z") =>
  royaltyCheckup({ rows: tracks.map((t) => {
    const r = trackReport(t, us, []);
    const status = statuses.find((s) => s.songRef === t.id);
    return { r, c: songChecklist(r, us, status), status };
  }), signedSheets, today });
const ids = (c: ReturnType<typeof run>) => c.organs.flatMap((o) => o.findings.map((f) => f.id));

describe("royalty checkup", () => {
  it("is all clear for a complete, registered song", () => {
    const c = run([track("a", { iswc: "T1234567890" })], [registeredAll("a")]);
    expect(ids(c)).toEqual([]);
    expect(c.lead).toBeNull();
    expect(c.organs.every((o) => o.state === "healthy")).toBe(true);
  });

  it("shows no flow, not treatment, when nothing is registered yet but the data is complete", () => {
    const c = run([track("a")]);
    expect(c.organs.find((o) => o.id === "lungs")!.state).toBe("noflow");
    expect(c.organs.find((o) => o.id === "kidneys")!.state).toBe("noflow");
    expect(c.organs.find((o) => o.id === "heart")!.state).toBe("noflow");
  });

  it("breaks the heart when the publisher half is missing, except for BMI writers", () => {
    const noPub = track("a", { publishers: [] });
    expect(run([noPub]).organs.find((o) => o.id === "heart")).toMatchObject({ state: "treat", broken: true });
    const bmi = track("b", { publishers: [], writers: [writer({ pro: "BMI" })] });
    expect(ids(run([bmi]))).not.toContain("broken");
    const selfPub = track("c", { publishers: [], selfPublished: true });
    expect(ids(run([selfPub]))).not.toContain("broken");
  });

  it("leads with the left artery when the writer IPI is missing, in the approved wording", () => {
    const c = run([track("a", { writers: [writer({ ipi: "" })] }), track("b", { writers: [writer({ ipi: "" })] }), track("c")], [registeredAll("c")]);
    expect(c.lead).toMatchObject({ id: "artery-left", dx: "Blockage in the left heart artery.", what: "2 of 3 songs can't pay your writer share from ASCAP." });
    expect(c.lead!.cause).toBe("Your IPI number is missing, and those songs aren't registered with ASCAP yet.");
    expect(c.lead!.steps.map((s) => s.action?.kind)).toEqual(["field", "download", "portal", "tick"]);
    expect(c.lead!.steps.at(-1)!.title).toBe("Tick Registered");
  });

  it("has no heartbeat when no writer belongs to a PRO", () => {
    const c = run([track("a", { writers: [writer({ pro: "", ipi: "" })] })]);
    expect(ids(c)).toContain("noheart");
    expect(ids(c)).not.toContain("artery-left");
  });

  it("asks for the ISWC once the song is registered with a PRO", () => {
    expect(run([track("a")], [registeredAll("a")]).lead).toMatchObject({ id: "brain-fog", what: "1 song is missing codes agencies use to recognize them: ISWC." });
  });

  it("finds mechanicals registered without an ISRC, and recordings missing the owner side", () => {
    const c = run([track("a", { isrc: "" }), track("b", { upc: "" })], [registeredAll("a"), registeredAll("b")]);
    expect(ids(c)).toEqual(expect.arrayContaining(["lungs-one", "kidney-one", "brain-fog"]));
  });

  it("catches one writer entered two ways and one ISRC on two songs", () => {
    const a = track("a", { isrc: "USCTA2600001" });
    const b = track("bb", { isrc: "USCTA2600001", writers: [writer({ ipi: "00111111111" })] });
    const c = run([a, b], [registeredAll("a"), registeredAll("bb")]);
    expect(ids(c)).toEqual(expect.arrayContaining(["brain-mixed", "brain-double"]));
    expect(c.organs.find((o) => o.id === "brain")!.state).toBe("treat");
  });

  it("checks splits and signed split sheets", () => {
    const over = track("a", { writers: [writer({ percentage: "60" }), writer({ legalName: "Bo Ray", percentage: "50" })] });
    const c = run([over], [registeredAll("a")], new Map());
    expect(ids(c)).toEqual(expect.arrayContaining(["spine-align", "spine-back"]));
    expect(c.organs.find((o) => o.id === "spine")!.findings[0]!.what).toBe('"a" splits total 110%.');
    const signed = run([track("b", { writers: [writer({ percentage: "50" }), writer({ legalName: "Bo Ray", percentage: "50" })] })], [registeredAll("b")], new Map([["b", true]]));
    expect(ids(signed)).not.toContain("spine-back");
  });

  it("feels a faint pulse six weeks after registering without confirming, and a skipped beat after an edit", () => {
    expect(ids(run([track("a")], [registeredAll("a", "2026-08-01T00:00:00Z")]))).toContain("pulse-faint");
    expect(ids(run([track("a")], [registeredAll("a", "2026-10-20T00:00:00Z")]))).not.toContain("pulse-faint");
    const edited: SongStatus = { ...registeredAll("a"), steps: { ...registeredAll("a").steps, "print:ascap": "old" } };
    expect(ids(run([track("a")], [edited]))).toContain("pulse-skip");
  });

  it("turns an uploaded agency list into mixed signals and faint pulses", () => {
    const st = (steps: Record<string, string>): SongStatus => ({ ...registeredAll("a"), steps: { ...registeredAll("a").steps, ...steps } });
    const mixed = run([track("a", { iswc: "T1234567890" })], [st({ "list:ascap": JSON.stringify({ at: "x", issues: ["Bo Ray isn't on the agency's registration"] }) })]);
    expect(mixed.lead).toMatchObject({ id: "brain-agency", what: "1 song doesn't match what ASCAP has on file.", cause: "Your catalog and your registration say different things: Bo Ray isn't on the agency's registration." });
    expect(mixed.lead!.scan).toBe("brain-mixed");
    const missing = run([track("a", { iswc: "T1234567890" })], [st({ "list:mlc": JSON.stringify({ at: "x", missing: true }) })]);
    expect(missing.lead).toMatchObject({ id: "pulse-missing", what: "1 song you marked registered isn't on your The MLC list." });
  });

  it("counts a song once per finding, even with two reasons", () => {
    const steps = { ...registeredAll("a").steps, "list:ascap": JSON.stringify({ at: "x", issues: ["Bo Ray isn't on the registration"] }), "list:mlc": JSON.stringify({ at: "x", issues: ["The ISRC differs"] }) };
    const c = run([track("a", { iswc: "T1234567890" })], [{ ...registeredAll("a"), steps }]);
    const f = c.organs.flatMap((o) => o.findings).find((x) => x.id === "brain-agency")!;
    expect(f.songs).toHaveLength(1);
    expect(f.songs[0]!.why).toContain("Bo Ray");
    expect(f.songs[0]!.why).toContain("ISRC differs");
    expect(f.what).toMatch(/^1 song /);
  });

  it("compares with the last checkup", () => {
    const before = summarize(run([track("a", { publishers: [] })]));
    const now = summarize(run([track("a", { iswc: "T1234567890" })], [registeredAll("a")]));
    expect(sinceLast(now, before)).toMatchObject({ healed: ["Heart", "Lungs", "Kidneys"], fresh: 0 });
    expect(sinceLast(now, null)).toBeNull();
  });

  it("BMI writers with no publisher are covered; only the other writers need one, and the writer share still pays", () => {
    const bmiOnly = run([track("a", { publishers: [], writers: [writer({ pro: "BMI" })] })], [registeredAll("a")]);
    expect(ids(bmiOnly)).not.toContain("broken");
    const mixed = run([track("b", { publishers: [], writers: [writer({ pro: "BMI", percentage: "50" }), writer({ legalName: "Kim Roe", pro: "ASCAP", percentage: "50" })] })]);
    const broken = mixed.organs.flatMap((o) => o.findings).find((f) => f.id === "broken")!;
    expect(broken.songs[0]!.why).toBe("no publisher for Kim Roe");
    expect(broken.what).toContain("The writer share still gets paid.");
    expect(broken.cause).toContain("BMI pays them the publisher share too");
  });

  it("reads check-in answers: not sure starts with a search, a split sheet signed elsewhere counts, unreleased recordings wait", () => {
    const two = { writers: [writer({ percentage: "50" }), writer({ legalName: "Kim Roe", percentage: "50" })] };
    const unsure: SongStatus = { ...emptyStatus("a"), steps: { "checkin:mlc": "unsure", "checkin:split": "no", "checkin:delivered": "no" } };
    const c = run([track("a", two)], [unsure]);
    const lungs = c.organs.flatMap((o) => o.findings).find((f) => f.id === "lungs-hold")!;
    expect(lungs.steps[0]!.title).toBe("Check first");
    expect(ids(c)).toContain("spine-back");
    expect(ids(c)).not.toContain("kidney-none");
    const signed = run([track("a", two)], [{ ...emptyStatus("a"), steps: { "checkin:split": "yes" } }]);
    expect(ids(signed)).not.toContain("spine-back");
  });
});
