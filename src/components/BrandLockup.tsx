import { SLOGAN } from "@/lib/social";

/**
 * The mark's box, in em, shared by every place the C replaces the first letter. One constant means the header, the
 * lockup and any new use cannot drift apart: em keeps it tied to the text size, `translate-y` puts its baseline on the
 * name's instead of the line box's (founder, 2026-11-05: on a phone the C sat off the rest of the name).
 */
export const MARK_BOX = "h-[1.02em] w-[1.02em] shrink-0 -translate-y-[0.04em] object-contain";

/**
 * The mark's picture is a 256px square with 14px of empty margin on its right (the artwork itself starts at 14 and ends
 * at 242), and every layout added its own gap on top of that, so the C floated away from "ame". Cancelling that margin
 * exactly brought the name too close, so the tuck is cancelled and a hair is added back: the name now starts just past
 * the art's edge at any size (founder, 2026-11-05).
 */
export const MARK_TUCK = "[margin-right:0.02em]";

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
      <p className={`flex items-center justify-center gap-[0.02em] font-bold uppercase tracking-[2px] ${nameClassName ?? "text-lg"}`}>
        <img src="/cta-mark-light.png" alt="" aria-hidden width={28} height={28} className={`${MARK_BOX} ${MARK_TUCK}`} />
        <span aria-hidden>ame Through Audio</span>
        <span className="sr-only">Came Through Audio</span>
      </p>
      <p className={`mt-1 font-bold uppercase tracking-[2px] text-brand-electric ${sloganClassName ?? "text-sm"}`}>{SLOGAN}</p>
    </div>
  );
}
