// Weekly backup of every Supabase Storage bucket (PLAN-backups.md). Copies files that aren't in the backup yet into
// ./storage-backup/<bucket>/<path>, so the workflow can upload only what's new. Usage:
//   node scripts/backup/storage.mjs <existing-keys.txt>
// existing-keys.txt lists keys already in the backup bucket (storage/<bucket>/<path>, one per line; may be empty).
// Needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY. Reads only; never changes or deletes anything in Supabase.
import { createClient } from "@supabase/supabase-js";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const have = new Set((await readFile(process.argv[2] ?? "/dev/null", "utf8").catch(() => "")).split("\n").map((l) => l.trim()).filter(Boolean));

/** Every file under a folder, walking sub-folders (Storage lists one level at a time). */
async function walk(bucket, prefix = "") {
  const out = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await sb.storage.from(bucket).list(prefix, { limit: 1000, offset });
    if (error) throw new Error(`${bucket}/${prefix}: ${error.message}`);
    for (const item of data) {
      const path = prefix ? `${prefix}/${item.name}` : item.name;
      if (item.id === null) out.push(...(await walk(bucket, path))); // a folder
      else out.push(path);
    }
    if (data.length < 1000) return out;
  }
}

const { data: buckets, error } = await sb.storage.listBuckets();
if (error) throw error;
let copied = 0, skipped = 0, failed = 0;
for (const b of buckets) {
  for (const path of await walk(b.id)) {
    const key = `storage/${b.id}/${path}`;
    if (have.has(key)) { skipped++; continue; }
    const { data, error: dl } = await sb.storage.from(b.id).download(path);
    if (dl || !data) { console.error(`Couldn't download ${key}: ${dl?.message}`); failed++; continue; }
    const file = join("storage-backup", b.id, path);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, Buffer.from(await data.arrayBuffer()));
    copied++;
  }
}
console.log(`Buckets: ${buckets.map((b) => b.id).join(", ")} · new files ${copied} · already backed up ${skipped} · failed ${failed}`);
if (failed) process.exitCode = 1;
