import { describe, expect, it } from "vitest";
import { emptyContributor, emptyMetadata, type Metadata } from "./metadata";
import type { ArtistProfile } from "./artist-profile";
import { propagated, propagationPlan } from "./profile-propagation";

const song = (title: string, over: Partial<Metadata>): { id: string; metadata: Metadata } =>
  ({ id: title, metadata: { ...emptyMetadata(), title, ...over } });

const profile: ArtistProfile = {
  label: "Karma Music",
  primaryGenre: "R&B/Soul",
  writers: [{ ...emptyContributor(), legalName: "Quiona Peterson", pro: "BMI", ipi: "00123456789", percentage: "100" }],
  publishers: [{ ...emptyContributor(), name: "Karma Came Publishing", pro: "BMI", ipi: "00987654321", percentage: "100" }],
};

describe("carrying a profile correction through the catalog", () => {
  it("counts a song that gains a blank, and one that holds a different number", () => {
    const plan = propagationPlan(profile, [
      song("New One", { writers: [{ ...emptyContributor(), legalName: "Quiona Peterson" }] }),
      song("Old One", { writers: [{ ...emptyContributor(), legalName: "Quiona Peterson", pro: "BMI", ipi: "00999999999" }] }),
      song("Untouched", { label: "Other Label", writers: [{ ...emptyContributor(), legalName: "Someone Else", ipi: "00111111111" }] }),
    ]);
    expect(plan.fill.map((s) => s.title)).toEqual(["New One"]);
    expect(plan.change.map((s) => s.title)).toEqual(["Old One"]);
    expect(plan.change[0]!.what).toContain("IPI 00999999999 → 00123456789");
    // The song that credits somebody else is never touched.
    expect(plan.total).toBe(2);
  });

  it("proposes nothing when the catalog already agrees", () => {
    const plan = propagationPlan(profile, [
      song("Done", { label: "Karma Music", primaryGenre: "R&B/Soul", writers: profile.writers!, publishers: profile.publishers! }),
    ]);
    expect(plan).toEqual({ fill: [], change: [], total: 0 });
  });

  it("fills blanks and corrects the codes, and nothing else", () => {
    const out = propagated(song("Old One", {
      label: "",
      writers: [{ ...emptyContributor(), legalName: "Quiona Peterson", pro: "ASCAP", ipi: "00999999999", percentage: "" }],
    }).metadata, profile);
    // Only PRO and IPI move: a song's own label answer is never rewritten by a profile correction.
    expect(out.label).toBe("");
    expect(out.writers[0]).toMatchObject({ legalName: "Quiona Peterson", pro: "BMI", ipi: "00123456789" });
    // A share the song already carries is the song's own record, not the profile's.
    expect(out.writers[0]!.percentage).toBe("");
  });

  it("never adds a person the song does not credit", () => {
    const out = propagated({ ...emptyMetadata(), title: "Solo", writers: [{ ...emptyContributor(), legalName: "Someone Else" }] }, profile);
    expect(out.writers).toHaveLength(1);
    expect(out.writers[0]!.legalName).toBe("Someone Else");
  });
});
