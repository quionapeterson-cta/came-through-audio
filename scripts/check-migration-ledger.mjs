#!/usr/bin/env node
/**
 * Catches ledger drift before `supabase db push` turns it into a surprise: fails when a migration in the repo has no
 * row in the remote `supabase_migrations.schema_migrations` ledger, because a push would run that file again.
 *
 *   npm run db:drift
 *   SUPABASE_ACCESS_TOKEN=... npm run db:drift          (Management API, read-only)
 *   npm run db:drift -- --remote-file saved.json        (a list saved earlier: API JSON, CLI table or bare versions)
 *
 * The remote side is read from the first of these that answers: `--remote-file`, the Supabase CLI
 * (`supabase migration list --linked`), then the Management API with SUPABASE_ACCESS_TOKEN and the project ref in
 * supabase/config.toml. Exits 0 clean, 1 on a pending migration, and 2 when it could not read the remote ledger — a
 * check that cannot see the database never passes quietly.
 *
 * The rules live in src/lib/migration-ledger.ts with their test; this file only compiles them (see loadRules), reads
 * files, asks the remote, and prints. Object existence is deliberately not part of it: that needs a live SQL query,
 * and the 2026-11-20 check (578 declared objects, 570 present, the 8 deliberate absences) was read by hand.
 */
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * The rules are TypeScript so they can carry their test, and this script has to run wherever the app is worked on —
 * Node 22 in CI and the devcontainer, whatever the machine in front of you uses. Node only strips types by default
 * from 22.18, so the module is compiled with the TypeScript the project already depends on instead of being imported
 * as source: a runtime that cannot read `.ts` is not a reason for the check to break. The compiled module is imported
 * from a data: URL, so nothing is written to disk and the rules still live in exactly one place.
 */
async function loadRules() {
  let ts;
  try {
    ts = createRequire(import.meta.url)("typescript");
  } catch {
    console.error(
      "The drift check needs TypeScript. Run npm install (or bun install), then retry.",
    );
    process.exit(2);
  }
  const file = fileURLToPath(new URL("../src/lib/migration-ledger.ts", import.meta.url));
  const { outputText, diagnostics } = ts.transpileModule(readFileSync(file, "utf8"), {
    fileName: file,
    reportDiagnostics: true,
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  });
  const errors = (diagnostics ?? []).filter((d) => d.category === ts.DiagnosticCategory.Error);
  if (errors.length) {
    console.error(
      `Could not compile ${file}:\n${errors
        .map((d) => `  ${ts.flattenDiagnosticMessageText(d.messageText, " ")}`)
        .join("\n")}`,
    );
    process.exit(2);
  }
  return import(
    `data:text/javascript;base64,${Buffer.from(outputText, "utf8").toString("base64")}`
  );
}

const {
  driftFailed,
  driftReport,
  formatDriftReport,
  localMigrations,
  parseMigrationListTable,
  versionsFromRows,
} = await loadRules();

const ROOT = fileURLToPath(new URL("..", import.meta.url));

const USAGE = `Ledger drift check

  npm run db:drift                                  compare supabase/migrations with the live ledger
  npm run db:drift -- --remote-file saved.json       use a saved list instead of asking
  npm run db:drift -- --project <ref>                a project other than supabase/config.toml's
  SUPABASE_ACCESS_TOKEN=...                          read the ledger through the Management API

Exit codes: 0 clean, 1 a migration is missing from the ledger, 2 the remote ledger could not be read.`;

/** Never printed: the operator's own words, not copy. */
function parseArgs(argv) {
  const options = {
    dir: join(ROOT, "supabase", "migrations"),
    project: "",
    remoteFile: "",
    help: false,
    problem: "",
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") options.help = true;
    else if (arg === "--dir") options.dir = resolve(argv[(i += 1)] ?? ".");
    else if (arg === "--project") options.project = argv[(i += 1)] ?? "";
    else if (arg === "--remote-file") options.remoteFile = resolve(argv[(i += 1)] ?? "");
    else options.problem = `Unknown argument: ${arg}`;
  }
  return options;
}

/** supabase/config.toml's project_id, unless the operator named one. */
function projectRef(named) {
  if (named) return named;
  try {
    const config = readFileSync(join(ROOT, "supabase", "config.toml"), "utf8");
    return /^\s*project_id\s*=\s*"([^"]+)"/m.exec(config)?.[1] ?? "";
  } catch {
    return "";
  }
}

/** A saved list: the CLI's table, the Management API's JSON, or plain versions one to a line. */
function remoteFromFile(path) {
  const text = readFileSync(path, "utf8");
  const table = parseMigrationListTable(text);
  if (table) return { versions: table, source: `saved list ${path} (CLI table)` };
  try {
    const rows = versionsFromRows(JSON.parse(text));
    if (rows.length) return { versions: rows, source: `saved list ${path} (JSON)` };
  } catch {
    /* not JSON: fall through to the plain list below */
  }
  const plain = versionsFromRows(text.split(/\s+/));
  return plain.length ? { versions: plain, source: `saved list ${path}` } : null;
}

function remoteFromCli() {
  try {
    const output = execFileSync("supabase", ["migration", "list", "--linked"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    const versions = parseMigrationListTable(output);
    return versions
      ? { versions, source: "Supabase CLI (supabase migration list --linked)" }
      : null;
  } catch {
    return null;
  }
}

async function remoteFromApi(ref, token) {
  if (!ref || !token) return null;
  try {
    const response = await fetch(
      `https://api.supabase.com/v1/projects/${ref}/database/migrations`,
      {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      },
    );
    if (!response.ok) {
      console.error(`Management API answered HTTP ${response.status}; falling back.`);
      return null;
    }
    return {
      versions: versionsFromRows(await response.json()),
      source: `Management API (project ${ref})`,
    };
  } catch (error) {
    console.error(`Management API unreachable (${error.message}); falling back.`);
    return null;
  }
}

const options = parseArgs(process.argv.slice(2));
if (options.help || options.problem) {
  if (options.problem) console.error(`${options.problem}\n`);
  console.log(USAGE);
  process.exit(options.problem ? 2 : 0);
}

let files;
try {
  files = readdirSync(options.dir);
} catch {
  console.error(`No migration folder at ${options.dir}.`);
  process.exit(2);
}
const local = localMigrations(files);
if (!local.length) {
  console.error(
    `No migration files in ${options.dir} — nothing to compare, so nothing is reported clean.`,
  );
  process.exit(2);
}

const remote =
  (options.remoteFile ? remoteFromFile(options.remoteFile) : null) ??
  remoteFromCli() ??
  (await remoteFromApi(projectRef(options.project), process.env.SUPABASE_ACCESS_TOKEN ?? ""));

if (!remote) {
  console.error(
    [
      "Could not read the remote migration ledger, so nothing was checked.",
      "",
      "Use one of:",
      "  supabase migration list --linked              (Supabase CLI, logged in and linked)",
      "  SUPABASE_ACCESS_TOKEN=... npm run db:drift    (Management API, read-only)",
      "  npm run db:drift -- --remote-file saved.json  (a list saved earlier)",
    ].join("\n"),
  );
  process.exit(2);
}

const drift = driftReport(local, remote.versions);
console.log(`Ledger source: ${remote.source} (${remote.versions.length} versions)`);
console.log(formatDriftReport(drift));
process.exit(driftFailed(drift) ? 1 : 0);
