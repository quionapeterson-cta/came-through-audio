import { AtSign, Facebook, Instagram, Twitter, Youtube } from "lucide-react";
import { SOCIAL_PLATFORMS, visibleSocials, type SocialLink, type SocialPlatform } from "@/lib/social";

/** TikTok isn't in the icon set, so its own mark is drawn here. */
function TikTokMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className} fill="currentColor">
      <path d="M12.53.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
    </svg>
  );
}

function Icon({ platform }: { platform: SocialPlatform }) {
  const cls = "h-5 w-5";
  switch (platform) {
    case "instagram": return <Instagram className={cls} aria-hidden />;
    case "tiktok": return <TikTokMark className={cls} />;
    case "youtube": return <Youtube className={cls} aria-hidden />;
    case "x": return <Twitter className={cls} aria-hidden />;
    case "facebook": return <Facebook className={cls} aria-hidden />;
    case "threads": return <AtSign className={cls} aria-hidden />;
  }
}

/** The footer's social icons: only the accounts switched on in Admin → Homepage → Social. */
export function SocialLinks({ links, className }: { links: SocialLink[]; className?: string }) {
  const shown = visibleSocials(links);
  if (!shown.length) return null;
  return (
    <ul className={className ?? "flex items-center gap-2"}>
      {shown.map((l) => {
        const label = SOCIAL_PLATFORMS.find((p) => p.platform === l.platform)?.label ?? l.platform;
        return (
          <li key={l.platform}>
            <a href={l.url} target="_blank" rel="me noopener noreferrer" aria-label={label} title={l.url}
              className="grid h-11 w-11 touch-manipulation place-items-center rounded-full border border-ink-border text-ink-foreground transition hover:border-brand-electric hover:text-brand-electric active:scale-95">
              <Icon platform={l.platform} />
            </a>
          </li>
        );
      })}
    </ul>
  );
}
