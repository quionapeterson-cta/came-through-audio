#!/usr/bin/env node
// Deletes old Vercel deployments for this project so they stop counting against the
// Hobby storage allowance. Each one still holds its own copy of the build artifact, and
// new deploys are now ~46 MB instead of ~224 MB, but the backlog has to be cleared once.
//
//   VERCEL_TOKEN=xxx node scripts/delete-vercel-deployments.mjs            # dry run, lists what would go
//   VERCEL_TOKEN=xxx node scripts/delete-vercel-deployments.mjs --delete   # actually deletes
//
// Never kept: nothing. Always kept:
//   - the newest READY production deployment (the one your domain serves)
//   - the newest --keep deployments (default 3)
//   - anything younger than --keep-days days (default 0, i.e. off)
//
// Get a token at https://vercel.com/account/tokens (scope it to this team if you can).
// Do not commit the token or paste it anywhere public; pass it as an env var.
import { setTimeout as sleep } from "node:timers/promises";

const API = "https://api.vercel.com";

const args = process.argv.slice(2);
const DELETE = args.includes("--delete");
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? fallback : Number(args[i + 1]);
};

const TOKEN = process.env.VERCEL_TOKEN;
const PROJECT_ID = process.env.VERCEL_PROJECT_ID ?? "prj_eROxy0x9oz8FigV2YwCWzQaMxuXP";
const TEAM_ID = process.env.VERCEL_TEAM_ID ?? "team_mHqKfIDvXr2KpxykPtjvkVCk";
const KEEP = flag("keep", 3);
const KEEP_DAYS = flag("keep-days", 0);

if (!TOKEN) {
  console.error("Set VERCEL_TOKEN first, for example: VERCEL_TOKEN=xxx node scripts/delete-vercel-deployments.mjs");
  console.error("Create one at https://vercel.com/account/tokens — it is only read from the environment, never written to disk.");
  process.exit(1);
}

async function api(path, init = {}) {
  for (let attempt = 1; attempt <= 5; attempt++) {
    const res = await fetch(`${API}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json", ...init.headers },
    });
    if (res.status === 429 || res.status >= 500) {
      const wait = 1000 * attempt;
      console.log(`  ${res.status} from ${path.split("?")[0]}, retrying in ${wait / 1000}s`);
      await sleep(wait);
      continue;
    }
    const body = res.status === 204 ? null : await res.json().catch(() => null);
    if (!res.ok) throw new Error(`${init.method ?? "GET"} ${path.split("?")[0]} -> ${res.status} ${body?.error?.message ?? ""}`);
    return body;
  }
  throw new Error(`Gave up on ${path.split("?")[0]} after 5 attempts`);
}

async function listAll() {
  const all = [];
  let until = null;
  for (;;) {
    const qs = new URLSearchParams({ projectId: PROJECT_ID, teamId: TEAM_ID, limit: "100" });
    if (until) qs.set("until", String(until));
    const page = await api(`/v6/deployments?${qs}`);
    const batch = page?.deployments ?? [];
    all.push(...batch);
    if (batch.length < 100) return all;
    until = batch[batch.length - 1].createdAt;
    if (!until) return all;
    await sleep(300);
  }
}

const deployments = await listAll();
const newestFirst = deployments.sort((a, b) => b.createdAt - a.createdAt);
const live = newestFirst.find((d) => d.target === "production" && d.readyState === "READY");
const cutoff = Date.now() - KEEP_DAYS * 24 * 60 * 60 * 1000;

const keep = new Set();
if (live) keep.add(live.uid);
for (const d of newestFirst.slice(0, KEEP)) keep.add(d.uid);
for (const d of newestFirst) if (d.createdAt > cutoff) keep.add(d.uid);

const doomed = newestFirst.filter((d) => !keep.has(d.uid));

const mb = (d) => `${Math.round(d.createdAt / 1000)}`;
console.log(`${deployments.length} deployments found; keeping ${keep.size}, ${DELETE ? "deleting" : "would delete"} ${doomed.length}.`);
console.log(`Keeping the live one: ${live ? `${live.uid} (${new Date(live.createdAt).toISOString()})` : "none found — aborting for safety"}`);
if (!live) process.exit(1);
console.log(
  KEEP_DAYS > 0
    ? `Keeping the newest ${KEEP} and everything from the last ${KEEP_DAYS} days.`
    : `Keeping only the newest ${KEEP}, plus the live one.`,
);

if (!DELETE) {
  for (const d of doomed.slice(0, 15)) {
    console.log(`  would delete ${d.uid}  ${new Date(d.createdAt).toISOString()}  ${d.url}`);
  }
  if (doomed.length > 15) console.log(`  …and ${doomed.length - 15} more`);
  console.log("\nDry run only. Re-run with --delete to remove them.");
  process.exit(0);
}

let ok = 0;
const failed = [];
for (const [i, d] of doomed.entries()) {
  try {
    await api(`/v9/deployments/${d.uid}?teamId=${TEAM_ID}${d.url ? `&url=${encodeURIComponent(d.url)}` : ""}`, { method: "DELETE" });
    ok++;
  } catch (err) {
    failed.push(`${d.uid}: ${err.message}`);
  }
  if ((i + 1) % 10 === 0) console.log(`  ${i + 1}/${doomed.length} processed (${ok} deleted, ${failed.length} failed)`);
  await sleep(250);
}

console.log(`\nDeleted ${ok} of ${doomed.length}.`);
if (failed.length) {
  console.log(`${failed.length} could not be deleted; Vercel refuses deployments that still hold an alias:`);
  for (const line of failed.slice(0, 20)) console.log(`  ${line}`);
  if (failed.length > 20) console.log(`  …and ${failed.length - 20} more`);
}
console.log("Storage usage updates over the next few minutes; check https://vercel.com/camethroughfam/came-through-audio/usage");
