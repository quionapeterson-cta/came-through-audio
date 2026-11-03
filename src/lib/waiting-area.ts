import type { OrganId } from "@/lib/royalty-checkup";

/**
 * Waiting Area pamphlets (PLAN-royalty-health-hub-v2 §1). The organ, its healthy reading, its bad reading and the
 * royalty meaning are the plan's table; the paragraphs are the education around them, so a visitor can read the whole
 * leaflet and not just the headline. Kept out of the component so the file only exports a component (react-refresh).
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
    healthy: "Registered with your PRO, with writers and splits on file",
    unhealthy: "Not registered, or missing writers",
    meaning: "Performance royalties go uncollected",
  },
  {
    organ: "lungs",
    subject: "Publishing (the publisher half)",
    lede: "Someone has to collect the publisher half. That someone can be you.",
    body: [
      "A publisher registers and administers songs, licenses them, and collects the publisher half of every performance and mechanical royalty. If you don't have one, you are self-published: you keep that half, and you do that work.",
      "BMI has a special case. A BMI writer with no publishing company is paid both halves by BMI, so those songs need neither a publisher nor the Self-published tick. Writers at other PROs need one or the other, which is why the Doctor asks instead of assuming.",
      "Publisher shares are entered as 100% of the publisher half, not of the whole song. Shares that add up to 200% are the usual mistake, and they read as out of alignment in the report.",
    ],
    healthy: "A publisher (or Self-published) on file, publisher shares adding up to 100%",
    unhealthy: "No publisher, or shares that don't add up",
    meaning: "The publisher share goes unclaimed",
  },
  {
    organ: "kidneys",
    subject: "Mechanical royalties (The MLC)",
    lede: "Every stream and download pays a mechanical royalty, separate from the performance one.",
    body: [
      "A mechanical royalty is owed each time a copy of your song is made: a stream, a download, a CD. It's collected by a mechanical society — The MLC in the US — not by your PRO, so registering with one does nothing for the other.",
      "The MLC matches your composition (writers, publishers, IPIs) to a recording by its ISRC. If the ISRC is missing, the stream arrives with nothing to attach it to, and the money is held back or paid out by market share instead.",
      "What the Doctor looks for: the work registered at the mechanical society, and an ISRC on the recording that points back to it.",
    ],
    healthy: "The work and its ISRC matched at The MLC",
    unhealthy: "Unmatched, or missing an ISRC",
    meaning: "Mechanical royalties are held back or unmatched",
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
    healthy: "ISRC, UPC, IPI and legal names all complete",
    unhealthy: "Identifiers missing or mismatched",
    meaning: "Payments can't find the right person",
  },
  {
    organ: "spine",
    subject: "Neighbouring rights (SoundExchange)",
    lede: "The recording earns its own performance money, separate from the song.",
    body: [
      "Non-interactive digital radio — radio-style streaming, satellite and cable music channels — pays the recording, not the composition. In the US, SoundExchange collects it. It's a different right from the one your PRO collects, so a song can be registered everywhere and still have nothing coming from these plays.",
      "SoundExchange pays the featured artist and the owner of the master, and holds a share for the session musicians and vocalists who played on it. If you own your masters, you register as both the artist and the rights owner; the master share tells them how much of that side is yours.",
      "What the Doctor looks for: the recording registered with its ISRC and UPC, the master share set, and a registration that matches the release you actually put out.",
    ],
    healthy: "The recording registered with SoundExchange and the master share set",
    unhealthy: "Not registered",
    meaning: "Digital performance royalties on the recording go uncollected",
  },
];
