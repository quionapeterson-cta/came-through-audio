import { describe, it, expect } from "vitest";
import { emptyMetadata } from "@/lib/metadata";
import { trackReport } from "@/lib/health";
import { songChecklist } from "@/lib/health-checklist";
import { inspectorChecks, emptyStatus } from "@/lib/health-songs";
import { countryByCode } from "@/lib/repertoires";

const us = countryByCode("US")!;
const track = (extra = {}) => ({ id: "t1", title: "Song", artist: "Q", updatedAt: "", metadata: { ...emptyMetadata(), title: "Song", artist: "Q", isrc: "USCTA2600001",
  writers: [{ name: "", legalName: "Ann Lee", role: "Author/Composer", pro: "BMI", ipi: "00123456789", percentage: "100" }],
  publishers: [{ name: "Lee Songs", pro: "BMI", ipi: "00987654321", percentage: "100" }], ...extra } });

describe("song health checklist", () => {
  it("starts with details done and registration to do", () => {
    const c = songChecklist(trackReport(track(), us, []), us);
    expect(c.steps.find((s) => s.id === "writers")?.done).toBe(true);
    expect(c.steps.find((s) => s.id === "register:performance")?.society?.id).toBe("bmi");
    expect(c.pct).toBeLessThan(100);
    expect(c.group).toBe("attention");
  });
  it("uses the shared readiness check for writers", () => {
    const c = songChecklist(trackReport(track({ writers: [{ name: "", legalName: "", role: "Composer", pro: "", ipi: "", percentage: "" }] }), us, []), us);
    expect(c.steps.find((s) => s.id === "writers")?.done).toBe(false);
  });
  it("ticked registrations and found marks count, and saved-for-later moves the song", () => {
    const status = { ...emptyStatus("t1"), list: "later" as const, steps: { "registered:bmi": "x" } };
    const c = songChecklist(trackReport(track(), us, []), us, status);
    expect(c.steps.find((s) => s.id === "register:performance")?.done).toBe(true);
    expect(c.group).toBe("later");
  });
  it("reaches 100% when every society is confirmed and the ISWC is in", () => {
    const r = trackReport(track({ iswc: "T1234567890" }), us, ["bmi", "mlc", "soundexchange"].map((society) => ({ trackId: "t1", society, status: "found" as const, source: "self" as const, checkedAt: "x" })));
    const c = songChecklist(r, us);
    expect(c.steps.filter((s) => !s.done).map((s) => s.title)).toEqual([]);
    expect(c.group).toBe("healthy");
  });
  it("reads inspector marks back as checks", () => {
    expect(inspectorChecks([{ ...emptyStatus("h:1"), steps: { "found:bmi": "x", "registered:mlc": "y" } }])).toEqual([{ trackId: "h:1", society: "bmi", status: "found", source: "self", checkedAt: "x" }]);
  });
});
