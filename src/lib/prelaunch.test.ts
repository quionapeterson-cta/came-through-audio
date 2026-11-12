import { describe, expect, it } from "vitest";
import {
  LOCKED_BY_TESTER,
  UNLOCKED_BY_TESTER,
  passkeyAccepted,
  previewInLink,
  testerUnlocked,
} from "@/lib/prelaunch";

describe("pre-launch unlock", () => {
  it("accepts only the passkey, trimmed", () => {
    expect(passkeyAccepted(" CTALAB2026 ")).toBe(true);
    expect(passkeyAccepted("ctalab2026")).toBe(false);
    expect(passkeyAccepted("")).toBe(false);
  });

  it("unlocks a tester link and a signed-in member", () => {
    expect(testerUnlocked(UNLOCKED_BY_TESTER, false)).toBe(true);
    expect(testerUnlocked(null, true)).toBe(true);
    expect(testerUnlocked(null, false)).toBe(false);
  });

  it("lets the public view win over a session, so Lock does something", () => {
    expect(testerUnlocked(LOCKED_BY_TESTER, true)).toBe(false);
  });

  it("reads the tester link, and ignores anything else", () => {
    expect(previewInLink("?preview=true")).toBe(true);
    expect(previewInLink("?next=/workspace&preview=true")).toBe(true);
    expect(previewInLink("?preview=false")).toBe(false);
    expect(previewInLink("?preview=yes")).toBe(false);
    expect(previewInLink("")).toBe(false);
  });
});
