/**
 * One plain-language glossary, so a term reads the same everywhere it appears (shown through <InfoTip>).
 * Style: one or two short sentences, "what it is → why it matters → where to get it". Founder-approved 2026-10-20;
 * ask before rewording. Examples use the brand ("Came Through Audio"), never made-up company names.
 */
/** What each agency's own template or form requires, shown in its info box and beside each Export option. */
export const EXPORT_REQUIRED = {
  mlc: "The MLC's bulk upload requires: song title, each writer's legal name and role, a publisher name and publisher IPI on every writer's row (plus the HFA P# if you have one), and a collection share above 0%. No publisher IPI (HFA only, BMI writers, or self-published)? We fill the placeholder IPI 123456789 so the file is accepted; remove it in The MLC Portal after the upload.",
  soundexchange: "SoundExchange's ingest form requires: artist, recording title, ISRC, basis of claim, percentage claimed, rights begin and end dates, release artist, release title, UPC and release label.",
  pro: "To register: song title, each writer's legal name, role, PRO and IPI, splits that total 100%, and a publisher (PRO, IPI and share) or Self-published. BMI also asks for duration, genre and the label once the song is released. If all the writers are with BMI, you don't need a publisher.",
} as const;

/**
 * How to upload each export at the agency, shown in the export box and after a download. Menu names come from each
 * agency's help pages (checked 2026-10-25); agencies rename menus, so steps name the area, not every click.
 */
export const AGENCY_UPLOAD_STEPS = {
  mlc: [
    "Sign in to The MLC Portal (portal.themlc.com) and choose your member account.",
    "In the left menu, open Works Registration (or Catalog) and choose the bulk registration tool (Register Bulk Works).",
    "Upload the .xlsx file from Came Through Audio as it is: don't rename the sheet or move columns.",
    "The MLC checks the file and lists anything it couldn't accept. Fix those songs in My Catalog, export just them, and upload again.",
    "Then open each song in the portal and remove the placeholder IPI 123456789 if we used it. Optional: add the recording's release date and duration there too.",
  ],
  soundexchange: [
    "Sign in to SoundExchange Direct (SXDirect).",
    "Go to My Catalog → Submit Recordings and choose the bulk (ISRC Ingest Form) upload.",
    "Upload the .xlsx file from Came Through Audio as it is.",
    "SoundExchange matches your recordings by ISRC. Check My Catalog in SXDirect over the next few weeks to see them listed.",
  ],
  pro: [
    "BMI and ASCAP register songs one at a time for writers, so this file is a cheat sheet, not an upload.",
    "Sign in to BMI Online Services or ASCAP Member Access and start a new work registration.",
    "Copy each field from the cheat sheet (title, writers, roles, IPIs, splits, publisher) into the form, one song per registration.",
    "Save the confirmation for each song, then tick Registered for it in the Royalty Health Hub.",
  ],
} as const;

/** Notes shown when exporting to The MLC (founder-verified process, 2026-10-25). */
export const MLC_EXPORT_NOTES = {
  placeholder: "These songs have no publisher IPI, so the file uses the placeholder IPI 123456789 (and lists the writer as publisher when there's no publisher). It's only there so The MLC accepts the upload: after it goes through, open each song in The MLC Portal and remove the placeholder IPI.",
  recording: "Optional at The MLC: the recording's release date and duration. The bulk file has no place for them, so if you want them on file, open each song in The MLC Portal after the upload and add them under its recording. Tip: close the song in My Catalog to see all its details on one row.",
} as const;

export const GLOSSARY = {
  isrc: { term: "ISRC", text: "Your recording's ID, like a barcode for one version of a song. Streaming services use it to pay you. Your distributor gives you one free when you release." },
  iswc: { term: "ISWC", text: "Your song's ID, for the written song rather than the recording. Your PRO or publisher assigns it after you register the song, so it's fine to leave blank until then." },
  upc: { term: "UPC", text: "The barcode for a whole release (single, EP or album). Stores use it to list your release. Your distributor assigns it." },
  ipi: { term: "IPI name number", text: "A 9–11 digit number that identifies you as a writer or publisher worldwide, so royalties reach the right person. You get one when you join a PRO. Leave it blank until then." },
  pro: { term: "PRO (performing rights organization)", text: "Pays songwriters when a song is played on radio, TV, live, in venues and on streaming. In the US that's BMI, ASCAP or SESAC. Each writer belongs to only one." },
  mlc: { term: "The MLC", text: `Pays songwriters and publishers mechanical royalties from US streaming services like Spotify and Apple Music. It's free to join. ${EXPORT_REQUIRED.mlc}` },
  soundexchange: { term: "SoundExchange", text: `Pays the featured artist, the other performers on the recording and the master owner when it plays on digital radio, like Pandora and SiriusXM. You register each recording's details there (title, artist, performers, master owner and ISRC), and the ISRC is how SoundExchange matches each play to your recording. It's free to join. ${EXPORT_REQUIRED.soundexchange}` },
  performance: { term: "Performance royalties", text: "Earned by the song when it's played publicly: radio, TV, live shows, venues and streaming. Your PRO collects them." },
  mechanical: { term: "Mechanical royalties", text: "Earned by the song each time it's copied: a stream, download or CD. In the US, The MLC collects them for streaming." },
  digitalPerformance: { term: "Digital performance royalties", text: "Earned by the recording on digital radio like Pandora and SiriusXM. SoundExchange collects them." },
  masterVsComposition: { term: "Master vs. composition", text: "Every track has two copyrights. The master is the recording and the composition is the song itself (lyrics and music), and each earns its own royalties." },
  split: { term: "Split", text: "Each writer's percentage of the song. Splits must add up to exactly 100%, or agencies won't register the song." },
  publisher: { term: "Publisher", text: "Manages the song and collects the publisher share, which is half of the song's royalties. Self-published? Enter your own publishing name. Publisher shares here add up to 100% of that half." },
  hfa: { term: "HFA P#", text: "Only if this publisher is signed with the Harry Fox Agency (HFA). HFA gives this account number when you join; it's at the top right of the HFA Portal. It's also your publisher number for The MLC's bulk upload, and it's a different number from your IPI. HFA songs are usually carried over to The MLC, but check The MLC Portal to make sure. Registering with The MLC does not register you with HFA." },
  selfPublished: { term: "Self-published", text: "No publisher has rights to your songs. Your PRO then pays the publisher half to the writers too, so you collect both halves. BMI pays the publisher share to the writers automatically, in proportion to their writer splits. Have your own publishing company? List it as a publisher instead." },
  samples: { term: "Samples", text: "Whether a song uses a sample, borrows from another song, or is based on an older song (public-domain songs too). PROs ask for the original song's details when you register. Your usual answer fills in new songs; change it on any song that's different." },
  writtenFor: { term: "Written for film, TV, stage or an ad", text: "Whether a song was made for a movie, TV show, stage show or commercial. BMI asks this when you register. Your usual answer fills in new songs; a song made for a production adds its title." },
  masterShare: { term: "Master share", text: "How much of the recording (the master) you own. Most independent artists own 100%. SoundExchange pays the master owner by this share." },
  masterBasis: { term: "How you hold the master", text: "Copyright Owner: you own the recording. Collections Designee: you collect for the owner, for example as their label or administrator." },
  publishing: { term: "Publishing on this song", text: "Who collects this writer's publisher share on this song. My publisher: a publisher listed under Publishers. Self-published: no publisher, so the writer collects it. BMI pays me: BMI writers with no publishing company get it from BMI. None: this writer gets no publishing on this song, for example when it belongs to someone else's publisher." },
  bmiWriterPublishing: { term: "BMI writer, no publishing company", text: "BMI pays its writers both halves of their royalties: the writer share and the publisher share, split in proportion to each writer's split. So a song whose writers are all with BMI doesn't need a publisher or a publisher IPI. Writers at other PROs still need a publisher, or Self-published." },
  pLine: { term: "℗ (P-line)", text: "Who owns the sound recording (the master) and the year, for example \"℗ 2026 Came Through Audio\"." },
  cLine: { term: "© (C-line)", text: "Who owns the composition and the year, usually the publisher or writers." },
  roles: { term: "Writer roles", text: "All three are writers; only the role differs. Author wrote the lyrics or melody. Composer made the music, such as the beat or instrumental. Author/Composer did both, and counts as an author and a composer for registration." },
  legalName: { term: "Legal name", text: "The writer's real full name, as their PRO and The MLC know it. It's only needed to register, so you can add it later." },
  producedBy: { term: "Produced by", text: "A credit for who produced the recording. It's embedded in your MP3 when you embed one, but it doesn't pay royalties by itself. If the producer made the beat and gets a share of the song, also add them under Writer as Composer. Producer points from the master are set in a producer contract or beat license." },
  featured: { term: "Featured artist", text: "An artist who appears on the track (feat.). Streaming services show them on the song and credit them in search." },
  releaseType: { term: "Release type", text: "Single, EP or Album. It tells stores how to group and display the release." },
  explicit: { term: "Explicit", text: "Check this if the lyrics have strong language or adult content. Stores label the song so listeners and parents know." },
  label: { term: "Label", text: "The name the release goes out under. Independent? Use your own label name or your artist name." },
  neighbouringRights: { term: "Neighbouring rights", text: "Royalties for your recording when it's played on radio, TV or in venues outside the US. They pay the performers and the master owner. Collect them through SoundExchange's international mandate or by joining PPL." },
  performers: { term: "Featured / non-featured performer", text: "Featured performers are the artists named on the release. Non-featured performers are session players and backup singers. Both can be paid for airplay outside the US." },
  ppl: { term: "PPL", text: "The UK society that collects neighbouring rights for performers and master owners, from about 100 countries. Artists from outside the UK can join." },
  metadata: { term: "Metadata", text: "The details saved inside your music file: title, artist, credits, artwork and IDs. Correct metadata helps you get found, credited and paid." },
} as const;

export type GlossaryKey = keyof typeof GLOSSARY;
