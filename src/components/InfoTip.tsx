import { useState, type ReactNode } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { GLOSSARY, type GlossaryKey } from "@/lib/glossary";

/**
 * The site's one help tip. Opens on tap (phones never show hover-only `title` text) or hover, closes on a tap
 * outside or Escape, and is a real button for keyboards and screen readers. Pass a glossary `term` so a word
 * reads the same everywhere, or `text` for a tip that's only about this spot. `children` replaces the ⓘ trigger.
 */
export function InfoTip({ term, text, title, children, className = "" }: { term?: GlossaryKey; text?: string; title?: string; children?: ReactNode; className?: string }) {
  const [open, setOpen] = useState(false);
  const entry = term ? GLOSSARY[term] : undefined;
  const heading = title ?? entry?.term;
  const body = text ?? entry?.text ?? "";
  const hover = (on: boolean) => () => { if (window.matchMedia?.("(hover: hover)").matches) setOpen(on); };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" aria-label={children ? undefined : heading ? `What is ${heading}?` : "More info"} onMouseEnter={hover(true)} onMouseLeave={hover(false)}
          // A click right after hovering keeps the tip open instead of toggling it shut.
          onClick={(e) => { e.stopPropagation(); if (open && window.matchMedia?.("(hover: hover)").matches) e.preventDefault(); }}
          data-infotip=""
          className={children ? className : `relative -top-px ml-1.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-primary align-middle text-[10px] font-semibold leading-none normal-case tracking-normal text-primary hover:bg-primary hover:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${className}`}>
          {children ?? "i"}
        </button>
      </PopoverTrigger>
      {/* No zoom-in: text scaled mid-animation stays soft on many screens, so the tip only fades in (sharp text). */}
      <PopoverContent side="top" className="w-72 max-w-[calc(100vw-2rem)] p-3 text-sm normal-case tracking-normal data-[state=open]:zoom-in-100 data-[state=closed]:zoom-out-100 data-[side=top]:slide-in-from-bottom-0" onOpenAutoFocus={(e) => e.preventDefault()}
        onMouseEnter={hover(true)} onMouseLeave={hover(false)}>
        {heading && <p className="font-semibold text-foreground">{heading}</p>}
        <p className="mt-0.5 font-normal leading-snug text-muted-foreground">{body}</p>
      </PopoverContent>
    </Popover>
  );
}
