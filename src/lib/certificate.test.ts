import { afterEach, describe, expect, it, vi } from "vitest";
import { STORED_COPY, manifestLine, storedCopyLine, verifyUrl } from "./certificate";
import { proofManifest } from "./ots";
import { SITE_URL } from "./email-layout";

describe("AI Protection certificates (3.8)", () => {
  it("stamps the stored copy's fingerprint next to the original's", () => {
    expect(storedCopyLine("abc", { path: "u/1_daw.mp4", hash: "abc" })).toBe("same file as the original");
    expect(storedCopyLine("abc", { path: "u/1_daw_720p.mp4", hash: "def" })).toBe("def (720p copy stored by Came Through Audio)");
    expect(storedCopyLine("abc", { path: "device-only", hash: "" })).toBe("no copy stored (keep your original file)");
    const m = proofManifest({ "DAW session SHA-256": "abc", [STORED_COPY.daw]: "def (720p copy stored by Came Through Audio)" });
    expect(manifestLine(m, STORED_COPY.daw)).toBe("def (720p copy stored by Came Through Audio)");
    expect(manifestLine(m, "Missing")).toBeUndefined();
  });

  afterEach(() => vi.unstubAllGlobals());
  it("QR and verify links never point at the Lovable editor preview", () => {
    vi.stubGlobal("window", { location: { origin: "https://id-preview--abc.lovable.app" } });
    expect(verifyUrl("c1")).toBe(`${SITE_URL}/verify/c1`);
    vi.stubGlobal("window", { location: { origin: "https://camethroughaudio.com" } });
    expect(verifyUrl("c1")).toBe("https://camethroughaudio.com/verify/c1");
  });
});
