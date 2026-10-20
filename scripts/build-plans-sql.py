#!/usr/bin/env python3
"""Builds plans-load.sql from the local PLAN-*.md files for Admin → Plans. Run from the repo root: python3 scripts/build-plans-sql.py
The output holds the plan text, so it stays out of git (.git/info/exclude)."""
import glob, re
out=["-- Loads every PLAN-*.md into Admin → Plans (super admins only). Generated locally; never commit this file.",
     "-- Run after migration 20261022120000. Safe to run again: it replaces each plan with the latest text."]
for f in sorted(glob.glob("PLAN*.md")):
    body=open(f).read()
    slug=f[:-3].lower()
    m=re.search(r"^#\s+(.*)$",body,re.M); title=m.group(1) if m else slug
    title=re.sub(r"^PLAN\s*[—:-]\s*","",title).strip()
    title=re.sub(r"\s*·\s*v\d+.*$","",title).strip()
    st=re.search(r"^Status:\s*(.*)$",body,re.M); status=(st.group(1) if st else "").replace("**","").strip()
    tag="$plan$"
    assert tag not in body
    q=lambda x: "'"+x.replace("'","''")+"'"
    out.append(f"INSERT INTO public.company_plans (slug, title, status, body, updated_at) VALUES ({q(slug)}, {q(title)}, {q(status)}, {tag}{body}{tag}, now())\n"
               "ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title, status = EXCLUDED.status, body = EXCLUDED.body, updated_at = now();")
open("plans-load.sql","w").write("\n\n".join(out)+"\n")
print(len(out)-2,"plans")
