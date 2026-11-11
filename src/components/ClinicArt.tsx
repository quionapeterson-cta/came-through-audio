import { artUrl } from "@/lib/art-url";
import type { OrganId } from "@/lib/royalty-checkup";

/**
 * The clinic's visual aids (PLAN-royalty-health-hub-v2 §1–§2): real SVG files under public/art/clinic, referenced by
 * literal path and pointed at the bucket by `artUrl()` (src/lib/art-url.ts). They're drawings of the
 * doctor's-office furniture the flow imitates: the front desk, the intake clipboard, the examination desk, the pamphlet
 * rack. Purely decorative, so they carry an empty alt and sit beside the words that explain them.
 */
const ART = {
  frontDesk: "/art/clinic/front-desk.svg",
  intake: "/art/clinic/intake.svg",
  exam: "/art/clinic/exam.svg",
  rack: "/art/clinic/rack.svg",
  stethoscope: "/art/clinic/stethoscope.svg",
  // The Waiting Area pamphlets: one illustrated leaflet per organ (plan §1).
  heart: "/art/clinic/pamphlet-heart.svg",
  lungs: "/art/clinic/pamphlet-lungs.svg",
  kidneys: "/art/clinic/pamphlet-kidneys.svg",
  brain: "/art/clinic/pamphlet-brain.svg",
  spine: "/art/clinic/pamphlet-spine.svg",
  isrc: "/art/clinic/pamphlet-isrc.svg",
} as const;

export type ClinicArtName = keyof typeof ART;

export function ClinicArt({ name, className = "" }: { name: ClinicArtName; className?: string }) {
  return (
    <img
      src={artUrl(ART[name])}
      alt=""
      aria-hidden="true"
      loading="lazy"
      decoding="async"
      className={`rounded-2xl border border-border object-cover ${className}`}
    />
  );
}

/**
 * One glyph per organ, drawn inline so a pamphlet can carry its own picture without a second request. Line art only:
 * it inherits the colour around it, so it works on both the light rack and a dark card.
 */
export function OrganGlyph({ organ, className = "h-7 w-7" }: { organ: Extract<OrganId, "heart" | "lungs" | "kidneys" | "brain" | "spine">; className?: string }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true" focusable="false">
      {organ === "heart" && (
        <path {...common} d="M16 27S5 20.5 5 13.2A5.6 5.6 0 0 1 16 10a5.6 5.6 0 0 1 11 3.2C27 20.5 16 27 16 27Z" />
      )}
      {organ === "lungs" && (
        <g {...common}>
          <path d="M16 6v13" />
          <path d="M16 12c-3 0-4.5 2-5.2 5.4-.6 3-.4 6 .7 7.1 1.5 1.5 4.5.4 4.5-2.4Z" />
          <path d="M16 12c3 0 4.5 2 5.2 5.4.6 3 .4 6-.7 7.1-1.5 1.5-4.5.4-4.5-2.4Z" />
        </g>
      )}
      {organ === "kidneys" && (
        <g {...common}>
          <path d="M12 8c-3 0-5 3-5 8s2 8 5 8c2.2 0 3-2 3-4.5S14.4 15 14.4 12 13.6 8 12 8Z" />
          <path d="M20 8c3 0 5 3 5 8s-2 8-5 8c-2.2 0-3-2-3-4.5S17.6 15 17.6 12 18.4 8 20 8Z" />
          <path d="M16 20v6" />
        </g>
      )}
      {organ === "brain" && (
        <g {...common}>
          <path d="M13 6a4 4 0 0 0-4 4 4 4 0 0 0-1 7.6V22a4 4 0 0 0 5 3.9" />
          <path d="M19 6a4 4 0 0 1 4 4 4 4 0 0 1 1 7.6V22a4 4 0 0 1-5 3.9" />
          <path d="M16 6v20M13 11h3M16 17h3M13 22h3" />
        </g>
      )}
      {organ === "spine" && (
        <g {...common}>
          <path d="M13 5h6M13 10h6M13 15h6M13 20h6M13 25h6" />
          <path d="M16 7v16" />
        </g>
      )}
    </svg>
  );
}

/**
 * The Music Royalty Doctor's coat (founder, 2026-11-11): the coat from the exam picture, drawn inline, with only a music
 * note on its chest patch. It introduces the Music Royalty Doctor inside the visit now that the hub's "Doctor is in" box is gone.
 * Inline, so it needs no new file in the art bucket.
 */
export function DoctorCoat({ className = "h-24 w-24" }: { className?: string }) {
  return (
    <svg viewBox="336 98 140 134" className={className} aria-hidden="true" focusable="false">
      <rect x="395" y="104" width="20" height="9" rx="4" fill="#0b0b0b" />
      <path d="M405 113v5" stroke="#0b0b0b" strokeWidth="4" strokeLinecap="round" opacity="0.5" />
      <path d="M405 118c-8 0-15 2-21 5l-34 14c-6 3-9 8-9 15v74h128v-74c0-7-3-12-9-15l-34-14c-6-3-13-5-21-5z" fill="#FFFFFF" stroke="#0b0b0b" strokeWidth="3" strokeLinejoin="round" />
      <path d="M405 118l-22 6 22 30 22-30z" fill="#E5E4E2" stroke="#0b0b0b" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M384 126l-17 12v26M426 126l17 12v26" fill="none" stroke="#0b0b0b" strokeWidth="2.5" opacity="0.35" strokeLinecap="round" />
      <path d="M405 152v74" stroke="#0b0b0b" strokeWidth="2.5" opacity="0.3" />
      <circle cx="405" cy="168" r="3.5" fill="#0b0b0b" opacity="0.45" />
      <circle cx="405" cy="194" r="3.5" fill="#0b0b0b" opacity="0.45" />
      {/* chest patch: a music note, nothing else */}
      <rect x="356" y="155" width="28" height="21" rx="3.5" fill="#E5E4E2" stroke="#0b0b0b" strokeWidth="2" />
      <path d="M368 171.5v-11l8-2v9" fill="none" stroke="#004AAD" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="366" cy="171.5" r="2.4" fill="#004AAD" />
      <circle cx="374" cy="167.5" r="2.4" fill="#004AAD" />
      <path d="M352 196h32v18h-32zM426 196h32v18h-32z" fill="none" stroke="#0b0b0b" strokeWidth="2.5" opacity="0.3" strokeLinejoin="round" />
      <path d="M424 112c8-8 26-8 34 0" fill="none" stroke="#004AAD" strokeWidth="5" strokeLinecap="round" />
      <path d="M438 118c0 24-5 34-5 48 0 18 10 30 17 36" fill="none" stroke="#004AAD" strokeWidth="6" strokeLinecap="round" />
      <circle cx="452" cy="206" r="12" fill="#E5E4E2" stroke="#0b0b0b" strokeWidth="3" />
      <circle cx="452" cy="206" r="5" fill="#4D8CFF" />
    </svg>
  );
}
