import { describe, expect, it } from "vitest";
import { agencyMetadata, agencyVersion, fieldChanges, fillPlan, finishItems, writerShares } from "@/lib/agency-fill";
import type { ListResult, ListWork } from "@/lib/agency-lists";
import type { CatalogTrack } from "@/lib/catalog";
import { emptyMetadata } from "@/lib/metadata";

const work = (o: Partial<ListWork> = {}): ListWork => ({ title: "Bloodline", iswc: "", isrc: "", workId: "1", writers: [], ...o });

const track = (id: string, title: string, metadata: Partial<ReturnType<typeof emptyMetadata>> = {}): CatalogTrack => ({
  id, title, artist: "Karma Came", updatedAt: "2026-11-01",
  metadata: { ...emptyMetadata(), title, artist: "Karma Came", ...metadata },
});
const result = (o: Partial<ListResult> = {}): ListResult => ({ matched: [], differences: [], clashes: [], notListed: [], extra: [], works: 0, ...o });

describe("writer shares on a list", () => {
  it("brings a 200% scale back to 100%", () => {
    expect(writerShares([{ name: "A", share: 100 }, { name: "B", share: 100 }])).toEqual([50, 50]);
  });

  it("rounds to a total of exactly 100, so the member's next save passes validation", () => {
    const shares = writerShares([{ name: "A", share: 33.33 }, { name: "B", share: 33.33 }, { name: "C", share: 33.33 }]);
    expect(shares.reduce((n, x) => n + x, 0)).toBe(100);
  });

  it("leaves a share scale alone when it already adds up, and blanks stay blank", () => {
    expect(writerShares([{ name: "A", share: 75 }, { name: "B", share: 25 }])).toEqual([75, 25]);
    expect(writerShares([{ name: "A" }])).toEqual([0]);
  });
});

describe("starting an entry from a list work", () => {
  it("carries the title, codes, writer names, IPI and shares, and leaves the rest blank", () => {
    const m = agencyMetadata(work({ isrc: "USCTA2600111", iswc: "T1234567890", writers: [{ name: "Qui-Ona Peterson", ipi: "123456789", pro: "BMI", share: 100 }] }), "Karma Came");
    expect(m.title).toBe("Bloodline");
    expect(m.artist).toBe("Karma Came");
    expect(m.isrc).toBe("USCTA2600111");
    expect(m.iswc).toBe("T1234567890");
    expect(m.writers[0]).toMatchObject({ legalName: "Qui-Ona Peterson", role: "", ipi: "123456789", pro: "BMI", percentage: "100" });
    expect(m.album).toBe("");
    expect(m.releaseType).toBe("");
  });

  it("keeps a writer row when the list has no writers, so the form still has a place to type one", () => {
    expect(agencyMetadata(work(), "Karma Came").writers).toHaveLength(1);
  });

  it("names what the member still has to add", () => {
    expect(finishItems(agencyMetadata(work(), "Karma Came"))).toEqual(["album or single title", "release type", "duration", "genre", "release date", "writer names", "each writer's role, author or composer — the list doesn't say which"]);
  });
});

describe("planning a fill", () => {
  it("adds the works the catalog doesn't have and offers the catalogued ones as duplicates", () => {
    const existing = track("t1", "Bloodline", { album: "BAM", isrc: "USCTA1600001" });
    const other = track("t2", "Good Girls");
    const plan = fillPlan(result({
      extra: [work({ title: "All Your Life", workId: "9" })],
      matched: [{ trackId: "t1", title: "Bloodline", work: work({ writers: [{ name: "Qui-Ona Peterson", share: 100 }] }), issues: [] }],
      differences: [{ trackId: "t2", title: "Good Girls", work: work({ title: "Good Girls", workId: "7", writers: [{ name: "Qui-Ona Peterson", share: 100 }] }), issues: ["share"] }],
    }), [existing, other], "Karma Came");
    expect(plan.creates.map((c) => c.metadata.title)).toEqual(["All Your Life"]);
    expect(plan.duplicates.map((d) => d.track.id)).toEqual(["t1", "t2"]);
  });

  it("treats a work catalogued after the upload as a duplicate, not a second copy", () => {
    const plan = fillPlan(result({ extra: [work({ title: "Bloodline", workId: "9", writers: [{ name: "Qui-Ona Peterson", share: 100 }] })] }), [track("t1", "Bloodline")], "Karma Came");
    expect(plan.creates).toHaveLength(0);
    expect(plan.duplicates.map((d) => d.track.id)).toEqual(["t1"]);
  });

  it("leaves a song the list already matches exactly out of the dialog", () => {
    const plan = fillPlan(result({ extra: [work({ title: "Bloodline", workId: "9" })] }), [track("t1", "Bloodline")], "Karma Came");
    expect(plan.creates).toHaveLength(0);
    expect(plan.duplicates).toHaveLength(0);
  });

  it("shows the agency's codes, and what differs, before the member chooses", () => {
    // A recording list (SoundExchange) compares the code; a composition list never does.
    const plan = fillPlan(result({ extra: [work({ title: "Bloodline", isrc: "USCTA1600001", iswc: "T1234567890" })] }), [track("t1", "Bloodline")], "Karma Came", "recording");
    expect(plan.duplicates[0]!.issues).toEqual([
      "The agency has ISRC USCTA1600001, your catalog has none",
      "The agency has ISWC T1234567890, your catalog has none",
    ]);
    expect(plan.duplicates[0]!.changes).toEqual([
      { field: "ISRC", catalog: "none", agency: "USCTA1600001" },
      { field: "ISWC", catalog: "none", agency: "T1234567890" },
    ]);
  });

  it("doesn't call a same-title work a duplicate of a song the writers say it isn't", () => {
    const plan = fillPlan(result({
      matched: [{ trackId: "t1", title: "Midnight", work: work({ title: "Midnight", workId: "1", writers: [{ name: "Ann Lee", share: 50 }, { name: "Bo Ray", share: 50 }] }), issues: [] }],
      extra: [work({ title: "Midnight", workId: "2", writers: [{ name: "Someone Else", share: 100 }] })],
    }), [track("t1", "Midnight", { writers: [{ name: "", legalName: "Ann Lee", role: "Author/Composer", pro: "", ipi: "", percentage: "100" }] })], "Karma Came");
    expect(plan.creates.map((c) => c.work.workId)).toEqual(["2"]);
    expect(plan.duplicates.map((d) => d.track.id)).toEqual(["t1"]);
    expect(plan.duplicates[0]!.work.workId).toBe("1");
  });

  it("offers the agency's name when the two read differently, and adopts it with its version", () => {
    const existing = track("t1", "Quit Playing With Me", { version: "Radio edit", isrc: "QT6HW2687935" });
    const listed = work({ title: "Quit Playing With Me (Clean Version)", isrc: "QT6HW2687935" });
    // One choice, shown where the member decides, instead of an issue they cannot settle.
    expect(fieldChanges(existing.metadata, listed, "recording")).toEqual([
      { field: "Title", catalog: "Quit Playing With Me (Radio edit)", agency: "Quit Playing With Me (Clean Version)" },
    ]);
    const adopted = agencyVersion(existing.metadata, listed, "Karma Came", "recording");
    expect(adopted.title).toBe("Quit Playing With Me (Clean Version)");
    // The agency's name already carries the version, so the catalog's own one isn't kept twice.
    expect(adopted.version).toBe("");
  });

  it("never writes a retired code back over the current one", () => {
    const existing = track("t1", "Do you Mind That?", { isrc: "GXESV2623521", retiredIscrs: ["QZNMY2291725"] });
    const listed = work({ title: "Do you Mind That", isrc: "QZNMY2291725" });
    // Nothing to choose: the catalog is right and the agency is the one that needs updating.
    expect(fieldChanges(existing.metadata, listed)).toEqual([]);
    expect(agencyVersion(existing.metadata, listed, "Karma Came").isrc).toBe("GXESV2623521");
  });

  it("offers no name change when only a feature credit or a capital letter differs", () => {
    const existing = track("t1", "Big Booty Bouncing feat. OG PI");
    expect(fieldChanges(existing.metadata, work({ title: "Big Booty Bouncing (Feat. Og Pi)" }))).toEqual([]);
  });

  it("keeps only codes the catalog can validate, so the next save isn't blocked", () => {
    const m = agencyMetadata(work({ isrc: "NOT-A-CODE", iswc: "bogus" }), "Karma Came");
    expect(m.isrc).toBe("");
    expect(m.iswc).toBe("");
  });

  it("puts the agency's writers and codes on a duplicate without losing the catalog's release details", () => {
    const existing = track("t1", "Bloodline", { album: "BAM", releaseType: "Album", trackNumber: "1", audioPath: "u/t1/master.mp3", artPath: "u/t1/art.jpg" });
    const m = agencyVersion(existing.metadata, work({ isrc: "USCTA1600001", writers: [{ name: "Qui-Ona Peterson", share: 100 }] }), "Karma Came");
    expect(m.album).toBe("BAM");
    expect(m.releaseType).toBe("Album");
    expect(m.trackNumber).toBe("1");
    // The master and the artwork are the member's own files: adopting the writers and codes never detaches them.
    expect(m.audioPath).toBe("u/t1/master.mp3");
    expect(m.artPath).toBe("u/t1/art.jpg");
    expect(m.isrc).toBe("USCTA1600001");
    expect(m.writers[0]!.legalName).toBe("Qui-Ona Peterson");
  });
});

import { describe as rolesDescribe, expect as rolesExpect, it as rolesIt } from "vitest";
import { agencyVersion as versionKeepingRoles } from "@/lib/agency-fill";
import { emptyContributor as blankWriter, emptyMetadata as blankMetadata } from "@/lib/metadata";

rolesDescribe("adopting the agency's version", () => {
  rolesIt("keeps the role the catalog already knows, because the list never says one", () => {
    const existing = {
      ...blankMetadata(), title: "Big Booty Bouncing",
      writers: [{ ...blankWriter(), name: "Calvin Stephens", legalName: "Calvin Stephens", role: "Composer", percentage: "100" }],
    };
    const work = { title: "Big Booty Bouncing", iswc: "", isrc: "", workId: "", writers: [{ name: "STEPHENS CALVIN ANDRE JR (MR)", share: 100 }] };
    rolesExpect(versionKeepingRoles(existing, work, "Qui-Ona").writers[0]?.role).toBe("Composer");
  });
});

import { describe as peopleDescribe, expect as peopleExpect, it as peopleIt } from "vitest";
import { agencyMetadata as metadataFromList, listPeople as peopleOnList, withPeople as applyPeople } from "@/lib/agency-fill";

const listWorks = [
  { title: "Big Booty Bouncing", iswc: "", isrc: "", workId: "1", writers: [{ name: "Qui-Ona Peterson", share: 50 }, { name: "Calvin Stephens", share: 50 }] },
  { title: "Bloodline", iswc: "", isrc: "", workId: "2", writers: [{ name: "Qui-Ona Peterson", share: 50 }, { name: "STEPHENS CALVIN ANDRE JR (MR)", share: 50, ipi: "00123456789" }] },
];

peopleDescribe("the people a list names", () => {
  peopleIt("lists each writer once, however the agency spells them, and counts their songs", () => {
    const people = peopleOnList(listWorks);
    peopleExpect(people).toHaveLength(2);
    const calvin = people.find((p) => p.names.some((n) => /stephens/i.test(n)))!;
    peopleExpect(calvin.names).toHaveLength(2);
    peopleExpect(calvin.works).toBe(2);
    peopleExpect(calvin.ipi).toBe("00123456789");
  });
  peopleIt("writes the chosen role and spelling into every song that person is on", () => {
    const people = peopleOnList(listWorks);
    const calvin = people.find((p) => p.names.some((n) => /stephens/i.test(n)))!;
    const entry = metadataFromList(listWorks[1]!, "Qui-Ona");
    const filled = applyPeople(entry, people, { [calvin.key]: { role: "Composer", name: "Calvin Stephens" } });
    const written = filled.writers.find((w) => /stephens|calvin/i.test(w.name))!;
    peopleExpect(written.role).toBe("Composer");
    peopleExpect(written.name).toBe("Calvin Stephens");
    peopleExpect(written.legalName).toBe("Calvin Stephens");
    // The person nobody answered for is left exactly as the list gave them.
    const unanswered = filled.writers.find((w) => /qui-ona/i.test(w.name))!;
    peopleExpect(unanswered.role).toBe("");
  });
  peopleIt("keeps the list's own role text out of the three real roles", () => {
    const people = peopleOnList(listWorks);
    const entry = metadataFromList(listWorks[0]!, "Qui-Ona");
    const untouched = applyPeople(entry, people, { nonsense: { role: "Lyricist" } });
    peopleExpect(untouched.writers.every((w) => w.role === "")).toBe(true);
  });
});

describe("the Title row in the fill dialog", () => {
  // A composition list names the work, and the title was the one field the dialog never compared (founder, 2026-11-15):
  // BMI filing "24/7 Love" as "TWENTY FOUR SEVEN" has to be visible before the member picks a version to keep.
  const work = { title: "TWENTY FOUR SEVEN", iswc: "T9187370996", isrc: "", workId: "1", writers: [{ name: "PETERSON QUI ONA LASHAY", share: 100, ipi: "" }] };

  it("compares a composition's title with the agency's own", () => {
    const rows = fieldChanges({ ...emptyMetadata(), title: "24/7 Love", iswc: "T9187370996" }, work, "composition");
    expect(rows).toContainEqual({ field: "Title", catalog: "24/7 Love", agency: "TWENTY FOUR SEVEN" });
  });

  it("leaves the title alone when it is already saved as an alternate title", () => {
    const rows = fieldChanges({ ...emptyMetadata(), title: "24/7 Love", iswc: "T9187370996", alternateTitles: ["TWENTY FOUR SEVEN"] }, work, "composition");
    expect(rows.some((r) => r.field === "Title")).toBe(false);
  });
});
