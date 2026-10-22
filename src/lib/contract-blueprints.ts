/**
 * Music industry contract blueprints. Each one is a fill-in template plus a plain-language guide.
 * Bodies use {{field}} for blueprint fields and {{party:Role}} for a party's legal name; renderContract fills them.
 * These are general templates, not legal advice, and every surface that shows one says so (CONTRACT_DISCLAIMER).
 */
/** `date` adds a calendar: "one" fills the field with the picked date, "many" adds each pick to a list. */
export type BlueprintField = { key: string; label: string; placeholder?: string; tip: string; multiline?: boolean; date?: "one" | "many" };
export type Blueprint = {
  id: string;
  name: string;
  category: "Production" | "Performance" | "Visual" | "Label" | "Company";
  summary: string;
  whenToUse: string;
  keyTerms: string[];
  roles: [string, string];
  fields: BlueprintField[];
  body: string;
};

export const CONTRACT_DISCLAIMER =
  "Blueprints are general templates to help you organize a deal. They are not legal advice. Have a qualified music attorney review any contract before you sign it.";

const DATE: BlueprintField = { key: "effectiveDate", label: "Effective date", placeholder: "January 1, 2027", tip: "The date the agreement starts.", date: "one" };
const STATE: BlueprintField = { key: "governingLaw", label: "Governing law (state or country)", placeholder: "Georgia", tip: "Whose laws apply if there's ever a dispute. Usually where you live or do business." };
const SONG: BlueprintField = { key: "songTitle", label: "Song title", placeholder: "Song Title", tip: "The song this agreement covers. Pick a catalog song to fill it in." };

const GENERAL = `GENERAL TERMS
{{n}}.1 Entire agreement. This agreement is the complete understanding between the parties about its subject and replaces any earlier discussions. Changes must be in writing and signed by both parties.
{{n}}.2 Independent parties. Nothing here creates a partnership, joint venture or employment relationship.
{{n}}.3 Governing law. This agreement is governed by the laws of {{governingLaw}}.
{{n}}.4 Severability. If any part is found unenforceable, the rest stays in effect.
{{n}}.5 Electronic signatures. The parties agree that electronic signatures, including typed signatures recorded by Came Through Audio with a time stamp and verification hash, are binding and have the same effect as handwritten signatures.`;

const general = (n: number) => GENERAL.replaceAll("{{n}}", String(n));

const RELEASE_TERMS = `PHOTO, VIDEO & TESTIMONIAL RELEASE

This release is made on {{effectiveDate}} between {{party:Company}} ("Company") and {{party:Participant}} ("Participant").

1. PERMISSION
Participant grants Company and its successors the irrevocable, perpetual, worldwide, royalty-free right to use, reproduce, publish, display and distribute the following, in whole or in part: {{materials}} (the "Materials").

2. TESTIMONIAL
Participant approves this written testimonial for use with the Materials: "{{testimonial}}". Company will not change its meaning.

3. USES
Company may use the Materials in any media now known or later developed, including {{uses}}, to advertise and promote Company and its services.

4. EDITING
Company may crop, edit, shorten, caption and combine the Materials with other content, as long as the meaning of Participant's statements is not changed.

5. CREDIT
Where a name appears, Participant will be credited as {{credit}}. Company may also use the Materials without a name.

6. CONSIDERATION
In exchange for this release, Participant receives: {{consideration}}. Participant agrees this is the full compensation, and no royalties or further payments are owed.

7. OWNERSHIP AND APPROVAL
Company owns any photos and recordings it creates of Participant. Participant waives any right to inspect or approve final versions, except that the written testimonial will not be changed in meaning.

8. NO OBLIGATION
Company is allowed, but never required, to use the Materials.

9. RELEASE OF CLAIMS
Participant releases Company from claims for invasion of privacy, right of publicity or defamation arising from uses permitted here.

10. AGE
Participant confirms they are 18 or older. If not, a parent or legal guardian must also sign this release on their behalf.

`;

export const BLUEPRINTS: Blueprint[] = [
  {
    id: "producer-agreement",
    name: "Producer Agreement",
    category: "Production",
    summary: "An artist hires a producer to produce a song: fee, royalty points, publishing share and credit.",
    whenToUse: "Use it when a producer works on your record for you (custom production), not when you're leasing an existing beat.",
    keyTerms: [
      "Fee: what the producer is paid up front, and when.",
      "Points: the producer's percentage of master royalties, usually 2–5%. Ask whether it's paid from the first stream or only after costs are recouped.",
      "Publishing: the producer's share of the composition. Put the same split on your split sheet.",
      "Credit: exactly how the producer is credited (\"Produced by\").",
      "Ownership: who owns the master. Normally the artist does.",
    ],
    roles: ["Artist", "Producer"],
    fields: [
      DATE, SONG,
      { key: "fee", label: "Production fee", placeholder: "$1,000", tip: "The up-front amount paid to the producer." },
      { key: "feeSchedule", label: "When the fee is paid", placeholder: "50% on signing, 50% on delivery", tip: "Payment timing, for example half now and half on delivery." },
      { key: "points", label: "Producer royalty (points)", placeholder: "3%", tip: "The producer's percentage of master royalties." },
      { key: "publishingShare", label: "Producer publishing share", placeholder: "50%", tip: "The producer's share of the song's writing (composition). Match your split sheet." },
      { key: "deliveryDate", label: "Delivery date", placeholder: "March 1, 2027", tip: "When the finished production is due.", date: "one" },
      { key: "credit", label: "Credit line", placeholder: "Produced by Jane Doe", tip: "How the producer will be credited on releases and metadata." },
      STATE,
    ],
    body: `PRODUCER AGREEMENT

This Producer Agreement is made on {{effectiveDate}} between {{party:Artist}} ("Artist") and {{party:Producer}} ("Producer").

1. SERVICES
Producer will produce the master recording of the song "{{songTitle}}" (the "Master") and deliver a final mix, an instrumental, and stems by {{deliveryDate}}.

2. FEE
Artist will pay Producer {{fee}}, paid as follows: {{feeSchedule}}.

3. ROYALTIES
Producer will receive a royalty of {{points}} of Artist's net master revenue from the Master, payable from the first unit or stream, with statements at least twice a year.

4. PUBLISHING
The parties agree Producer owns {{publishingShare}} of the composition embodied in the Master, and will register their shares with their performing rights organizations and publishers accordingly. The parties will sign a split sheet confirming all writer shares.

5. OWNERSHIP
Artist owns the Master and all copyrights in the sound recording. Producer keeps the right to use the Master in their portfolio, not for sale.

6. CREDIT
Producer will be credited as "{{credit}}" on all releases and in embedded metadata where credits appear.

7. SAMPLES
Producer confirms the production contains no uncleared samples or third-party material unless disclosed to Artist in writing before delivery.

${general(8)}`,
  },
  {
    id: "beat-license-nonexclusive",
    name: "Non-Exclusive Beat License (Lease)",
    category: "Production",
    summary: "A producer licenses an existing beat to an artist, while keeping the right to license it to others.",
    whenToUse: "Use it when you buy a beat lease online or from a producer's catalog and others may use the same beat.",
    keyTerms: [
      "Non-exclusive: the producer can lease the same beat to other artists.",
      "Caps: stream and sales limits. Going over usually means upgrading the license.",
      "Term: how long the license lasts.",
      "Publishing: producers usually keep a writer share, so register it.",
      "No Content ID: you usually can't claim the beat on YouTube Content ID.",
    ],
    roles: ["Producer", "Artist"],
    fields: [
      DATE,
      { key: "beatTitle", label: "Beat title", placeholder: "Beat Title", tip: "The producer's name for the beat." },
      SONG,
      { key: "fee", label: "License fee", placeholder: "$50", tip: "What the artist pays for the lease." },
      { key: "streamCap", label: "Stream cap", placeholder: "500,000 streams", tip: "The maximum number of streams allowed under this lease." },
      { key: "salesCap", label: "Sales cap", placeholder: "5,000 units", tip: "The maximum number of downloads or sales allowed." },
      { key: "term", label: "Term", placeholder: "3 years", tip: "How long the license lasts." },
      { key: "publishingShare", label: "Producer publishing share", placeholder: "50%", tip: "The producer's share of the song's writing. Match your split sheet." },
      { key: "credit", label: "Credit line", placeholder: "Produced by Jane Doe", tip: "How the producer will be credited." },
      STATE,
    ],
    body: `NON-EXCLUSIVE BEAT LICENSE

This license is made on {{effectiveDate}} between {{party:Producer}} ("Producer") and {{party:Artist}} ("Artist").

1. GRANT
Producer grants Artist a non-exclusive license to use the instrumental "{{beatTitle}}" (the "Beat") to create one new song, "{{songTitle}}" (the "Song"), for {{term}} from the date above.

2. FEE
Artist pays Producer {{fee}} on signing. The license starts when payment is received.

3. LIMITS
The Song may earn up to {{streamCap}} across streaming services and up to {{salesCap}} in downloads or sales. Exceeding either limit requires a new license. Producer keeps ownership of the Beat and may license it to others.

4. PERMITTED USES
Artist may distribute the Song on streaming and download stores, perform it live, and use it in one music video. Sync licensing (film, TV, ads, games) is not included without Producer's written approval. Artist may not register the Beat or Song with YouTube Content ID.

5. PUBLISHING
Producer owns {{publishingShare}} of the composition of the Song. Both parties will register their writer shares with their performing rights organizations.

6. CREDIT
Artist will credit Producer as "{{credit}}" wherever credits appear, including embedded metadata.

7. OWNERSHIP
Artist owns their new lyrics, melody and vocal performance. Producer owns the Beat.

${general(8)}`,
  },
  {
    id: "beat-license-exclusive",
    name: "Exclusive Beat License",
    category: "Production",
    summary: "A producer licenses a beat exclusively to one artist. Nobody else can use it after signing.",
    whenToUse: "Use it when you want a beat that's yours alone, with no caps, to release and promote without limits.",
    keyTerms: [
      "Exclusive: the producer stops licensing the beat to anyone new. Earlier leases may still exist, so ask for a list.",
      "No caps: unlimited streams and sales.",
      "Points: some exclusives include a producer royalty. Check before agreeing.",
      "Publishing: the producer usually still keeps a writer share.",
    ],
    roles: ["Producer", "Artist"],
    fields: [
      DATE,
      { key: "beatTitle", label: "Beat title", placeholder: "Beat Title", tip: "The producer's name for the beat." },
      SONG,
      { key: "fee", label: "Exclusive fee", placeholder: "$1,500", tip: "What the artist pays for exclusive rights." },
      { key: "points", label: "Producer royalty (points)", placeholder: "0% or 3%", tip: "The producer's percentage of master royalties, if any." },
      { key: "priorLicenses", label: "Earlier non-exclusive leases", placeholder: "None", tip: "Any leases sold before this deal. Those artists may keep their versions." },
      { key: "publishingShare", label: "Producer publishing share", placeholder: "50%", tip: "The producer's share of the song's writing. Match your split sheet." },
      { key: "credit", label: "Credit line", placeholder: "Produced by Jane Doe", tip: "How the producer will be credited." },
      STATE,
    ],
    body: `EXCLUSIVE BEAT LICENSE

This license is made on {{effectiveDate}} between {{party:Producer}} ("Producer") and {{party:Artist}} ("Artist").

1. GRANT
Producer grants Artist an exclusive, worldwide, perpetual license to use the instrumental "{{beatTitle}}" (the "Beat") in the song "{{songTitle}}" (the "Song"), with no limit on streams, sales, performances or videos.

2. FEE
Artist pays Producer {{fee}} on signing.

3. EXCLUSIVITY
From signing, Producer will not license, sell or use the Beat for anyone else and will remove it from sale. Earlier non-exclusive licenses disclosed here remain valid: {{priorLicenses}}.

4. ROYALTIES
Producer will receive {{points}} of Artist's net master revenue from the Song, if any.

5. PUBLISHING
Producer owns {{publishingShare}} of the composition of the Song. Both parties will register their writer shares.

6. CREDIT
Artist will credit Producer as "{{credit}}" wherever credits appear, including embedded metadata.

7. SAMPLES
Producer confirms the Beat contains no uncleared samples unless disclosed in writing before signing.

${general(8)}`,
  },
  {
    id: "feature-agreement",
    name: "Feature Artist Agreement",
    category: "Performance",
    summary: "A guest artist records a verse or hook on another artist's song: fee, royalties, credit and clearance.",
    whenToUse: "Use it before you release any song with a featured artist, especially when they're signed to a label.",
    keyTerms: [
      "Fee and points: some features are a flat fee, others add a royalty.",
      "Credit format: exactly how the name appears (\"feat.\" or \"with\").",
      "Label clearance: a signed feature may need their label's written OK.",
      "Publishing: the feature usually owns a share of the lyrics they wrote.",
    ],
    roles: ["Artist", "Featured Artist"],
    fields: [
      DATE, SONG,
      { key: "fee", label: "Feature fee", placeholder: "$500", tip: "The flat amount paid to the featured artist." },
      { key: "points", label: "Featured artist royalty", placeholder: "0% or 2%", tip: "Their percentage of master royalties, if any." },
      { key: "publishingShare", label: "Featured artist publishing share", placeholder: "15%", tip: "Their share of the song's writing for the lyrics they wrote. Match your split sheet." },
      { key: "creditFormat", label: "Credit format", placeholder: "Song Title (feat. Guest Name)", tip: "Exactly how the feature appears in titles and metadata." },
      { key: "clearance", label: "Label clearance", placeholder: "Not signed / Cleared by Label Name", tip: "Whether the featured artist's label must approve the release." },
      STATE,
    ],
    body: `FEATURE ARTIST AGREEMENT

This agreement is made on {{effectiveDate}} between {{party:Artist}} ("Artist") and {{party:Featured Artist}} ("Featured Artist").

1. PERFORMANCE
Featured Artist will write and record a featured performance on the song "{{songTitle}}" (the "Song") and deliver the vocal files to Artist.

2. COMPENSATION
Artist will pay Featured Artist {{fee}}, plus a royalty of {{points}} of Artist's net master revenue from the Song, if any.

3. PUBLISHING
Featured Artist owns {{publishingShare}} of the composition for the lyrics and melody they contributed. The parties will sign a split sheet confirming all writer shares.

4. CREDIT AND NAME USE
The Song will be credited as "{{creditFormat}}". Featured Artist allows Artist to use their name, approved likeness and biography to promote the Song.

5. CLEARANCE
Featured Artist confirms they are free to perform under this agreement. Label status: {{clearance}}.

6. OWNERSHIP
Artist owns the master recording of the Song, including the featured performance.

${general(7)}`,
  },
  {
    id: "session-musician",
    name: "Session Musician Agreement (Work for Hire)",
    category: "Performance",
    summary: "A musician is paid to play on a recording, and the artist keeps all rights in the performance.",
    whenToUse: "Use it for players and singers hired for a session who aren't writers or owners of the song.",
    keyTerms: [
      "Work for hire: the musician is paid once and doesn't own the recording.",
      "Credit: session players are usually credited for their instrument.",
      "Writing: if they write parts of the song, use a split sheet instead.",
    ],
    roles: ["Artist", "Musician"],
    fields: [
      DATE, SONG,
      { key: "instrument", label: "Instrument or role", placeholder: "Bass guitar", tip: "What the musician will play or sing." },
      { key: "sessionDate", label: "Session date(s)", placeholder: "February 10, 2027", tip: "When the recording session happens.", date: "many" },
      { key: "fee", label: "Session fee", placeholder: "$300", tip: "The one-time amount paid for the session." },
      { key: "credit", label: "Credit line", placeholder: "Bass: John Smith", tip: "How the musician will be credited." },
      STATE,
    ],
    body: `SESSION MUSICIAN AGREEMENT (WORK FOR HIRE)

This agreement is made on {{effectiveDate}} between {{party:Artist}} ("Artist") and {{party:Musician}} ("Musician").

1. SERVICES
Musician will perform {{instrument}} on the recording of "{{songTitle}}" on {{sessionDate}}.

2. FEE
Artist will pay Musician {{fee}} within 14 days after the session. This is the full payment for the services.

3. WORK FOR HIRE
Musician's performance is a work made for hire for Artist. If it is not, Musician assigns all rights in the recorded performance to Artist. Artist may use, edit and release the recording in any media.

4. NO WRITING SHARE
Musician is not a writer of the composition unless the parties sign a separate split sheet.

5. CREDIT
Artist will credit Musician as "{{credit}}" where credits appear.

${general(6)}`,
  },
  {
    id: "videographer",
    name: "Videographer & Music Video Agreement",
    category: "Visual",
    summary: "An artist hires a videographer for a music video: deliverables, fee, ownership and credit.",
    whenToUse: "Use it for music videos, visualizers, behind-the-scenes and promo content.",
    keyTerms: [
      "Deliverables: exactly what you get (final cut, vertical edits, raw footage).",
      "Ownership: who owns the footage. Artists usually want full ownership.",
      "Portfolio use: whether the videographer can show the video in their reel.",
      "Revisions: how many edit rounds are included.",
    ],
    roles: ["Artist", "Videographer"],
    fields: [
      DATE, SONG,
      { key: "shootDate", label: "Shoot date(s)", placeholder: "April 5, 2027", tip: "When filming happens.", date: "many" },
      { key: "deliverables", label: "Deliverables", placeholder: "Final 16:9 cut, 3 vertical clips, raw footage", tip: "Everything the videographer will hand over.", multiline: true },
      { key: "revisions", label: "Revision rounds", placeholder: "2", tip: "How many rounds of edits are included." },
      { key: "deliveryDate", label: "Delivery date", placeholder: "May 1, 2027", tip: "When the final files are due.", date: "one" },
      { key: "fee", label: "Fee", placeholder: "$2,000", tip: "The total paid to the videographer." },
      { key: "credit", label: "Credit line", placeholder: "Directed by Jane Doe", tip: "How the videographer is credited." },
      STATE,
    ],
    body: `VIDEOGRAPHER & MUSIC VIDEO AGREEMENT

This agreement is made on {{effectiveDate}} between {{party:Artist}} ("Artist") and {{party:Videographer}} ("Videographer").

1. SERVICES
Videographer will film and edit a music video for "{{songTitle}}" on {{shootDate}} and deliver: {{deliverables}}, by {{deliveryDate}}. The fee includes {{revisions}} rounds of revisions.

2. FEE
Artist will pay Videographer {{fee}}: half on signing and half on delivery of the final files.

3. OWNERSHIP
On full payment, Artist owns all footage and edits, including copyright, and may use them in any media. Videographer may show the finished video in their portfolio and reel, with credit to Artist.

4. MUSIC
Artist licenses the song to Videographer only to make the video. Videographer may not use the song for anything else.

5. RELEASES
Videographer will collect appearance releases from anyone featured on camera, and location permits where needed.

6. CREDIT
Artist will credit Videographer as "{{credit}}" in the video description where credits appear.

${general(7)}`,
  },
  {
    id: "photo-video-release",
    name: "Photo, Video & Testimonial Release",
    category: "Visual",
    summary: "Someone gives you permission to use their photo, video, voice, name and written testimonial, forever, in exchange for a gift or fee.",
    whenToUse: "Use it before you post a customer testimonial, a fan video, behind-the-scenes footage or any photo of a person in your marketing.",
    keyTerms: [
      "Perpetual and worldwide: you can keep using the material with no end date, anywhere.",
      "What's covered: photos, video, audio, their name, likeness and the exact written testimonial.",
      "Consideration: what they receive in return (a gift, product or fee). Something of value makes the release stronger.",
      "Editing: you may crop, edit and shorten, but not change the meaning of what they said.",
      "No obligation: you're allowed to use it, never required to.",
      "Minors: anyone under 18 needs a parent or guardian to sign too.",
    ],
    roles: ["Company", "Participant"],
    fields: [
      DATE,
      { key: "materials", label: "Materials covered", placeholder: "Photos, video recordings, voice, name, likeness and written testimonial", tip: "Everything the person is giving you permission to use.", multiline: true },
      { key: "testimonial", label: "Written testimonial (optional)", placeholder: "Paste their testimonial exactly as approved", tip: "The exact words they approved. Leave blank if it isn't written yet.", multiline: true },
      { key: "consideration", label: "What they receive", placeholder: "One year of Catalog Plus at no cost", tip: "The gift or payment they get in return for the release." },
      { key: "uses", label: "Where it may appear", placeholder: "Website, social media, ads, email, presentations and press", tip: "The places you plan to use the material. \"Any media\" is broadest." },
      { key: "credit", label: "How they are credited", placeholder: "First name and city, e.g. \"Jordan, Atlanta\"", tip: "How the person's name appears next to their testimonial, if at all." },
      STATE,
    ],
    body: `${RELEASE_TERMS}${general(11)}`,
  },
  {
    id: "indie-label-license",
    name: "Independent Label License Agreement",
    category: "Label",
    summary: "An artist licenses a release to an independent label for a set term and territory. The artist keeps ownership.",
    whenToUse: "Use it when an indie label wants to release and promote your project but you want your masters back later.",
    keyTerms: [
      "License, not sale: the artist keeps ownership and the rights return after the term.",
      "Territory and term: where and for how long the label controls the release.",
      "Advance: money paid up front, and recouped from your royalties.",
      "Royalty split: indie licenses are often 50/50 of net profit.",
      "Reversion: what happens if the label doesn't release or pay.",
    ],
    roles: ["Artist", "Label"],
    fields: [
      DATE,
      { key: "releaseTitle", label: "Release title", placeholder: "EP Title", tip: "The single, EP or album being licensed." },
      { key: "territory", label: "Territory", placeholder: "Worldwide", tip: "Where the label can release it." },
      { key: "term", label: "Term", placeholder: "5 years", tip: "How long the label controls the release before rights return." },
      { key: "advance", label: "Advance", placeholder: "$0", tip: "Money paid to the artist up front, recouped from royalties." },
      { key: "royaltySplit", label: "Artist royalty", placeholder: "50% of net receipts", tip: "The artist's share of the label's income from the release." },
      { key: "releaseDeadline", label: "Release deadline", placeholder: "Within 6 months of delivery", tip: "If the label misses this, rights go back to the artist.", date: "one" },
      STATE,
    ],
    body: `INDEPENDENT LABEL LICENSE AGREEMENT

This agreement is made on {{effectiveDate}} between {{party:Artist}} ("Artist") and {{party:Label}} ("Label").

1. LICENSE
Artist grants Label an exclusive license to distribute, sell and promote the release "{{releaseTitle}}" (the "Release") in {{territory}} for {{term}} from the first release date (the "Term"). Artist keeps ownership of all master recordings and compositions.

2. ADVANCE
Label will pay Artist an advance of {{advance}}, recoupable only from Artist's royalties under this agreement.

3. ROYALTIES
Label will pay Artist {{royaltySplit}} from the Release, with accounting statements and payment at least twice a year. Artist may audit Label's records once a year with 30 days' notice.

4. RELEASE COMMITMENT
Label will release the Release {{releaseDeadline}}. If it doesn't, Artist may end this agreement by written notice and all rights return to Artist.

5. REVERSION
At the end of the Term, all rights in the Release return to Artist automatically, and Label will stop exploiting it and transfer any distribution accounts.

6. CREDITS AND METADATA
Label will keep all credits, identifiers (ISRC, UPC) and embedded metadata accurate on every release.

${general(7)}`,
  },
];

/** The company's own legal name, the Company party on every company contract. */
export const COMPANY_LEGAL_NAME = "Came Through Audio, LLC";

/** Company agreements name the LLC as the party; the founder signs as its authorized representative. */
const SIGNER: BlueprintField = { key: "signerTitle", label: "Your title", placeholder: "Founder & CEO", tip: "Your title at Came Through Audio, LLC. You sign with your own legal name on the company's behalf." };
const asCompany = (body: string) => body.replace(`{{party:Company}} ("Company")`, `${COMPANY_LEGAL_NAME} ("Company"), signed by its authorized representative {{party:Company}}, {{signerTitle}},`);

const PRELAUNCH = (n: number) => `${n}. PRE-LAUNCH CONFIDENTIALITY
Until Company publicly announces the launch of its service (or gives written permission first), Participant will not post, share, screenshot, record or describe the Came Through Audio app or its features. Company will hold the Materials and will not publish them before launch.

`;

/**
 * Came Through Audio, LLC's own agreements, sent from Admin → Company Contracts (super admins only). Never shown in
 * the customer blueprint list. Super admins can change a template's wording there (stored in site_settings).
 */
export const COMPANY_BLUEPRINTS: Blueprint[] = [
  {
    ...BLUEPRINTS.find((b) => b.id === "photo-video-release")!,
    id: "company-testimonial-release",
    category: "Company",
    summary: "A homepage or marketing testimonial giver lets Came Through Audio use their photo, video, name and words, and keeps the app private until launch.",
    whenToUse: "Send it to everyone whose testimonial, photo or video appears on the site or in marketing, including people already on the homepage.",
    fields: [SIGNER, ...BLUEPRINTS.find((b) => b.id === "photo-video-release")!.fields],
    body: asCompany(`${RELEASE_TERMS}${PRELAUNCH(11)}${general(12)}`),
  },
  {
    id: "company-blank",
    name: "Blank company agreement",
    category: "Company",
    summary: "Your own wording, signed through the same secure flow.",
    whenToUse: "Any company agreement that doesn't have a template yet.",
    keyTerms: ["Write the terms in your own words, then lock and send."],
    roles: ["Company", "Participant"],
    fields: [SIGNER, DATE, { key: "terms", label: "Terms", placeholder: "What each side agrees to", tip: "The agreement in plain language.", multiline: true }, STATE],
    body: asCompany(`AGREEMENT

This agreement is made on {{effectiveDate}} between {{party:Company}} ("Company") and {{party:Participant}} ("Participant").

1. TERMS
{{terms}}

${general(2)}`),
  },
];

export type AuthorizationSchedule = { songs: { title: string; isrc: string }[]; agencies: string[]; purchasedOn: string; amount: string };

/**
 * The Registration Authorization a customer signs at intake step 4 (PLAN-registration-intake §6). Came Through Audio,
 * LLC is the party; Schedule A is filled from the order. Built on the server when signing, so the text and its hash
 * can't be changed by the browser. Have a lawyer review before launch.
 */
export function registrationAuthorization(o: { effectiveDate: string; client: string; prelaunch: boolean } & AuthorizationSchedule): string {
  const agencies = o.agencies.join(", ");
  const n = o.prelaunch ? 10 : 9;
  return `REGISTRATION AUTHORIZATION

This agreement is made on ${o.effectiveDate} between ${COMPANY_LEGAL_NAME} ("Came Through Audio") and ${o.client} ("Client").

1. WHAT CLIENT AUTHORIZES
Client authorizes Came Through Audio to register the songs and recordings listed in Schedule A with the organizations listed there (${agencies}), acting as Client's authorized user or representative in Client's own accounts. This includes entering, checking and submitting registration details, and reading Client's registration status.

2. WHAT CAME THROUGH AUDIO WILL NOT DO
Came Through Audio will not: (a) take or claim any ownership, copyright, writer share or publisher share in Client's music; (b) collect, receive or hold royalties for Client; (c) change Client's payment, bank or tax details, contact email, password or membership; (d) sign up for new memberships or agreements on Client's behalf; or (e) register anything not listed in Schedule A.

3. CLIENT'S INFORMATION
Client confirms that the details submitted for each song (titles, writers, roles, shares, publishers, IPI numbers, recordings and ownership) are true and complete, that every co-writer and co-owner has agreed to the shares submitted, and that Client has the right to register them. Came Through Audio registers exactly what Client submitted and is not responsible for errors in it. If an organization reports a conflict or asks for proof, Came Through Audio will tell Client, and Client will provide what's needed.

4. ACCOUNT ACCESS
Client will add Came Through Audio as an authorized user or representative in each account, as the organization allows, and will not share passwords. Client may remove that access at any time. Came Through Audio will stop using an account once its work for that account is done, and asks Client to remove its access then.

5. NO GUARANTEE OF RESULTS
Each organization decides on its own whether and when to accept a registration and pay royalties. Came Through Audio does not guarantee acceptance, timing or any amount of royalties.

6. FEES AND REFUNDS
Fees are listed in Schedule A. Refunds follow Came Through Audio's Refund Policy: a full refund within 30 days of purchase, as long as work on Client's registrations hasn't started. Work starts once Client has submitted every song in Schedule A and signed this agreement.

7. PRIVACY
Came Through Audio uses Client's information only to complete these registrations, as described in its Privacy Policy, and keeps PRO, IPI and share details private.

8. ENDING THIS AUTHORIZATION
This authorization ends when every registration in Schedule A is complete, or earlier if either side ends it in writing. Registrations already submitted stay in place.

${o.prelaunch ? `9. PRE-LAUNCH CONFIDENTIALITY
Until Came Through Audio publicly announces the launch of its service (or gives written permission first), Client will not post, share, screenshot, record or describe the Came Through Audio app or its features.

` : ""}${general(n).replace("{{governingLaw}}", "the State of Georgia")}

SCHEDULE A
Organizations: ${agencies}
Purchased: ${o.purchasedOn} · Amount paid: ${o.amount}
${o.songs.map((s, i) => `${i + 1}. ${s.title}${s.isrc ? ` (ISRC ${s.isrc})` : ""}`).join("\n")}`;
}

export const blueprintById =(id: string) => BLUEPRINTS.find((b) => b.id === id) ?? COMPANY_BLUEPRINTS.find((b) => b.id === id);

/** Fills {{field}} and {{party:Role}} tokens. Anything left blank stays visible as a [Label] blank to fill in. */
export function renderContract(bp: Blueprint, fields: Record<string, string>, parties: { role: string; legalName: string }[]) {
  return bp.body
    .replace(/\{\{party:([^}]+)\}\}/g, (_, role: string) => parties.find((p) => p.role === role)?.legalName.trim() || `[${role} legal name]`)
    .replace(/\{\{(\w+)\}\}/g, (_, key: string) => fields[key]?.trim() || `[${bp.fields.find((f) => f.key === key)?.label ?? key}]`);
}
