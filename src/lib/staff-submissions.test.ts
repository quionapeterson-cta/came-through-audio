import { describe, expect, it } from "vitest";
import { fileProblem, KIND_LIMIT, KIND_LABEL, safeFileName, SUBMISSION_KINDS, SUBMISSION_STATUS } from "./staff-submissions";

const file = (size: number, type: string, name = "file") => ({ name, size, type });

describe("fileProblem", () => {
  it("accepts a normal file of each kind", () => {
    expect(fileProblem("paperwork", file(2_000_000, "application/pdf", "contract.pdf"))).toBeNull();
    expect(fileProblem("video", file(40_000_000, "video/mp4", "cut.mp4"))).toBeNull();
    expect(fileProblem("music", file(9_000_000, "audio/wav", "song.wav"))).toBeNull();
    expect(fileProblem("photo", file(3_000_000, "image/jpeg", "shot.jpg"))).toBeNull();
  });

  it("refuses a file over the kind's ceiling and names the ceiling", () => {
    const tooBig = fileProblem("photo", file(KIND_LIMIT.photo + 1, "image/png", "huge.png"));
    expect(tooBig).toContain("Photo");
    expect(tooBig).toMatch(/MB/);
    expect(fileProblem("paperwork", file(49 * 1024 * 1024, "application/pdf", "big.pdf"))).toBeNull();
  });

  it("refuses a type the kind doesn't take", () => {
    expect(fileProblem("photo", file(1_000_000, "audio/mpeg", "song.mp3"))).toMatch(/photo/i);
    expect(fileProblem("music", file(1_000_000, "application/pdf", "sheet.pdf"))).toMatch(/music/i);
  });

  it("refuses an empty file", () => {
    expect(fileProblem("idea", file(0, "application/pdf", "empty.pdf"))).toMatch(/empty/i);
  });

  it("has a limit and a label for every kind", () => {
    for (const kind of SUBMISSION_KINDS) {
      expect(KIND_LIMIT[kind]).toBeGreaterThan(0);
      expect(KIND_LABEL[kind].length).toBeGreaterThan(0);
    }
    expect(new Set(SUBMISSION_STATUS).size).toBe(SUBMISSION_STATUS.length);
  });
});

describe("safeFileName", () => {
  it("keeps a storage key safe", () => {
    expect(safeFileName("My Contract (signed).pdf")).toBe("My-Contract-signed-.pdf");
    expect(safeFileName("../../etc/passwd")).toBe("etc-passwd");
    expect(safeFileName("")).toBe("file");
  });
});
