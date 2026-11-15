import { describe, expect, it } from "vitest";
import { fileSize, shelfFileName, shelfStorageName } from "./pdf-shelf";

describe("shelfFileName", () => {
  it("keeps a name that already ends in .pdf", () => {
    expect(shelfFileName("Lease (signed).pdf")).toBe("Lease (signed).pdf");
  });

  it("adds the extension and falls back to a name", () => {
    expect(shelfFileName("Contract")).toBe("Contract.pdf");
    expect(shelfFileName("   ")).toBe("Document.pdf");
  });

  it("never lets a name travel as a path", () => {
    expect(shelfFileName("../../etc/passwd")).toBe("etc-passwd.pdf");
  });
});

describe("shelfStorageName", () => {
  it("keeps a storage key to safe characters", () => {
    expect(shelfStorageName("SR_James Packet (signed).pdf")).toBe("SR_James_Packet_signed.pdf");
  });

  it("stays within the bucket's key limit", () => {
    expect(shelfStorageName(`${"a".repeat(300)}.pdf`).length).toBeLessThanOrEqual(120);
  });
});

describe("fileSize", () => {
  it("reads in the unit that fits", () => {
    expect(fileSize(900)).toBe("900 B");
    expect(fileSize(2048)).toBe("2 KB");
    expect(fileSize(1_500_000)).toBe("1.4 MB");
  });
});
