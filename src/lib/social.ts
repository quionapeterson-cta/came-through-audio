/**
 * The social accounts the site can show, and which of them are switched on (founder, 2026-11-04). Kept here, not in the
 * footer, so Admin can change them without a deploy; the list is the complete set of platforms the footer may draw.
 */
export type SocialPlatform = "instagram" | "tiktok" | "youtube" | "x" | "facebook" | "threads";

export type SocialLink = { platform: SocialPlatform; url: string; enabled: boolean };

/** Canonical order: the two we run first, then the ones waiting for an account. */
export const SOCIAL_PLATFORMS: { platform: SocialPlatform; label: string }[] = [
  { platform: "instagram", label: "Instagram" },
  { platform: "tiktok", label: "TikTok" },
  { platform: "youtube", label: "YouTube" },
  { platform: "x", label: "X" },
  { platform: "facebook", label: "Facebook" },
  { platform: "threads", label: "Threads" },
];

export const SOCIAL_HANDLE = "@camethroughaudio";

/** The line the brand stands for, always written after the name, never before it (AGENTS.md, Brand Lockup). */
export const SLOGAN = "Your first stop before distribution";

export const DEFAULT_SOCIALS: SocialLink[] = [
  { platform: "instagram", url: "https://www.instagram.com/camethroughaudio/", enabled: true },
  { platform: "tiktok", url: "https://www.tiktok.com/@camethroughaudio", enabled: true },
  { platform: "youtube", url: "", enabled: false },
  { platform: "x", url: "", enabled: false },
  { platform: "facebook", url: "", enabled: false },
  { platform: "threads", url: "", enabled: false },
];

const urlOk = (u: string) => /^https?:\/\/[^\s]+$/i.test(u.trim());

/** One row per known platform, in canonical order, with only real addresses. Anything else is ignored. */
export function cleanSocials(raw: unknown): SocialLink[] {
  const rows = Array.isArray(raw) ? (raw as Partial<SocialLink>[]) : [];
  return SOCIAL_PLATFORMS.map(({ platform }) => {
    const row = rows.find((r) => r?.platform === platform);
    const fallback = DEFAULT_SOCIALS.find((d) => d.platform === platform)!;
    const typed = typeof row?.url === "string" ? row.url.trim() : "";
    return { platform, url: typed && urlOk(typed) ? typed : fallback.url, enabled: row ? row.enabled === true : fallback.enabled };
  });
}

/** Only what the page may draw: switched on and pointing at a real address. */
export const visibleSocials = (links: SocialLink[]) => links.filter((l) => l.enabled && urlOk(l.url));
