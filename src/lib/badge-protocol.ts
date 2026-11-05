/**
 * The badge art protocol (founder, 2026-11-05).
 *
 * Branding, Marketing & Social Media and Support design badges; a super admin approves every one before it exists; and
 * the founder is the only person who uploads art to the R2 bucket, because the bucket's keys are his alone. This module
 * holds the naming rule, the keys that rule produces and the steps each side follows, so the admin panel, the server
 * check and the tests all agree on one set of conditions.
 */

export const BADGE_SCOPES = ["serious", "playful"] as const;
export type BadgeScope = (typeof BADGE_SCOPES)[number];

/** The bucket mirrors the repo: web copies at the root, 4K masters under `4k/`. The app never requests the masters. */
export const WEB_ROOT = "icons";
export const MASTER_ROOT = "4k/icons";

/** Lowercase words joined by single hyphens, starting with a letter: `holiday-2026`, `first-placement`. */
export const SLUG_PATTERN = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
export const MAX_SLUG = 48;

/** Why this name breaks the rule, or null when it is good. One sentence, in the words the panel shows. */
export function slugProblem(slug: string): string | null {
  if (!slug.trim()) return "Give the badge a name first.";
  if (slug.length > MAX_SLUG) return `Keep the name to ${MAX_SLUG} characters or fewer.`;
  if (SLUG_PATTERN.test(slug)) return null;
  if (/[A-Z]/.test(slug)) return "Lowercase only: no capitals.";
  if (/[\s_]/.test(slug)) return "Use hyphens, never spaces or underscores.";
  if (/--/.test(slug)) return "Use single hyphens, never doubles.";
  if (/^-/.test(slug)) return "Start with a letter, not a hyphen.";
  return "Letters, numbers and single hyphens only.";
}

/** The bucket key a title becomes: `Holiday 2026` → `holiday-2026`. */
export function badgeSlug(title: string): string {
  return title
    .normalize("NFKD")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, MAX_SLUG)
    .replace(/^-+|-+$/g, "");
}

/**
 * A set folder is named by the same rule, so a batch of badges sorts together in the bucket. People type it naturally
 * ("Badge Drops") and it becomes `badge-drops`; only a folder that can't be named at all is a problem.
 */
export function setFolderProblem(set: string): string | null {
  if (!set.trim()) return null;
  return slugProblem(badgeSlug(set));
}

/**
 * Exactly where the two files go. The founder copies these keys into the R2 dashboard; nothing in the app builds a
 * bucket path by hand (see `artUrl()`), so a wrong key would ship a broken picture.
 */
export function badgeKeys(o: { scope: BadgeScope; slug: string; set?: string | null }): { web: string; master: string } {
  const set = badgeSlug(o.set ?? "");
  const folder = set ? `${o.scope}/${set}` : o.scope;
  return {
    web: `${WEB_ROOT}/${folder}/${o.slug}.webp`,
    master: `${MASTER_ROOT}/${folder}/${o.slug}.png`,
  };
}

/** The two files a badge needs, and what "web-ready" means. Shown under the naming rule. */
export const FILE_RULES = [
  { file: "Web copy", spec: "512 × 512 px, transparent WebP, 120 KB or smaller, named <slug>.webp" },
  { file: "4K master", spec: "The full-resolution original, transparent PNG, named <slug>.png (never requested by the app)" },
] as const;

/** The naming conditions, in the order the panel lists them. */
export const NAMING_RULES = [
  { rule: "Lowercase", detail: "No capitals anywhere in a badge name or set folder." },
  { rule: "Hyphens, not spaces", detail: "`holiday-2026`, never `Holiday 2026` or `holiday_2026`. No double hyphens." },
  { rule: "Start with a letter", detail: "No leading hyphen or digit; 48 characters at most." },
  { rule: "One name for both files", detail: "The web copy and the 4K master share the slug; only the extension differs." },
  { rule: "Same name in the app", detail: "The badge's `src` uses the slug too, so the app, the bucket and this queue always match." },
] as const;

export type ProtocolStep = { title: string; body: string; who: string };

/** What the teams do, start to finish. The founder asked for this to live in Admin for good. */
export const PROTOCOL_STEPS: ProtocolStep[] = [
  {
    title: "Check it doesn't exist",
    body: "Search the Badge Reference PDF in Admin → Badges for the same milestone. A second badge for a moment users already celebrate is a no, and a renamed idea is better than a duplicate.",
    who: "Team member",
  },
  {
    title: "Name it by the rule",
    body: "Write the badge title as a person would read it, then take the slug the form shows you. Fix it now: renaming after approval means re-uploading both files to the bucket.",
    who: "Team member",
  },
  {
    title: "Draw both files",
    body: "A 512 × 512 transparent WebP web copy under 120 KB, and the full-resolution transparent PNG master. Both named with the slug.",
    who: "Branding",
  },
  {
    title: "Submit the idea",
    body: "Fill in the form below: title, collection, tier, serious or playful, the milestone, the short action, the description and the unlock message. Attach the art. It arrives as Submitted, and nothing ships from here.",
    who: "Branding, Marketing & Social Media, Support",
  },
  {
    title: "Super admin approves",
    body: "A super admin reads every submission and approves or rejects it with a reason. Rejected ideas keep their note so nobody re-submits the same thing next quarter.",
    who: "Super admin",
  },
  {
    title: "The founder uploads to R2",
    body: "Only the founder holds the bucket keys: the web copy goes to the key the queue prints, the master to the 4k/ key. Nobody else uploads art, ever.",
    who: "Founder",
  },
  {
    title: "The founder marks it uploaded",
    body: "That is the green light for engineering, and it keeps the queue honest about which art is really live in the bucket.",
    who: "Founder",
  },
];

/** What engineering does once the art is in the bucket: the part that turns art into a badge users can earn. */
export const ENGINEERING_STEPS: ProtocolStep[] = [
  {
    title: "Add the badge",
    body: "A `BadgeDef` in src/lib/badges.ts with the same path the queue printed, its collection, tier, milestone, action, description and pop-up. Leave `artPending` on until the bucket key answers with the picture.",
    who: "Engineering",
  },
  {
    title: "Wire the count",
    body: "The `metric` must exist in badge-rules.ts and rise somewhere real, or the badge can never unlock. Check `goal` (and `every`, for repeat badges).",
    who: "Engineering",
  },
  {
    title: "Prove it unlocks",
    body: "Earn it once in a test account and confirm the pop-up, the shelf and the reference PDF all show the new art.",
    who: "Engineering",
  },
  {
    title: "Ship and check the bucket",
    body: "Deploy, then confirm the picture loads from the bucket rather than a local copy. A 404 means the key is wrong, not that the art is missing.",
    who: "Engineering",
  },
];
