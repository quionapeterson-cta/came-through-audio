import { describe, expect, it } from "vitest";
import {
  driftFailed,
  driftReport,
  formatDriftReport,
  localMigrations,
  migrationVersion,
  parseMigrationListTable,
  versionsFromRows,
} from "./migration-ledger";

/** The ledger drift check: what a `db push` would run again (founder, 2026-11-20). */
describe("migration ledger drift", () => {
  it("reads a version from a migration's filename, and nothing from anything else", () => {
    expect(migrationVersion("20261120160000_seat-owner-guard-columns.sql")).toBe("20261120160000");
    expect(migrationVersion("supabase/migrations/20261120090000_vault-subscription.sql")).toBe(
      "20261120090000",
    );
    expect(migrationVersion("20261120090000_vault-subscription.SQL")).toBeNull();
    expect(migrationVersion("README.md")).toBeNull();
    expect(migrationVersion("seed_20261120090000_x.sql")).toBeNull();
    expect(migrationVersion("202611200900_vault-subscription.sql")).toBeNull();
  });

  it("keeps only real migrations, oldest first, named by file", () => {
    const rows = localMigrations([
      "20261120160000_seat-owner-guard-columns.sql",
      "notes.txt",
      "20261104140000_artist-seat-key.sql",
    ]);
    expect(rows).toEqual([
      { version: "20261104140000", file: "20261104140000_artist-seat-key.sql" },
      { version: "20261120160000", file: "20261120160000_seat-owner-guard-columns.sql" },
    ]);
  });

  it("reads the versions out of the CLI's LOCAL │ REMOTE │ TIME table", () => {
    const output = [
      "        LOCAL      │     REMOTE     │     TIME (UTC)",
      "  ───────────────┼────────────────┼──────────────────────",
      "                   │ 20261120212013 │ 2026-11-20 21:20:13",
      "   20261120090000  │ 20261120090000 │ 2026-11-20 20:49:06",
      "   20261120100000  │                │ 2026-11-20 21:00:00",
    ].join("\n");
    expect(parseMigrationListTable(output)).toEqual(["20261120090000", "20261120212013"]);
  });

  it("reads the same table drawn with plain pipes", () => {
    const output = ["LOCAL | REMOTE | TIME (UTC)", " | 20261120212013 | 2026-11-20 21:20:13"].join(
      "\n",
    );
    expect(parseMigrationListTable(output)).toEqual(["20261120212013"]);
  });

  it("says it could not read the ledger rather than calling every migration pending", () => {
    expect(parseMigrationListTable("")).toBeNull();
    expect(parseMigrationListTable("Project is not linked.")).toBeNull();
  });

  it("reads versions from the Management API rows, a saved list or bare versions", () => {
    expect(
      versionsFromRows([
        { version: "20261120212013", name: "vault" },
        { version: "nope" },
        "20261120090000",
      ]),
    ).toEqual(["20261120090000", "20261120212013"]);
    expect(versionsFromRows({ version: "20261120212013" })).toEqual([]);
    expect(versionsFromRows(null)).toEqual([]);
  });

  it("splits pending from recorded, and treats a ledger row with no file as expected history", () => {
    const local = localMigrations([
      "20261120090000_vault-subscription.sql",
      "20261120160000_seat-owner-guard-columns.sql",
    ]);
    const drift = driftReport(local, ["20261120090000", "20261120212013"]);
    expect(drift.pending.map((m) => m.version)).toEqual(["20261120160000"]);
    expect(drift.recorded.map((m) => m.version)).toEqual(["20261120090000"]);
    expect(drift.stray).toEqual(["20261120212013"]);
    expect(driftFailed(drift)).toBe(true);
  });

  it("is clean when the only difference is Lovable's own version names", () => {
    const local = localMigrations(["20261120090000_vault-subscription.sql"]);
    const drift = driftReport(local, ["20261120090000", "20261120212013"]);
    expect(drift.pending).toEqual([]);
    expect(driftFailed(drift)).toBe(false);
    const report = formatDriftReport(drift);
    expect(report).not.toContain("PENDING");
    expect(report).toContain("STRAY (1)");
    expect(report).toContain("Ledger drift: clean");
  });

  it("names every pending file and says a push is not safe", () => {
    const drift = driftReport(localMigrations(["20261120090000_vault-subscription.sql"]), []);
    const report = formatDriftReport(drift);
    expect(report).toContain("Migrations in the repo: 1 · recorded in the remote ledger: 0");
    expect(report).toContain("PENDING (1)");
    expect(report).toContain("20261120090000  20261120090000_vault-subscription.sql");
    expect(report).toContain("NOT CLEAN");
  });
});
