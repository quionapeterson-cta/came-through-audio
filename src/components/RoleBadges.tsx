import { useId, type ReactNode } from "react";

/**
 * Animated role badges for the homepage's "Who it's for" section, drawn in the award art's style: a white sticker
 * edge, glossy cobalt, gold trim and rhinestones. Each badge acts out its scene while its card is hovered; the motion lives in styles.css
 * (role-*) and stops for reduced motion. Gold and Platinum are allowed here because these are badges (BRANDING.md §1).
 */
export const C = { cobalt: "#004AAD", deep: "#00296b", electric: "#4D8CFF", gold: "#FFD700", goldDeep: "#c99a00", platinum: "#E5E4E2", ink: "#0b0b0b", white: "#FFFFFF" };

/** Shared gradients and the rhinestone fill, scoped by a per-badge id so several badges can share a page. */
function Defs({ id }: { id: string }) {
  return (
    <defs>
      <linearGradient id={`${id}-cobalt`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor={C.electric} /><stop offset="0.45" stopColor={C.cobalt} /><stop offset="1" stopColor={C.deep} />
      </linearGradient>
      <linearGradient id={`${id}-gold`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#fff3a0" /><stop offset="0.4" stopColor={C.gold} /><stop offset="1" stopColor={C.goldDeep} />
      </linearGradient>
      <linearGradient id={`${id}-silver`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor={C.white} /><stop offset="0.5" stopColor={C.platinum} /><stop offset="1" stopColor="#b9b8b5" />
      </linearGradient>
      <pattern id={`${id}-stones`} width="5" height="5" patternUnits="userSpaceOnUse">
        <circle cx="2.5" cy="2.5" r="1.4" fill={C.white} opacity="0.35" />
        <circle cx="2" cy="2" r="0.5" fill={C.white} opacity="0.9" />
      </pattern>
    </defs>
  );
}

/** Gold and platinum four-point glints that twinkle around a badge. */
export function Glints({ at, className = "role-glint" }: { at: [number, number, number][]; className?: string }) {
  return <>{at.map(([x, y, s], i) => (
    <path key={i} className={className} style={{ animationDelay: `${i * 0.7}s` }} fill={i % 2 ? C.platinum : C.gold}
      d={`M${x} ${y - s} L${x + s * 0.28} ${y - s * 0.28} L${x + s} ${y} L${x + s * 0.28} ${y + s * 0.28} L${x} ${y + s} L${x - s * 0.28} ${y + s * 0.28} L${x - s} ${y} L${x - s * 0.28} ${y - s * 0.28} Z`} />
  ))}</>;
}

export function Badge({ label, className = "h-36 w-36", children }: { label: string; className?: string; children: (id: string) => ReactNode }) {
  const id = `rb${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  return <svg viewBox="0 0 120 120" role="img" aria-label={label} className={`${className} overflow-visible drop-shadow-[0_6px_14px_rgb(0_74_173/0.45)]`}><Defs id={id} />{children(id)}</svg>;
}

const note = (x: number, y: number, fill: string) => <g><ellipse cx={x} cy={y} rx="3.4" ry="2.5" transform={`rotate(-20 ${x} ${y})`} fill={fill} /><path d={`M${x + 3} ${y - 1} v-12 q5 2 6 7`} stroke={fill} strokeWidth="1.6" fill="none" strokeLinecap="round" /></g>;

/** Artist: a jewelled studio mic, recording light blinking, sound rippling out. */
export function ArtistBadge() {
  return <Badge label="Bedazzled studio microphone recording">{(id) => <>
    <g stroke={C.white} strokeWidth="8" strokeLinejoin="round" strokeLinecap="round" fill={C.white}>
      <rect x="44" y="18" width="32" height="52" rx="16" /><path d="M40 52 v8 a20 20 0 0 0 40 0 v-8" fill="none" /><rect x="57" y="78" width="6" height="20" /><ellipse cx="60" cy="101" rx="20" ry="5" />
    </g>
    <path d="M40 52 v8 a20 20 0 0 0 40 0 v-8" stroke={`url(#${id}-gold)`} strokeWidth="4" fill="none" strokeLinecap="round" />
    <rect x="57" y="78" width="6" height="20" fill={`url(#${id}-gold)`} /><ellipse cx="60" cy="101" rx="20" ry="5" fill={`url(#${id}-gold)`} />
    <rect x="44" y="18" width="32" height="52" rx="16" fill={`url(#${id}-cobalt)`} />
    <rect x="44" y="18" width="32" height="52" rx="16" fill={`url(#${id}-stones)`} />
    <rect x="44" y="42" width="32" height="6" fill={`url(#${id}-gold)`} />
    <ellipse cx="53" cy="30" rx="4" ry="8" fill={C.white} opacity="0.35" />
    {[0, 1, 2].map((i) => <g key={i} className="role-wave" style={{ animationDelay: `${i * 0.45}s` }} stroke={i === 1 ? C.gold : C.electric} strokeWidth="3" fill="none" strokeLinecap="round">
      <path d="M86 32 a18 18 0 0 1 0 26" /><path d="M34 32 a18 18 0 0 0 0 26" />
    </g>)}
    <g className="role-rec"><circle cx="16" cy="16" r="4" fill="#ff3b3b" /><text x="23" y="19.5" fontSize="9" fontWeight="800" fill={C.white}>REC</text></g>
    <Glints at={[[100, 82, 6], [20, 88, 5], [92, 14, 4]]} />
  </>}</Badge>;
}

/** Musician: a jewelled guitar, strings shimmering as notes rise off it. */
export function MusicianBadge() {
  return <Badge label="Bedazzled guitar being played live">{(id) => <>
    <g transform="rotate(-32 60 62)">
      <g fill={C.white} stroke={C.white} strokeWidth="8" strokeLinejoin="round">
        <circle cx="60" cy="84" r="22" /><circle cx="60" cy="58" r="16" /><rect x="55" y="12" width="10" height="44" /><rect x="53" y="4" width="14" height="14" rx="3" />
      </g>
      <circle cx="60" cy="84" r="22" fill={`url(#${id}-cobalt)`} /><circle cx="60" cy="58" r="16" fill={`url(#${id}-cobalt)`} />
      <circle cx="60" cy="84" r="22" fill={`url(#${id}-stones)`} /><circle cx="60" cy="58" r="16" fill={`url(#${id}-stones)`} />
      <rect x="55" y="12" width="10" height="44" fill={C.deep} />
      {[20, 28, 36, 44].map((y) => <rect key={y} x="55" y={y} width="10" height="1.4" fill={`url(#${id}-gold)`} />)}
      <rect x="53" y="4" width="14" height="14" rx="3" fill={`url(#${id}-gold)`} />
      <circle cx="60" cy="66" r="7" fill={C.ink} stroke={`url(#${id}-gold)`} strokeWidth="2" />
      <rect x="51" y="90" width="18" height="4" rx="1" fill={`url(#${id}-gold)`} />
      {[57.6, 59.2, 60.8, 62.4].map((x, i) => <line key={x} className="role-string" style={{ animationDelay: `${i * 0.05}s` }} x1={x} y1="8" x2={x} y2="92" stroke={C.platinum} strokeWidth="0.6" />)}
      <ellipse cx="52" cy="76" rx="4" ry="7" fill={C.white} opacity="0.3" />
    </g>
    {[[88, 48, C.gold], [96, 58, C.electric], [84, 62, C.platinum]].map(([x, y, fill], i) => <g key={i} className="role-float" style={{ animationDelay: `${i * 0.8}s` }}>{note(x as number, y as number, fill as string)}</g>)}
    <Glints at={[[20, 28, 5], [104, 96, 6], [26, 104, 4]]} />
  </>}</Badge>;
}

/** Producer: a jewelled beat machine, pads lighting up as a beat plays. */
const BEAT = [0, 4, 2, 6, 8, 12, 10, 14, 1, 9, 5, 13, 3, 11, 7, 15];
export function ProducerBadge() {
  return <Badge label="Bedazzled beat machine with pads lighting up">{(id) => <>
    <rect x="10" y="14" width="100" height="92" rx="9" fill={C.white} stroke={C.white} strokeWidth="8" />
    <rect x="10" y="14" width="100" height="92" rx="9" fill={`url(#${id}-silver)`} stroke={`url(#${id}-gold)`} strokeWidth="3" />
    <rect x="10" y="14" width="100" height="92" rx="9" fill={`url(#${id}-stones)`} opacity="0.7" />
    <rect x="18" y="21" width="56" height="13" rx="2" fill={C.deep} stroke={`url(#${id}-gold)`} strokeWidth="1.2" />
    <text x="46" y="31" textAnchor="middle" fontSize="9" fontWeight="800" fill={C.gold} letterSpacing="1">CTA</text>
    {[86, 100].map((x) => <g key={x}><circle cx={x} cy="28" r="5.5" fill={`url(#${id}-gold)`} /><circle cx={x} cy="28" r="2.5" fill={C.cobalt} /></g>)}
    <rect x="88" y="44" width="4" height="50" rx="2" fill={C.ink} opacity="0.7" /><rect x="85" y="60" width="10" height="7" rx="1.5" fill={`url(#${id}-gold)`} />
    <rect x="99" y="44" width="5" height="5" rx="1" fill="#ff3b3b" /><rect x="99" y="52" width="5" height="5" rx="1" fill={C.ink} />
    {Array.from({ length: 16 }, (_, i) => {
      const x = 18 + (i % 4) * 15, y = 41 + Math.floor(i / 4) * 15;
      return <g key={i}>
        <rect x={x} y={y} width="13" height="13" rx="2" fill={`url(#${id}-cobalt)`} />
        <rect className="role-pad" style={{ animationDelay: `${BEAT.indexOf(i) * 0.15}s` }} x={x} y={y} width="13" height="13" rx="2" fill={C.electric} />
        <rect x={x + 2} y={y + 1.5} width="6" height="2" rx="1" fill={C.white} opacity="0.45" />
      </g>;
    })}
    <Glints at={[[108, 10, 6], [8, 106, 5]]} />
  </>}</Badge>;
}

/** Songwriter: a jewelled notebook, a gold pen writing lyrics line by line. */
export function SongwriterBadge() {
  const lines = ["M34 38 q4 -5 8 0 t8 0 t8 0 t8 0 t8 0 t6 0", "M34 50 q4 -5 8 0 t8 0 t8 0 t8 0 t8 0 t6 0", "M34 62 q4 -5 8 0 t8 0 t8 0 t6 0"];
  return <Badge label="Bedazzled notebook with a gold pen writing">{(id) => <>
    <rect x="16" y="12" width="80" height="96" rx="7" fill={C.white} stroke={C.white} strokeWidth="8" />
    <rect x="16" y="12" width="80" height="96" rx="7" fill={`url(#${id}-cobalt)`} />
    <rect x="16" y="12" width="80" height="96" rx="7" fill={`url(#${id}-stones)`} />
    <rect x="26" y="18" width="64" height="84" rx="3" fill="#f7f7f5" />
    {[38, 50, 62, 74, 86].map((y) => <line key={y} x1="32" y1={y + 2} x2="86" y2={y + 2} stroke={C.electric} strokeWidth="0.8" opacity="0.45" />)}
    <line x1="34" y1="20" x2="34" y2="100" stroke="#ff6b6b" strokeWidth="0.8" opacity="0.5" />
    {[24, 36, 48, 60, 72, 84, 96].map((y) => <circle key={y} cx="26" cy={y} r="3" fill="none" stroke={`url(#${id}-gold)`} strokeWidth="2" />)}
    {lines.map((d, i) => <path key={i} className={`role-ink role-ink-${i}`} d={d} pathLength="1" stroke={C.cobalt} strokeWidth="2" fill="none" strokeLinecap="round" />)}
    <g className="role-pen">
      <path d="M0 0 L3 -8 L26 -36 L32 -31 L9 -3 Z" fill={`url(#${id}-gold)`} stroke={C.white} strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M0 0 L3 -8 L9 -3 Z" fill={C.ink} /><path d="M22 -31 L28 -26" stroke={C.cobalt} strokeWidth="2.5" />
    </g>
    <Glints at={[[104, 20, 6], [106, 96, 4]]} />
  </>}</Badge>;
}

/** Composer: jewelled sheet music, notes landing on the staff one by one. */
export function ComposerBadge() {
  const notes: [number, number][] = [[38, 50], [50, 44], [62, 48], [74, 40], [44, 82], [58, 76], [72, 80], [86, 72]];
  return <Badge label="Bedazzled sheet music with notes being written">{(id) => <>
    <rect x="20" y="20" width="88" height="84" rx="6" fill={C.white} stroke={C.white} strokeWidth="8" transform="rotate(6 64 62)" />
    <rect x="20" y="20" width="88" height="84" rx="6" fill={`url(#${id}-cobalt)`} transform="rotate(6 64 62)" />
    <rect x="20" y="20" width="88" height="84" rx="6" fill={`url(#${id}-stones)`} transform="rotate(6 64 62)" />
    <rect x="12" y="14" width="88" height="84" rx="5" fill="#f7f7f5" stroke={`url(#${id}-gold)`} strokeWidth="2.5" />
    {[0, 32].map((dy) => <g key={dy}>{[0, 4, 8, 12, 16].map((y) => <line key={y} x1="20" y1={34 + dy + y} x2="94" y2={34 + dy + y} stroke={C.ink} strokeWidth="0.7" opacity="0.6" />)}
      <rect x="20" y={34 + dy} width="2.5" height="16" fill={`url(#${id}-gold)`} /></g>)}
    <text x="56" y="27" textAnchor="middle" fontSize="7" fontWeight="800" fill={C.cobalt} letterSpacing="1">SCORE</text>
    {notes.map(([x, y], i) => <g key={i} className="role-note" style={{ animationDelay: `${i * 0.4}s` }}>{note(x, y, i % 3 === 2 ? C.goldDeep : C.cobalt)}</g>)}
    <Glints at={[[108, 12, 6], [8, 104, 5], [110, 104, 4]]} />
  </>}</Badge>;
}
