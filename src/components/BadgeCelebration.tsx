import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Copy, Download, Link2, RefreshCw, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { captionForX, promoCaption, promoOrder, type PromoContext } from "@/lib/promo-copy";
import { drawPromoCard } from "@/lib/promo-card";
import { publishShareCard } from "@/lib/share-cards";

export type ShareInfo = { ctx: PromoContext; artist: string; title?: string | undefined; count?: number | undefined; genre?: string | undefined };

const rand = (a: number, b: number) => a + Math.random() * (b - a);
// Smaller on phones so the share panel starts on the first screen.
const ROUND_SIZE = "w-[min(70vw,38svh)] md:w-[min(80vw,32rem)]";
const reducedMotion = () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/**
 * The big badge with the celebration: it pops in and shines, a burst of small badges shoots out from behind it,
 * then about 45 badges rain down for ~5 seconds with depth, sway and gold sparkles, and a replay button appears.
 * Reduced motion: no rain or burst, just one gentle shine.
 */
export function CelebrationStage({ src, name, round, float }: { src: string; name?: string | undefined; round?: boolean | undefined; float?: boolean | undefined }) {
  const [run, setRun] = useState(0);
  const [done, setDone] = useState(false);
  const [still] = useState(reducedMotion);
  const badge = useRef<HTMLImageElement>(null);
  useEffect(() => {
    setDone(false);
    if (!still) navigator.vibrate?.([30, 40, 60]);
    const t = setTimeout(() => setDone(true), 5000);
    return () => clearTimeout(t);
  }, [run, still]);
  const shape = round ? "rounded-full object-cover" : "object-contain";
  return (
    <figure className="flex flex-col items-center gap-4 md:gap-6">
      {!still && <Rain key={`rain-${run}`} src={src} shape={shape} />}
      {!still && <Burst key={`burst-${run}`} src={src} shape={shape} from={badge} />}
      <div key={`badge-${run}`} className="relative w-full" style={still ? undefined : { animation: "badge-pop 0.6s ease-out" }}>
        <img ref={badge} src={src} alt={name ?? "Badge"} className={`${round ? `mx-auto aspect-square ${ROUND_SIZE} rounded-full border-4 border-primary object-cover` : "max-h-[38svh] w-full object-contain drop-shadow-2xl md:max-h-[60vh]"}${float ? " badge-float" : ""}`} />
        {/* The shine is masked by the badge itself so only the artwork catches the light. */}
        <div aria-hidden className={`pointer-events-none absolute inset-0 ${round ? `mx-auto aspect-square ${ROUND_SIZE} rounded-full` : ""}`}
          style={{ ...(round ? {} : { maskImage: `url("${src}")`, WebkitMaskImage: `url("${src}")`, maskSize: "contain", WebkitMaskSize: "contain", maskRepeat: "no-repeat", WebkitMaskRepeat: "no-repeat", maskPosition: "center", WebkitMaskPosition: "center" }),
            backgroundImage: "linear-gradient(105deg, transparent 40%, rgb(255 255 255 / 0.7) 50%, transparent 60%)", backgroundSize: "250% 100%", backgroundRepeat: "no-repeat",
            animation: "badge-shine 1.1s ease-in-out 0.35s both" }} />
      </div>
      {name && <figcaption className="text-2xl font-bold tracking-tight text-white">{name}</figcaption>}
      {!still && <Button type="button" variant="outline" onClick={() => setRun((r) => r + 1)}
        className={`transition-opacity duration-500 ${done ? "opacity-100" : "pointer-events-none opacity-0"}`} tabIndex={done ? 0 : -1}>🎉 Make it rain again</Button>}
    </figure>
  );
}

/**
 * Small badges shoot up and out from behind the big one, then drop away. It is a full-screen layer placed at the
 * badge's center, so the dialog's scroll area can't clip it.
 */
function Burst({ src, shape, from }: { src: string; shape: string; from: React.RefObject<HTMLImageElement | null> }) {
  const [at, setAt] = useState<{ x: number; y: number }>();
  useEffect(() => {
    const id = requestAnimationFrame(() => { const r = from.current?.getBoundingClientRect(); if (r) setAt({ x: r.left + r.width / 2, y: r.top + r.height / 2 }); });
    return () => cancelAnimationFrame(id);
  }, [from]);
  const bits = useMemo(() => Array.from({ length: 12 }, (_, i) => {
    const angle = (-90 + (i - 5.5) * 15 + rand(-6, 6)) * (Math.PI / 180), dist = rand(28, 44);
    // Starts after the dialog's 200ms fade, while the layer is still positioned against the whole screen.
    return { bx: Math.cos(angle) * dist * 1.4, by: Math.sin(angle) * dist, size: rand(36, 64), spin: rand(-540, 540), delay: rand(0.25, 0.4) };
  }), []);
  if (!at) return null;
  return <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
    {bits.map((b, i) => <img key={i} src={src} alt="" className={`absolute ${shape}`}
      style={{ left: at.x, top: at.y, width: b.size, height: b.size, animation: `badge-burst 1.6s cubic-bezier(0.2, 0.7, 0.3, 1) ${b.delay}s both`, "--bx": `${b.bx}vh`, "--by": `${b.by}vh`, "--spin": `${b.spin}deg` } as CSSProperties} />)}
  </div>;
}

/** Full-screen rain. Bigger badges are "closer": they fall faster. Drops start dense and thin out toward the end. */
function Rain({ src, shape }: { src: string; shape: string }) {
  const drops = useMemo(() => Array.from({ length: 45 }, () => {
    const depth = Math.random(), size = 24 + depth * 48;
    return {
      left: rand(-2, 98), size, fall: 3 - depth * 1.2, delay: 0.4 + 4.6 * Math.random() ** 1.6,
      sway: rand(8, 28), swayTime: rand(0.9, 1.6), spin: rand(-540, 540), opacity: 0.55 + depth * 0.45,
    };
  }), []);
  const sparkles = useMemo(() => Array.from({ length: 32 }, (_, i) => ({
    left: rand(2, 98), top: rand(4, 92), size: rand(16, 32), delay: rand(0.3, 5.2), time: rand(0.9, 1.5), platinum: i % 3 === 0,
  })), []);
  return <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
    {drops.map((d, i) => <div key={i} className="absolute top-0" style={{ left: `${d.left}%`, opacity: d.opacity, animation: `badge-fall ${d.fall}s linear ${d.delay}s both` }}>
      <div style={{ animation: `badge-sway ${d.swayTime}s ease-in-out ${-d.swayTime * Math.random()}s infinite alternate`, "--sway": `${d.sway}px` } as CSSProperties}>
        <img src={src} alt="" className={shape} style={{ width: d.size, height: d.size, animation: `badge-spin ${d.fall}s linear ${d.delay}s both`, "--spin": `${d.spin}deg` } as CSSProperties} />
      </div>
    </div>)}
    {sparkles.map((p, i) => <span key={`s${i}`} className={`badge-sparkle absolute${p.platinum ? " platinum" : ""}`}
      style={{ left: `${p.left}%`, top: `${p.top}%`, width: p.size, height: p.size, animation: `badge-twinkle ${p.time}s ease-in-out ${p.delay}s both` }} />)}
  </div>;
}

const HEADINGS: Record<PromoContext, string> = { embed: "Share the tease", catalog: "Show off your catalog", profile: "Share your badge" };
const SITE_URL = "https://camethroughaudio.com";
const fileName = (s: string) => s.replace(/[<>:"/\\|?*]+/g, "_").trim() || "teaser";

/** Teaser card, a caption that changes with Generate, and ways to post it. */
export function SharePanel({ avatar, round, share }: { avatar: string; round?: boolean | undefined; share: ShareInfo }) {
  const { ctx, artist, title, count, genre } = share;
  const [order] = useState(() => promoOrder(ctx));
  const [step, setStep] = useState(0);
  const [showDetail, setShowDetail] = useState(true);
  const input = { title: showDetail ? title?.trim() || undefined : undefined, count: showDetail ? count || undefined : undefined, genre };
  const [caption, setCaption] = useState("");
  const [card, setCard] = useState<{ blob: Blob; url: string }>();
  // Public /share link for the current card (uploaded on first share), so link previews show the card image.
  const [shareLink, setShareLink] = useState<{ for: string; url: string }>();

  useEffect(() => { setCaption(promoCaption(ctx, order[step % order.length]!, input)); }, [step, showDetail]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    let url = "", live = true;
    drawPromoCard({ ctx, avatar, round: !!round, artist, ...input })
      .then((blob) => { if (!live) return; url = URL.createObjectURL(blob); setCard({ blob, url }); })
      .catch(() => setCard(undefined));
    return () => { live = false; if (url) URL.revokeObjectURL(url); };
  }, [avatar, round, artist, showDetail]); // eslint-disable-line react-hooks/exhaustive-deps

  const detail = ctx === "embed" && title?.trim() ? "Show song title" : ctx === "catalog" && count ? "Show song count" : "";
  const imageName = `${fileName([artist, input.title].filter(Boolean).join(" - "))} teaser.png`;
  const copy = async (msg = "Caption copied.") => { try { await navigator.clipboard.writeText(caption); toast.success(msg); } catch { toast.error("Couldn't copy. Select the caption and copy it instead."); } };
  const file = card && typeof File !== "undefined" ? new File([card.blob], imageName, { type: "image/png" }) : undefined;
  const canShare = typeof navigator !== "undefined" && !!navigator.share;

  async function link() {
    if (!card) return SITE_URL;
    if (shareLink?.for === card.url) return shareLink.url;
    const url = await publishShareCard(card.blob);
    setShareLink({ for: card.url, url });
    return url;
  }
  /** Opens the tab right away (popup blockers allow that only during the click), then points it at the share URL. */
  function openWithLink(build: (url: string) => string) {
    const w = window.open("", "_blank");
    link()
      .then((url) => { if (w) { w.opener = null; w.location.href = build(url); } })
      .catch(() => {
        toast.error("Couldn't attach your card image, so the post will link to the site instead.");
        if (w) { w.opener = null; w.location.href = build(SITE_URL); }
      });
  }

  async function nativeShare() {
    try {
      if (file && navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], text: caption });
      else await navigator.share({ text: caption, url: await link().catch(() => SITE_URL) });
    } catch (e) { if ((e as Error).name !== "AbortError") toast.error("Sharing didn't work. Try Save image and Copy caption."); }
  }
  function save() {
    if (!card) return;
    const a = document.createElement("a"); a.href = card.url; a.download = imageName; a.click();
  }

  return (
    <section aria-label={HEADINGS[ctx]} className="w-full space-y-4 rounded-2xl border border-border bg-card p-5 text-left text-card-foreground shadow-2xl">
      <h2 className="text-xl font-bold">{HEADINGS[ctx]}</h2>
      <div className="grid gap-4 sm:grid-cols-[10rem_1fr]">
        {card ? <img src={card.url} alt="Teaser card preview" className="aspect-square w-40 rounded-lg border border-border" /> : <div className="aspect-square w-40 animate-pulse rounded-lg bg-muted" />}
        <div className="space-y-2">
          <label htmlFor="promo-caption" className="text-sm font-medium">Caption</label>
          <Textarea id="promo-caption" rows={6} value={caption} onChange={(e) => setCaption(e.target.value)} />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <Button type="button" variant="outline" onClick={() => setStep((s) => s + 1)}><RefreshCw />Generate</Button>
        {detail && <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-[var(--primary)]" checked={showDetail} onChange={(e) => setShowDetail(e.target.checked)} />{detail}</label>}
      </div>
      <div className="flex flex-wrap gap-2">
        {canShare && <Button type="button" onClick={() => void nativeShare()}><Share2 />Share…</Button>}
        {/* Each of these builds its preview from the /share link's og:image, so the card shows up in the post. */}
        <Button type="button" variant="outline" disabled={!card} onClick={() => openWithLink((u) => `https://twitter.com/intent/tweet?text=${encodeURIComponent(captionForX(caption, genre))}&url=${encodeURIComponent(u)}`)}>X</Button>
        <Button type="button" variant="outline" disabled={!card} onClick={() => { void copy("Caption copied. Paste it into your Facebook post."); openWithLink((u) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(u)}`); }}>Facebook</Button>
        <Button type="button" variant="outline" disabled={!card} onClick={() => openWithLink((u) => `https://www.threads.net/intent/post?text=${encodeURIComponent(`${caption}\n\n${u}`)}`)}>Threads</Button>
        <Button type="button" variant="outline" disabled={!card} onClick={() => openWithLink((u) => `https://wa.me/?text=${encodeURIComponent(`${caption}\n\n${u}`)}`)}>WhatsApp</Button>
        <Button type="button" variant="outline" onClick={() => void copy()}><Copy />Copy caption</Button>
        <Button type="button" variant="outline" disabled={!card} onClick={() => void link().then((u) => navigator.clipboard.writeText(u)).then(() => toast.success("Link copied. Paste it in iMessage, Discord or any post: it shows your card.")).catch(() => toast.error("Couldn't copy the link."))}><Link2 />Copy link</Button>
        <Button type="button" variant="outline" disabled={!card} onClick={save}><Download />Save image</Button>
      </div>
      <p className="text-xs text-muted-foreground">X, Facebook, Threads and WhatsApp show your card in the post preview. Instagram and TikTok don't allow link posts, so use Share… on your phone, or Save image and Copy caption, then post from the app.</p>
    </section>
  );
}
