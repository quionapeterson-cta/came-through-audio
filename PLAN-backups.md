# PLAN — Backups and rebuilding · v1

Status: **✅ BUILT 2026-10-25 (Phase 4 item 2, order approved). Turns on once you do the 4 setup steps below; then one test restore before launch.**

## What's protected
| What | Where it's safe | How often |
| --- | --- | --- |
| The code | GitHub (this repo) | Every change |
| The database (accounts, catalogs, contracts, split sheets, certificates, payments records) | Your private Cloudflare R2 bucket, encrypted with your passphrase | Every Sunday 3–4 AM Eastern, the newest 12 kept |
| Stored files (masters, artwork, proof videos, logos, homepage photos) | The same R2 bucket | Every Sunday; only new files are copied |

The job is `.github/workflows/backup.yml` (GitHub → Actions → **Weekly backup**). You can also run it anytime with **Run workflow**.
R2's free tier includes 10 GB a month; past that it's about $0.015 per GB a month.

## Setup (about 15 minutes, once)
1. **Cloudflare R2:** dash.cloudflare.com → R2 → Create bucket → name `cta-backups` (keep it private).
   Then R2 → Manage API tokens → Create API token → permission **Object Read & Write**, only that bucket → copy the
   Access Key ID, Secret Access Key and your Account ID.
2. **Supabase database address:** Supabase → Project Settings → Database → Connection string → **Session pooler** → copy
   it and put your database password in it.
3. **A backup passphrase:** make a long random one and save it in your password manager. Without it the database backup
   can't be opened, by anyone, including us.
4. **GitHub secrets:** this repo → Settings → Secrets and variables → Actions → New repository secret, one for each:

| Secret | Value |
| --- | --- |
| `SUPABASE_DB_URL` | Step 2 |
| `SUPABASE_URL` | Supabase → Project Settings → API → Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API keys → service_role (never share it) |
| `R2_ACCOUNT_ID` | Step 1 |
| `R2_ACCESS_KEY_ID` | Step 1 |
| `R2_SECRET_ACCESS_KEY` | Step 1 |
| `R2_BUCKET` | `cta-backups` |
| `BACKUP_PASSPHRASE` | Step 3 |

Then Actions → Weekly backup → **Run workflow** and check it turns green.

## Secrets to keep in your password manager
Everything above, plus: CRON_SECRET, SESSION_SECRET, SITE_PASSWORD, RESEND_API_KEY, the Stripe secret keys and webhook
secrets, CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_AI_TOKEN, your Supabase and Cloudflare logins, and the Lovable login.
With those and this repo, the whole site can be rebuilt.

## Restore (the test before launch, or a real emergency)
Do the test with Claude's help on a new, empty Supabase project, never the live one.
1. Download the newest `db/db-YYYY-MM-DD.tgz.gpg` from the R2 bucket.
2. Open it: `gpg -d db-YYYY-MM-DD.tgz.gpg > db.tgz` (it asks for your passphrase), then `tar xzf db.tgz`.
3. Load it into the new project (Supabase's own steps):
   `psql --single-transaction --variable ON_ERROR_STOP=1 --file dump/roles.sql --file dump/schema.sql --command 'SET session_replication_role = replica' --file dump/data.sql --dbname "<new project's connection string>"`
4. Files: download the bucket's `storage/` folder into `storage-backup`, then run
   `SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… node scripts/backup/restore-storage.mjs` with the new project's values.
5. Point a copy of the site at the new project and check: log in, open My Catalog, download a master, open a signed contract.

## Rebuilding the site
Clone this repo, `bun install`, add the secrets, deploy to Cloudflare (PLAN-cloudflare-hosting.md).
