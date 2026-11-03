/**
 * Pre-launch milestones (PLAN-phase4-order item 1, approved 2026-10-25): the founder's to-do list (PLAN-founder-todo.md)
 * as Task Bank tasks in the super-admin-only "launch" department, with importance and deadlines so the sign-in alerts
 * and reminders work on them. Loaded once from Admin → Task Bank; titles already there are skipped.
 *
 * Dates revised 2026-11-03: build frozen Thu Nov 5, self-testing Nov 5–15, beta Mon Nov 16 – Thu Dec 3, hosting move
 * the week of Dec 7 (Lovable Pro extended one month, so it lapses Dec 11). Editing a date here does NOT update a task
 * that is already in the Task Bank — those dates get edited by hand.
 */
export type Milestone = { title: string; importance: "top" | "high" | "normal" | "low"; due: string | null; body: string };

const at = (d: string) => `${d}T17:00:00.000Z`; // noon Eastern

export const LAUNCH_MILESTONES: Milestone[] = [
  { title: "Run db-check.sql and every MISSING migration", importance: "top", due: at("2026-11-05"), body: "Supabase → SQL Editor. Links and order in PLAN-founder-todo.md §2. Then refresh Admin → Plans with plans-load.sql." },
  { title: "Find CRON_SECRET and add the hourly Task reminders cron job", importance: "high", due: at("2026-11-05"), body: "cron-job.org: POST /api/public/cron/task-reminders every hour with Authorization: Bearer CRON_SECRET (PLAN-founder-todo.md §4)." },
  { title: "Stripe sandbox: create branding_yearly ($13.99) and contract_generator ($3.99)", importance: "high", due: at("2026-11-06"), body: "One-time prices with those exact lookup keys. Test both checkouts with card 4242." },
  { title: "Add Cloudflare AI secrets for the Contract Generator", importance: "normal", due: at("2026-11-06"), body: "CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_AI_TOKEN in Lovable → Cloud → Secrets." },
  { title: "Create billing@ mailbox and set it as Stripe's support and receipts email", importance: "high", due: at("2026-11-06"), body: "Billing emails send from it; refund requests go to it." },
  { title: "Supabase: minimum password length 12", importance: "normal", due: at("2026-11-06"), body: "Matches the sign-up form." },
  { title: "Stripe settings: renewal emails off, portal cancel off, Terms and Privacy links in Checkout", importance: "high", due: at("2026-11-06"), body: "Our own emails and cancel offers handle these." },
  { title: "Extend Lovable Pro one month so hosting lasts to Dec 11", importance: "top", due: at("2026-11-10"), body: "Lovable → Settings → Billing → extend one month. Without it the site and camethroughaudio.com go dark on Nov 11, five days before beta starts on Nov 16." },
  { title: "Publish and run the full test list", importance: "high", due: at("2026-11-05"), body: "PLAN-founder-todo.md §6. Build freeze Thu Nov 5; self-testing and debugging run Nov 5–15 and learnings go back into the build. Send exact error text for anything that breaks." },
  { title: "Lawyer review: blueprints, company agreements, AI certificate wording, Registration Authorization, disclaimers, Terms", importance: "top", due: at("2026-11-12"), body: "Needed before testers are invited on Nov 13: the Beta Tester Agreement carries the beta dates. All disclaimer wording is in src/lib/disclaimers.ts; Terms §7–16." },
  { title: "Beta testing ready: agreement, testers invited, checklist page", importance: "high", due: at("2026-11-13"), body: "Beta runs 3 weeks from Mon Nov 16 (Nov 16 – Dec 3, Mon–Thu 12–2 PM; Thanksgiving is Thu Nov 26). Invite testers by Fri Nov 13." },
  { title: "Backups running and one test restore done", importance: "high", due: at("2026-11-13"), body: "Weekly database and file backup (Phase 4 item 2). Done before beta, so tester data is covered from day one." },
  { title: "Move hosting to Cloudflare", importance: "top", due: at("2026-12-07"), body: "PLAN-cloudflare-hosting.md: secrets (incl. the 2 Cloudflare AI ones), Stripe webhook URLs, the 4 cron job URLs. Week of Dec 7, after beta ends Dec 3 and before Lovable lapses Dec 11." },
  { title: "Point camethroughaudio.com at the site and switch every link to it", importance: "top", due: at("2026-12-07"), body: "Then tell Claude to switch SITE_URL so emails and certificates use the domain. Same week as the move." },
  { title: "Stripe live: lookup keys, live secret key and webhook", importance: "top", due: at("2026-12-10"), body: "All lookup keys from PLAN-founder-todo.md §3 on the live account." },
  { title: "Run the security scan once more", importance: "high", due: at("2026-12-10"), body: "Fix anything it finds before launch." },
  { title: "Representative logins for SoundExchange Direct and The MLC Portal", importance: "high", due: at("2026-12-10"), body: "Needed for Expert Registration Assistance." },
  { title: "Confirm the ISRC registrant ($95) terms with ISRC Manager", importance: "normal", due: null, body: "" },
  { title: "Send the new app icon", importance: "normal", due: null, body: "Claude makes every size (home screen, browser tab)." },
  { title: "Replace the placeholder badge art", importance: "normal", due: null, body: "19 customer and 33 staff badges, file names in PLAN-badge-art-placeholders.md." },
  { title: "Turn on STRIPE_TAX once Stripe Tax is active", importance: "low", due: null, body: "" },
  { title: "Launch day: grant launch gifts", importance: "normal", due: null, body: "Admin → Company Contracts → Launch gifts, for every signed testimonial release." },
  { title: "Launch day: remove the passcode gate and let search engines in", importance: "top", due: null, body: "Tell Claude on launch day." },
];
