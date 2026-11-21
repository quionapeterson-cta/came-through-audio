#!/usr/bin/env node
/**
 * Fails when a backend vendor's name reaches copy a member (or a standard staff member) can read.
 * Only Stripe, its Link checkout and opentimestamps.org are approved to appear: everyone else is
 * "third-party infrastructure and service providers". Super-admin-only plan documents
 * (public.company_plans) and the founder's own launch checklist are deliberately not scanned.
 *
 *   npm run check:copy
 *
 * Scans every string literal and JSX text node in src/, then the database tables that hold copy.
 * Module paths, console diagnostics, env vars and API hostnames are code, not copy, and are ignored.
 * The database half needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY; without them it is skipped
 * with a loud note rather than passing silently.
 *
 * Adding a vendor to an allowlist is a decision, not a fix: first ask whether a member needs the name.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const SRC = join(ROOT, "src");

/** Never rendered: the client itself, generated files, tests, the vendor error reporter, ops checklists. */
const SKIP = [
  /^src\/integrations\//,
  /^src\/routeTree\.gen\.ts$/,
  /^src\/lib\/lovable-error-reporting\.ts$/,
  /^src\/lib\/launch-milestones\.ts$/, // founder's ops checklist (hosting, secrets): super-admin work, not staff copy
  /\.test\.tsx?$/,
];

/** Names that must never be shown. Stripe, Link and opentimestamps.org are approved and absent. */
const VENDORS = [
  /\bsupabase\b/i,
  /\bcloudflare\b/i,
  /\bresend\b(?=\s*(?:api|webhook|failed|events|dashboard|email api))/i,
  /\bvercel\b/i,
  /\blovable\b/i,
  /\bnetlify\b/i,
  /\bfirebase\b/i,
  /\bgoogle cloud\b/i,
  /\bdaily\.co\b/i,
  /\bgithub\b/i,
  /\bpaddle\b/i,
  /\bamazon web services\b/i,
  /\baws\b/i,
];

/** Hostnames, env vars and record ids: code, never copy. Removed before the vendor test. */
const TECHNICAL = [
  /supabase\.(co|in)\b/gi,
  /\b(?:VITE_)?SUPABASE_[A-Z_]+\b/g,
  /\bresend\.com\b/gi,
  /\bapi\.resend\b/gi,
  /\bresend[_-](?:id|events?|webhook|status|message)\b/gi,
  /\bRESEND_[A-Z_]+\b/g,
  /lovable\.(?:app|dev)\b/gi,
  /\bLOVABLE_[A-Z_]+\b/g,
  /\bLovable-API-Key\b/g,
  /vercel\.app\b/gi,
  /\bVERCEL\b/g,
  /\bapi\.cloudflare\.com\b/gi,
  /\bCLOUDFLARE_[A-Z_]+\b/g,
  /\bapi\.daily\.co\b/gi,
  /githubusercontent\.com\b/gi,
];

/** Module paths, requires and console diagnostics: never shown to anyone. */
function stripCode(source) {
  return source
    .replace(/^\s*import\s+[\s\S]*?from\s*["'][^"']+["'];?/gm, "")
    .replace(/^\s*import\s*["'][^"']+["'];?/gm, "")
    .replace(/\b(?:import|require)\(\s*["'][^"']+["']\s*\)/g, "")
    .replace(/\[\s*["'][\w$.]+["']\s*\]/g, "") // indexed access: Ctx["supabase"], env['VITE_…']
    .replace(/\bexport\s+[\s\S]*?from\s*["'][^"']+["'];?/g, "")
    .replace(/\bconsole\.\w+\([\s\S]*?\);/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

/** String literals and JSX text only, so identifiers like context.supabase never match. */
function copyIn(source) {
  const body = stripCode(source);
  const found = [];
  for (const m of body.matchAll(/(?<![\w$])["'`]((?:\\.|[^"'`\\\n])*)["'`]/g)) found.push(m[1]);
  for (const m of body.matchAll(/>([^<>{}]*[A-Za-z]{2}[^<>{}]*)</g)) found.push(m[1]);
  return found;
}

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = join(dir, e.name);
    return e.isDirectory() ? walk(full) : /\.tsx?$/.test(e.name) ? [full] : [];
  });
}

function scanCopy() {
  const hits = [];
  for (const file of walk(SRC)) {
    const rel = relative(ROOT, file).split("\\").join("/");
    if (SKIP.some((s) => s.test(rel))) continue;
    for (const text of copyIn(readFileSync(file, "utf8"))) {
      const cleaned = TECHNICAL.reduce((t, re) => t.replace(re, " "), text);
      for (const vendor of VENDORS) {
        const m = cleaned.match(vendor);
        if (m) hits.push({ where: rel, vendor: m[0], text: text.trim().slice(0, 120) });
      }
    }
  }
  return hits;
}

/**
 * Tables holding copy we write that members or standard staff then read. Text a member typed
 * (support tickets, inbound mail) is theirs, not our copy, so it is not scanned.
 * company_plans is super-admin only.
 */
const TABLES = {
  support_ticket_messages: ["body"],
  team_notices: ["body"],
  department_tasks: ["title", "body"],
  calendar_events: ["title", "notes"],
  contracts: ["title", "body"],
  video_rooms: ["title", "description"],
  scheduled_events: ["title", "description"],
  pdf_packets: ["title"],
  pdf_templates: ["name", "contract_description"],
  pdf_email_sends: ["subject", "bounce_message"],
  outreach_emails: ["subject"],
  badge_submissions: ["title", "description", "decision_note", "popup"],
  badge_drops: ["note"],
  staff_submissions: ["title", "details", "note"],
  work_queue: ["title", "note"],
};

/** The bare word "resend" is ordinary English in copy; only the vendor's own forms count. */
const NEEDLES =
  "supabase cloudflare resend.com api.resend vercel lovable netlify firebase daily.co github paddle amazon".split(
    " ",
  );

async function scanDatabase() {
  const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").replace(/\/+$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.log(
      "database scan: SKIPPED (set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to include it)",
    );
    return [];
  }
  const hits = [];
  for (const [table, columns] of Object.entries(TABLES)) {
    const filter = NEEDLES.flatMap((needle) =>
      columns.map((column) => `${column}.ilike.*${needle}*`),
    ).join(",");
    const query = `${url}/rest/v1/${table}?select=id&or=(${encodeURIComponent(filter).replace(/%2C/g, ",").replace(/%2A/g, "*")})&limit=3`;
    const res = await fetch(query, {
      headers: { apikey: key, Authorization: `Bearer ${key}`, Prefer: "count=exact" },
    });
    if (!res.ok) {
      hits.push({
        where: table,
        vendor: `HTTP ${res.status}`,
        text: (await res.text()).slice(0, 200),
      });
      continue;
    }
    const rows = await res.json();
    if (rows.length) {
      const count = res.headers.get("content-range")?.split("/")[1] ?? String(rows.length);
      hits.push({
        where: table,
        vendor: `${count} row(s)`,
        text: rows.map((r) => r.id).join(", "),
      });
    }
  }
  return hits;
}

const hits = scanCopy();
hits.push(...(await scanDatabase()));

if (hits.length) {
  console.error(`\nBanned vendor names in copy (${hits.length}):\n`);
  for (const h of hits) console.error(`  ${h.where}  [${h.vendor}]  ${h.text}`);
  console.error(
    "\nMembers and standard staff must not learn backend vendor names. Stripe, Link and opentimestamps.org are approved.\n",
  );
  process.exit(1);
}
console.log("vendor copy: clean");
