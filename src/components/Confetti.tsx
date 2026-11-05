import { useEffect, useRef } from "react";

/**
 * A short burst of brand-coloured confetti (founder, 2026-11-05). Shared by Admin's sign-in welcome and the member
 * celebration in the workspace, so there is one burst in the product, not two. Skips itself entirely when the visitor
 * asked for reduced motion.
 */
export function Confetti({ pieces = 120, frames = 150, className = "pointer-events-none absolute inset-0 h-full w-full" }: {
  pieces?: number;
  frames?: number;
  className?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current, x = c?.getContext("2d");
    if (!c || !x || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    c.width = c.offsetWidth; c.height = c.offsetHeight;
    const colors = ["#004AAD", "#4D8CFF", "#ffffff", "#FFD700"];
    const bits = Array.from({ length: pieces }, () => ({ x: c.width / 2, y: c.height / 3, vx: (Math.random() - 0.5) * 12, vy: -Math.random() * 10 - 4, r: Math.random() * 6 + 3, c: colors[Math.floor(Math.random() * colors.length)]!, a: Math.random() * 6 }));
    let raf = 0, frame = 0;
    const tick = () => {
      x.clearRect(0, 0, c.width, c.height);
      for (const b of bits) { b.vy += 0.35; b.x += b.vx; b.y += b.vy; b.a += 0.2; x.fillStyle = b.c; x.save(); x.translate(b.x, b.y); x.rotate(b.a); x.fillRect(-b.r / 2, -b.r / 4, b.r, b.r / 2); x.restore(); }
      if (++frame < frames) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [pieces, frames]);
  return <canvas ref={ref} aria-hidden className={className} />;
}
