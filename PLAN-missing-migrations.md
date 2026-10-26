# PLAN — Missing database updates checklist (as of 2026-10-26) · v1

Status: **Open. Tick each box as you run it.**

All links need you logged in to GitHub (the repo is private). On each file, click **Copy raw file** (two squares, top right), then paste it into Supabase → SQL Editor → Run.

## 1. Find what's missing
- [ ] Run [db-check.sql](https://github.com/quionapeterson-cta/came-through-audio/blob/main/db-check.sql). Each row says **applied** or **MISSING**.
- [ ] Run only the files that say MISSING, top to bottom. Skip the ones that say applied.

## 2. Oct 25 (newest, most likely missing)
- [ ] [20261025090000 founding-upgrades](https://github.com/quionapeterson-cta/came-through-audio/blob/main/supabase/migrations/20261025090000_e4b8c2d6-founding-upgrades.sql) (Founding 100 seats)
- [ ] [20261025100000 agency-exports](https://github.com/quionapeterson-cta/came-through-audio/blob/main/supabase/migrations/20261025100000_f2a9d4c7-agency-exports.sql) (agency export history)
- [ ] [20261025110000 site-media](https://github.com/quionapeterson-cta/came-through-audio/blob/main/supabase/migrations/20261025110000_a3c7e5b9-site-media.sql) (testimonial photo uploads)
- [ ] [20261025120000 task-priority-alerts](https://github.com/quionapeterson-cta/came-through-audio/blob/main/supabase/migrations/20261025120000_b6d2f8a4-task-priority-alerts.sql) (Task Bank priority, deadlines, reminders)
- [ ] [20261025130000 trial-per-email](https://github.com/quionapeterson-cta/came-through-audio/blob/main/supabase/migrations/20261025130000_c8e1a4f7-trial-per-email.sql) (one split sheet trial per email)
- [ ] [20261025140000 brand-kits](https://github.com/quionapeterson-cta/came-through-audio/blob/main/supabase/migrations/20261025140000_d4f9b2e6-brand-kits.sql) (Personal Branding brand kits)
- [ ] [20261025150000 contract-generations](https://github.com/quionapeterson-cta/came-through-audio/blob/main/supabase/migrations/20261025150000_e7a3c1d9-contract-generations.sql) (Contract Generator daily limit)
- [ ] [20261025160000 paid-contracts](https://github.com/quionapeterson-cta/came-through-audio/blob/main/supabase/migrations/20261025160000_f3b8d2a6-paid-contracts.sql) ($3.99 contracts)
- [ ] [20261025170000 launch-department](https://github.com/quionapeterson-cta/came-through-audio/blob/main/supabase/migrations/20261025170000_a9d4e2c7-launch-department.sql) (pre-launch milestones; afterwards Admin → Task Bank → Load pre-launch milestones)
- [ ] [20261025180000 beta-feedback](https://github.com/quionapeterson-cta/came-through-audio/blob/main/supabase/migrations/20261025180000_b3e7f1a5-beta-feedback.sql) (beta checklist results)
- [ ] [20261025190000 outreach-emails](https://github.com/quionapeterson-cta/came-through-audio/blob/main/supabase/migrations/20261025190000_c5f2a8d1-outreach-emails.sql) (outreach email log)
- [ ] [20261025200000 market-research-repeat](https://github.com/quionapeterson-cta/came-through-audio/blob/main/supabase/migrations/20261025200000_d7a1c9e3-market-research-repeat.sql) (Market Research team, repeating tasks)
- [ ] [20261025210000 project-manager-role](https://github.com/quionapeterson-cta/came-through-audio/blob/main/supabase/migrations/20261025210000_e2b6d4f8-project-manager-role.sql) (Project Manager role). **Run this one by itself, then Run the next one separately.**
- [ ] [20261025210100 admin-calendar](https://github.com/quionapeterson-cta/came-through-audio/blob/main/supabase/migrations/20261025210100_f8c3a5e1-admin-calendar.sql) (Admin calendar)
- [ ] [20261025220000 department-plans](https://github.com/quionapeterson-cta/came-through-audio/blob/main/supabase/migrations/20261025220000_a4e8b2d6-department-plans.sql) (department plans)
- [ ] [20261025230000 work-queue](https://github.com/quionapeterson-cta/came-through-audio/blob/main/supabase/migrations/20261025230000_b8d2f6a3-work-queue.sql) (My Queue)

## 3. Oct 24
- [ ] [20261024090000 account-pauses](https://github.com/quionapeterson-cta/came-through-audio/blob/main/supabase/migrations/20261024090000_c5e9a3b7-account-pauses.sql)
- [ ] [20261024100000 renewal-reminders](https://github.com/quionapeterson-cta/came-through-audio/blob/main/supabase/migrations/20261024100000_d7f1b4e2-renewal-reminders.sql)
- [ ] [20261024110000 contracts-grants](https://github.com/quionapeterson-cta/came-through-audio/blob/main/supabase/migrations/20261024110000_e2a8c6f1-contracts-grants.sql)
- [ ] [20261024120000 company-sign-by-link](https://github.com/quionapeterson-cta/came-through-audio/blob/main/supabase/migrations/20261024120000_b9d3f7a2-company-sign-by-link.sql)
- [ ] [20261024130000 royalty-health-reports](https://github.com/quionapeterson-cta/came-through-audio/blob/main/supabase/migrations/20261024130000_f4b8d2e6-royalty-health-reports.sql)
- [ ] [20261024140000 ipi-requests](https://github.com/quionapeterson-cta/came-through-audio/blob/main/supabase/migrations/20261024140000_a6c2e9f3-ipi-requests.sql)
- [ ] [20261024150000 ipi-requests-plus](https://github.com/quionapeterson-cta/came-through-audio/blob/main/supabase/migrations/20261024150000_b8d4f1a7-ipi-requests-plus.sql)
- [ ] [20261024160000 health-report-scope](https://github.com/quionapeterson-cta/came-through-audio/blob/main/supabase/migrations/20261024160000_a7c3e1f9-health-report-scope.sql)

## 4. Oct 23
- [ ] [20261023090000 registration-intake](https://github.com/quionapeterson-cta/came-through-audio/blob/main/supabase/migrations/20261023090000_b3d6f1a8-registration-intake.sql)

## 5. Oct 22
- [ ] [20261022090000 badge-log-and-drops](https://github.com/quionapeterson-cta/came-through-audio/blob/main/supabase/migrations/20261022090000_d5b8f3c1-badge-log-and-drops.sql)
- [ ] [20261022100000 new-departments](https://github.com/quionapeterson-cta/came-through-audio/blob/main/supabase/migrations/20261022100000_e7c2a4b6-new-departments.sql)
- [ ] [20261022110000 support-badge-grants-and-task-bank](https://github.com/quionapeterson-cta/came-through-audio/blob/main/supabase/migrations/20261022110000_f1a9c3d7-support-badge-grants-and-task-bank.sql)
- [ ] [20261022120000 company-plans](https://github.com/quionapeterson-cta/came-through-audio/blob/main/supabase/migrations/20261022120000_a3d6e8f2-company-plans.sql)
- [ ] [20261022130000 masterclass-interest](https://github.com/quionapeterson-cta/came-through-audio/blob/main/supabase/migrations/20261022130000_b8e1d4a2-masterclass-interest.sql)
- [ ] [20261022140000 ai-certificate-credits](https://github.com/quionapeterson-cta/came-through-audio/blob/main/supabase/migrations/20261022140000_c5a9e3f1-ai-certificate-credits.sql)
- [ ] [20261022150000 catalog-lapses](https://github.com/quionapeterson-cta/came-through-audio/blob/main/supabase/migrations/20261022150000_e2b7c9d4-catalog-lapses.sql)
- [ ] [20261022160000 ai-single-songs](https://github.com/quionapeterson-cta/came-through-audio/blob/main/supabase/migrations/20261022160000_f4a8d2c6-ai-single-songs.sql)
- [ ] [20261022170000 company-contracts](https://github.com/quionapeterson-cta/came-through-audio/blob/main/supabase/migrations/20261022170000_a7c3e5f9-company-contracts.sql)

## 6. Older than Oct 22
- [ ] If db-check lists an older file as MISSING, send me its name and I'll add the link here.

## 7. Finish
- [ ] Run [db-check.sql](https://github.com/quionapeterson-cta/came-through-audio/blob/main/db-check.sql) again. Everything should say applied (or ok / check by hand).
- [ ] If anything still says MISSING or a file gives a red error, send me a screenshot or the exact error text.
