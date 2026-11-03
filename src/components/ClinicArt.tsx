import type { OrganId } from "@/lib/royalty-checkup";

/**
 * The clinic's visual aids (PLAN-royalty-health-hub-v2 §1–§2): real SVG files under public/art/clinic, referenced by
 * literal path so they cache like any other asset and can be read straight from the repo. They're drawings of the
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
} as const;

export type ClinicArtName = keyof typeof ART;

export function ClinicArt({ name, className = "" }: { name: ClinicArtName; className?: string }) {
  return (
    <img
      src={ART[name]}
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
