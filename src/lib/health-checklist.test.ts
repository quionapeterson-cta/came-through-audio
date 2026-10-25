import { describe, it, expect } from "vitest";
import { emptyMetadata } from "@/lib/metadata";
import { trackReport } from "@/lib/health";
import { ACCOUNT_REF, catalogHealth, INTL_KEY, printKey, registrationPrint, releaseGroups, searchKey, songChecklist } from "@/lib/health-checklist";
import { inspectorChecks, emptyStatus } from "@/lib/health-songs";
import { countryByCode } from "@/lib/repertoires";

const us = countryByCode("US")!;
const track = (extra = {}) => ({ id: "t1", title: "Song", artist: "Q", updatedAt: "", metadata: { ...emptyMetadata(), title: "Song", artist: "Q", isrc: "USCTA2600001",
  upc: "123456789012", duration: "3:10", primaryGenre: "Hip-Hop/Rap", samples: "No" as const, writtenFor: "No" as const,
  writers: [{ name: "", legalName: "Ann Lee", role: "Author/Composer", pro: "BMI", ipi: "00123456789", percentage: "100" }],
  publishers: [{ name: "Lee Songs", pro: "BMI", ipi: "00987654321", percentage: "100" }], ...extra } });

describe("song health checklist", () => {
  it("is 100% ready from the catalog alone, with registration still to do", () => {
    const c = songChecklist(trackReport(track(), us, []), us);
    expect(c.steps.filter((s) => s.stage === "details").map((s) => [s.id, s.done])).toEqual([["ready:performance", true], ["ready:digital", true], ["ready:mechanical", true]]);
    expect(c.steps.find((s) => s.id === "register:performance")?.society?.id).toBe("bmi");
    expect(c.pct).toBe(100);
    expect(c.registered).toEqual({ done: 0, total: 4 });
    expect(c.group).toBe("attention");
  });
  it("scores readiness by agency with the shared registration check", () => {
    const c = songChecklist(trackReport(track({ upc: "", writers: [{ name: "", legalName: "", role: "Composer", pro: "", ipi: "", percentage: "" }] }), us, []), us);
    expect(c.steps.find((s) => s.id === "ready:performance")?.done).toBe(false);
    expect(c.steps.find((s) => s.id === "ready:digital")?.items?.map((i) => i.field)).toEqual(["upc"]);
    expect(c.pct).toBe(0);
  });
  it("counts a BMI song with no publisher as ready with BMI, without Self-published (BMI pays its writers the publisher share)", () => {
    const m = { publishers: [{ name: "", pro: "", ipi: "", percentage: "" }] };
    const steps = songChecklist(trackReport(track(m), us, []), us).steps;
    expect(steps.find((s) => s.id === "ready:performance")?.done).toBe(true);
    // The MLC too: the bulk file lists the writer as publisher with the placeholder IPI (founder, 2026-10-25).
    expect(steps.find((s) => s.id === "ready:mechanical")?.done).toBe(true);
    expect(songChecklist(trackReport(track({ ...m, selfPublished: true }), us, []), us).pct).toBe(100);
  });
  it("averages readiness across the catalog and counts ticked registrations", () => {
    const h = catalogHealth([track(), { ...track({ upc: "" }), id: "t2" }], us, [], [{ ...emptyStatus("t1"), steps: { "registered:bmi": "x" } }]);
    expect(h.pct).toBe(84);
    expect(h.ready).toBe(1);
    expect(h.registered).toEqual({ done: 1, total: 8 });
    expect(h.next).toMatchObject({ field: "upc" });
  });
  it("ticked registrations and found marks count, and saved-for-later moves the song", () => {
    const status = { ...emptyStatus("t1"), list: "later" as const, steps: { "registered:bmi": "x" } };
    const c = songChecklist(trackReport(track(), us, []), us, status);
    expect(c.steps.find((s) => s.id === "register:performance")?.done).toBe(true);
    expect(c.group).toBe("later");
  });
  it("reaches 100% when every society is confirmed, the ISWC is in and international airplay is set up", () => {
    const r = trackReport(track({ iswc: "T1234567890" }), us, ["bmi", "mlc", "soundexchange"].map((society) => ({ trackId: "t1", society, status: "found" as const, source: "self" as const, checkedAt: "x" })));
    const c = songChecklist(r, us, undefined, { ...emptyStatus(ACCOUNT_REF), steps: { [INTL_KEY]: "x" } });
    expect(c.steps.filter((s) => !s.done).map((s) => s.title)).toEqual([]);
    expect(c.group).toBe("healthy");
  });
  it("reads inspector marks back as checks", () => {
    expect(inspectorChecks([{ ...emptyStatus("h:1"), steps: { "found:bmi": "x", "registered:mlc": "y" } }])).toEqual([{ trackId: "h:1", society: "bmi", status: "found", source: "self", checkedAt: "x" }]);
  });

  it("asks for a registration update when registered details change afterwards", () => {
    const t = track();
    const steps = { "registered:bmi": "2026-10-01T00:00:00Z", [printKey("bmi")]: registrationPrint(t.metadata, "performance") };
    const same = songChecklist(trackReport(t, us, []), us, { ...emptyStatus("t1"), steps });
    expect(same.steps.find((s) => s.id === "register:performance")).toMatchObject({ done: true, update: false });
    const changed = track({ writers: [{ name: "", legalName: "Ann Lee", role: "Author/Composer", pro: "BMI", ipi: "00123456789", percentage: "50" }] });
    const step = songChecklist(trackReport(changed, us, []), us, { ...emptyStatus("t1"), steps }).steps.find((s) => s.id === "register:performance");
    expect(step).toMatchObject({ done: false, update: true, title: "Update your registration at BMI" });
  });
  it("searches each agency by its most exact key", () => {
    const m = track().metadata;
    const socs = us.societies;
    expect(searchKey(socs.digital![0]!, m)).toMatchObject({ by: "ISRC", value: "USCTA2600001" });
    expect(searchKey(socs.mechanical![0]!, m)).toMatchObject({ by: "writer name", value: "Ann Lee" });
    expect(searchKey(socs.performance![0]!, m)).toMatchObject({ by: "writer name", value: "Ann Lee" });
    expect(searchKey(countryByCode("GB")!.societies.performance![0]!, m)).toMatchObject({ by: "title", value: "Song" });
    expect(searchKey(socs.digital![0]!, { ...m, isrc: "" })).toMatchObject({ value: "", field: "isrc" });
  });

  it("groups songs by release in track order, with Singles and Inspector songs last", () => {
    const song = (id: string, album: string, trackNumber: string, pct: number, releaseType = album ? "Album" : "Single") => {
      const t = { ...track({ album, trackNumber, releaseType }), id, title: id };
      return { r: trackReport(t, us, []), c: { ...songChecklist(trackReport(t, us, []), us), pct } };
    };
    const songs = [song("b2", "Karma Season", "2", 40), song("b1", "Karma Season", "1", 80), song("s1", "", "", 10), song("e1", "Came Through", "1", 90), song("h:x", "", "", 0)];
    const groups = releaseGroups(songs, "least");
    expect(groups.map((g) => g.name)).toEqual(["Karma Season", "Came Through", "Singles", "Royalty Inspector songs"]);
    expect(groups[0]!.songs.map((x) => x.r.track.id)).toEqual(["b1", "b2"]);
    expect(groups[0]!.pct).toBe(60);
    expect(releaseGroups(songs, "az").map((g) => g.name).slice(0, 2)).toEqual(["Came Through", "Karma Season"]);
    expect(releaseGroups(songs, "least", "karma").flatMap((g) => g.songs).length).toBe(2);
  });

  it("puts every single in one Singles group, even when its title is typed in Album", () => {
    const song = (id: string, album: string, releaseType: string, pct: number) => {
      const t = { ...track({ album, releaseType, trackNumber: "1" }), id, title: id };
      return { r: trackReport(t, us, []), c: { ...songChecklist(trackReport(t, us, []), us), pct } };
    };
    const songs = [song("Zed", "Zed", "Single", 20), song("Alpha", "Alpha", "", 70), song("Beta", "", "Single", 10), song("e1", "Tape", "EP", 50)];
    const groups = releaseGroups(songs, "least");
    expect(groups.map((g) => [g.name, g.type])).toEqual([["Tape", "EP"], ["Singles", ""]]);
    expect(groups[1]!.songs.map((x) => x.r.track.id)).toEqual(["Beta", "Zed", "Alpha"]);
    expect(releaseGroups(songs, "az")[1]!.songs.map((x) => x.r.track.id)).toEqual(["Alpha", "Beta", "Zed"]);
  });

  it("asks US users once per account to collect international airplay", () => {
    const r = trackReport(track(), us, []);
    expect(songChecklist(r, us).steps.find((s) => s.id === "intl")).toMatchObject({ stage: "register", done: false });
    const account = { ...emptyStatus(ACCOUNT_REF), steps: { [INTL_KEY]: "2026-10-20T00:00:00Z" } };
    expect(songChecklist(r, us, undefined, account).steps.find((s) => s.id === "intl")?.done).toBe(true);
    const gb = countryByCode("GB")!;
    expect(songChecklist(trackReport(track(), gb, []), gb).steps.some((s) => s.id === "intl")).toBe(false);
  });
});
