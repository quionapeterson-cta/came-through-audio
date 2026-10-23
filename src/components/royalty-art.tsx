import type { KeyboardEvent, ReactElement } from "react";
import type { Organ, OrganId, OrganState, ScanId, StepAction } from "@/lib/royalty-checkup";

/**
 * Artwork for the Royalty Health Report: organ symbols, the clickable body, a scan picture for every finding and a
 * doctor's tool for every treatment step. All static, app-authored SVG (no user text), so the scans are kept as markup strings.
 */
const SYMBOLS = `
<symbol id="rr-i-brain" viewBox="0 0 64 64"><path d="M30 10c-6-4-14 0-14 7-6 1-9 8-6 13-4 4-2 12 4 13 0 6 6 10 12 8 2 3 4 3 4 3V10z" fill="var(--rr-pink)"/><path d="M34 10c6-4 14 0 14 7 6 1 9 8 6 13 4 4 2 12-4 13 0 6-6 10-12 8-2 3-4 3-4 3V10z" fill="var(--rr-rose)"/><path d="M20 24c4 0 6 3 6 6M16 36c4-1 7 1 8 4M44 24c-4 0-6 3-6 6M48 36c-4-1-7 1-8 4" fill="none" stroke="var(--rr-heart-deep)" stroke-width="2" stroke-linecap="round" opacity=".55"/></symbol>
<symbol id="rr-i-heart" viewBox="0 0 64 64"><path d="M26 8v8M34 6v10" stroke="var(--rr-heart-deep)" stroke-width="5" stroke-linecap="round"/><path d="M32 56S8 42 8 24a12 12 0 0124-4 12 12 0 0124 4c0 18-24 32-24 32z" fill="var(--rr-heart)"/><path d="M18 22a6 6 0 016-5" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" opacity=".5"/></symbol>
<symbol id="rr-i-heart-broken" viewBox="0 0 64 64"><path d="M26 8v8M34 6v10" stroke="var(--rr-heart-deep)" stroke-width="5" stroke-linecap="round"/><path d="M30 55S6 41 6 23a12 12 0 0124-4l-4 9 6 6-4 7 2 14z" fill="var(--rr-heart)"/><path d="M36 55s22-14 22-32a12 12 0 00-22-4l-2 9 6 6-4 7z" fill="var(--rr-rose)"/></symbol>
<symbol id="rr-i-lungs" viewBox="0 0 64 64"><path d="M32 6v24M32 22l-6 6M32 22l6 6" stroke="var(--rr-heart-deep)" stroke-width="3.5" stroke-linecap="round" fill="none"/><path d="M24 18c-8 2-14 14-14 28 0 6 4 10 10 8 4-1 6-4 6-8V22c0-3-1-4-2-4z" fill="var(--rr-pink)"/><path d="M40 18c8 2 14 14 14 28 0 6-4 10-10 8-4-1-6-4-6-8V22c0-3 1-4 2-4z" fill="var(--rr-rose)"/></symbol>
<symbol id="rr-i-kidneys" viewBox="0 0 64 64"><path d="M20 10c-8 0-12 8-12 18s4 22 12 22c6 0 8-6 6-10-2-3-2-7 0-10 2-4 2-8 0-12-1-5-3-8-6-8z" fill="var(--rr-heart)"/><path d="M44 10c8 0 12 8 12 18s-4 22-12 22c-6 0-8-6-6-10 2-3 2-7 0-10-2-4-2-8 0-12 1-5 3-8 6-8z" fill="var(--rr-rose)"/><path d="M24 34c4 2 6 8 8 20M40 34c-4 2-6 8-8 20" stroke="var(--rr-pink)" stroke-width="3" fill="none" stroke-linecap="round"/></symbol>
<symbol id="rr-i-spine" viewBox="0 0 64 64"><g fill="var(--rr-pink)"><rect x="22" y="4" width="20" height="9" rx="4.5"/><rect x="21" y="16" width="22" height="9" rx="4.5"/><rect x="20" y="28" width="24" height="9" rx="4.5"/><rect x="21" y="40" width="22" height="9" rx="4.5"/><rect x="23" y="52" width="18" height="9" rx="4.5"/></g><path d="M16 8h6M42 8h6M15 20h6M43 20h6M14 32h6M44 32h6M15 44h6M43 44h6" stroke="var(--rr-rose)" stroke-width="3" stroke-linecap="round"/></symbol>
<symbol id="rr-i-pulse" viewBox="0 0 64 64"><circle cx="32" cy="32" r="27" fill="var(--rr-blush)" stroke="var(--rr-pink)" stroke-width="3"/><path d="M8 34h12l5-12 7 22 6-16 4 6h14" fill="none" stroke="var(--rr-heart)" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"/></symbol>`;

/** Mount once per page; every organ icon and scan below refers to these symbols. */
export function ArtDefs() {
  return <svg width="0" height="0" className="absolute" aria-hidden="true" dangerouslySetInnerHTML={{ __html: SYMBOLS }} />;
}

export const organSymbol = (o: Pick<Organ, "id" | "broken">) => (o.id === "heart" && o.broken ? "rr-i-heart-broken" : `rr-i-${o.id}`);
export function OrganIcon({ organ, className = "h-11 w-11" }: { organ: Pick<Organ, "id" | "broken">; className?: string }) {
  return <svg className={className} viewBox="0 0 64 64" aria-hidden="true"><use href={`#${organSymbol(organ)}`} /></svg>;
}

/** Each rhythm takes its status colour, shown on a small dark monitor so Cobalt, Gold and red all read. */
export const RHYTHM: Record<OrganState, { d: string; color: string; label: string }> = {
  healthy: { d: "M0 18 H30 L36 18 L40 4 L46 30 L50 18 H80 L86 18 L90 4 L96 30 L100 18 H140", color: "#4D8CFF", label: "Steady rhythm · healthy" },
  watch: { d: "M0 18 H24 L30 18 L34 8 L40 26 L44 18 H70 L74 14 L78 22 L82 18 H110 L116 18 L120 6 L126 28 L130 18 H140", color: "var(--rr-prestige)", label: "Uneven rhythm · watch" },
  treat: { d: "M0 18 H20 L24 18 L28 2 L34 34 L38 10 L42 26 L46 18 H64 L68 18 L72 12 L76 18 H96 L100 18 L104 2 L110 34 L114 18 H140", color: "#E0313F", label: "Irregular rhythm · needs treatment" },
  noflow: { d: "M0 18 H140", color: "#7d828c", label: "No signal · nothing coming in" },
};
export function MiniRhythm({ state }: { state: OrganState }) {
  const r = RHYTHM[state];
  return <svg className="rr-mini" viewBox="0 0 140 36" role="img" aria-label={r.label}><path d={r.d} fill="none" stroke={r.color} strokeWidth="2.5" strokeLinejoin="round" /></svg>;
}
/** The hero monitor line: steady when all is well, irregular when something needs treatment. */
export const MONITOR: Record<OrganState, string> = {
  healthy: "M0 30 H60 L70 30 L76 6 L84 54 L90 30 H160 L170 30 L176 6 L184 54 L190 30 H260 L270 30 L276 6 L284 54 L290 30 H400",
  watch: "M0 30 H70 L80 30 L86 14 L94 46 L100 30 H170 L176 24 L182 36 L188 30 H260 L270 30 L276 10 L284 50 L290 30 H400",
  treat: "M0 30 H70 L80 30 L86 8 L94 52 L100 18 L106 38 L112 30 H150 L158 30 L162 22 L168 30 H230 L240 30 L246 4 L254 56 L260 30 H400",
  noflow: "M0 30 H400",
};

const STATE_RING: Record<OrganState, string> = { healthy: "", watch: "var(--rr-prestige)", treat: "var(--rr-heart)", noflow: "" };

/** The clickable body: every organ opens its report. Organs show their state: full colour, ring, beating, or hollow. */
export function BodyDiagram({ organs, selected, onSelect }: { organs: Organ[]; selected: OrganId; onSelect: (id: OrganId) => void }) {
  const of = (id: OrganId) => organs.find((o) => o.id === id);
  const hit = (id: OrganId) => {
    const o = of(id);
    return o ? {
      className: `rr-hit${selected === id ? " rr-sel" : ""}`, tabIndex: 0, role: "button", "aria-label": `${o.name}: ${o.system}, ${o.state === "treat" ? "needs treatment" : o.state === "noflow" ? "no flow" : o.state}. Open its report.`,
      onClick: () => onSelect(id), onKeyDown: (e: KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(id); } },
    } : { "aria-hidden": true as const };
  };
  const look = (id: OrganId) => {
    const s = of(id)?.state ?? "healthy";
    return { opacity: s === "noflow" ? 0.4 : 1, filter: s === "noflow" ? "grayscale(1)" : undefined };
  };
  const mark = (id: OrganId, shape: ReactElement) => {
    const s = of(id)?.state;
    // Rings only for watch (dashed prestige) and treat (red); no-flow organs are simply drawn hollow grey.
    return s && STATE_RING[s] ? shape : null;
  };
  const ringStyle = (id: OrganId) => {
    const s = of(id)?.state ?? "healthy";
    return { stroke: STATE_RING[s], strokeDasharray: s === "watch" ? "6 4" : undefined };
  };
  const heart = of("heart");
  return (
    <svg viewBox="0 0 280 430" role="group" aria-label="Your royalty body. Select an organ to open its report.">
      <circle cx="140" cy="58" r="46" fill="none" stroke="var(--rr-hero-line)" strokeWidth="2.5" />
      <path d="M62 140c22-26 134-26 156 0l18 140c-4 58-36 104-64 120h-64c-28-16-60-62-64-120z" fill="none" stroke="var(--rr-hero-line)" strokeWidth="2.5" />
      {of("spine") && <g {...hit("spine")}>
        <rect className="rr-ring" x="120" y="120" width="40" height="270" rx="20" />
        {[124, 188, 252, 316].map((y) => <use key={y} href="#rr-i-spine" x="112" y={y} width="56" height="64" style={look("spine")} />)}
        {mark("spine", <rect x="118" y="118" width="44" height="274" rx="22" fill="none" strokeWidth="2.5" style={ringStyle("spine")} />)}
      </g>}
      <g {...hit("brain")}>
        <circle className="rr-ring" cx="140" cy="58" r="40" />
        <use href="#rr-i-brain" x="106" y="24" width="68" height="68" style={look("brain")} />
        {mark("brain", <circle cx="140" cy="58" r="40" fill="none" strokeWidth="2.5" style={ringStyle("brain")} />)}
      </g>
      {of("lungs") && <g {...hit("lungs")}>
        <rect className="rr-ring" x="66" y="132" width="148" height="122" rx="44" />
        <use href="#rr-i-lungs" x="70" y="126" width="140" height="130" style={look("lungs")} />
        {mark("lungs", <rect x="66" y="132" width="148" height="122" rx="44" fill="none" strokeWidth="2.5" style={ringStyle("lungs")} />)}
      </g>}
      {heart && <g {...hit("heart")}>
        <circle className="rr-ring" cx="154" cy="200" r="36" />
        {heart.state === "treat" && <circle className="rr-halo" cx="154" cy="200" r="28" fill="var(--rr-heart)" />}
        <g className={heart.state === "treat" ? "rr-beat" : undefined}><use href={`#${organSymbol(heart)}`} x="124" y="170" width="60" height="60" style={look("heart")} /></g>
        {mark("heart", <circle cx="154" cy="200" r="36" fill="none" strokeWidth="2.5" style={ringStyle("heart")} />)}
      </g>}
      {of("kidneys") && <g {...hit("kidneys")}>
        <rect className="rr-ring" x="84" y="266" width="112" height="84" rx="32" />
        <use href="#rr-i-kidneys" x="96" y="268" width="88" height="80" style={look("kidneys")} />
        {mark("kidneys", <rect x="84" y="266" width="112" height="84" rx="32" fill="none" strokeWidth="2.5" style={ringStyle("kidneys")} />)}
      </g>}
      <g {...hit("pulse")}>
        <rect className="rr-ring" x="16" y="398" width="248" height="28" rx="14" />
        <polyline points="22,412 92,412 104,394 118,428 132,400 144,412 258,412" fill="none" stroke={RHYTHM[of("pulse")?.state ?? "healthy"].color} strokeWidth="3.5" strokeLinejoin="round" strokeLinecap="round" />
      </g>
    </svg>
  );
}

// Scans: one picture per finding, on an imaging screen. The prestige marker circles the blockage.
const MK = (cx: number, cy: number, r: number) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="var(--rr-prestige)" stroke-width="2.5" stroke-dasharray="5 4"/>`;
const TX = (x: number, y: number, t: string) => `<text x="${x}" y="${y}" text-anchor="middle" font-family="Poppins,Arial" font-size="10" font-weight="700" letter-spacing="1.5" fill="#E5E4E2">${t}</text>`;
const USE = (id: string, x: number, y: number, w: number, h: number, extra = "") => `<use href="#${id}" x="${x}" y="${y}" width="${w}" height="${h}" ${extra}/>`;
const ARTERY = (px: number, label: string) => `
  <rect x="10" y="50" width="220" height="40" fill="#E0313F" opacity=".18"/><path d="M10 50H230M10 90H230" stroke="#F0687F" stroke-width="4"/>
  <path d="M${px - 30} 50q30 30 60 0z" fill="var(--rr-prestige)" opacity=".9"/><path d="M${px - 24} 90q24 -22 48 0z" fill="var(--rr-prestige)" opacity=".9"/>
  ${[24, 42, 60, 76].filter((x) => x < px - 34).map((x, i) => `<circle cx="${x}" cy="${i % 2 ? 64 : 76}" r="6" fill="#E0313F"/>`).join("")}
  <circle cx="${px - 40}" cy="70" r="6" fill="#E0313F"/><circle cx="${Math.min(px + 70, 214)}" cy="70" r="4" fill="#E0313F" opacity=".4"/>${MK(px, 70, 34)}${TX(120, 128, label)}`;
const KIDNEY_L = "M86 24c-16 0-24 16-24 36s8 44 24 44c12 0 16-12 12-20-4-6-4-14 0-20 4-8 4-16 0-24-2-10-6-16-12-16z";
const KIDNEY_R = "M154 24c16 0 24 16 24 36s-8 44-24 44c-12 0-16-12-12-20 4-6 4-14 0-20-4-8-4-16 0-24 2-10 6-16 12-16z";
const HOLLOW = `fill="none" stroke="#7d828c" stroke-width="2.5" stroke-dasharray="5 4"`;
const SCANS: Record<ScanId, string> = {
  "artery-left": ARTERY(110, "LEFT ARTERY · WRITER SHARE"),
  "artery-right": ARTERY(150, "RIGHT ARTERY · PUBLISHER SHARE"),
  broken: `<g transform="translate(56 4) scale(1.95)"><path d="M30 55S6 41 6 23a12 12 0 0124-4l-4 9 6 6-4 7 2 14z" fill="#E0313F"/><g transform="translate(6 2) rotate(8 46 30)"><path d="M36 55s22-14 22-32a12 12 0 00-22-4l-2 9 6 6-4 7z" fill="#F0687F" opacity=".55"/></g></g>${MK(124, 64, 22)}${TX(72, 132, "FILLED")}${TX(170, 132, "EMPTY HALF")}`,
  noheart: `<path d="M120 112S72 84 72 52a24 24 0 0148-8 24 24 0 0148 8c0 32-48 60-48 60z" ${HOLLOW}/><path d="M14 70H226" stroke="#E0313F" stroke-width="3"/>${TX(120, 132, "NO PRO · NO HEARTBEAT")}`,
  "lungs-hold": `${USE("rr-i-lungs", 70, 8, 100, 100)}<path d="M98 10l44 0" stroke="var(--rr-prestige)" stroke-width="4"/><path d="M104 2l32 16M136 2l-32 16" stroke="var(--rr-prestige)" stroke-width="3"/>${TX(120, 128, "AIRWAY CLOSED · NOT REGISTERED")}`,
  "lungs-one": `<path d="M104 30c-24 6-36 34-36 60 0 12 8 20 20 16 10-3 14-8 14-16V36c0-5-1-6-2-6z" fill="#F59AB1"/><path d="M136 30c24 6 36 34 36 60 0 12-8 20-20 16-10-3-14-8-14-16V36c0-5 1-6 2-6z" ${HOLLOW}/><path d="M120 8v30" stroke="#F0687F" stroke-width="4"/>${MK(152, 70, 34)}${TX(120, 130, "RECORDING NOT LINKED · NO ISRC")}`,
  "kidney-none": `<path d="${KIDNEY_L}" ${HOLLOW}/><path d="${KIDNEY_R}" ${HOLLOW}/><path d="M20 112H220" stroke="#7d828c" stroke-width="2"/>${TX(120, 132, "NOTHING FLOWING · NOT REGISTERED")}`,
  "kidney-one": `<path d="${KIDNEY_L}" fill="#E0313F"/><path d="${KIDNEY_R}" ${HOLLOW}/>${MK(158, 64, 36)}${TX(80, 132, "ARTIST")}${TX(160, 132, "MASTER OWNER · EMPTY")}`,
  "brain-fog": `${USE("rr-i-brain", 70, 6, 100, 100)}<g fill="#E5E4E2" opacity=".45"><ellipse cx="96" cy="50" rx="34" ry="12"/><ellipse cx="146" cy="66" rx="40" ry="13"/><ellipse cx="112" cy="84" rx="30" ry="10"/></g>${TX(120, 128, "FOGGY · CODES MISSING")}`,
  "brain-mixed": `${USE("rr-i-brain", 70, 6, 100, 100)}<path d="M30 30l30 20-14 6 30 22" fill="none" stroke="var(--rr-prestige)" stroke-width="3"/><path d="M210 30l-30 20 14 6-30 22" fill="none" stroke="#4D8CFF" stroke-width="3"/>${TX(120, 128, "TWO SIGNALS · ONE WRITER")}`,
  "brain-double": `${USE("rr-i-brain", 58, 6, 100, 100, 'opacity=".45"')}${USE("rr-i-brain", 82, 6, 100, 100)}${MK(120, 56, 50)}${TX(120, 128, "ONE ISRC · TWO SONGS")}`,
  "brain-tag": `<rect x="62" y="22" width="116" height="80" rx="10" fill="#E0313F"/><rect x="72" y="54" width="96" height="38" rx="4" fill="#fff"/><path d="M84 64l72 20M156 64l-72 20" stroke="#0b0b0b" stroke-width="3"/><text x="120" y="40" text-anchor="middle" font-family="Poppins,Arial" font-size="11" font-weight="800" fill="#fff">HELLO, MY NAME IS</text>${TX(120, 128, "STREAMING SHOWS DIFFERENT DETAILS")}`,
  "spine-align": `<g fill="#F59AB1">${[[100, 8], [104, 28], [116, 48], [102, 68], [100, 88]].map(([x, y]) => `<rect x="${x}" y="${y}" width="40" height="16" rx="8"/>`).join("")}</g>${MK(136, 56, 24)}${TX(120, 128, "SPLITS DON'T ADD UP TO 100%")}`,
  "spine-back": `<g fill="#F59AB1">${[8, 28, 88].map((y) => `<rect x="100" y="${y}" width="40" height="16" rx="8"/>`).join("")}</g><g ${HOLLOW}><rect x="100" y="48" width="40" height="16" rx="8"/><rect x="100" y="68" width="40" height="16" rx="8"/></g>${MK(120, 66, 26)}${TX(120, 128, "NO SIGNED SPLIT SHEET")}`,
  "pulse-skip": `<path d="M10 64H60L68 64 74 30 82 96 88 64H110" fill="none" stroke="#E0313F" stroke-width="3" stroke-linejoin="round"/><path d="M110 64H150" stroke="#7d828c" stroke-width="3" stroke-dasharray="4 6"/><path d="M150 64H170L176 64 182 30 190 96 196 64H230" fill="none" stroke="#E0313F" stroke-width="3" stroke-linejoin="round"/>${MK(130, 64, 22)}${TX(120, 128, "CHANGED AFTER REGISTERING")}`,
  "pulse-faint": `<path d="M10 64H50L56 64 60 56 66 72 70 64H120L126 64 130 58 136 70 140 64H190L196 64 200 57 206 71 210 64H230" fill="none" stroke="#E0313F" stroke-width="2.5" opacity=".6" stroke-linejoin="round"/>${TX(120, 128, "REGISTERED · NOT CONFIRMED YET")}`,
};
const CLEAR = (organ: Pick<Organ, "id" | "broken">) => `${USE(organSymbol(organ), 80, 6, 80, 80)}<circle cx="170" cy="78" r="16" fill="#004AAD"/><path d="M162 78l6 6 11-12" fill="none" stroke="#fff" stroke-width="3"/>${TX(120, 128, "CLEAR SCAN")}`;

export function Scan({ condition, organ, label = "SCAN" }: { condition?: ScanId; organ?: Pick<Organ, "id" | "broken">; label?: string }) {
  const art = condition ? SCANS[condition] : organ ? CLEAR(organ) : "";
  return (
    <div className="rr-scan">
      <span className="rr-scan-label">{label}</span>
      <svg viewBox="0 0 240 140" role="img" aria-label={`${label.toLowerCase()}: ${(condition ?? "clear").replace(/-/g, " ")}`} dangerouslySetInnerHTML={{ __html: art }} />
    </div>
  );
}

// The doctor's tool for each kind of treatment step.
const TOOL: Record<StepAction["kind"] | "none", { label: string; svg: string }> = {
  field: { label: "Bandage: patch the gap", svg: `<g transform="rotate(-35 16 16)"><rect x="3" y="11" width="26" height="10" rx="5" fill="var(--rr-pink)"/><rect x="11" y="11" width="10" height="10" fill="var(--rr-rose)"/><circle cx="14" cy="14" r="1" fill="#fff"/><circle cx="18" cy="14" r="1" fill="#fff"/><circle cx="14" cy="18" r="1" fill="#fff"/><circle cx="18" cy="18" r="1" fill="#fff"/></g>` },
  download: { label: "Prescription bottle: the agency file", svg: `<rect x="9" y="3" width="14" height="5" rx="1.5" fill="var(--rr-heart)"/><rect x="7" y="8" width="18" height="21" rx="4" fill="var(--rr-rose)"/><rect x="10" y="13" width="12" height="10" rx="2" fill="#fff"/><text x="16" y="21.5" text-anchor="middle" font-family="Georgia,serif" font-size="9" font-weight="700" fill="var(--rr-heart)">℞</text>` },
  portal: { label: "Stethoscope: see the agency", svg: `<path d="M8 4v8a6 6 0 0012 0V4" fill="none" stroke="var(--rr-heart)" stroke-width="2.5" stroke-linecap="round"/><path d="M14 18v3a5 5 0 0010 0v-3" fill="none" stroke="var(--rr-heart)" stroke-width="2.5" stroke-linecap="round"/><circle cx="24" cy="15.5" r="3" fill="var(--rr-rose)"/><circle cx="8" cy="4" r="1.6" fill="var(--rr-heart-deep)"/><circle cx="20" cy="4" r="1.6" fill="var(--rr-heart-deep)"/>` },
  tick: { label: "Chart: tick it off", svg: `<rect x="6" y="5" width="20" height="24" rx="3" fill="var(--rr-rose)"/><rect x="11" y="3" width="10" height="5" rx="1.5" fill="var(--rr-heart-deep)"/><rect x="9" y="10" width="14" height="16" rx="1.5" fill="#fff"/><path d="M11.5 18l3 3 6-6" fill="none" stroke="var(--rr-heart)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>` },
  split: { label: "Consent form: everyone signs", svg: `<rect x="5" y="4" width="18" height="24" rx="2" fill="#fff" stroke="var(--rr-rose)" stroke-width="2"/><path d="M9 10h10M9 14h10M9 22c2-3 3 1 5-1" fill="none" stroke="var(--rr-heart)" stroke-width="1.8" stroke-linecap="round"/><path d="M20 26l8-12 2 1.5-8 12-3 1z" fill="var(--rr-heart)"/>` },
  join: { label: "Wristband: join a PRO", svg: `<ellipse cx="16" cy="16" rx="12" ry="7" fill="none" stroke="var(--rr-rose)" stroke-width="4"/><rect x="10" y="12" width="12" height="8" rx="2" fill="#fff" stroke="var(--rr-heart)" stroke-width="1.5"/><path d="M13 16h6" stroke="var(--rr-heart)" stroke-width="1.5"/>` },
  distributor: { label: "Phone: call your distributor", svg: `<rect x="9" y="3" width="14" height="26" rx="3" fill="var(--rr-rose)"/><rect x="11" y="7" width="10" height="16" rx="1" fill="#fff"/><circle cx="16" cy="26" r="1.4" fill="#fff"/><path d="M13 12h6M13 15h4" stroke="var(--rr-heart)" stroke-width="1.5" stroke-linecap="round"/>` },
  changes: { label: "Magnifier: look closer", svg: `<circle cx="13" cy="13" r="8" fill="#fff" stroke="var(--rr-heart)" stroke-width="3"/><path d="M19 19l8 8" stroke="var(--rr-heart-deep)" stroke-width="4" stroke-linecap="round"/><path d="M9 13h2l1.5-3 2 6 1.5-3h2" fill="none" stroke="var(--rr-rose)" stroke-width="1.5" stroke-linejoin="round"/>` },
  upload: { label: "Test tube: lab results", svg: `<path d="M12 3h8M13 3v18a3 3 0 006 0V3" fill="none" stroke="var(--rr-heart)" stroke-width="2.5" stroke-linecap="round"/><path d="M13 14h6v7a3 3 0 01-6 0z" fill="var(--rr-rose)"/><circle cx="16" cy="18" r="1" fill="#fff"/>` },
  none: { label: "Capsule", svg: `<g transform="rotate(-40 16 16)"><rect x="5" y="11" width="22" height="10" rx="5" fill="var(--rr-rose)"/><path d="M16 11h6a5 5 0 010 10h-6z" fill="var(--rr-heart)"/></g>` },
};
export function Tool({ kind }: { kind?: StepAction["kind"] | undefined }) {
  const t = TOOL[kind ?? "none"];
  return <span className="rr-tool" title={t.label}><svg viewBox="0 0 32 32" role="img" aria-label={t.label} dangerouslySetInnerHTML={{ __html: t.svg }} /></span>;
}
