# Access & Delegation Plan

Founder, 2026-11-05: "lets set up properly just in case I'm working or other things and need to have someone else
get the art uploaded." This file is the record of who holds which seat, what each seat can do, and what happens when
the founder is unavailable. It is a procedure, not code: the platforms below are granted in their own dashboards.

## The three seats

| # | Seat | Who | Purpose |
|---|------|-----|---------|
| 1 | Owner / root | Founder | Holds every account and the billing. The only seat that can delete data or transfer ownership. |
| 2 | Technical lead | One named person | Deploys, migrations, secrets, badge art in R2. The person who can fix a broken deploy without waking the founder. |
| 3 | Security lead | One named person (may be the same as #2 while the team is small) | Audit, incident response, revoke access. Read-heavy by default. |

Nobody else gets infra access. Branding, Marketing, Support, HR and Finance use the app (Admin panels) and never the
accounts behind it. Adding a fourth infra seat needs a written reason in this file.

## Who holds what, platform by platform

| Platform | Founder | Technical lead | Security lead |
|---|---|---|---|
| Cloudflare (DNS, R2) | Super Administrator, account owner | **Administrator** (or, preferred, a scoped API token: R2 Object Read & Write on the art bucket only) | Read Only |
| Supabase (database, auth, storage) | Organization Owner | Developer on the project (SQL editor, migrations, storage policies) | Read Only where offered; otherwise audit via logs |
| Stripe (payments) | Administrator | Developer (API keys, webhooks, products) — never the live secret key pasted anywhere | Analyst / View Only |
| Vercel (hosting, deploys) | Owner | Member with Developer role on this project | Viewer |
| GitHub (repository) | Organization Owner | Write access to `came-through-audio` | Security manager |
| Domain registrar | Registrant | Technical contact only | — |
| Email (founder's mailbox) | Sole holder | — | — |

Rules that hold for every platform:

- **Named accounts, never a shared login.** Every action must be attributable to one person.
- **2FA with an authenticator app**, not SMS. Each holder keeps their own recovery codes.
- **Least privilege.** Start at the lowest role that does the job; a read-only seat is usually enough for security.
- **Quarterly review.** Re-check this table every quarter and after any departure.
- **No credentials in the repo, chat, or a commit.** `.env` and `.vercel-token` are gitignored; that is a safety net,
  not a licence to add more.

## Letting someone else get the art uploaded

Two halves — one in Cloudflare, one in the app.

### Cloudflare (the bucket)

1. Create the API token at **My Profile → API Tokens → Create Token → Custom token**.
2. Permissions: **Workers R2 Storage → Edit**, and nothing else. Resource: **Include → specific bucket** — the badge art
   bucket only, never "all buckets".
3. Set a TTL (90 days is reasonable) and hand the token over through a password manager, never email or chat.
4. R2 dashboard access, if the person also needs to browse objects: Cloudflare **Manage Account → Members → Invite**,
   role **Administrator**. That is broader than the token above, so prefer the token for routine art uploads.

### The app (the approval side)

Today only the founder can approve a badge idea or mark its art uploaded (`public.is_founder`, claimed once in
Admin → Badges → Badge Protocol). That is deliberate, but it also means a badge stalls while the founder is away.
The fix is a **deputy seat**: the founder names one staff member, and that person can approve and mark uploaded only
while the founder has the delegation switched on. Revoking is one click and takes effect immediately. Until that seat
exists, the workaround is the founder approving over mobile — the panel is usable from a phone.

### Naming still applies

Whoever uploads, the rules do not change: 512×512 WebP under 120 KB at `icons/<serious|playful>/[<set>/]<slug>.webp`,
the 4K PNG master in `4k/icons/…/<slug>.png`, slug from `src/lib/badge-protocol.ts`, and one earned run before a badge
ships. A deputy uploading is a second pair of hands, not a second standard.

## When the founder is unavailable

- **Art needs to go up:** the technical lead uses the scoped R2 token and the key the queue prints, then marks the
  submission uploaded (once the deputy seat exists; until then the founder does the last click).
- **A deploy is broken:** the technical lead has Vercel Developer access and can roll back without the founder.
- **A payment or login is broken:** the technical lead holds Stripe Developer and Supabase Developer seats.
- **Something looks compromised:** the security lead revokes sessions and tokens first, then reports. Revocation does not
  wait for the founder.

## Break-glass (founder account lost or locked out)

1. Recovery codes are printed and stored offline, plus a second 2FA device held by the technical lead.
2. Cloudflare: the technical lead's Administrator seat can remove a lost 2FA device or add a new member.
3. Supabase: another organization Owner can restore access; if the founder is the only Owner, the technical lead is
   promoted through Supabase support with billing proof.
4. If the founder's *account* (not the platform) is what is lost, badge approval can be restored by writing one row
   manually in the Supabase SQL editor:
   ```sql
   DELETE FROM public.founder_access;
   INSERT INTO public.founder_access (user_id) VALUES ('<the new account uuid>');
   ```
   That is the only supported way to move the seat, and it needs SQL editor access — which is why seat #2 exists.

## Offboarding checklist

In this order, on the day someone leaves:

1. GitHub: remove from the organization and the repository.
2. Vercel: remove from the team; check for deploy hooks and environment variables they created.
3. Supabase: remove from the organization; review recent SQL and storage policy changes.
4. Stripe: remove the team member and **roll any API key they could see**.
5. Cloudflare: remove the member, **delete their API tokens**, and rotate the R2 token if it was shared.
6. Re-check this file's table and commit the update.

## Open items

- Name the technical lead and security lead, then invite them to the seats above.
- Decide on the deputy seat for badge approval (who, and whether it is approval-only or approval plus upload).
- Revoke the Vercel token left in `.vercel-token` from the deployment cleanup; nothing needs it now that storage is 0 B.
