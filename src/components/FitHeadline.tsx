import { useEffect, useRef, type ReactNode } from "react";

/** Scales an element's font size until its text spans the given width. Letter spacing is fixed in px, so further passes correct for it. */
function fitToWidth(el: HTMLElement, width: number) {
  for (let i = 0; i < 3; i++) {
    const size = parseFloat(getComputedStyle(el).fontSize);
    el.style.fontSize = `${(size * width / el.getBoundingClientRect().width).toFixed(2)}px`;
  }
}

/**
 * A stacked headline whose lines all span the same width: each line's font size is scaled to fill the heading.
 * An optional subheading is fitted to the same width on one line, unless that would make it smaller than
 * `subMin` px; then it wraps at its own size. The className sizes are the pre-hydration fallback.
 */
export function FitHeadline({ lines, className = "", sub, subClassName = "", subMin = 16 }: {
  lines: { text: ReactNode; className?: string }[]; className?: string; sub?: ReactNode; subClassName?: string; subMin?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const box = ref.current;
    if (!box) return;
    const [h, p] = Array.from(box.children) as HTMLElement[];
    const fit = () => {
      const width = box.getBoundingClientRect().width;
      for (const line of Array.from(h!.children) as HTMLElement[]) fitToWidth(line, width);
      if (!p) return;
      p.style.fontSize = "";
      p.style.whiteSpace = "nowrap";
      p.style.width = "max-content";
      fitToWidth(p, width);
      if (parseFloat(p.style.fontSize) < subMin) p.style.fontSize = p.style.whiteSpace = p.style.width = "";
    };
    let live = true;
    void document.fonts?.ready.then(() => live && fit());
    const observer = new ResizeObserver(fit);
    observer.observe(box);
    return () => { live = false; observer.disconnect(); };
  }, [subMin]);
  return (
    <div ref={ref} className="space-y-5">
      <h1 className={`[text-rendering:geometricPrecision] ${className}`}>
        {lines.map((l, i) => <span key={i} className={`block w-max whitespace-nowrap ${l.className ?? ""}`}>{l.text}</span>)}
      </h1>
      {sub && <p className={`[text-rendering:geometricPrecision] ${subClassName}`}>{sub}</p>}
    </div>
  );
}
