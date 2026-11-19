import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import * as limits from "./invite-limits";

/**
 * The sign-off document quotes every invite limit, and it drifted from the code once: the contract-signing cap lived in
 * `contracts-email.functions.ts` while the document described it as if it were one of the shared ones. A reviewer reads
 * the document, so a limit that exists in code has to be named in it — a new constant, or a renamed one, fails here
 * until the document catches up (founder, 2026-11-19).
 */
const doc = readFileSync("SECURITY-FINDINGS.md", "utf8");
const named = Object.keys(limits).filter((name) => /(_LIMIT|_GAP_MS|_MAX)$/.test(name));

describe("SECURITY-FINDINGS.md", () => {
  it("names every invite limit constant", () => {
    // The list must actually cover the caps, so an empty match can't pass this file by accident.
    expect(named).toContain("CONTRACT_INVITE_DAILY_LIMIT");
    expect(named).toContain("DAILY_INVITE_LIMIT");
    expect(named.filter((name) => !doc.includes(name))).toEqual([]);
  });
});
