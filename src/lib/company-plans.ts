/**
 * The plans the super admins read in Admin → Plans. The text lives twice: as `PLAN-*.md` in the repository (the copy
 * that changes with a commit) and as rows in `public.company_plans` (the copy loaded by hand from plans-load.sql).
 * The repository copy wins wherever a slug exists in both, so the tab never shows an older paste while main has a
 * newer plan (founder, 2026-11-25). Nothing here imports server code: the panel uses these helpers too.
 */
export type CompanyPlan = {
  slug: string;
  title: string;
  status: string;
  body: string;
  /** The `PLAN-*.md` the text came from, or null when the row was only ever loaded into the database. */
  file: string | null;
  updated_at: string | null;
};

/** `PLAN-foo.md` → `plan-foo`: the same slug `scripts/build-plans-sql.py` writes into the table. */
export function planSlug(file: string): string {
  const name = file.replace(/^.*[\\/]/, "");
  return name.replace(/\.md$/i, "").toLowerCase();
}

/**
 * The title and status the loader reads out of a document: the first `# ` line, with the `PLAN — ` prefix and the
 * `· vN` suffix removed, and the `Status:` line without its bold markers. Kept identical to build-plans-sql.py so the
 * tab reads the same whichever copy it shows.
 */
export function planHeading(body: string, slug: string) {
  const heading = /^#\s+(.+)$/m.exec(body)?.[1]?.trim();
  const title = (heading ?? slug)
    .replace(/^PLAN\s*[—:-]\s*/, "")
    .replace(/\s*·\s*v\d+.*$/, "")
    .trim();
  const status = (/^Status:\s*(.*)$/m.exec(body)?.[1] ?? "").replace(/\*\*/g, "").trim();
  return { title: title || slug, status };
}

export function planFromDoc(file: string, body: string): CompanyPlan {
  const slug = planSlug(file);
  const { title, status } = planHeading(body, slug);
  return { slug, title, status, body, file: file.replace(/^.*[\\/]/, ""), updated_at: null };
}

/**
 * Repository plans first, then any row the table holds that the repository does not, all sorted by title. A slug in
 * both keeps the repository's text and the row's `updated_at`, so the tab still dates a plan it now reads from git.
 */
export function mergePlans(repo: CompanyPlan[], stored: CompanyPlan[]): CompanyPlan[] {
  const dated = new Map(stored.map((row) => [row.slug, row.updated_at]));
  const merged = new Map<string, CompanyPlan>();
  for (const plan of repo) {
    merged.set(plan.slug, { ...plan, updated_at: dated.get(plan.slug) ?? null });
  }
  for (const row of stored) {
    if (!merged.has(row.slug)) merged.set(row.slug, { ...row, file: row.file ?? null });
  }
  return [...merged.values()].sort((a, b) => a.title.localeCompare(b.title));
}
