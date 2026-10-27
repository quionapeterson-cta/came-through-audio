import { emptyContributor, type Contributor } from "./metadata";
import { fillFromSaved, findSaved, libraryRowsOf, savedPeople } from "./saved-people";

const w = (legalName: string, over: Partial<Contributor> = {}): Contributor => ({ ...emptyContributor(), legalName, ...over });

describe("savedPeople", () => {
  const profile = { writers: [w("Qui-Ona Peterson", { role: "Author/Composer", pro: "BMI", ipi: "123456789", percentage: "75" })] };
  const library = [
    { name: "Jordan Lee", kind: "Composer", email: "", pro: "ASCAP", ipi: "987654321", publisher: "", label: "", role: "", share: "25" },
    { name: "Big Pub", kind: "Publisher", email: "", pro: "BMI", ipi: "555555555", publisher: "", label: "", role: "", share: "" },
  ];
  const songs = [{ writers: [w("jordan lee", { percentage: "40", pro: "" }), w("Sam Ray", { role: "Author", percentage: "60" })], producers: [{ ...emptyContributor(), name: "DJ Beat" }] }];
  const people = savedPeople(profile, library, songs);

  it("gathers writers from the profile, the library and past songs, once each", () => {
    expect(people.writers.map((p) => p.legalName)).toEqual(["Jordan Lee", "Qui-Ona Peterson", "Sam Ray"]);
    expect(people.publishers.map((p) => p.name)).toEqual(["Big Pub"]);
    expect(people.producers.map((p) => p.name)).toEqual(["DJ Beat"]);
  });

  it("takes a usual split from the library or profile, never from one past song", () => {
    expect(findSaved(people.writers, "JORDAN  LEE")?.percentage).toBe("25");
    expect(findSaved(people.writers, "Jordan Lee")?.role).toBe("Composer");
    expect(findSaved(people.writers, "Sam Ray")?.percentage).toBe("");
  });

  it("matches only a whole name", () => {
    expect(findSaved(people.writers, "Jordan")).toBeUndefined();
    expect(findSaved(people.writers, "")).toBeUndefined();
  });
});

describe("fillFromSaved", () => {
  it("fills blanks only and never replaces what the row has", () => {
    const saved = w("Jordan Lee", { pro: "ASCAP", ipi: "987654321", percentage: "25", role: "Composer" });
    expect(fillFromSaved(w("Jordan Lee"), saved, true)).toMatchObject({ pro: "ASCAP", ipi: "987654321", percentage: "25", role: "Composer" });
    expect(fillFromSaved(w("Jordan Lee", { percentage: "30", pro: "BMI" }), saved, true)).toMatchObject({ pro: "BMI", percentage: "30" });
  });
});

describe("libraryRowsOf", () => {
  it("turns a song's people into library rows, with roles for writers", () => {
    const rows = libraryRowsOf({ writers: [w("A", { role: "Author" }), w("")], composers: [{ ...emptyContributor(), name: "Old Composer" }], publishers: [{ ...emptyContributor(), name: "Pub" }] });
    expect(rows.map((r) => [r.name, r.kind, r.role])).toEqual([["A", "Writer", "Author"], ["Old Composer", "Writer", "Composer"], ["Pub", "Publisher", undefined]]);
  });
});

describe("percentInput and formatDuration", async () => {
  const { percentInput, formatDuration, metadataSchema, emptyMetadata } = await import("./metadata");
  it("never lets a percentage past 100", () => {
    expect(percentInput("150")).toBe("100");
    expect(percentInput("75.5%")).toBe("75.5");
    expect(percentInput("1.2.3")).toBe("1.23");
  });
  it("writes durations as mm:ss with two-digit minutes", () => {
    expect(formatDuration(225)).toBe("03:45");
    expect(formatDuration(725)).toBe("12:05");
    expect(metadataSchema.parse({ ...emptyMetadata(), title: "T", artist: "A", duration: "3:45" }).duration).toBe("03:45");
  });
});

describe("credit menu", async () => {
  const { creditChoice, fromCreditChoice, OTHER_INSTRUMENT, BACKUP_VOCALS } = await import("./metadata");
  it("shows saved credits as one menu choice", () => {
    expect(creditChoice({ role: "Session musician", instrument: "guitar" })).toBe("Guitar");
    expect(creditChoice({ role: "Session musician", instrument: "Sitar" })).toBe(OTHER_INSTRUMENT);
    expect(creditChoice({ role: "Backup vocalist", instrument: "" })).toBe(BACKUP_VOCALS);
    expect(creditChoice({ role: "Mixing engineer" })).toBe("Mixing engineer");
  });
  it("saves a pick the same way as before", () => {
    expect(fromCreditChoice("Saxophone", { role: "Mixing engineer" })).toEqual({ role: "Session musician", instrument: "Saxophone" });
    expect(fromCreditChoice(OTHER_INSTRUMENT, { role: "Session musician", instrument: "Sitar" })).toEqual({ role: "Session musician", instrument: "Sitar" });
    expect(fromCreditChoice(OTHER_INSTRUMENT, { role: "Session musician", instrument: "Guitar" })).toEqual({ role: "Session musician", instrument: "" });
    expect(fromCreditChoice("Arranger", { role: "Session musician", instrument: "Guitar" })).toEqual({ role: "Arranger", instrument: "" });
  });
});

describe("genres", async () => {
  const { GENRES, parentGenre } = await import("./metadata");
  const { genreTags } = await import("./promo-copy");
  it("keeps every original genre and adds subgenres", () => {
    for (const g of ["Hip-Hop/Rap", "Spiritual Hip-Hop", "R&B/Soul", "Gospel", "Afrobeats", "Other"]) expect(GENRES).toContain(g);
    expect(GENRES.length).toBeGreaterThan(60);
  });
  it("counts a subgenre as its main genre", () => {
    expect(parentGenre("Trap")).toBe("Hip-Hop/Rap");
    expect(parentGenre("Amapiano")).toBe("Electronic");
    expect(parentGenre("Spiritual Hip-Hop")).toBe("Spiritual Hip-Hop");
    expect(genreTags("Drill")).toEqual(genreTags("Hip-Hop/Rap"));
  });
});
