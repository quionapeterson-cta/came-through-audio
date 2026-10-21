# PLAN — Company Operations: Finance, Departments, Staff Awards, Training & Global Hiring · v1

Status: **awaiting approval. No code written for anything in this file.**
Builds on PLAN.md (departments, /admin/staff) and PLAN-pricing-badges.md §F (Finance Center).

---

## 1. Finance Center updates

### Vendors to add (all $0 today)
| Vendor | Use | Watch for |
| --- | --- | --- |
| Gmail × 4 (free) | Inboxes for the @camethroughaudio.com addresses, via email routing | No admin console. If a staff member keeps a password, they keep the inbox. |
| Email routing (Cloudflare) | Forwards @camethroughaudio.com to the Gmail inboxes | Forwarding breaks silently if DNS records change |
| cron-job.org (free) | Calls `/api/public/cron/trial-reminders` daily (the 5-day trial-ending email) | If it stops, reminders stop and nobody notices |

### Proposed additions
- **Cron heartbeat tile:** the reminder endpoint records its last run and how many emails it sent. Finance and super admin see "Trial reminders: last run 6 h ago ✓". If no run in 36 h, it shows ⚠️. Turn on cron-job.org's own failure email too.
- **Account ownership register:** for each free account (the 4 Gmails, cron-job.org, Cloudflare): owner, recovery email, 2FA on (yes/no), where the password is kept. Login details are never stored in the app.
- **Upgrade trigger:** when you hire your first non-founder employee, move the inboxes to Google Workspace (about $7 per user per month, verify current price). Then the company owns every inbox and can take access back on someone's last day.

### Should Finance see gross profit? I agree with you: no.
| Finance department sees | Super admin only |
| --- | --- |
| Revenue totals, refunds, Paddle fees (needed to match Paddle payouts to the bank) | Gross and net profit, margins |
| Expense ledger, receipts, fees calendar, upgrade watch | Projections, growth plan, growth slider |
| CSV exports for the accountant | Payroll and individual pay |

This is called separation of duties. The people who record money don't need the strategic numbers. Add one more rule: **Finance records expenses, you approve them.** Nobody approves their own expense.

---

## 2. How big companies run departments, scaled down for CTA

Fortune 500 companies don't win by working harder. They win because every department runs on the same few habits:

| Habit | What it is | CTA version |
| --- | --- | --- |
| **Goals that cascade** (OKRs) | Company goal → department goal → personal goal | 1 company goal per quarter. Each department picks 1–2 measurable results that feed it. |
| **Scorecards** (KPIs) | 3–5 numbers per department, reviewed weekly | Registration: songs registered, rejection rate, days to register. Support: first-reply time, solved %. Finance: books closed by the 5th. |
| **SOPs / playbooks** | Written "how we do it" for every repeat task | Every Task Bank task links to its SOP in the Training area (§4) |
| **RACI** | Who does it, who signs off, who's consulted, who's told | One owner per task. Never "the team". |
| **Operating rhythm** | Fixed meetings with fixed agendas | Daily 10-min async check-in · weekly 30-min scorecard · monthly review · quarterly planning |
| **Internal service levels** | Departments promise each other turnaround times | "Support hands a registration problem to Registration within 1 business day" |
| **Quality sampling** | Audit a % of work, not 100% | Lead re-checks 10% of registrations each week. Quality is what earns badges. |
| **30-60-90 onboarding** | New hires have a written plan for their first 3 months | Built into Training (§4) |
| **Career ladders** | Clear levels and what it takes to move up | Specialist I → II → Senior → Regional Lead, each tied to certifications |
| **Retros** | "What went well, what didn't, what we'll change" | 15 minutes at the end of each month per department |

### Making it easy, fun and productive
- **Easy:** one place for everything (the /admin tabs plus Training). Every task has an owner, a due date and a linked SOP. Checklists beat memory.
- **Fun:** badges (§3), team goals everyone celebrates together, a weekly "win of the week" shout-out, peer kudos.
- **Productive:** reward **quality and outcomes**, never hours or raw volume. If speed is rewarded alone, people rush registrations and the rejection rate climbs.

---

## 3. Staff badge & award system

> **Superseded by PLAN-staff-recognition.md (2026-10-20)**, which covers staff badges, appreciation and the profit-based bonus plan.

It is separate from customer awards and lives in /admin. Gold and Platinum are allowed here, because these are badges (BRANDING.md §1). Reuse the existing badge artwork and celebration animation.

| Type | Examples |
| --- | --- |
| **Certifications** (from Training) | "Certified: The MLC", "Certified: SAMRO", "Region Certified: West Africa" |
| **Quality** | "Clean Sheet": 25 registrations in a row with no rejections · "Detective": found and fixed a conflicting registration |
| **Milestones** | 100 / 500 / 1,000 accepted registrations (Gold at 500, Platinum at 1,000) |
| **Service** | "Fast Friend": support replies under 2 h for a whole month |
| **Team** | Whole department wins when its quarterly goal is hit |
| **Peer kudos** | Each person can give 3 kudos a week, with a reason. Five kudos make a badge. |
| **Tenure** | 90 days, 1 year, 2 years |

Rules:
- **No staff awards for late-night or overtime work.** Unlike the customer "Marathon" award, rewarding staff for long hours encourages burnout and creates overtime-pay risk.
- Badges are earned from real records (accepted registrations, closed tickets, completed courses), never self-claimed, so they can't be gamed.
- Optional later: badges count toward the career ladder or a small quarterly bonus.

Schema sketch: `staff_award_defs (id, name, kind, rule, tier)` and `staff_awards (user_id, award_id, earned_at, evidence_ref)`. They are granted by server functions only; staff can read their own; leads read their department.

---

## 4. Onboarding & Training area (/admin/training)

### Structure
- **Level 1: Company core (everyone, week 1):** mission and brand rules · how the site works (Embed Metadata, My Catalog, readiness rules, split sheets, contracts, AI Protection Hub, Health Checklist) · privacy and data handling (PRO/IPI never in MP3s, least access) · using /admin and the Task Bank.
- **Level 2: Department tracks:** Registration, Royalty Accounts, Finance, Branding, Marketing & Sales, Support, HR. Each is built from that department's SOPs.
- **Level 3: Collection agency library (worldwide):** one module per society. Every module uses the same template:
  1. What it collects (performance, mechanical, neighbouring rights, digital)
  2. Who can join, and the cost
  3. How works are registered (portal, CWR file, bulk sheet)
  4. Required fields and how they map to CTA writer fields (legal name, role, PRO, IPI, share)
  5. Payout schedule and typical delays
  6. Common rejection reasons and how to fix them
  7. Partner societies abroad (reciprocal agreements)
  8. Official links, plus a "last verified" date. Every module is re-checked every 6 months.
- Each module ends with a short quiz, and passing earns the certification badge.
- **30-60-90 plan:** 30 days: Level 1 + department track. 60 days: first region certified, work double-checked. 90 days: works independently, with only the normal 10% sampling.

### Region library (first draft, every entry gets verified before publishing)
| Region | Societies to cover |
| --- | --- |
| **Global basics** | CISAC, IPI and ISWC numbers, ISRC, CWR, how reciprocity works, publishing vs master rights |
| **USA** | ASCAP, BMI, SESAC, GMR, The MLC, SoundExchange, HFA |
| **Canada** | SOCAN, CMRRA, Re:Sound, CONNECT |
| **Latin America** | SACM (Mexico), ECAD + UBC/ABRAMUS (Brazil), SADAIC (Argentina), SAYCO (Colombia), SCD (Chile) |
| **UK & Ireland** | PRS for Music (PRS + MCPS), PPL, IMRO |
| **Europe** | GEMA + GVL (Germany), SACEM (France), SGAE (Spain), SIAE (Italy), Buma/Stemra (Netherlands), STIM / TONO / KODA / Teosto (Nordics) |
| **Africa** | SAMRO, CAPASSO, SAMPRA (South Africa) · MCSN and other CMOs (Nigeria; approvals have changed, verify the current status) · GHAMRO (Ghana) · MCSK, KAMP, PRISK (Kenya) · UPRS (Uganda) · COSOTA (Tanzania) · SODAV (Senegal) · BURIDA (Côte d'Ivoire) · BMDAV (Morocco) |
| **Middle East** | ACUM (Israel), plus the newer Gulf societies (research needed) |
| **Asia-Pacific** | JASRAC + NexTone (Japan), KOMCA (Korea), MCSC (China), IPRS + PPL India, FILSCAP (Philippines), APRA AMCOS + PPCA (Australia/NZ) |

Schema sketch: `training_courses (id, level, department, region, title)`, `training_lessons (course_id, order, body, sources, verified_on)`, `training_progress (user_id, lesson_id, completed_at, quiz_score)`. Lessons are edited in /admin by leads, with no code changes needed.

---

## 5. Worldwide hiring plan: regional registration experts

### Before hiring: one legal check
Most societies only accept registrations from the writer, their publisher or an authorised administrator. Before staff register works for customers, CTA needs a **customer authorisation** (an administration agreement or letter of direction) that a lawyer has reviewed. The customer signs it in-app, using the existing contracts feature. This is the most important item in this section.

### Phases
| Phase | When | Who |
| --- | --- | --- |
| **0: Prove demand** | Now | You, plus the Training library. Tag every customer song with its territories so the data shows where customers need help. |
| **1: First regional contractors** | When a region reaches about 50 songs a month waiting | Part-time contractors in your top 2 regions (likely Africa (Nigeria/Ghana/South Africa) and the UK/EU, which the data will confirm) |
| **2: Regional leads** | When a region needs about 2 contractors | 1 lead per region who owns quality sampling and keeps that region's Training modules up to date |
| **3: Coverage** | Ongoing | Latin America, Asia-Pacific and the Middle East, in order of demand |

### How to hire
- **Use an employer-of-record / contractor platform** (e.g. Deel, Remote, Oyster). It handles local contracts, payment and tax forms, and lowers the risk of misclassifying a worker in another country.
- **Profile:** 2+ years of hands-on registration experience with that region's societies, the local language, references from a label, publisher or admin company.
- **Paid test task:** a mock catalog of 5 songs with planted errors (missing IPI, splits not adding up, an Author/Composer counted wrong). Candidates find and fix the errors, then explain how each song would be registered locally.
- **Pay:** an hourly or per-accepted-registration rate, plus a quality bonus. Never pay purely per submission.
- **Access:** add a `regions text[]` field next to `departments` on `user_roles`, so a specialist only sees songs in their territory (same pattern as in_department).
- **Data protection:** EU/UK staff who access customer data need a data-processing agreement (GDPR). Contractors sign an NDA, use 2FA and get company-owned inboxes (Google Workspace, §1).

### Interview scorecard (1–5 each)
Registration accuracy (test task) · knowledge of local societies · written English for SOPs · attention to detail · reliability (references) · culture fit (clear, kind and fast with artists).

---

## Questions for you
1. Finance: is the table in §1 right? Should Finance also see the cron heartbeat tile?
2. Staff awards: badges only, or tied to a quarterly bonus later?
3. Training: build the platform first with the Global basics + USA modules, then add regions in order?
4. Hiring: which two regions do you expect first? I'll add territory tagging so the data can confirm it.
5. Do you have a lawyer for the customer authorisation agreement in §5?

Suggested build order once approved: Finance updates → Training area (Level 1 + USA) → Staff awards → `regions` + territory tagging → hiring.
