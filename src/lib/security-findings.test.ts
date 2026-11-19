import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import * as companyMail from "./company-email";
import * as inviteLimits from "./invite-limits";
import * as outreach from "./outreach-emails";

/**
 * The sign-off document quotes every cap that protects our mail, and it drifted from the code once: the
 * contract-signing cap lived in `contracts-email.functions.ts` while the document described it as if it were one of the
 * shared ones. A reviewer reads the document, so a cap that exists in code has to be named in it — a new constant, or a
 * renamed one, fails here until the document catches up (founder, 2026-11-19).
 */
const doc = readFileSync("SECURITY-FINDINGS.md", "utf8");
const CAP = /(_LIMIT|_GAP_MS|_MAX)$/;
const modules = { "invite-limits.ts": inviteLimits, "company-email.ts": companyMail, "outreach-emails.ts": outreach };
const caps = Object.values(modules).flatMap((module) =>
  Object.keys(module).filter((name) => CAP.test(name)),
);

describe("SECURITY-FINDINGS.md", () => {
  it("names every mail cap in the code", () => {
    // The list must actually cover the caps, so an empty match can't pass this file by accident.
    for (const name of [
      "DAILY_INVITE_LIMIT",
      "CONTRACT_INVITE_DAILY_LIMIT",
      "COMPANY_MAIL_DAILY_LIMIT",
      "COMPANY_MAIL_SENDER_DAILY_LIMIT",
      "OUTREACH_DAILY_LIMIT",
    ])
      expect(caps).toContain(name);
    expect(caps.filter((name) => !doc.includes(name))).toEqual([]);
  });
});
