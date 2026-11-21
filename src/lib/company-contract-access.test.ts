import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Company agreements are the LLC's own paperwork, so the database lets a super admin save, add parties to, and send
 * one without Catalog Management (20261121190000). This reads the migration chain in order, keeping the last policy
 * and function definition, so deleting the carve-out or overriding it in a later migration fails the suite.
 */
const MIGRATION_DIR = "supabase/migrations";
const migrations = readdirSync(MIGRATION_DIR)
  .filter((file) => /^\d{14}_.*\.sql$/.test(file))
  .sort()
  .map((file) => readFileSync(join(MIGRATION_DIR, file), "utf8").replace(/--.*$/gm, ""));

const oneLine = (sql: string) => sql.replace(/\s+/g, " ").trim();

/** The policy the database would end up with after every migration, or null if one removes it for good. */
function latestPolicy(name: string, table: string): string | null {
  const events = new RegExp(
    `(?:DROP POLICY (?:IF EXISTS )?"${name}" ON public\\.${table}\\b|ALTER POLICY "${name}" ON public\\.${table}\\b|CREATE POLICY "${name}" ON public\\.${table}\\b[\\s\\S]*?;)`,
    "gi",
  );
  let current: string | null = null;
  for (const sql of migrations) {
    for (const [statement] of sql.matchAll(events)) {
      // An ALTER POLICY has to be read as a new definition, not silently ignored; fail until this test is updated.
      current = /^(DROP|ALTER) POLICY/.test(statement.toUpperCase()) ? null : oneLine(statement);
    }
  }
  return current;
}

/** The newest send_contract body, wherever a later migration replaced it. */
function latestSendContract(): string | null {
  let current: string | null = null;
  for (const sql of migrations) {
    for (const match of sql.matchAll(/CREATE (?:OR REPLACE )?FUNCTION public\.send_contract\b/g)) {
      const start = match.index ?? 0;
      const body = sql.indexOf("$function$;", start);
      current = body === -1 ? null : oneLine(sql.slice(start, body + "$function$;".length));
    }
    if (/DROP FUNCTION (?:IF EXISTS )?public\.send_contract\b/i.test(sql)) current = null;
  }
  return current;
}

describe("free super-admin company contracts", () => {
  const contractsPolicy = latestPolicy("Contracts need Catalog Management", "contracts");
  const partiesPolicy = latestPolicy(
    "Contract parties need Catalog Management",
    "contract_parties",
  );
  const sendContract = latestSendContract();

  it("still saves a company agreement for a super admin whose plan is Free", () => {
    expect(contractsPolicy, "the contracts insert policy is missing").not.toBeNull();
    expect(contractsPolicy).toContain("public.has_tier(auth.uid(), 'management')");
    expect(contractsPolicy).toContain(
      "(coalesce(is_company, false) AND public.has_role(auth.uid(), 'super_admin'))",
    );
  });

  it("still lets that super admin add the agreement's parties", () => {
    expect(partiesPolicy, "the contract parties insert policy is missing").not.toBeNull();
    expect(partiesPolicy).toContain("public.has_tier(auth.uid(), 'management')");
    expect(partiesPolicy).toContain(
      "coalesce(k.is_company, false) AND public.has_role(auth.uid(), 'super_admin')",
    );
  });

  it("still lets a free super admin send it, while every other company sender needs approval", () => {
    expect(sendContract, "the send_contract function is missing").not.toBeNull();
    // The member tier rule is unchanged, with the company carve-out alongside it.
    expect(sendContract).toContain(
      "IF NOT public.has_tier(auth.uid(),'management') AND k.paid_purchase_id IS NULL",
    );
    expect(sendContract).toContain(
      "NOT (coalesce(k.is_company,false) AND public.has_role(auth.uid(),'super_admin'))",
    );
    // A company agreement still goes out only after a super admin approves it.
    expect(sendContract).toContain(
      "IF coalesce(k.is_company,false) AND NOT public.has_role(auth.uid(),'super_admin') THEN RAISE EXCEPTION",
    );
  });

  it("never widens the carve-out to personal contracts", () => {
    expect(contractsPolicy).not.toMatch(/OR\s+public\.has_role\(auth\.uid\(\), 'super_admin'\)/);
    expect(contractsPolicy).toContain("coalesce(is_company, false) AND public.has_role");
  });
});
