# PLAN — Move hosting from Lovable to Cloudflare (free) · v1

Status: **Code ready 2026-10-23. Founder follows the steps below, ideally the week of Nov 3 (Lovable Pro ends 2026-11-11), while Lovable hosting still works as a backup.**
Source: founder, 2026-10-21 and 2026-10-23 (Lovable Pro ends Nov 11; no budget after; Cloudflare is free for this size).

---

## What's already done in the code
- The app already builds as a Cloudflare Worker (`npm run build` makes `.output/`; `npx wrangler deploy` publishes it).
- The public settings (Supabase URL and publishable key, Stripe publishable keys) are in the repo's `.env` files, so Cloudflare picks them up when it builds.
- **Stripe:** set your own Stripe secret keys (below) and payments go straight to Stripe. Until you set them, they keep going through Lovable's connector, so nothing changes until you're ready.
- Daily jobs stay on cron-job.org. Once the domain points to Cloudflare, the same URLs keep working.

## What you'll need (collect these first)
| Name in Cloudflare | Where to get it |
| --- | --- |
| `SUPABASE_URL` | Supabase → Project Settings → API (Project URL) |
| `SUPABASE_PUBLISHABLE_KEY` | Supabase → Project Settings → API keys (publishable / anon) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API keys (secret / service_role). **Never share it.** |
| `RESEND_API_KEY` | Resend → API Keys → Create (Sending access, camethroughaudio.com) |
| `SESSION_SECRET` | The same value as in Lovable (Cloud → Secrets) if you can see it. If not, make a new long random one (see note 1). |
| `SITE_PASSWORD` | Your pre-launch passcode for /unlock |
| `CRON_SECRET` | The same value cron-job.org sends after "Bearer ". If unknown, make a new one and update the 3 cron jobs. |
| `STRIPE_SANDBOX_SECRET_KEY` | Stripe (sandbox selected) → Developers → API keys → Secret key `sk_test_…` |
| `STRIPE_LIVE_SECRET_KEY` | Stripe (live account) → Developers → API keys → Secret key `sk_live_…` (when you go live) |
| `PAYMENTS_SANDBOX_WEBHOOK_SECRET` | Made in step 4 (`whsec_…`) |
| `PAYMENTS_LIVE_WEBHOOK_SECRET` | Made in step 4, on the live account |

**Note 1, SESSION_SECRET:** it signs the pre-launch gate, company signing links and invite opt-out links. A new value means everyone types the passcode again, and company signing links already sent stop working (just click Resend on those).
**Note 2:** nothing else uses Lovable after the move. The AI draft-date scan was removed on 2026-10-23 (artists can type their draft dates as an optional note instead).

## Steps
1. **Create the Worker.** Cloudflare dashboard (free account) → Workers & Pages → Create → **Import a repository** → GitHub → `came-through-audio`.
   - Build command: `npm run build` · Deploy command: `npx wrangler deploy` · Root directory: `/`.
2. **Add the secrets.** Your Worker → Settings → **Variables and Secrets** → add each name from the table as type **Secret**. Then Deployments → **Retry / Deploy** so it builds with them.
3. **Test on the free address** Cloudflare gives you (`…workers.dev`):
   - In Supabase → Authentication → URL Configuration, add `https://<your-worker>.workers.dev/**` to Redirect URLs (so sign-in and password resets work there).
   - Open it: /unlock with the passcode, sign in, open My Catalog, open a contract.
4. **Stripe webhooks** (Stripe → Developers → Webhooks → Add endpoint), one per account:
   - Sandbox: `https://<your-worker>.workers.dev/api/public/payments/webhook?env=sandbox` · Live: `…?env=live`.
   - Events: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`, `charge.refunded`.
   - Copy each endpoint's **Signing secret** (`whsec_…`) into the matching `PAYMENTS_…_WEBHOOK_SECRET`, redeploy, then buy a plan with card 4242 4242 4242 4242 and check it unlocks.
5. **Move the domain.** Cloudflare → Add a site → `camethroughaudio.com` (Free plan) → change the nameservers at your domain registrar to the two Cloudflare gives you. **Before switching, check your email records** (MX, Resend's DKIM/SPF) were copied over, so email keeps working.
   - Then Worker → Settings → Domains & Routes → Add **Custom domain** `camethroughaudio.com` (and `www`).
   - Stripe webhooks: change the URLs from `workers.dev` to `https://camethroughaudio.com/api/public/payments/webhook?env=…`.
   - Supabase → Authentication → URL Configuration: Site URL `https://camethroughaudio.com`.
6. **Disconnect the domain in Lovable** (Project → Settings → Domains) once Cloudflare serves it. Keep the Lovable project and GitHub connection: edits there still push to GitHub, and Cloudflare deploys every push.

## After the move
- Every push to `main` deploys automatically (about 2 minutes). Lovable's Publish button no longer matters.
- cron-job.org needs no change if the domain is the same.
- If something breaks, point the domain back to Lovable (before Nov 11) while we fix it.
