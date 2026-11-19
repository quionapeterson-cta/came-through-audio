import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import * as companyMail from "./company-email";
import * as inviteLimits from "./invite-limits";
import * as outreach from "./outreach-emails";

/**
 * The sign-off document quotes every cap that protects our mail, and it drifted from the code once: the
 * contract-signing cap lived in `contracts-email.functions.ts` while the document described it as if it were one of the
 * shared ones. A reviewer reads the document, so a cap that exists in code has to be named in it *and* carry the right
 * figure — a new constant, a renamed one or an edited number fails here until the document catches up
 * (founder, 2026-11-19).
 */
const doc = readFileSync("SECURITY-FINDINGS.md", "utf8");
const CAP = /(_LIMIT|_GAP_MS|_MAX)$/;
const modules: Record<string, Record<string, unknown>> = {
  "invite-limits.ts": inviteLimits,
  "company-email.ts": companyMail,
  "outreach-emails.ts": outreach,
};
const caps = Object.entries(modules).flatMap(([file, module]) =>
  Object.entries(module)
    .filter(([name]) => CAP.test(name))
    .map(([name, value]) => ({ file, name, value: Number(value) })),
);

/** The figure a cap is written with: the second cell of the table row that names it. */
function valueCell(name: string): string | null {
  const row = doc.split("\n").find((line) => line.startsWith("|") && line.includes(`\`${name}\``));
  return row ? (row.split("|").map((cell) => cell.trim())[2] ?? null) : null;
}

/** A gap is written in hours in the document (`24 hours`); every other cap is written in digits. */
function shown(name: string, value: number): RegExp {
  return name.endsWith("_GAP_MS")
    ? new RegExp(`^${value / 3_600_000} hours?$`)
    : new RegExp(`(^|\\D)${value}(\\D|$)`);
}

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
      expect(caps.map((cap) => cap.name)).toContain(name);
  });

  it.each(caps)("states $name at the value in $file", ({ name, value }) => {
    const cell = valueCell(name);
    expect(cell, `${name} is not named in a table row`).not.toBeNull();
    expect(cell, `${name} should read ${shown(name, value)}`).toMatch(shown(name, value));
  });
});
