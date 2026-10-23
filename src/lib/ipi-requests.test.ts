import { describe, it, expect } from "vitest";
import { emptyMetadata } from "@/lib/metadata";
import { cowritersMissing, fillWriter } from "@/lib/ipi-requests";

const w = (legalName: string, extra = {}) => ({ name: "", legalName, role: "Author/Composer", pro: "", ipi: "", percentage: "50", ...extra });
const track = (id: string, writers: ReturnType<typeof w>[], composers: ReturnType<typeof w>[] = []) => ({ id, title: id, artist: "Q", updatedAt: "", metadata: { ...emptyMetadata(), title: id, writers, composers } });

describe("co-writer IPI requests", () => {
  it("lists each co-writer missing a PRO or IPI once, with all their songs, and never you", () => {
    const tracks = [
      track("Midnight", [w("Qui-Ona Peterson"), w("Jordan Lee")]),
      track("Run It Back", [w("Qui-Ona Peterson")], [w("LEE JORDAN", { role: "Composer" })]),
      track("Gold Teeth", [w("Bo Ray", { pro: "BMI", ipi: "00123456789" })]),
    ];
    expect(cowritersMissing(tracks, "Qui-Ona Peterson")).toEqual([
      { name: "Jordan Lee", role: "Author/Composer", songs: [{ catalog_id: "Midnight", title: "Midnight" }, { catalog_id: "Run It Back", title: "Run It Back" }] },
    ]);
  });

  it("fills only blank PRO and IPI fields for the matching writer", () => {
    const m = track("x", [w("Jordan Lee", { pro: "ASCAP" }), w("Bo Ray")]).metadata;
    const out = fillWriter(m, "Jordan Lee", { legal_name: "Jordan Lee", pro: "BMI", ipi: "00123456789", no_pro: false })!;
    expect(out.writers[0]).toMatchObject({ pro: "ASCAP", ipi: "00123456789" });
    expect(out.writers[1]).toMatchObject({ pro: "", ipi: "" });
    expect(fillWriter(out, "Jordan Lee", { legal_name: "Jordan Lee", pro: "BMI", ipi: "00999999999", no_pro: false })).toBeNull();
    expect(fillWriter(m, "Jordan Lee", { legal_name: "Jordan Lee", pro: "", ipi: "", no_pro: true })).toBeNull();
  });
});
