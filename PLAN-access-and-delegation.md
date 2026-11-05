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
| Stripe (payments) | Administrator | **Restricted API key** (`rk_live_`, per-resource); a Developer seat only for dashboard work (it can pay out and mint live keys) | View Only |
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

## Stripe without handing over the account

Stripe never requires giving anyone your login or ownership. Three levels, tightest first:

1. **Restricted API key (`rk_live_`)** — no dashboard, no account. You pick each resource and set it to None, Read or
   Write (write implies read), so a stolen key can only do what you granted, and you can roll or delete it in seconds.
   Create it in **Developers → API keys → Create restricted key**. Start from zero permissions and add only what a 403
   forces: the server reads prices, products, customers and subscriptions, and writes checkout sessions if it creates
   them. Webhook endpoints are not part of a key — those stay dashboard work for an administrator.
2. **Team member with the Developer role** — dashboard access, can create secret keys (so still broad), cannot invite
   team members or change the account owner. Right for the technical lead who must fix webhooks and read logs; wrong for
   a contractor.
3. **Sandbox-only** — invite someone to sandboxes with no access to the live account, for testing the integration.

### What a Developer seat can actually touch

Stripe's role table is specific here (checked 2026-11-05), and two lines matter:

- **Can:** view balance, view payouts, **pay the balance out to the existing bank account**, create and refund payments,
  view customers, download financial reports, view audit logs, and create live secret keys.
- **Cannot:** add or edit bank account details, edit the payout schedule, invite team members, or change the owner.

So they cannot redirect money to a different account — changing the destination is a dashboard action the role blocks.
They can still push the balance to the bank you already have, and a secret key they mint can do anything the API allows.
That is why the seat is temporary and one-named-person: give it for the length of a dashboard task (webhooks, refunds,
disputes) and remove it afterwards, while the app itself runs on a restricted key with no Payouts permission. Stripe can
require two-step authentication on the account — switch that on before the first invite.

Never hand over the `sk_live_` secret key itself: it grants every API resource and cannot be limited. This project's key
belongs in the Vercel environment variables (or Supabase secrets), never in a message or a file.

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
