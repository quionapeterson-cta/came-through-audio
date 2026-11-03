import type { OrganId } from "@/lib/royalty-checkup";

/**
 * Waiting Area pamphlets (PLAN-royalty-health-hub-v2 §1). Each organ means the same thing here as in the diagnosis
 * (`royalty-checkup.ts`, PLAN-royalty-health-report §2): Heart = performance, Lungs = mechanicals, Kidneys = digital
 * performance, Brain = metadata, Spine = splits and paperwork. **Founder decision, 2026-11-03:** the plan's pamphlet
 * table was brought into line with the built diagnosis rather than the other way round. Kept out of the component so the
 * file only exports a component (react-refresh).
 */
export type Pamphlet = {
  organ: Extract<OrganId, "heart" | "lungs" | "kidneys" | "brain" | "spine">;
  /** What the pamphlet is about, in the language of the money rather than the organ. */
  subject: string;
  /** One line that says why the organ matters, under the title. */
  lede: string;
  /** The pamphlet itself: two or three short paragraphs, in the order they're printed. */
  body: string[];
  healthy: string;
  unhealthy: string;
  meaning: string;
};

export const PAMPHLETS: Pamphlet[] = [
  {
    organ: "heart",
    subject: "Performance royalties (your PRO)",
    lede: "Every public play of your song pays the writer side. Your PRO is the only one who can collect it for you.",
    body: [
      "A performance royalty is paid when your song is played in public: radio, TV, a venue, a livestream, or a streaming service. In the US, ASCAP, BMI, SESAC and GMR collect it; every other country has its own society. None of them know a song exists until you register it with your legal name and your IPI number, the ID your PRO gives you.",
      "The money has two halves. The writer half is yours. The publisher half is paid to a publisher, or to you as a self-published writer. Both halves are collected on the same plays, so a song with only one half set up keeps collecting only half of what it earns.",
      "What the Doctor looks for: every song registered with your PRO, a legal name and an IPI for each writer in a PRO, and an answer on the publisher side. A song edited after it was registered counts as needing an update, because the society still has the old details.",
    ],
    healthy: "Registered with your PRO, with writers + splits on file",
    unhealthy: "Not registered / missing writers",
    meaning: "Performance royalties uncollected",
  },
  {
    organ: "lungs",
    subject: "Mechanical royalties (The MLC)",
    lede: "Every stream and download pays a mechanical royalty, separate from the performance one.",
    body: [
      "A mechanical royalty is owed each time a copy of your song is made: a stream, a download, a CD. It's collected by a mechanical society — The MLC in the US — not by your PRO, so registering with one does nothing for the other.",
      "The MLC matches your composition (writers, publishers, IPIs) to a recording by its ISRC. If the ISRC is missing, the stream arrives with nothing to attach it to, and the money is held back or paid out by market share instead.",
      "Why the lungs: every stream is a breath, and a song that isn't registered for mechanicals holds its breath on all of them. What the Doctor looks for: the work registered at the mechanical society, and an ISRC on the recording that points back to it.",
    ],
    healthy: "Work + ISRC matched at The MLC",
    unhealthy: "Unmatched / missing ISRC",
    meaning: "Mechanical royalties held / unmatched",
  },
  {
    organ: "kidneys",
    subject: "Digital performance (SoundExchange)",
    lede: "Internet and satellite radio pay the recording, and that money has its own registry.",
    body: [
      "Non-interactive digital radio — radio-style streaming, satellite and cable music channels — pays the recording, not the composition. In the US, SoundExchange collects it. It's a different right from the one your PRO collects, so a song can be registered everywhere and still have nothing coming in from these plays.",
      "SoundExchange pays the featured artist and the owner of the master, and holds a share for the session musicians and vocalists who played on it. If you own your masters, you register as both the artist and the rights owner; the master share tells them how much of that side is yours.",
      "Why the kidneys: they filter what arrives out of the airwaves. What the Doctor looks for: the recording registered with its ISRC and UPC, the master share set, and a registration that matches the release you actually put out.",
    ],
    healthy: "Recording registered, master share set",
    unhealthy: "Not registered",
    meaning: "Digital performance (recording) royalties uncollected",
  },
  {
    organ: "brain",
    subject: "Metadata and identifiers",
    lede: "Agencies don't find songs by title. They find them by code.",
    body: [
      "Four codes do most of the work. The ISRC identifies a recording and comes from your distributor. The ISWC identifies the composition and appears once your PRO registers it. The UPC identifies a release. The IPI identifies a writer or a publisher.",
      "Matching is literal. One writer entered two ways — two IPI numbers, or two spellings of a legal name — is two different people to the system, and the payments split between them. One ISRC used on two songs pays the wrong recording.",
      "What the Doctor looks for: an ISRC on every song, an ISWC on registered songs, one IPI per writer, no duplicate ISRCs, and titles and artist names that match what streaming shows.",
    ],
    healthy: "ISRC, UPC, IPI and legal names complete",
    unhealthy: "Missing / mismatched IDs",
    meaning: "Payments can't find the right person",
  },
  {
    organ: "spine",
    subject: "Splits and paperwork",
    lede: "Every agency divides your money the same way: by the shares on file.",
    body: [
      "A split is each writer's percentage of the song, and the shares must total exactly 100%. When they don't — a typo that leaves 90% or 110% — the agency has no way to divide the money, so the payment is held until someone fixes it.",
      "Publishers are divided the same way, but separately: publisher shares total 100% of the publisher half, not of the whole song. Entering them as shares of the whole song is the most common way a correct split ends up looking wrong.",
      "A split sheet is the signed agreement behind those numbers, and with more than one writer a disagreement over shares can freeze every payment for the song. What the Doctor looks for: writer shares at 100%, publisher shares at 100% of their half, and a signed sheet whenever there is more than one writer.",
    ],
    healthy: "Writer splits 100%, publisher shares 100% of their half, signed split sheet",
    unhealthy: "Shares off / no signed sheet",
    meaning: "Agencies hold payments until the splits add up",
  },
];
