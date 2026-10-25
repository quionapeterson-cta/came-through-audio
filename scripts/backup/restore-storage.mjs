// Puts backed-up files back into Supabase Storage (PLAN-backups.md, "Restore"). First download the backup's storage/
// folder from R2 into ./storage-backup (aws s3 cp s3://<bucket>/storage/ storage-backup --recursive --endpoint-url …),
// then: SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… node scripts/backup/restore-storage.mjs
// Creates any missing bucket (private, except site-media) and uploads every file, replacing what's there.
import { createClient } from "@supabase/supabase-js";
import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const root = "storage-backup";
const PUBLIC = new Set(["site-media"]);

async function files(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...(await files(p))); else out.push(p);
  }
  return out;
}

const { data: existing } = await sb.storage.listBuckets();
let restored = 0, failed = 0;
for (const bucket of await readdir(root)) {
  if (!existing?.some((b) => b.id === bucket)) {
    const { error } = await sb.storage.createBucket(bucket, { public: PUBLIC.has(bucket) });
    if (error) { console.error(`Couldn't create bucket ${bucket}: ${error.message}`); continue; }
  }
  for (const file of await files(join(root, bucket))) {
    const path = relative(join(root, bucket), file).split("\\").join("/");
    const { error } = await sb.storage.from(bucket).upload(path, await readFile(file), { upsert: true });
    if (error) { console.error(`${bucket}/${path}: ${error.message}`); failed++; } else restored++;
  }
}
console.log(`Restored ${restored} files, ${failed} failed.`);
if (failed) process.exitCode = 1;
