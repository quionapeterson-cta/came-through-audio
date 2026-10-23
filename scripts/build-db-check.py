#!/usr/bin/env python3
"""Builds db-check.sql: one query that says, for every file in supabase/migrations, whether the database already has
what it creates (applied) or not (MISSING, with the first thing not found). Run from the repo root:
    python3 scripts/build-db-check.py
Paste the WHOLE db-check.sql into the Supabase SQL editor and run it; run every MISSING file, oldest first.
The project's migrations are pasted by hand, so supabase_migrations can't tell us; this checks the objects themselves:
tables, columns, functions (and the newest body of each), policies, check constraints and table grants."""
import glob, os, re

FILES = sorted(glob.glob("supabase/migrations/*.sql"))
q = lambda x: "'" + x.replace("'", "''") + "'"
ident = r'"?([A-Za-z_][\w]*)"?'

def strip_comments(sql):
    return re.sub(r"--[^\n]*", "", sql)

def function_bodies(sql):
    """(name, body) for each CREATE [OR REPLACE] FUNCTION public.name(...) ... AS $tag$ body $tag$."""
    out = []
    for m in re.finditer(r"CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+(?:public\.)?" + ident + r"\s*\(", sql, re.I):
        rest = sql[m.end():]
        d = re.search(r"AS\s+(\$\w*\$)", rest, re.I)
        if not d:
            continue
        tag = d.group(1)
        end = rest.find(tag, d.end())
        out.append((m.group(1), rest[d.end():end] if end > 0 else ""))
    return out

# The newest file that defines each function: only its body is checked, since later files replace earlier bodies.
latest_fn = {}
for f in FILES:
    for name, _ in function_bodies(strip_comments(open(f).read())):
        latest_fn[name.lower()] = f

# Later files that drop or redefine a policy, function or constraint make the earlier file's version disappear, so
# only the newest definition is checked.
def later(f, pattern):
    return any(re.search(pattern, strip_comments(open(g).read()), re.I) for g in FILES if g > f)

def checks(f):
    sql = strip_comments(open(f).read())
    out = []  # (label, boolean SQL)
    for t in re.findall(r"CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?" + ident, sql, re.I):
        out.append((f"table {t}", f"to_regclass({q('public.' + t)}) IS NOT NULL"))
    for m in re.finditer(r"ALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?(?:ONLY\s+)?(?:public\.)?" + ident + r"(.*?);", sql, re.I | re.S):
        table, body = m.group(1), m.group(2)
        for c in re.findall(r"ADD\s+COLUMN\s+(?:IF\s+NOT\s+EXISTS\s+)?" + ident, body, re.I):
            out.append((f"column {table}.{c}", f"EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = {q(table)} AND column_name = {q(c)})"))
        for name, rule in re.findall(r"ADD\s+CONSTRAINT\s+" + ident + r"\s+CHECK\s*\((.*)\)", body, re.I | re.S):
            vals = re.findall(r"'([^']+)'", rule)
            if vals and not later(f, r"(ADD|DROP)\s+CONSTRAINT\s+(IF\s+EXISTS\s+)?\"?" + re.escape(name) + r"\b"):
                out.append((f"constraint {name}", f"EXISTS (SELECT 1 FROM pg_constraint WHERE conname = {q(name)} AND pg_get_constraintdef(oid) LIKE {q('%' + vals[-1] + '%')})"))
    for name, body in function_bodies(sql):
        if later(f, r"DROP\s+FUNCTION\s+(IF\s+EXISTS\s+)?(public\.)?" + re.escape(name) + r"\s*\("):
            continue
        out.append((f"function {name}", f"EXISTS (SELECT 1 FROM pg_proc WHERE proname = {q(name.lower())} AND pronamespace = 'public'::regnamespace)"))
        if latest_fn.get(name.lower()) == f:
            lines = [l.strip() for l in body.splitlines() if 30 <= len(l.strip()) <= 200 and "'" not in l and "\\" not in l]
            if lines:
                line = max(lines, key=len)
                out.append((f"newest version of {name}", f"EXISTS (SELECT 1 FROM pg_proc WHERE proname = {q(name.lower())} AND pronamespace = 'public'::regnamespace AND prosrc LIKE {q('%' + line.replace('%', '_') + '%')})"))
    for p, schema, t in re.findall(r"CREATE\s+POLICY\s+\"([^\"]+)\"\s+ON\s+(?:(\w+)\.)?" + ident, sql, re.I):
        if later(f, r"DROP\s+POLICY\s+(IF\s+EXISTS\s+)?\"" + re.escape(p) + r"\""):
            continue
        schema = schema or "public"
        out.append((f"policy {p}", f"EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = {q(schema)} AND tablename = {q(t)} AND policyname = {q(p)})"))
    for privs, tables, role in re.findall(r"GRANT\s+([A-Z, ]+?)\s+ON\s+(?:TABLE\s+)?((?:public\.)?\w+(?:\s*,\s*(?:public\.)?\w+)*)\s+TO\s+(\w+)", sql, re.I):
        if "FUNCTION" in tables.upper() or privs.upper().strip() in ("EXECUTE", "USAGE"):
            continue
        for t in re.split(r"\s*,\s*", tables):
            t = t.replace("public.", "")
            # Only SELECT is checked: some files grant broadly, then revoke writes.
            if not re.search(r"\b(SELECT|ALL)\b", privs, re.I):
                continue
            priv = "SELECT"
            out.append((f"{priv} grant on {t} to {role}", f"coalesce(has_table_privilege({q(role)}, to_regclass({q('public.' + t)}), {q(priv)}), false)"))
    # One check per label, in file order.
    seen, uniq = set(), []
    for label, expr in out:
        if label not in seen:
            seen.add(label); uniq.append((label, expr))
    return uniq

rows = []
for f in FILES:
    name = os.path.basename(f)
    cs = checks(f)
    if not cs:
        rows.append(f"({q(name)}, NULL::text, 'nothing to check automatically: open the file to confirm')")
        continue
    missing = " ".join(f"WHEN NOT {expr} THEN {q(label)}" for label, expr in cs)
    rows.append(f"({q(name)}, CASE {missing} ELSE NULL END, {q(f'{len(cs)} checks')})")

sql = f"""-- Came Through Audio: which migrations has this database already got? Generated by scripts/build-db-check.py.
-- Copy the WHOLE file (Ctrl+A, Ctrl+C), paste into the Supabase SQL editor and Run. It only reads; it changes nothing.
-- Run every MISSING file from supabase/migrations, oldest first, then run this again.
SELECT migration,
       CASE WHEN missing IS NULL AND note LIKE 'nothing%' THEN 'check by hand' WHEN missing IS NULL THEN 'applied' ELSE 'MISSING' END AS status,
       coalesce('not found: ' || missing, note) AS details
FROM (VALUES
  {(","+chr(10)+"  ").join(rows)}
) AS m(migration, missing, note)
ORDER BY (missing IS NULL), migration;
"""
open("db-check.sql", "w").write(sql)
print(f"db-check.sql: {len(FILES)} migrations")
