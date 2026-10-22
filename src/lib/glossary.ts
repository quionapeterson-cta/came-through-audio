/**
 * One plain-language glossary, so a term reads the same everywhere it appears (shown through <InfoTip>).
 * Style: one or two short sentences, "what it is → why it matters → where to get it". Founder-approved 2026-10-20;
 * ask before rewording. Examples use the brand ("Came Through Audio"), never made-up company names.
 */
export const GLOSSARY = {
  isrc: { term: "ISRC", text: "Your recording's ID, like a barcode for one version of a song. Streaming services use it to pay you. Your distributor gives you one free when you release." },
  iswc: { term: "ISWC", text: "Your song's ID, for the written song rather than the recording. Your PRO or publisher assigns it after you register the song, so it's fine to leave blank until then." },
  upc: { term: "UPC", text: "The barcode for a whole release (single, EP or album). Stores use it to list your release. Your distributor assigns it." },
  ipi: { term: "IPI name number", text: "A 9–11 digit number that identifies you as a writer or publisher worldwide, so royalties reach the right person. You get one when you join a PRO. Leave it blank until then." },
  pro: { term: "PRO (performing rights organization)", text: "Pays songwriters when a song is played on radio, TV, live, in venues and on streaming. In the US that's BMI, ASCAP or SESAC. Each writer belongs to only one." },
  mlc: { term: "The MLC", text: "Pays songwriters and publishers mechanical royalties from US streaming services like Spotify and Apple Music. It's free to join." },
  soundexchange: { term: "SoundExchange", text: "Pays the featured artist, the other performers on the recording and the master owner when it plays on digital radio, like Pandora and SiriusXM. You register each recording's details there (title, artist, performers, master owner and ISRC), and the ISRC is how SoundExchange matches each play to your recording. It's free to join." },
  performance: { term: "Performance royalties", text: "Earned by the song when it's played publicly: radio, TV, live shows, venues and streaming. Your PRO collects them." },
  mechanical: { term: "Mechanical royalties", text: "Earned by the song each time it's copied: a stream, download or CD. In the US, The MLC collects them for streaming." },
  digitalPerformance: { term: "Digital performance royalties", text: "Earned by the recording on digital radio like Pandora and SiriusXM. SoundExchange collects them." },
  masterVsComposition: { term: "Master vs. composition", text: "Every track has two copyrights. The master is the recording and the composition is the song itself (lyrics and music), and each earns its own royalties." },
  split: { term: "Split", text: "Each writer's percentage of the song. Splits must add up to exactly 100%, or agencies won't register the song." },
  publisher: { term: "Publisher", text: "Manages the song and collects the publisher share, which is half of the song's royalties. Self-published? Enter your own publishing name. Publisher shares here add up to 100% of that half." },
  selfPublished: { term: "Self-published", text: "No publisher has rights to your songs. Your PRO then pays the publisher half to the writers too, so you collect both halves. BMI pays the publisher share to the writers automatically, in proportion to their writer splits. Have your own publishing company? List it as a publisher instead." },
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
