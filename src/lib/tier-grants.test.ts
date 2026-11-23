import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Every access grant lands in public.user_tier. Staff roles and staff-plan grants are the member's own access, not the
 * paused plan's, so they must keep working while a plan is paused; a paid plan, founding upgrade or seat must not.
 * This reads the migration chain in order and keeps the last definition, so a later migration that drops a grant branch
 * or reorders the pause ahead of staff fails here.
 */
const MIGRATION_DIR = "supabase/migrations";
const migrations = readdirSync(MIGRATION_DIR)
  .filter((file) => /^\d{14}_.*\.sql$/.test(file))
  .sort()
  .map((file) => readFileSync(join(MIGRATION_DIR, file), "utf8").replace(/--.*$/gm, ""));

const oneLine = (sql: string) => sql.replace(/\s+/g, " ").trim();

/** The newest function body for public.<name>, wherever a later migration replaced it. */
function latestFunction(name: string): string | null {
  let current: string | null = null;
  const create = new RegExp(`CREATE (?:OR REPLACE )?FUNCTION public\\.${name}\\b`, "i");
  for (const sql of migrations) {
    const start = sql.search(create);
    if (start !== -1) {
      const tail = sql.slice(start);
      const opener = /\bAS\s+(\$[A-Za-z_]*\$)/i.exec(tail);
      const delimiter = opener?.[1];
      const close =
        opener && delimiter ? tail.indexOf(delimiter, opener.index + opener[0].length) : -1;
      current =
        close === -1 || !delimiter ? null : oneLine(tail.slice(0, close + delimiter.length + 1));
    }
    if (new RegExp(`DROP FUNCTION (?:IF EXISTS )?public\\.${name}\\b`, "i").test(sql))
      current = null;
  }
  return current;
}

/** Index order matters: a grant that is evaluated after the pause branch never gets its tier. */
const order = (sql: string, ...needles: string[]) => needles.map((needle) => sql.indexOf(needle));

describe("tier grants", () => {
  const userTier = latestFunction("user_tier");
  const staffPlanActive = latestFunction("staff_plan_active");
  const isPaused = latestFunction("is_paused");

  it("keeps the staff role and the staff-plan grant as management", () => {
    expect(userTier, "user_tier is missing").not.toBeNull();
    expect(userTier).toContain("WHEN public.has_role(_uid, 'super_admin') THEN 'management'");
    // An HR Admin holds a staff role too, so user_tier must never show that seat as Free (founder, 2026-11-23).
    expect(userTier).toContain(
      "WHEN public.is_staff(_uid) OR public.in_department(_uid, 'hr') THEN 'management'",
    );
    expect(userTier).toContain("WHEN public.staff_plan_active(_uid) THEN 'management'");
  });

  it("checks every staff grant before the pause can return Free", () => {
    const [superAdmin = -1, staff = -1, staffPlan = -1, paused = -1] = order(
      userTier!,
      "public.has_role(_uid, 'super_admin')",
      "public.is_staff(_uid)",
      "public.staff_plan_active(_uid)",
      "public.is_paused(_uid)",
    );
    expect(superAdmin).toBeGreaterThan(-1);
    expect(staff).toBeGreaterThan(superAdmin);
    expect(staffPlan).toBeGreaterThan(staff);
    expect(paused, "the pause branch runs before a staff grant").toBeGreaterThan(staffPlan);
  });

  it("still makes a paused account Free, seat and paid plan included", () => {
    expect(userTier).toContain("WHEN public.is_paused(_uid) THEN 'free'");
    // The paid and seat ranks are only used after the pause branch.
    const trees = userTier!.indexOf("SELECT CASE");
    const paused = userTier!.indexOf("WHEN public.is_paused(_uid) THEN 'free'");
    const combined = userTier!.indexOf(
      "greatest((SELECT paid_rank FROM tiers), (SELECT seat_rank FROM tiers))",
    );
    expect(trees).toBeGreaterThan(-1);
    expect(combined).toBeGreaterThan(paused);
  });

  it("keeps the founding upgrade tied to the paid tier in the active environment", () => {
    expect(userTier).toContain("SELECT f.granted_tier FROM founding_upgrades f");
    expect(userTier).toContain("f.ended_at IS NULL");
    expect(userTier).toContain("f.paid_tier = public.paid_tier(_uid)");
    expect(userTier).toContain(
      "(NOT EXISTS (SELECT 1 FROM env) OR f.environment = (SELECT e FROM env))",
    );
  });

  it("counts a live staff-plan grant only inside its approved window", () => {
    expect(staffPlanActive, "staff_plan_active is missing").not.toBeNull();
    for (const rule of [
      "g.status = 'active'",
      "g.ended_at is null",
      "g.starts_at is not null",
      "g.ends_at is not null",
      "g.starts_at <= now()",
      "g.ends_at > now()",
    ]) {
      expect(staffPlanActive).toContain(rule);
    }
  });

  it("treats an open-ended, unended pause as live", () => {
    expect(isPaused, "is_paused is missing").not.toBeNull();
    expect(isPaused).toContain("p.kind = 'pause'");
    expect(isPaused).toContain("p.ended_at IS NULL");
    expect(isPaused).toContain("now() >= p.starts_at");
    expect(isPaused).toContain("(p.ends_at IS NULL OR now() < p.ends_at)");
  });
});
