import { describe, expect, it } from "vitest";
import { withOwnWriter, withProfileFilled } from "@/lib/artist-profile";
import { emptyContributor, emptyMetadata } from "@/lib/metadata";

describe("withOwnWriter", () => {
  it("names a lone unnamed row so its IPI and PRO reach new embeds", () => {
    const rows = withOwnWriter([{ ...emptyContributor(), ipi: "00123456789", pro: "BMI" }], "Jordan Lee");
    expect(rows).toEqual([{ ...emptyContributor(), ipi: "00123456789", pro: "BMI", legalName: "Jordan Lee" }]);
  });
  it("adds the user as writer when none was saved", () => {
    expect(withOwnWriter(undefined, "Jordan Lee")?.[0]).toMatchObject({ legalName: "Jordan Lee", role: "Author/Composer" });
  });
  it("never replaces a saved name or touches several rows", () => {
    const named = [{ ...emptyContributor(), legalName: "Sam Rivers" }];
    expect(withOwnWriter(named, "Jordan Lee")).toBe(named);
    const two = [emptyContributor(), emptyContributor()];
    expect(withOwnWriter(two, "Jordan Lee")).toBe(two);
    expect(withOwnWriter(undefined, " ")).toBeUndefined();
  });
});

describe("withProfileFilled", () => {
  const profile = {
    label: "Came Through Audio", selfPublished: true,
    writers: [{ ...emptyContributor(), legalName: "Jordan Lee", pro: "BMI", ipi: "00123456789", percentage: "100" }],
  };
  it("fills a catalog song's blanks from the profile, matching writers by name", () => {
    const song = { ...emptyMetadata(), title: "Song", writers: [{ ...emptyContributor(), legalName: "jordan lee" }] };
    const m = withProfileFilled(song, profile);
    expect(m.writers[0]).toMatchObject({ legalName: "jordan lee", pro: "BMI", ipi: "00123456789", percentage: "100" });
    expect(m.label).toBe("Came Through Audio");
    expect(m.selfPublished).toBe(true);
  });
  it("never replaces what the song already has", () => {
    const song = { ...emptyMetadata(), label: "Other Label", publishers: [{ ...emptyContributor(), name: "Lee Songs" }],
      writers: [{ ...emptyContributor(), legalName: "Jordan Lee", ipi: "00999999999", percentage: "50" }] };
    const m = withProfileFilled(song, profile);
    expect(m.label).toBe("Other Label");
    expect(m.writers[0]).toMatchObject({ ipi: "00999999999", percentage: "50", pro: "BMI" });
    expect(m.selfPublished).toBe(false);
  });
  it("prefills the publisher's HFA P# from the profile, without replacing one the song has", () => {
    const withPub = { publishers: [{ ...emptyContributor(), name: "Lee Songs", ipi: "00987654321", hfa: "P12345" }] };
    expect(withProfileFilled({ ...emptyMetadata(), title: "Song" }, withPub).publishers[0]?.hfa).toBe("P12345");
    const named = { ...emptyMetadata(), publishers: [{ ...emptyContributor(), name: "lee songs" }] };
    expect(withProfileFilled(named, withPub).publishers[0]?.hfa).toBe("P12345");
    const own = { ...emptyMetadata(), publishers: [{ ...emptyContributor(), name: "Lee Songs", hfa: "P99999" }] };
    expect(withProfileFilled(own, withPub).publishers[0]?.hfa).toBe("P99999");
  });
});


describe("registration defaults from the profile", () => {
  it("fill a song's unanswered sample and written-for questions, never answered ones", async () => {
    const { withProfileFilled } = await import("@/lib/artist-profile");
    const { emptyMetadata } = await import("@/lib/metadata");
    const p = { samples: "No" as const, writtenFor: "No" as const, credits: [{ role: "Mixing engineer", name: "Dre Lane", instrument: "" }] };
    const filled = withProfileFilled({ ...emptyMetadata(), title: "A" }, p);
    expect([filled.samples, filled.writtenFor, filled.credits[0]?.name]).toEqual(["No", "No", "Dre Lane"]);
    const kept = withProfileFilled({ ...emptyMetadata(), title: "B", samples: "Yes", writtenFor: "TV" }, p);
    expect([kept.samples, kept.writtenFor]).toEqual(["Yes", "TV"]);
  });
  it("keep a song's own defaults when a profile answer is blank", async () => {
    const { withProfile } = await import("@/lib/artist-profile");
    expect(withProfile({ masterShare: "" }).masterShare).toBe("100");
    expect(withProfile({ masterShare: "50" }).masterShare).toBe("50");
  });
});
