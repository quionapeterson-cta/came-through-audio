import { SLOGAN } from "@/lib/social";

/**
 * The brand lockup: the mark is the C in "Came", the name follows it, and the line it stands for sits underneath
 * (AGENTS.md, Brand Lockup; founder, 2026-11-04). The mark is sized in em, not pixels, so it scales with the name on a
 * phone instead of drifting off the baseline, and it is centred on the cap height with no rotation of its own.
 */
export function BrandLockup({ className, nameClassName, sloganClassName }: {
  className?: string; nameClassName?: string; sloganClassName?: string;
}) {
  return (
    <div className={className ?? "text-center"}>
      <p className={`flex items-center justify-center gap-[0.12em] font-bold uppercase tracking-[2px] ${nameClassName ?? "text-lg"}`}>
        <img src="/cta-mark-light.png" alt="" aria-hidden width={28} height={28}
          className="h-[1.15em] w-[1.15em] shrink-0 translate-y-[-0.04em]" />
        <span aria-hidden>ame Through Audio</span>
        <span className="sr-only">Came Through Audio</span>
      </p>
      <p className={`mt-1 font-bold uppercase tracking-[2px] text-brand-electric ${sloganClassName ?? "text-sm"}`}>{SLOGAN}</p>
    </div>
  );
}
