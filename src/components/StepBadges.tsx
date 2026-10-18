import { Badge, C, Glints } from "@/components/RoleBadges";

/**
 * "How it works" step badges in the award art's style. They sit still and play their action only while the step
 * card (a Tailwind `group`) is hovered; the motion lives in styles.css (step-*).
 */
const size = "h-20 w-20";

/** Upload your master: a jewelled audio file, its waveform dancing as a gold arrow lifts it up. */
export function UploadBadge() {
  return <Badge label="Audio file uploading" className={size}>{(id) => <>
    <path d="M24 14 h46 l18 18 v72 a6 6 0 0 1 -6 6 h-58 a6 6 0 0 1 -6 -6 v-84 a6 6 0 0 1 6 -6 Z" fill={C.white} stroke={C.white} strokeWidth="8" strokeLinejoin="round" />
    <path d="M24 14 h46 l18 18 v72 a6 6 0 0 1 -6 6 h-58 a6 6 0 0 1 -6 -6 v-84 a6 6 0 0 1 6 -6 Z" fill={`url(#${id}-cobalt)`} />
    <path d="M24 14 h46 l18 18 v72 a6 6 0 0 1 -6 6 h-58 a6 6 0 0 1 -6 -6 v-84 a6 6 0 0 1 6 -6 Z" fill={`url(#${id}-stones)`} />
    <path d="M70 14 v12 a6 6 0 0 0 6 6 h12 Z" fill={`url(#${id}-gold)`} />
    {([[30, 14], [39, 26], [48, 18], [57, 30], [66, 12]] as const).map(([x, h], i) => <rect key={i} className="step-bar" style={{ animationDelay: `${i * 0.08}s` }} x={x} y={62 - h} width="5" height={h * 2} rx="2.5" fill={`url(#${id}-gold)`} />)}
    <g className="step-lift"><circle cx="88" cy="88" r="18" fill={`url(#${id}-gold)`} stroke={C.white} strokeWidth="4" />
      <path d="M88 98 v-18 M80 87 l8 -8 l8 8" stroke={C.deep} strokeWidth="4.5" fill="none" strokeLinecap="round" strokeLinejoin="round" /></g>
    <Glints className="step-glint" at={[[106, 18, 6], [10, 100, 4]]} />
  </>}</Badge>;
}

/** Embed your metadata: a gold credits tag slides into a spinning record. */
export function EmbedBadge() {
  return <Badge label="Metadata tag going into a record" className={size}>{(id) => <>
    <circle cx="54" cy="64" r="40" fill={C.white} />
    <g className="step-spin">
      <circle cx="54" cy="64" r="36" fill={C.ink} />
      {[30, 24, 18].map((r) => <circle key={r} cx="54" cy="64" r={r} fill="none" stroke={C.platinum} strokeWidth="0.6" opacity="0.35" />)}
      <circle cx="54" cy="64" r="12" fill={`url(#${id}-cobalt)`} /><circle cx="54" cy="64" r="12" fill={`url(#${id}-stones)`} />
      <circle cx="54" cy="64" r="2.5" fill={C.white} /><path d="M34 42 a30 30 0 0 1 16 -8" stroke={C.white} strokeWidth="2" opacity="0.5" fill="none" strokeLinecap="round" />
    </g>
    <g className="step-tag">
      <path d="M78 22 h28 a4 4 0 0 1 4 4 v20 a4 4 0 0 1 -4 4 h-28 l-10 -14 Z" fill={`url(#${id}-gold)`} stroke={C.white} strokeWidth="3.5" strokeLinejoin="round" />
      <circle cx="77" cy="36" r="2.5" fill={C.deep} />
      <text x="94" y="40" textAnchor="middle" fontSize="10" fontWeight="800" fill={C.deep}>ISRC</text>
    </g>
    <Glints className="step-glint" at={[[106, 100, 6], [12, 16, 4]]} />
  </>}</Badge>;
}

/** Save to your catalog: a jewelled vault door, its gold dial turning to lock. */
export function VaultBadge() {
  return <Badge label="Bedazzled catalog vault" className={size}>{(id) => <>
    <rect x="12" y="14" width="96" height="92" rx="12" fill={C.white} stroke={C.white} strokeWidth="8" />
    <rect x="12" y="14" width="96" height="92" rx="12" fill={`url(#${id}-silver)`} stroke={`url(#${id}-gold)`} strokeWidth="3" />
    <rect x="12" y="14" width="96" height="92" rx="12" fill={`url(#${id}-stones)`} opacity="0.6" />
    {[34, 86].map((y) => <rect key={y} x="8" y={y - 6} width="8" height="12" rx="2" fill={`url(#${id}-gold)`} />)}
    <circle cx="62" cy="60" r="34" fill={`url(#${id}-cobalt)`} stroke={`url(#${id}-gold)`} strokeWidth="3" />
    <circle cx="62" cy="60" r="34" fill={`url(#${id}-stones)`} />
    <g className="step-dial">
      {[0, 60, 120, 180, 240, 300].map((a) => <rect key={a} x="60" y="34" width="4" height="16" rx="2" fill={`url(#${id}-gold)`} transform={`rotate(${a} 62 60)`} />)}
      <circle cx="62" cy="60" r="11" fill={`url(#${id}-gold)`} stroke={C.white} strokeWidth="2" /><circle cx="62" cy="60" r="4" fill={C.deep} />
    </g>
    <Glints className="step-glint" at={[[106, 12, 6], [12, 108, 4]]} />
  </>}</Badge>;
}

/** Create a split sheet: a sheet with a jewelled pie chart whose share pops out. */
export function SplitBadge() {
  return <Badge label="Split sheet with a pie chart" className={size}>{(id) => <>
    <rect x="18" y="10" width="78" height="100" rx="6" fill={C.white} stroke={C.white} strokeWidth="8" />
    <rect x="18" y="10" width="78" height="100" rx="6" fill="#f7f7f5" stroke={`url(#${id}-gold)`} strokeWidth="2.5" />
    <text x="57" y="26" textAnchor="middle" fontSize="8" fontWeight="800" fill={C.cobalt} letterSpacing="1">SPLITS</text>
    <g className="step-pie">
      <path d="M57 62 L57 34 A28 28 0 0 1 81.2 76 Z" fill={`url(#${id}-cobalt)`} /><path d="M57 62 L57 34 A28 28 0 0 1 81.2 76 Z" fill={`url(#${id}-stones)`} />
      <path d="M57 62 L81.2 76 A28 28 0 0 1 32.8 76 Z" fill={C.electric} />
    </g>
    <path className="step-slice" d="M57 62 L32.8 76 A28 28 0 0 1 57 34 Z" fill={`url(#${id}-gold)`} stroke={C.white} strokeWidth="1.5" />
    {[96, 102].map((y, i) => <rect key={y} x="30" y={y} width={i ? 36 : 54} height="2.5" rx="1.2" fill={C.ink} opacity="0.25" />)}
    <Glints className="step-glint" at={[[106, 16, 6], [10, 96, 4]]} />
  </>}</Badge>;
}

/** Collect signatures: a signature writes itself across a contract and a gold seal stamps it verified. */
export function SignBadge() {
  return <Badge label="Contract being signed and verified" className={size}>{(id) => <>
    <rect x="14" y="14" width="84" height="92" rx="6" fill={C.white} stroke={C.white} strokeWidth="8" />
    <rect x="14" y="14" width="84" height="92" rx="6" fill={`url(#${id}-cobalt)`} />
    <rect x="14" y="14" width="84" height="92" rx="6" fill={`url(#${id}-stones)`} />
    <rect x="22" y="22" width="68" height="76" rx="3" fill="#f7f7f5" />
    {[32, 40, 48].map((y, i) => <rect key={y} x="30" y={y} width={i === 2 ? 30 : 52} height="2.5" rx="1.2" fill={C.ink} opacity="0.25" />)}
    <path className="step-sign" pathLength="1" d="M30 76 c6 -14 10 -14 8 0 c-1 8 6 -10 10 -6 c3 3 0 8 4 6 c4 -3 6 -8 10 -4 c2 2 4 2 8 -1" stroke={C.cobalt} strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    <line x1="30" y1="84" x2="80" y2="84" stroke={C.ink} strokeWidth="1" opacity="0.4" />
    <g className="step-seal"><circle cx="92" cy="92" r="15" fill={`url(#${id}-gold)`} stroke={C.white} strokeWidth="3.5" />
      <path d="M85 92 l5 5 l9 -10" stroke={C.deep} strokeWidth="3.5" fill="none" strokeLinecap="round" strokeLinejoin="round" /></g>
    <Glints className="step-glint" at={[[108, 14, 6], [8, 70, 4]]} />
  </>}</Badge>;
}

/** AI Protection: a jewelled shield, light sweeping across it as the gold check stamps in. */
export function ShieldBadge() {
  const shield = "M60 8 L102 22 V56 C102 84 84 102 60 112 C36 102 18 84 18 56 V22 Z";
  return <Badge label="Bedazzled protection shield" className={size}>{(id) => <>
    <clipPath id={`${id}-shield`}><path d={shield} /></clipPath>
    <path d={shield} fill={C.white} stroke={C.white} strokeWidth="8" strokeLinejoin="round" />
    <path d={shield} fill={`url(#${id}-cobalt)`} stroke={`url(#${id}-gold)`} strokeWidth="3.5" strokeLinejoin="round" />
    <path d={shield} fill={`url(#${id}-stones)`} />
    <g clipPath={`url(#${id}-shield)`}><rect className="step-sheen" x="-30" y="0" width="22" height="120" fill={C.white} opacity="0.45" transform="skewX(-20)" /></g>
    <path className="step-check" pathLength="1" d="M40 60 l14 14 l28 -30" stroke={`url(#${id}-gold)`} strokeWidth="9" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    <Glints className="step-glint" at={[[108, 12, 6], [12, 100, 4]]} />
  </>}</Badge>;
}
