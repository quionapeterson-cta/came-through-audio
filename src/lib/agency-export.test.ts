import { describe, it, expect } from "vitest";
import { emptyMetadata } from "@/lib/metadata";
import { mlcRows, proCheatSheet, soundExchangeRows } from "@/lib/agency-export";

const track = (extra = {}) => ({ id: "1", title: "Song", artist: "Q", updatedAt: "", metadata: { ...emptyMetadata(), title: "Song", artist: "Q", releaseDate: "2026-03-14", isrc: "US-CTA-26-00001", upc: "012345678905",
  writers: [{ name: "", legalName: "Ann Lee", role: "Author/Composer", pro: "BMI", ipi: "00123456789", percentage: "100" }],
  publishers: [{ name: "Lee Songs", pro: "BMI", ipi: "00987654321", percentage: "100" }], ...extra } });

describe("agency exports", () => {
  it("MLC keeps IPI leading zeros", () => {
    const row = mlcRows([track()])[0]!;
    expect(row[8]).toBe("00123456789");
    expect(row[12]).toBe("00987654321");
  });
  it("SoundExchange claims 100% as 1 with real dates and blank inception dates", () => {
    const row = soundExchangeRows([track({ featured: ["B"] })])[0]!;
    expect(row[0]).toBe("Q feat. B");
    expect(row[4]).toBe(1);
    expect(row[5]).toBe("");
    expect(row[15]).toEqual(new Date(Date.UTC(2026, 2, 14)));
    expect(row[28]).toBe("Q"); // no label: self-released uses the artist
  });
  it("PRO cheat sheet keeps IPI as text", () => expect(proCheatSheet([track()])).toContain('"=""00123456789"""'));
});
