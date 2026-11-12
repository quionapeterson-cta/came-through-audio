import { describe, it, expect } from "vitest";
import { emptyMetadata } from "@/lib/metadata";
import { MLC_MAX_ROWS, MLC_PLACEHOLDER_IPI, mlcFiles, mlcPlaceholderSongs, mlcRows, neighbouringRows, proCheatSheet, soundExchangeRows } from "@/lib/agency-export";

const track = (extra = {}) => ({ id: "1", title: "Song", artist: "Q", updatedAt: "", metadata: { ...emptyMetadata(), title: "Song", artist: "Q", releaseDate: "2026-03-14", isrc: "US-CTA-26-00001", upc: "012345678905",
  writers: [{ name: "", legalName: "Ann Lee", role: "Author/Composer", pro: "BMI", ipi: "00123456789", percentage: "100" }],
  publishers: [{ name: "Lee Songs", pro: "BMI", ipi: "00987654321", percentage: "100" }], ...extra } });

describe("agency exports", () => {
  it("MLC keeps IPI leading zeros", () => {
    const row = mlcRows([track()])[0]!;
    expect(row[8]).toBe("00123456789");
    expect(row[12]).toBe("00987654321");
  });
  it("MLC puts the publisher's HFA P# in the MLC Publisher Number column, apart from its IPI", () => {
    const pub = { name: "Lee Songs", pro: "BMI", ipi: "00987654321", percentage: "100", hfa: "p12345" };
    const row = mlcRows([track({ publishers: [pub] })])[0]!;
    expect(row[10]).toBe("P12345");
    expect(row[12]).toBe("00987654321");
    expect(mlcRows([track()])[0]![10]).toBe("");
  });
  it("MLC fills the placeholder IPI for an HFA-only publisher and lists a writer with no publisher as their own publisher", () => {
    const hfaOnly = track({ publishers: [{ name: "Lee Songs", pro: "", ipi: "", percentage: "100", hfa: "P12345" }] });
    expect(mlcRows([hfaOnly])[0]!.slice(11, 13)).toEqual(["LEE SONGS", MLC_PLACEHOLDER_IPI]);
    const noPub = track({ publishers: [] });
    expect(mlcRows([noPub])[0]!.slice(11, 13)).toEqual(["ANN LEE", MLC_PLACEHOLDER_IPI]);
    expect(mlcPlaceholderSongs([track(), hfaOnly, noPub])).toEqual(["Song", "Song"]);
  });
  it("splits big MLC exports into files of at most 300 rows without splitting a song", () => {
    const two = (i: number) => ({ ...track({ writers: [
      { name: "", legalName: "Ann Lee", role: "Author", pro: "BMI", ipi: "00123456789", percentage: "50" },
      { name: "", legalName: "Kim Roe", role: "Composer", pro: "BMI", ipi: "00123456780", percentage: "50" }] }), id: String(i) });
    const files = mlcFiles(Array.from({ length: 151 }, (_, i) => two(i)));
    expect(files.map((f) => f.length)).toEqual([150, 1]);
    expect(files.every((f) => mlcRows(f).length <= MLC_MAX_ROWS)).toBe(true);
  });
  it("SoundExchange claims 100% as 1 with real dates and blank inception dates", () => {
    const row = soundExchangeRows([track({ featured: ["B"] })])[0]!;
    expect(row[0]).toBe("Q feat. B");
    expect(row[4]).toBe(1);
    expect(row[5]).toBe("");
    expect(row[15]).toEqual(new Date(Date.UTC(2026, 2, 14)));
    expect(row[28]).toBe("Q"); // no label: self-released uses the artist
  });
  it("SoundExchange claims the song's master ownership", () => {
    const row = soundExchangeRows([track({ masterShare: "50", masterBasis: "Collections Designee", rightsStart: "2026-01-02" })])[0]!;
    expect(row[3]).toBe("Collections Designee");
    expect(row[4]).toBe(0.5);
    expect(row[5]).toEqual(new Date(Date.UTC(2026, 0, 2)));
    expect(row[6]).toBe("");
  });
  it("PRO cheat sheet gives IPI and duration exactly as typed, ready to paste", () => {
    const cells = proCheatSheet([track({ duration: "3:20" })]).flat();
    expect(cells).toContain("00123456789");
    expect(cells).toContain("03:20");
    expect(cells.some((c) => c.startsWith("="))).toBe(false);
  });
  it("PRO cheat sheet says BMI pays the publisher share when there's no publisher", () => {
    expect(proCheatSheet([track({ publishers: [] })]).flat()).toContain("None: BMI pays the publisher share to its writers");
    expect(proCheatSheet([track()]).flat().join()).not.toContain("None: BMI");
  });
  it("Neighbouring Rights Pack lists every performer, featured first, and leaves out songs without an ISRC", () => {
    const t = track({ featured: ["OG PI"], phonographic: "℗ 2026 Came Through Audio", recordedIn: "United States", recordedYear: "",
      credits: [{ role: "Session musician", name: "Jane Doe", instrument: "Guitar" }, { role: "Mixing engineer", name: "Sam", instrument: "" }] });
    const { rows, skipped } = neighbouringRows([t, { ...t, id: "2", metadata: { ...t.metadata, isrc: "" } }]);
    const lines = rows.map((r) => r.join(","));
    const csv = lines.join("\n");
    expect(lines).toHaveLength(4);
    expect(lines[1]).toContain("USCTA2600001,Song,Q feat. OG PI,Q,Featured");
    expect(lines[3]).toContain("Jane Doe,Non-featured,Session musician,Guitar,United States,2026,Came Through Audio");
    expect(csv).not.toContain("Sam");
    expect(skipped).toHaveLength(1);
  });
  it("reads the master owner from the P-line without eating a leading P", () => {
    expect(soundExchangeRows([track({ phonographic: "Prince Records" })])[0]![17]).toBe("Prince Records");
    expect(soundExchangeRows([track({ phonographic: "P 2026 Came Through Audio" })])[0]![17]).toBe("2026 Came Through Audio");
  });
});

describe("nothing the catalog knows is left behind", () => {
  it("SoundExchange carries the recording version and where it was recorded", () => {
    const row = soundExchangeRows([track({ version: "sped up", recordedIn: "United States", duration: "5:01" })])[0]!;
    // 8 Recording Version, 9 Duration, 10 Genre, 12 Country of Recording/Fixation.
    expect(row[8]).toBe("sped up");
    expect(row[9]).toBe("00:05:01");
    expect(row[12]).toBe("United States");
    expect(row).toHaveLength(29);
  });

  it("SoundExchange keeps a year-only release date instead of dropping it", () => {
    const row = soundExchangeRows([track({ releaseDate: "2019" })])[0]!;
    expect(row[15]).toEqual(new Date(Date.UTC(2019, 0, 1)));
    expect(row[26]).toEqual(new Date(Date.UTC(2019, 0, 1)));
    const monthOnly = soundExchangeRows([track({ releaseDate: "2019-05" })])[0]!;
    expect(monthOnly[26]).toEqual(new Date(Date.UTC(2019, 4, 1)));
  });

  it("the PRO cheat sheet carries alternate titles and the BMI work answers", () => {
    const rows = proCheatSheet([track({ alternateTitles: ["Mind That", " That "], samples: "Yes", sampleTitle: "Ooh La", sampleWriters: "Ann Lee", writtenFor: "Film/TV/Stage/Ad", productionTitle: "Blue Hour", instrumental: false })]);
    expect(rows[0]).toHaveLength(15);
    const writer = rows.find((r) => r[5] === "Writer")!;
    expect(writer[11]).toBe("Mind That; That");
    expect(writer[12]).toBe("Yes: Ooh La (Ann Lee)");
    expect(writer[13]).toBe("Yes: Film/TV/Stage/Ad — Blue Hour");
    expect(writer[14]).toBe("No");
  });
});

describe("the country and territory answers", () => {
  it("SoundExchange receives all five, in their own columns", () => {
    const row = soundExchangeRows([track({ masteredIn: "United States", ownerNationality: "United States", firstReleaseCountry: "Worldwide", releaseCountry: "Worldwide", collectionTerritories: "Canada; Mexico" })])[0]!;
    expect(row[7]).toBe("Canada; Mexico"); // Non-US Territories of Collection Rights
    expect(row[13]).toBe("United States"); // Country of Mastering
    expect(row[14]).toBe("United States"); // Copyright Owner Country of Nationality
    expect(row[16]).toBe("Worldwide"); // Country/Countries of First Release
    expect(row[27]).toBe("Worldwide"); // Country of Release
    expect(row[12]).toBe(""); // country of recording is its own answer, untouched
  });
});

describe("the recording and release answers", () => {
  it("SoundExchange receives the recording date, the release version and the catalog number", () => {
    const row = soundExchangeRows([track({ recordingDate: "2024-03-09", releaseVersion: "Deluxe", catalogNumber: "CTA-004" })])[0]!;
    expect(row[11]).toEqual(new Date(Date.UTC(2024, 2, 9))); // Recording Date
    expect(row[23]).toBe("Deluxe"); // Release Version
    expect(row[25]).toBe("CTA-004"); // Catalog #
  });
  it("a year alone never becomes a recording date", () => {
    const row = soundExchangeRows([track({ recordedYear: "2016" })])[0]!;
    expect(row[11]).toBe(""); // Recording Date stays blank rather than guessed from the year
  });
});
