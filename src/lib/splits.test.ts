import { describe, expect, it } from "vitest";
import { emptyMetadata } from "@/lib/metadata";
import { catalogWithSplits, collaboratorsFromTrack } from "@/lib/splits";
import type { CatalogTrack } from "@/lib/catalog";

const track = (): CatalogTrack => ({
  id: "t1", title: "Song", artist: "Me", updatedAt: "",
  metadata: {
    ...emptyMetadata(),
    writers: [{ name: "", legalName: "Ann Lee", role: "Author", pro: "BMI", ipi: "1", percentage: "50" }],
    composers: [{ name: "", legalName: "Bo Kim", pro: "", ipi: "", percentage: "50" }],
    producers: [{ name: "", pro: "", ipi: "", percentage: "" }],
  },
});

describe("catalogWithSplits", () => {
  it("copies edited percentages onto the matching catalog rows only", () => {
    const rows = collaboratorsFromTrack(track()).map((c) => ({ ...c, percentage: c.name === "Ann Lee" ? 60 : 40 }));
    const m = catalogWithSplits(track(), [...rows, { ...rows[0]!, name: "New Person", percentage: 0 }])!;
    expect(m.writers[0]).toMatchObject({ legalName: "Ann Lee", role: "Author", pro: "BMI", percentage: "60" });
    expect(m.composers[0]!.percentage).toBe("40");
    expect(m.writers).toHaveLength(1);
  });
  it("returns null when the splits already match", () => expect(catalogWithSplits(track(), collaboratorsFromTrack(track()))).toBeNull());
});
