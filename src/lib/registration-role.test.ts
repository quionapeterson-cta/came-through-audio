import { describe, expect, it } from "vitest";
import { emptyContributor, emptyMetadata, type Metadata } from "@/lib/metadata";
import { registrationCheck } from "@/lib/readiness";

/** A song that is otherwise ready for BMI, so only the role answer is left to test. */
const song = (role: string): Metadata => ({
  ...emptyMetadata(),
  title: "Words I Wrote",
  artist: "Ann Lee",
  isrc: "USCTA2600001",
  duration: "03:20",
  primaryGenre: "R&B/Soul",
  writtenFor: "No",
  label: "Independent",
  releaseDate: "2026-01-01",
  samples: "No",
  selfPublished: true,
  writers: [{ ...emptyContributor(), name: "", legalName: "Ann Lee", role, pro: "ASCAP", ipi: "00123456789", percentage: "100" }],
  publishers: [],
});

describe("registration and a writer's role", () => {
  it("waits for the member to say what the writer wrote", () => {
    const missing = registrationCheck(song(""), "bmi").missing;
    expect(missing.some((m) => m.code === "role")).toBe(true);
  });
  it("does not ask again once the role is answered", () => {
    for (const role of ["Author", "Composer", "Author/Composer"]) {
      expect(registrationCheck(song(role), "bmi").missing.some((m) => m.code === "role")).toBe(false);
    }
  });
  it("never blocks saving or embedding: only the registration check carries the role item", () => {
    const missing = registrationCheck(song(""), "ascap").missing;
    expect(missing.every((m) => m.code !== "author" && m.code !== "composer")).toBe(true);
  });
});
