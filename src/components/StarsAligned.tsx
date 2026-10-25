import { useEffect, useRef } from "react";

/**
 * Fully completed catalog celebration (founder, 2026-10-25): a lit CTA night sky fills the screen, stars twinkle and
 * shoot, and some fly in to spell the most recent song's title, with a short "the stars aligned" line. (100% royalty
 * health on one song gets the green pulse instead.) Click or Esc closes it; it ends on its own after a few seconds.
 * With reduced motion the sky and title simply appear.
 */
export function StarsAligned({ title, onDone }: { title: string; onDone: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const c = canvas.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = window.innerWidth, H = window.innerHeight;
    c.width = W * dpr; c.height = H * dpr; ctx.scale(dpr, dpr);

    // Where the title's stars land: sample the title drawn in Poppins on an offscreen canvas.
    const off = document.createElement("canvas");
    off.width = W; off.height = H;
    const o = off.getContext("2d")!;
    let size = Math.min(110, (W * 0.9) / Math.max(4, title.length * 0.62));
    o.font = `800 ${size}px Poppins, system-ui, sans-serif`;
    while (o.measureText(title).width > W * 0.9 && size > 18) { size -= 4; o.font = `800 ${size}px Poppins, system-ui, sans-serif`; }
    o.textAlign = "center"; o.textBaseline = "middle"; o.fillStyle = "#fff";
    o.fillText(title, W / 2, H * 0.42);
    const img = o.getImageData(0, 0, W, H).data;
    const step = Math.max(3, Math.round(size / 14));
    const targets: [number, number][] = [];
    for (let y = 0; y < H; y += step) for (let x = 0; x < W; x += step) if (img[(y * W + x) * 4 + 3]! > 128) targets.push([x, y]);

    type Star = { x: number; y: number; tx?: number; ty?: number; sx: number; sy: number; r: number; tw: number; gold: boolean };
    const field: Star[] = Array.from({ length: Math.round((W * H) / 3500) }, () => ({ x: Math.random() * W, y: Math.random() * H, sx: 0, sy: 0, r: Math.random() * 1.3 + 0.3, tw: Math.random() * Math.PI * 2, gold: Math.random() < 0.08 }));
    const aligned: Star[] = targets.map(([tx, ty]) => { const x = Math.random() * W, y = Math.random() * H; return { x, y, sx: x, sy: y, tx, ty, r: Math.random() * 0.8 + 0.9, tw: Math.random() * Math.PI * 2, gold: Math.random() < 0.15 }; });
    const shooting: { x: number; y: number; vx: number; vy: number; life: number }[] = [];

    const start = performance.now();
    let raf = 0;
    const ease = (t: number) => 1 - Math.pow(1 - t, 3);
    const draw = (now: number) => {
      const t = (now - start) / 1000;
      ctx.fillStyle = "#0b0b0b"; ctx.fillRect(0, 0, W, H);
      // A soft cobalt glow behind the title.
      const g = ctx.createRadialGradient(W / 2, H * 0.42, 10, W / 2, H * 0.42, Math.max(W, H) * 0.6);
      g.addColorStop(0, "rgba(0,74,173,0.35)"); g.addColorStop(1, "rgba(0,74,173,0)");
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      for (const s of field) {
        const a = 0.45 + 0.55 * Math.sin(t * 2 + s.tw);
        ctx.fillStyle = s.gold ? `rgba(255,215,0,${a})` : `rgba(255,255,255,${a})`;
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
      }
      const k = reduce ? 1 : ease(Math.min(1, Math.max(0, (t - 0.6) / 2.2)));
      for (const s of aligned) {
        const x = s.sx + (s.tx! - s.sx) * k, y = s.sy + (s.ty! - s.sy) * k;
        const a = 0.7 + 0.3 * Math.sin(t * 3 + s.tw);
        ctx.fillStyle = s.gold ? `rgba(255,215,0,${a})` : `rgba(77,140,255,${a})`;
        ctx.beginPath(); ctx.arc(x, y, s.r, 0, Math.PI * 2); ctx.fill();
      }
      if (!reduce && Math.random() < 0.04) shooting.push({ x: Math.random() * W * 0.8, y: Math.random() * H * 0.3, vx: 9 + Math.random() * 6, vy: 4 + Math.random() * 3, life: 1 });
      for (const sh of shooting) {
        ctx.strokeStyle = `rgba(255,255,255,${sh.life})`; ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.moveTo(sh.x, sh.y); ctx.lineTo(sh.x - sh.vx * 8, sh.y - sh.vy * 8); ctx.stroke();
        sh.x += sh.vx; sh.y += sh.vy; sh.life -= 0.02;
      }
      while (shooting.length && shooting[0]!.life <= 0) shooting.shift();
      if (!reduce) raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    const end = window.setTimeout(onDone, 8000);
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") onDone(); };
    window.addEventListener("keydown", key);
    return () => { cancelAnimationFrame(raf); window.clearTimeout(end); window.removeEventListener("keydown", key); };
  }, [title, onDone]);

  return (
    <div role="dialog" aria-label={`The stars aligned for ${title}`} className="fixed inset-0 z-[100] cursor-pointer" onClick={onDone}>
      <canvas ref={canvas} className="absolute inset-0 h-full w-full" />
      <div className="absolute inset-x-0 bottom-[22%] mx-auto max-w-xl px-6 text-center text-white">
        <p className="text-xs font-bold uppercase tracking-[2px] text-[#4D8CFF]">Catalog complete</p>
        <p className="mt-2 text-xl font-bold">The stars aligned.</p>
        <p className="mt-1 text-white/80">Every song in your catalog is ready to get paid. You Came Through for your whole catalog.</p>
        <p className="mt-4 text-xs text-white/50">Tap anywhere to close</p>
      </div>
    </div>
  );
}
