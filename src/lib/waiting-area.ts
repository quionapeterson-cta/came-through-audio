import type { OrganId } from "@/lib/royalty-checkup";

/**
 * Waiting Area pamphlets (PLAN-royalty-health-hub-v2 §1). Copy is locked in the plan; change it there first.
 * Kept out of the component so the file only exports a component (react-refresh).
 */
export type Pamphlet = {
  organ: Extract<OrganId, "heart" | "lungs" | "kidneys" | "brain" | "spine">;
  healthy: string;
  unhealthy: string;
  meaning: string;
};

export const PAMPHLETS: Pamphlet[] = [
  {
    organ: "heart",
    healthy: "Registered with your PRO, with writers and splits on file",
    unhealthy: "Not registered, or missing writers",
    meaning: "Performance royalties go uncollected",
  },
  {
    organ: "lungs",
    healthy: "A publisher (or Self-published) on file, publisher shares adding up to 100%",
    unhealthy: "No publisher, or shares that don't add up",
    meaning: "The publisher share goes unclaimed",
  },
  {
    organ: "kidneys",
    healthy: "The work and its ISRC matched at The MLC",
    unhealthy: "Unmatched, or missing an ISRC",
    meaning: "Mechanical royalties are held back or unmatched",
  },
  {
    organ: "brain",
    healthy: "ISRC, UPC, IPI and legal names all complete",
    unhealthy: "Identifiers missing or mismatched",
    meaning: "Payments can't find the right person",
  },
  {
    organ: "spine",
    healthy: "The recording registered with SoundExchange and the master share set",
    unhealthy: "Not registered",
    meaning: "Digital performance royalties on the recording go uncollected",
  },
];
