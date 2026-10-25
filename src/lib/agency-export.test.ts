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
  it("PRO cheat sheet keeps IPI as text", () => expect(proCheatSheet([track()])).toContain('"=""00123456789"""'));
  it("PRO cheat sheet says BMI pays the publisher share when there's no publisher", () => {
    expect(proCheatSheet([track({ publishers: [] })])).toContain("None: BMI pays the publisher share to its writers");
    expect(proCheatSheet([track()])).not.toContain("None: BMI");
  });
  it("Neighbouring Rights Pack lists every performer, featured first, and leaves out songs without an ISRC", () => {
    const t = track({ featured: ["OG PI"], phonographic: "℗ 2026 Came Through Audio", recordedIn: "United States", recordedYear: "",
      credits: [{ role: "Session musician", name: "Jane Doe", instrument: "Guitar" }, { role: "Mixing engineer", name: "Sam", instrument: "" }] });
    const { csv, skipped } = neighbouringRows([t, { ...t, id: "2", metadata: { ...t.metadata, isrc: "" } }]);
    const lines = csv.split("\r\n");
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
