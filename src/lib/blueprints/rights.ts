import { CLAUSE, DATE, FEE, SONG, STATE, doc, field, need, type Blueprint } from "./common";

const PROJECT = need("project", "Project", "The film, show, ad, game or video the music is used in.", { placeholder: "\"Night Drive\" short film" });
const MEDIA = field("media", "Where it can be shown", "The media the license covers.", { value: "all media now known or later invented, including streaming, TV, film festivals, online and social media" });
const TERRITORY = field("territory", "Territory", "Where it can be shown.", { value: "worldwide" });
const LICENSE_TERM = field("term", "How long", "How long the license lasts.", { value: "forever" });

export const RIGHTS: Blueprint[] = [
  {
    id: "distribution",
    name: "Music Distribution Agreement",
    category: "Rights & Distribution",
    summary: "A distributor puts your music on streaming services and pays you your share. You keep ownership.",
    whenToUse: "Use it with a smaller or independent distributor, or anyone distributing your music for a cut.",
    keyTerms: ["Non-exclusive: you can take your music elsewhere.", "You keep 100% ownership.", "Takedown within 30 days when you ask.", "You get your data and reports."],
    roles: ["Artist", "Distributor"],
    fields: [
      DATE, need("releases", "Release(s)", "The singles, EPs or albums covered.", { placeholder: "\"Song Title\" (single)" }),
      field("distributorShare", "Distributor's share", "The distributor's percentage of income from the releases.", { value: "15%" }),
      field("fees", "Up-front fees", "Any fee the distributor charges per release.", { value: "none" }),
      STATE,
    ],
    body: doc("Music Distribution Agreement", ["Artist", "Distributor"], [
      ["DISTRIBUTION", "Artist allows Distributor, non-exclusively and worldwide, to deliver {{releases}} (the \"Releases\") to streaming services and download stores and to collect the income they pay."],
      ["OWNERSHIP", "Artist keeps 100% ownership of the Releases, their recordings and compositions. Distributor gets no ownership, publishing or other rights."],
      ["MONEY", "Distributor keeps {{distributorShare}} of the net income it receives from the Releases and pays the rest to Artist at least every 3 months, with a statement. Up-front fees: {{fees}}."],
      ["TAKEDOWN", "Artist may end distribution of any Release at any time. Distributor removes it from every service within 30 days of being asked."],
      ["DATA", "Artist may download their sales and streaming reports at any time. On ending, Distributor hands over all codes (ISRC, UPC) and data so Artist can move the Releases without losing their history."],
      ["NO FAKE STREAMS", "Neither party will use bots or artificial streams. Distributor will tell Artist before taking down a Release for suspected fake activity."],
    ]),
  },
  {
    id: "publishing-admin",
    name: "Publishing Administration Agreement",
    category: "Rights & Distribution",
    summary: "An administrator registers your songs and collects your publishing money for a percentage. You keep the copyrights.",
    whenToUse: "Use it when someone collects your songwriting royalties worldwide for a fee.",
    keyTerms: ["You keep 100% of your copyrights.", "Admin fee usually 10–20%.", "Songs come back to you when it ends."],
    roles: ["Writer", "Administrator"],
    fields: [
      DATE, need("adminFee", "Administration fee", "The administrator's percentage of publishing income they collect.", { value: "15%" }),
      field("songs", "Songs covered", "Which songs. Leave as is for all your songs.", { value: "all songs written by Writer, now and during the term" }),
      field("term", "Length", "How long it lasts.", { value: "3 years" }),
      STATE,
    ],
    body: doc("Publishing Administration Agreement", ["Writer", "Administrator"], [
      ["SERVICES", "For {{term}}, Administrator will register, license and collect publishing income worldwide for {{songs}} (the \"Songs\")."],
      ["OWNERSHIP", "Writer keeps 100% of the copyrights in the Songs. Administrator administers them but owns none of them."],
      ["FEE", "Administrator keeps {{adminFee}} of the publishing income it actually collects and pays the rest to Writer with a statement twice a year. Writer's share of performance income paid directly to Writer by their PRO isn't touched."],
      ["LIMITS", "Administrator needs Writer's written approval for any license for ads, political or religious uses, or changes to a Song."],
      ["ENDING", "When the term ends, the Songs come back to Writer. Administrator may keep collecting money earned during the term for 6 months, then stops."],
      ["RECORDS", "Writer may check Administrator's records about the Songs once a year."],
    ]),
  },
  {
    id: "catalog-admin",
    name: "Music Catalog Administration Agreement",
    category: "Rights & Distribution",
    summary: "Someone organizes and registers your catalog's metadata and registrations, without touching your money or logins.",
    whenToUse: "Use it when you hand someone your catalog to clean up, register and keep current.",
    keyTerms: ["They register and organize; they never collect your money.", "They never change bank, tax or password details.", "Full handoff of records when it ends."],
    roles: ["Artist", "Administrator"],
    fields: [
      DATE, FEE("Fee", "$300 per month", "What the administrator is paid."),
      field("songs", "Catalog covered", "Which songs and recordings.", { value: "all of Artist's songs and recordings in Artist's catalog" }),
      STATE,
    ],
    body: doc("Music Catalog Administration Agreement", ["Artist", "Administrator"], [
      ["SERVICES", "Administrator will organize the metadata and registrations of {{songs}}, including song and recording details, split sheets, ISRC and other codes, and registrations with the organizations Artist chooses."],
      ["ACCOUNTS", "Administrator works in Artist's accounts only as an authorized user Artist adds and may remove at any time. Administrator never changes bank, payment, tax, password or contact details, and never collects or holds Artist's royalties."],
      ["FEE", "Artist pays Administrator {{fee}}."],
      ["ACCURACY", "Administrator registers what Artist confirms. Artist confirms the details given are true and agreed with every co-writer."],
      ["HANDOFF", "When this agreement ends, Administrator hands over every record, file and registration confirmation within 14 days and stops using Artist's accounts."],
      ["ENDING", "Either party may end this agreement with 30 days' written notice."],
      CLAUSE.confidential,
    ]),
  },
  {
    id: "sync-license",
    name: "Synchronization (Sync) License",
    category: "Rights & Distribution",
    summary: "Let a film, show, ad or video use your song's composition, in sync with pictures.",
    whenToUse: "Use it with a master use license when your song goes in a video project. This one covers the songwriting.",
    keyTerms: ["Sync covers the composition; the recording needs a master use license too.", "Non-exclusive by default.", "Cue sheet: the producer files it, so you get performance royalties."],
    roles: ["Rights Owner", "Licensee"],
    fields: [
      DATE, SONG, PROJECT, FEE("Sync fee", "$1,000", "The one-time fee for the license."),
      MEDIA, TERRITORY, LICENSE_TERM, STATE,
    ],
    body: doc("Synchronization License", ["Rights Owner", "Licensee"], [
      ["LICENSE", "Rights Owner grants Licensee a non-exclusive license to use the composition \"{{songTitle}}\" (the \"Song\") in sync with {{project}} (the \"Project\"), in {{media}}, {{territory}}, {{term}}."],
      ["FEE", "Licensee pays Rights Owner {{fee}} on signing."],
      ["LIMITS", "The Song may be edited only for length. It can't be used in other projects, trailers for other works, or in a way that changes its lyrics or meaning, without written approval."],
      ["CREDIT AND CUE SHEET", "Licensee will credit the Song's writers in the end credits or description where practical, and file a cue sheet with the performing rights organizations, sending Rights Owner a copy."],
      ["RECORDING", "This license covers only the composition. Using a recording of the Song needs a separate master use license."],
    ]),
  },
  {
    id: "master-use-license",
    name: "Master Use License",
    category: "Rights & Distribution",
    summary: "Let a film, show, ad or video use your actual recording.",
    whenToUse: "Use it with a sync license when your recording goes in a video project. This one covers the recording.",
    keyTerms: ["Covers the recording only; the songwriting needs a sync license.", "Non-exclusive by default.", "You keep ownership."],
    roles: ["Master Owner", "Licensee"],
    fields: [
      DATE, SONG, PROJECT, FEE("Master use fee", "$1,000", "The one-time fee for the license."),
      MEDIA, TERRITORY, LICENSE_TERM, STATE,
    ],
    body: doc("Master Use License", ["Master Owner", "Licensee"], [
      ["LICENSE", "Master Owner grants Licensee a non-exclusive license to use the master recording of \"{{songTitle}}\" (the \"Master\") in {{project}} (the \"Project\"), in {{media}}, {{territory}}, {{term}}."],
      ["FEE", "Licensee pays Master Owner {{fee}} on signing."],
      ["EDITS", "Licensee may edit the Master only for length and fades. No remixes, re-recordings or sampling."],
      ["OWNERSHIP", "Master Owner keeps all ownership of the Master."],
      ["CREDIT", "Licensee will credit the recording artist in the end credits or description where practical."],
      ["COMPOSITION", "This license covers only the recording. The songwriting needs a separate sync license."],
    ]),
  },
  {
    id: "copyright-assignment",
    name: "Copyright Assignment Agreement",
    category: "Rights & Distribution",
    summary: "Permanently transfer ownership of a song, recording, artwork or other work to someone else.",
    whenToUse: "Use it when ownership of a work is sold or given, so the new owner can register and license it.",
    keyTerms: ["Permanent: the new owner owns it forever.", "The original creator keeps credit.", "Both sign anything else needed to record the transfer."],
    roles: ["Assignor", "Assignee"],
    fields: [
      DATE, need("work", "The work", "What's being transferred: a song, recording, artwork, video or other work.", { placeholder: "The sound recording \"Song Title\"" }),
      need("payment", "Payment", "What the new owner pays. Write \"no payment\" if it's a gift.", { placeholder: "$2,000" }),
      STATE,
    ],
    body: doc("Copyright Assignment", ["Assignor", "Assignee"], [
      ["ASSIGNMENT", "For {{payment}}, Assignor transfers to Assignee all rights, title and copyright in {{work}} (the \"Work\"), worldwide and forever, including the right to register, license and sue for infringement."],
      ["CREDIT", "Assignor keeps the right to be credited as its creator where credits appear."],
      ["PROMISES", "Assignor confirms they own the Work and haven't transferred or exclusively licensed it to anyone else."],
      ["FURTHER PAPERWORK", "Assignor will sign any reasonable document needed to record this transfer, for example with a copyright office."],
    ]),
  },
];
