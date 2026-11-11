import type { OrganId } from "@/lib/royalty-checkup";

/**
 * Waiting Area pamphlets (PLAN-royalty-health-hub-v2 §1). Each organ means the same thing here as in the diagnosis
 * (`royalty-checkup.ts`, PLAN-royalty-health-report §2): Heart = performance, Lungs = mechanicals, Kidneys = digital
 * performance, Brain = metadata, Spine = splits and paperwork. **Founder decision, 2026-11-03:** the plan's pamphlet
 * table was brought into line with the built diagnosis rather than the other way round. Facts checked against ASCAP, BMI,
 * The MLC, SoundExchange and the US ISRC Agency on 2026-11-11. Kept out of the component so the
 * file only exports a component (react-refresh).
 */
/** The five organs, plus the ISRC leaflet, which is about a code rather than an organ (founder, 2026-11-05). */
export type PamphletOrgan = Extract<OrganId, "heart" | "lungs" | "kidneys" | "brain" | "spine"> | "isrc";

export type Pamphlet = {
  organ: PamphletOrgan;
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
      "A performance royalty is paid when your song is played in public: radio, TV, a venue, a livestream, or a streaming service. In the US, ASCAP, BMI, SESAC and GMR collect it (SESAC and GMR by invitation); every other country has its own society. None of them know a song exists until you register it with your legal name and your IPI number, the ID your PRO gives you.",
      "The money has two halves. The writer half is yours. The publisher half is paid to a publisher, or to you as a self-published writer. Both halves are collected on the same plays. At BMI, a song with no publisher pays you both halves. At ASCAP, you collect the publisher half through your own ASCAP publishing company.",
      "What the Music Royalty Doctor looks for: every song registered with your PRO, a legal name and an IPI for each writer in a PRO, and an answer on the publisher side. A song edited after it was registered counts as needing an update, because the society still has the old details.",
    ],
    healthy: "Registered with your PRO, with writers + splits on file",
    unhealthy: "Not registered / missing writers",
    meaning: "Performance royalties uncollected",
  },
  {
    organ: "lungs",
    subject: "Mechanical royalties (The MLC)",
    lede: "Every on-demand stream and download pays a mechanical royalty, separate from the performance one.",
    body: [
      "A mechanical royalty is owed each time a copy of your song is made: an on-demand stream, a download, a CD. For streams and downloads in the US, The MLC collects it — not your PRO — so registering with one does nothing for the other. Radio-style streaming doesn't pay a mechanical, and CDs and other physical copies are licensed outside The MLC.",
      "The MLC matches your composition (writers, publishers, IPIs) to a recording by its ISRC. If your work isn't linked to the recording's ISRC, the royalty sits unmatched: it's held, and after at least three years it may be paid out by market share.",
      "Why the lungs: every stream is a breath, and a song that isn't registered for mechanicals holds its breath on all of them. What the Music Royalty Doctor looks for: the work registered at the mechanical society, and an ISRC on the recording that points back to it.",
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
      "Non-interactive digital radio — radio-style streaming, satellite and cable music channels — pays the recording, separately from what your PRO collects for the song. In the US, SoundExchange collects it. It's a different right from the one your PRO collects, so a song can be registered everywhere and still have nothing coming in from these plays.",
      "SoundExchange pays the featured artist and the owner of the master, and sends 5% to the AFM & SAG-AFTRA Fund, which pays the session musicians and vocalists who played on it. If you own your masters, you register as both the artist and the rights owner; the master share tells them how much of that side is yours.",
      "Why the kidneys: they filter what arrives out of the airwaves. What the Music Royalty Doctor looks for: the recording registered with its ISRC (and UPC where you have one), the master share set, and a registration that matches the release you actually put out.",
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
      "Four codes do most of the work. The ISRC identifies a recording and usually comes from your distributor, or you can assign your own through the US ISRC Agency. The ISWC identifies the composition and appears once your PRO registers it and every writer has an IPI. The UPC identifies a release. The IPI identifies a writer or a publisher.",
      "Matching is literal. One writer entered two ways — two IPI numbers, or two spellings of a legal name — is two different people to the system, and the payments split between them. One ISRC used on two songs pays the wrong recording.",
      "What the Music Royalty Doctor looks for: an ISRC on every song, an ISWC on registered songs, one IPI per writer, no duplicate ISRCs, and titles and artist names that match what streaming shows.",
    ],
    healthy: "ISRC, UPC, IPI and legal names complete",
    unhealthy: "Missing / mismatched IDs",
    meaning: "Payments can't find the right person",
  },
  {
    organ: "spine",
    subject: "Splits and paperwork",
    lede: "Every agency pays by the shares on file, but each counts them its own way.",
    body: [
      "A split is each writer's percentage of the song. Shares that add up to more than 100% are refused or held until someone fixes them; shares that add up to less leave the missing part unpaid. BMI counts writers and publishers as 100% each, ASCAP as 50% each, so enter the shares the way each form asks.",
      "Here at Came Through Audio, publishers are entered separately: publisher shares total 100% of the publisher half, not of the whole song. Mixing the two scales up is the most common way a correct split ends up looking wrong.",
      "A split sheet is the signed agreement behind those numbers, and with more than one writer a disagreement over shares can freeze every payment for the song. What the Music Royalty Doctor looks for: writer shares at 100%, publisher shares at 100% of their half, and a signed sheet whenever there is more than one writer.",
    ],
    healthy: "Writer splits 100%, publisher shares 100% of their half, signed split sheet",
    unhealthy: "Shares off / no signed sheet",
    meaning: "Agencies hold payments until the splits add up",
  },
  {
    organ: "isrc",
    subject: "Registering with your PRO, with or without an ISRC",
    lede: "A PRO registers the song, not the recording. The ISRC belongs to the recording, so it can never be the thing that decides whether the song gets registered.",
    body: [
      "The two codes name different copyrights. An ISRC names one recording: this take, this mix, this master. Your PRO registers the composition — the words and music, shared by every recording of it — and identifies it by the writers' legal names, their IPI numbers and the splits, then by an ISWC assigned once the PRO registers it. That is why the registration form needs your writers and splits, and a recording code is optional.",
      "So a song can be registered before a recording of it exists. A songwriter writing for other artists, a composer selling scores or cues, a topliner handing over a demo: none of them hold an ISRC and all of them register. Register the work as soon as the splits are settled. If a recording comes out later, add the recording then — the work is not re-registered, and its writers, shares and IPIs stay as they are.",
      "One song, many codes: a cover, a remix, a live version and a sync edit each carry their own ISRC, while the composition stays one work with one set of splits. That is also why an ISRC can't stand in for a work ID, and why registering the same song under two recordings can create a duplicate work instead of two registrations.",
      "Where the ISRC does earn its keep: once a recording is out, plays get matched back to the song through the recordings registered against it, SoundExchange can't register a recording without one, and The MLC needs it to match streams to your song. What the Music Royalty Doctor looks for: the work registered at your PRO with its writers, IPIs and splits, and an ISRC only once a recording exists — a missing code is a reason to get one from your distributor before The MLC or SoundExchange, never a reason to wait before registering the song with your PRO. ASCAP treats it as a helpful extra; BMI doesn't require it.",
    ],
    healthy: "The work registered at your PRO, with or without an ISRC",
    unhealthy: "Registration put off because the recording has no code yet",
    meaning: "Performance royalties go uncollected while the song waits",
  },
];
