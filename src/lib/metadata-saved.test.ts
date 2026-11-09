import { describe, expect, it } from "vitest";
import { emptyMetadata, metadataSchema, savedSchema } from "@/lib/metadata";

describe("saving a song with no artist of its own", () => {
  const writer = { ...emptyMetadata().writers[0]!, name: "", legalName: "Ann Lee", role: "Author/Composer" as const, pro: "ASCAP", ipi: "00123456789", percentage: "100" };
  const song = { ...emptyMetadata(), title: "Words I Wrote", artist: "", writers: [writer] };

  it("saves a songwriter's work, because someone else performs it", () => {
    expect(savedSchema.safeParse(song).success).toBe(true);
  });
  it("still refuses to tag a master with no artist, because the tag is the artist", () => {
    expect(metadataSchema.safeParse(song).success).toBe(false);
  });
  it("keeps the share rules on both: a share with no name is still refused", () => {
    const nameless = { ...song, writers: [{ ...writer, legalName: "" }] };
    expect(savedSchema.safeParse(nameless).success).toBe(false);
  });
});
