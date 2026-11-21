/**
 * Ledger drift: which migrations `supabase db push` would run that the database already has.
 *
 * `db push` runs every local migration whose version is missing from the remote
 * `supabase_migrations.schema_migrations` table. Lovable records a migration under its own timestamp instead of the
 * filename's, so a file can be applied on the database and still have no row of its own — that gap is what turns a
 * push into a surprise (founder, 2026-11-20: 86 files sat unrecorded, and the Vault migration landed as
 * `20261120212013` rather than `20261120090000`). The rules live here with their test, never inline in the script.
 */

export type LocalMigration = { version: string; file: string };

/**
 * The comparison. `pending` is the only alarming half: those are the files a push would run again. `stray` is the
 * ledger's own extra history — versions with no file in the repo — which is normal here, because Lovable names the
 * versions it records, so it is reported and never fails the check.
 */
export type LedgerDrift = {
  pending: LocalMigration[];
  recorded: LocalMigration[];
  stray: string[];
};

/** `20261120160000_seat-owner-guard-columns.sql` → `20261120160000`; anything that is not a migration → null. */
export function migrationVersion(file: string): string | null {
  const name = file.replace(/\\/g, "/").split("/").pop() ?? file;
  const match = /^(\d{14})_.+\.sql$/.exec(name);
  return match?.[1] ?? null;
}

/** The migration files among these names, oldest first. Paths are reduced to the file's own name for the report. */
export function localMigrations(files: string[]): LocalMigration[] {
  const found: LocalMigration[] = [];
  for (const file of files) {
    const version = migrationVersion(file);
    if (!version) continue;
    found.push({ version, file: file.replace(/\\/g, "/").split("/").pop() ?? file });
  }
  return found.sort((a, b) => a.version.localeCompare(b.version) || a.file.localeCompare(b.file));
}

/**
 * The remote versions out of `supabase migration list --linked`, whose table is
 * `LOCAL │ REMOTE │ TIME (UTC)`: a row applied on the database carries the version in the second cell, and a row with
 * an empty remote cell is one the CLI itself calls pending. Null (not an empty list) when the text is not that table,
 * so a changed format makes the check say it could not read the ledger rather than report every migration as pending.
 */
export function parseMigrationListTable(output: string): string[] | null {
  const lines = output.split(/\r?\n/);
  const looksLikeTable = lines.some((line) => /LOCAL/.test(line) && /REMOTE/.test(line));
  if (!looksLikeTable) return null;
  const versions = new Set<string>();
  for (const line of lines) {
    if (!/[│|]/.test(line)) continue;
    const remote = (line.split(/[│|]/)[1] ?? "").trim();
    if (/^\d{14}$/.test(remote)) versions.add(remote);
  }
  return [...versions].sort();
}

/** Versions out of the Management API's rows (`{ version, name }`), a saved JSON array, or a list of bare versions. */
export function versionsFromRows(rows: unknown): string[] {
  if (!Array.isArray(rows)) return [];
  const versions = new Set<string>();
  for (const row of rows) {
    const value =
      typeof row === "string"
        ? row
        : row && typeof row === "object"
          ? (row as Record<string, unknown>)["version"]
          : null;
    if (typeof value === "string" && /^\d{14}$/.test(value)) versions.add(value);
  }
  return [...versions].sort();
}

/** What the repo has against what the ledger holds. */
export function driftReport(local: LocalMigration[], remote: string[]): LedgerDrift {
  const known = new Set(remote);
  const inRepo = new Set(local.map((m) => m.version));
  return {
    pending: local.filter((m) => !known.has(m.version)),
    recorded: local.filter((m) => known.has(m.version)),
    stray: [...new Set(remote)].filter((v) => !inRepo.has(v)).sort(),
  };
}

/** The check fails on a pending migration, and on nothing else. */
export function driftFailed(drift: LedgerDrift): boolean {
  return drift.pending.length > 0;
}

/** The report a person reads: what is pending, what is extra, and the verdict in one sentence. */
export function formatDriftReport(drift: LedgerDrift): string {
  const total = drift.recorded.length + drift.pending.length;
  const lines = [
    `Migrations in the repo: ${total} · recorded in the remote ledger: ${drift.recorded.length}`,
  ];
  if (drift.pending.length) {
    lines.push("", `PENDING (${drift.pending.length}) — a db push would run these again:`);
    for (const m of drift.pending) lines.push(`  ${m.version}  ${m.file}`);
  }
  if (drift.stray.length) {
    lines.push(
      "",
      `STRAY (${drift.stray.length}) — in the ledger with no file in the repo (the editor records its own versions, so this is expected history):`,
    );
    for (const version of drift.stray) lines.push(`  ${version}`);
  }
  lines.push(
    "",
    driftFailed(drift)
      ? "Ledger drift: NOT CLEAN — record every PENDING version before a push (see PLAN-vault-monthly-subscription.md §8)."
      : "Ledger drift: clean — every migration in the repo is recorded, so db push has nothing to run.",
  );
  return lines.join("\n");
}
