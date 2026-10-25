/**
 * Every badge in one list (PLAN-badges-roles-app.md). The profile shelf, unlock pop-ups, progress hints, the admin
 * switchboard and the server award check all read from here. What counts toward each `metric` lives in badge-rules.ts.
 * Voice (BRANDING.md §4): lead with "Came Through"; crowns only now and then; no gendered words or fixed names.
 */

export type Tier = "standard" | "instant" | "mega" | "ultimate";
export const TIER_LABEL: Record<Tier, string> = { standard: "", instant: "Instant Win", mega: "MEGA", ultimate: "Ultimate" };
/** MEGA and Ultimate get the full celebration even when a user picks "Big moments only". */
export const isBigTier = (t: Tier) => t === "mega" || t === "ultimate";

export type CollectionId = "core" | "health" | "night" | "lyrics" | "splits" | "contracts" | "producer" | "live" | "hiphop" | "spiritual";
/** `always`: locked badges show even before any progress. The rest appear once the user starts that kind of work. */
export const COLLECTIONS: { id: CollectionId; title: string; always?: boolean }[] = [
  { id: "core", title: "Came Through", always: true },
  { id: "lyrics", title: "Lyrics", always: true },
  { id: "splits", title: "Split Sheets", always: true },
  { id: "contracts", title: "Contracts & Blueprints", always: true },
  { id: "health", title: "Royalty Health" },
  { id: "producer", title: "Producer" },
  { id: "live", title: "Live Musicians" },
  { id: "hiphop", title: "Hip-Hop/Rap" },
  { id: "spiritual", title: "Spiritual Hip-Hop" },
  { id: "night", title: "Night Shift" },
];

export type BadgeDef = {
  id: string;
  title: string;
  collection: CollectionId;
  tier: Tier;
  /** Plain-language milestone, shown on locked badges. */
  milestone: string;
  /** Short action that earns it ("Embed 5 lyrics"), on the next-badge card; the milestone and description show on hover. */
  action: string;
  description: string;
  /** Short unlock message; "{artist}" becomes the user's artist name. */
  popup: string;
  src: string;
  /** Count from badge-rules.ts; the badge unlocks when it reaches `goal`. */
  metric: string;
  goal: number;
  /**
   * Earned again every `every` more after the first time: Positive Vibes (goal 1, every 1) comes with each spiritual
   * track; Lyrical Legacy (goal 100, every 100) comes again at 200, 300…
   */
  every?: number;
  /** Art the user picks from each time it's earned (Self-Produced lets producers choose a Beat Machine). */
  choices?: string[];
  /** Art isn't uploaded yet: the badge stays out of checks and shelves until this flag is removed. */
  artPending?: boolean;
  /** Already celebrated elsewhere (Genesis is claimed in onboarding), so it lands on the shelf without a pop-up. */
  preSeen?: boolean;
};

/** Singular and plural names for each count, for hints like "3 more lyrics to Lyric Lover". */
export const METRIC_UNIT: Record<string, [string, string]> = {
  songs: ["song", "songs"], ready: ["Registration Ready song", "Registration Ready songs"], masters: ["stored master", "stored masters"],
  lyrics: ["lyric", "lyrics"], healthy: ["100% healthy song", "100% healthy songs"], protected: ["protected song", "protected songs"],
  splitsSigned: ["fully signed split sheet", "fully signed split sheets"], contractsSigned: ["fully signed contract", "fully signed contracts"],
  deals: ["signed agreement", "signed agreements"], produced: ["produced song", "produced songs"], performerCredits: ["performer credit", "performer credits"],
  hiphop: ["hip-hop track", "hip-hop tracks"], spiritual: ["spiritual hip-hop track", "spiritual hip-hop tracks"],
  agencyExports: ["agency export", "agency exports"],
};

/** How many times a badge has been earned at this count: once at `goal`, then once per `every` beyond it. */
export function timesEarned(badge: Pick<BadgeDef, "goal" | "every">, count: number) {
  if (count < badge.goal) return 0;
  return badge.every ? 1 + Math.floor(count / badge.every) - Math.floor(badge.goal / badge.every) : 1;
}

/** The count at which a badge is next earned (its goal, or the next `every` step once it's held). */
export function nextGoal(badge: Pick<BadgeDef, "goal" | "every">, count: number) {
  if (count < badge.goal || !badge.every) return badge.goal;
  return (Math.floor(count / badge.every) + 1) * badge.every;
}

const I = "/icons";
const S = `${I}/serious`, P = `${I}/playful`;

const CORE: BadgeDef[] = [
  { id: "genesis", title: "Genesis Crown", collection: "core", tier: "instant", milestone: "Set up your profile", action: "Set up your profile", metric: "welcomed", goal: 1, preSeen: true, src: `${S}/came_genesis_gold.png`,
    description: "Every empire starts with a name on the door. You set up your profile and claimed your spot. From here on, everything you build has your name on it.",
    popup: "You came through! Your profile is live and your story starts now." },
  { id: "first_note", title: "First Note", collection: "core", tier: "instant", milestone: "Save your first song to your catalog", action: "Catalog your first song", metric: "songs", goal: 1, src: `${P}/bedazzled_note.png`,
    description: "One song, filed and safe. Most artists never write down what they own. You just did. Your first stop before distribution, handled.",
    popup: "First note logged! Your catalog is officially open." },
  { id: "master_crowned", title: "Master Crowned", collection: "core", tier: "instant", milestone: "Embed and download your first master, then every full album of WAV masters", action: "Embed your first master", metric: "masterCrowns", goal: 1, every: 1, src: `${S}/master_crowned.png`,
    description: "Your credits now travel inside the file. Wherever this master goes, your name goes with it. That's how you get found and get paid. Every full album of WAV masters you embed crowns you again.",
    popup: "Came through! Your credits ride with every play." },
  { id: "mic_check", title: "Mic Check", collection: "core", tier: "standard", milestone: "Credit a vocalist on a song", action: "Credit a vocalist", metric: "vocalSongs", goal: 1, src: `${P}/bedazzled_mic.png`,
    description: "The voice got its credit. Naming who sang it means nobody gets left out of the story or the royalties.",
    popup: "Mic check! Every voice on this record is on the record." },
  { id: "came_strong", title: "Came Strong", collection: "core", tier: "standard", milestone: "1 song Registration Ready", action: "Ready 1 song to register", metric: "ready", goal: 1, src: `${S}/came_strong_gold.png`,
    description: "Writers named, roles set, nothing missing. This song is ready to register and ready to collect. You came through for it.",
    popup: "Came strong! Your first song is ready to register." },
  { id: "came_double", title: "Doubled Up", collection: "core", tier: "standard", milestone: "10 songs Registration Ready, then every 10 more", action: "Ready 10 songs to register", metric: "ready", goal: 10, every: 10, src: `${S}/came_double_trophy_gold.png`,
    description: "Ten songs with nothing missing. You came up and you came through: you're not hoping the money finds you, you're making sure it does.",
    popup: "Doubled up! 10 more songs ready to collect." },
  { id: "key_holder", title: "Key Holder", collection: "core", tier: "standard", milestone: "A collaborator signs one of your split sheets or contracts", action: "Get a collaborator to sign", metric: "collaboratorSigned", goal: 1, src: `${S}/award_certificate.png`,
    description: "You opened the door and someone shook on it. Good business is built with people you trust, and your first collaborator just signed.",
    popup: "Deal shook! Your first collaborator signed." },
  { id: "time_witness", title: "Time Witness", collection: "core", tier: "standard", milestone: "Every song protected in the AI Protection Hub", action: "Protect a song", metric: "protected", goal: 1, every: 1, src: `${S}/time_witness.png`,
    description: "The clock saw it. You have proof this file existed on this date, sealed where nobody can change it. Every song you protect earns another.",
    popup: "Witnessed! Another song protected and timestamped." },
  { id: "shield_up", title: "Shield Up", collection: "core", tier: "standard", milestone: "10 songs protected in the AI Protection Hub, then every 10 more", action: "Protect 10 songs", metric: "protected", goal: 10, every: 10, src: `${S}/award_shield.png`,
    description: "Ten songs guarded in the AI Protection Hub. You protect what you make before anyone else gets ideas.",
    popup: "Shield up! 10 songs protected." },
  { id: "paper_ready", title: "Paper Ready", collection: "core", tier: "standard", milestone: "Download your first agency export, then every 10 more", action: "Download an agency export", metric: "agencyExports", goal: 1, every: 10, src: `${S}/award_folder.png`,
    description: "Your songs left the building in the format the agencies want. This is the paperwork that turns plays into payments.",
    popup: "Exported! Your songs are on their way to get paid." },
  { id: "checkup_champ", title: "Checkup Champ", collection: "core", tier: "standard", milestone: "Run a Royalty Health Check, once each month", action: "Run a monthly Health Check", metric: "healthCheckMonths", goal: 1, every: 1, src: `${S}/key_holder.png`,
    description: "You unlocked where your money is instead of guessing. Every fix you make from here is money you were missing. Check in every month to earn it again.",
    popup: "Checkup done! Now you know where your money is." },
  { id: "chain_of_title", title: "Chain of Title", collection: "core", tier: "standard", milestone: "Every song with writers complete, splits at 100%, a fully signed split sheet and a timestamp", action: "Seal a song's paperwork", metric: "chainOfTitle", goal: 1, every: 1, src: `${S}/came_chain_gold.png`,
    description: "Every link is in place. Who wrote it, who owns what, signed and dated. This is what a bulletproof song looks like.",
    popup: "Unbreakable chain! This song's paperwork is airtight." },
  { id: "full_band", title: "Full Band", collection: "core", tier: "standard", milestone: "Every song crediting 3 or more performers", action: "Credit 3+ performers", metric: "fullBandSongs", goal: 1, every: 1, src: `${P}/bedazzled_band.png`,
    description: "Everybody on the stage got their name on the record. Credit where it's due is how musicians keep getting called back.",
    popup: "Full band! Every player got their credit." },
  { id: "vault", title: "The Vault", collection: "core", tier: "standard", milestone: "25 masters stored in your catalog, then every 25 more", action: "Store 25 masters", metric: "masters", goal: 25, every: 25, src: `${P}/vault.png`,
    description: "Twenty-five masters, locked and organized in one place. No more digging through old drives and inboxes.",
    popup: "Vault sealed! 25 masters safe and sound." },
  { id: "full_release", title: "Full Release", collection: "core", tier: "standard", milestone: "Every EP or album (3+ tracks) with every track Registration Ready", action: "Ready a full EP or album", metric: "readyReleases", goal: 1, every: 1, src: `${P}/bedazzled_vinyl.webp`,
    description: "A whole project, nothing missing on any track. That's a release run like a real label.",
    popup: "Came through for the whole project! Every track is ready to collect." },
  { id: "deal_maker", title: "Deal Maker", collection: "core", tier: "mega", milestone: "10 signed agreements (split sheets and contracts together), then every 10 more", action: "Sign 10 agreements", metric: "deals", goal: 10, every: 10, src: `${S}/handshake_diamond_watch.png`,
    description: "Ten deals signed and on file. You handle business like a boss, and everyone who works with you knows where they stand.",
    popup: "MEGA! 10 deals signed. Boss moves." },
  { id: "catalog_complete", title: "Catalog Complete", collection: "core", tier: "ultimate", milestone: "Every song in your catalog Registration Ready (10 songs or more)", action: "Ready every song (10+)", metric: "catalogComplete", goal: 1, src: `${P}/catalog_complete.png`,
    description: "Not one loose end. Every song you own is credited, organized and ready to collect. Most catalogs never get here. Yours did.",
    popup: "ULTIMATE! You came through for every song you own." },
  { id: "unbreakable", title: "Unbreakable", collection: "core", tier: "standard", milestone: "1 year as a member", action: "Stay a member 1 year", metric: "memberYears", goal: 1, src: `${P}/unbreakable.png`,
    description: "A full year of showing up for your music business. Consistency is the chain that holds everything else together.",
    popup: "Unbreakable! One year strong." },
  // Each year after gets an upgraded chain. Art is coming: public/icons/playful/unbreakable_<years>.webp.
  ...[2, 3, 4, 5].map((years): BadgeDef => ({ id: `unbreakable_${years}`, title: `Unbreakable · ${years} Years`, collection: "core", tier: years === 5 ? "mega" : "standard",
    milestone: `${years} years as a member`, action: `Stay a member ${years} years`, metric: "memberYears", goal: years, artPending: true, src: `${P}/unbreakable_${years}.webp`,
    description: `${years} years of showing up for your music business. The chain gets heavier every year, and so does everything you've built.`,
    popup: `Unbreakable! ${years} years strong. Came Through Audio came through with you.` })),
  // Art is coming: public/icons/playful/full_ep.webp and full_album.webp.
  { id: "full_ep", title: "Full EP", collection: "core", tier: "standard", milestone: "Every full EP (4 to 6 songs) in your catalog", action: "Catalog a full EP", metric: "fullEps", goal: 1, every: 1, artPending: true, src: `${P}/full_ep.webp`,
    description: "Every song on the EP, embedded and filed together. A complete project with your credits riding inside every track.",
    popup: "Full EP! The whole project came through." },
  { id: "full_album", title: "Full Album", collection: "core", tier: "mega", milestone: "Every full album (7 or more songs) in your catalog", action: "Catalog a full album", metric: "fullAlbums", goal: 1, every: 1, artPending: true, src: `${P}/full_album.webp`,
    description: "A whole album, every track embedded and filed. That's a body of work with your name on every song.",
    popup: "MEGA! A full album came through." },
];

const HEALTH: BadgeDef[] = [
  { id: "silver_crown", title: "Silver Crown", collection: "health", tier: "standard", milestone: "10 songs 100% healthy", action: "Get 10 songs 100% healthy", metric: "healthy", goal: 10, src: `${P}/crowns/silver_tiara.png`,
    description: "Ten songs with every royalty door open. You fixed what most people never even check.",
    popup: "Silver crown! 10 healthy songs." },
  { id: "jeweled_crown", title: "Jeweled Crown", collection: "health", tier: "mega", milestone: "25 songs 100% healthy", action: "Get 25 songs 100% healthy", metric: "healthy", goal: 25, src: `${P}/crowns/cross_crown.png`,
    description: "Twenty-five songs collecting from every direction. Every one of them came through.",
    popup: "MEGA! 25 healthy songs. Jewels earned." },
  { id: "gold_crown", title: "Gold Crown", collection: "health", tier: "ultimate", milestone: "50 songs 100% healthy, then every 50 more", action: "Get 50 songs 100% healthy", metric: "healthy", goal: 50, every: 50, src: `${P}/crowns/king_crown.png`,
    description: "Fifty songs, fully healthy, fully collecting. This is the crown for people who leave no money on the table.",
    popup: "ULTIMATE! 50 healthy songs. Wear the gold." },
];

const NIGHT: BadgeDef[] = [
  { id: "marathon", title: "Marathon", collection: "night", tier: "standard", milestone: "Save 5 songs to your catalog between 9 PM and midnight in one night", action: "Catalog 5 songs, 9 PM–12 AM", metric: "marathonNights", goal: 1, every: 1, src: `${P}/marathon.png`,
    description: "Five songs in one night. While everyone else was winding down, you were building.",
    popup: "Marathon! 5 songs in one night. Hustle." },
  { id: "midnight_oil", title: "Midnight Oil", collection: "night", tier: "standard", milestone: "Save a song to your catalog between midnight and 4 AM, once each night", action: "Catalog a song 12–4 AM", metric: "midnightNights", goal: 1, every: 1, src: `${P}/midnight_oil.png`,
    description: "The world's asleep and you're still handling business. Late nights build early wins.",
    popup: "Midnight oil! Still grinding at 2 AM." },
  { id: "in_the_quiet", title: "In the Quiet", collection: "night", tier: "standard", milestone: "Save a song to your catalog between 4 AM and 6 AM, once each morning", action: "Catalog a song 4–6 AM", metric: "quietMornings", goal: 1, every: 1, src: `${P}/in_the_quiet.webp`,
    description: "Before the sun, before the noise, you showed up for your music. The quiet hours are where real work happens.",
    popup: "In the quiet. You beat the sunrise." },
];

// The founder's lyric set (copy approved 2026-10-20).
const L = `${P}/lyrics`;
const LYRICS: BadgeDef[] = [
  { id: "first_lyric_entry", title: "First Lyric Entry", collection: "lyrics", tier: "instant", milestone: "1 lyric", action: "Embed your first lyric", metric: "lyrics", goal: 1, src: `${L}/1_first_lyric_entry.webp`,
    description: "You did it. The hardest lyric is the first one, and you just broke through. This pen drop is proof your voice matters. Welcome to Came Through Audio — you’re officially in motion.",
    popup: "First ink! One lyric down — the universe just heard you." },
  { id: "word_weaver", title: "Word Weaver", collection: "lyrics", tier: "standard", milestone: "5 lyrics", action: "Embed 5 lyrics", metric: "lyrics", goal: 5, src: `${L}/5_word_weaver.webp`,
    description: "Look at you weaving. You're not just writing words, you're braiding feelings into sound. Five stories stitched with heart — your thread is getting stronger.",
    popup: "You're weaving magic. 5 lyrics — your patterns are forming!" },
  { id: "lyrical_genius", title: "Lyrical Genius", collection: "lyrics", tier: "standard", milestone: "10 lyrics", action: "Embed 10 lyrics", metric: "lyrics", goal: 10, src: `${L}/creative_flow_brain_a.webp`,
    description: "Genius unlocked. Ten times you chose to feel and say it anyway. That heart splash? That's your signature showing. You're not trying — you're becoming.",
    popup: "Genius level: 10 lyrics! Your heart has its own handwriting now." },
  { id: "lyric_lover", title: "Lyric Lover", collection: "lyrics", tier: "standard", milestone: "15 lyrics", action: "Embed 15 lyrics", metric: "lyrics", goal: 15, src: `${L}/creative_flow_brain_b.webp`,
    description: "You're in love with the process and it shows. 15 lyrics means you've stayed when it got hard. Your brain and heart are starting to dance together.",
    popup: "15 deep. You're officially a Lyric Lover — heart and head in sync." },
  { id: "hook_keeper", title: "Hook Keeper", collection: "lyrics", tier: "standard", milestone: "25 lyrics", action: "Embed 25 lyrics", metric: "lyrics", goal: 25, src: `${L}/25_hook_keeper.webp`,
    description: "You catch feelings and you KEEP them. 25 lyrics means you know how to hold onto what matters and let it drip with meaning. Your vault of hits is starting.",
    popup: "Hooked! 25 lyrics — you're keeping the ones that stick." },
  { id: "brain_to_diamond", title: "Brain to Diamond", collection: "lyrics", tier: "mega", milestone: "40 lyrics", action: "Embed 40 lyrics", metric: "lyrics", goal: 40, src: `${L}/40_mega_accomplishment.webp`,
    description: "This is the big one. 40 lyrics is head to heart, brain to diamond — you've turned thoughts into treasure. This is not a milestone, it's a transformation. You are the chain, the spark, and the gem.",
    popup: "MEGA! 40 lyrics — your brain just became a diamond. This is huge, {artist}." },
  { id: "verse_vault", title: "Verse Vault", collection: "lyrics", tier: "standard", milestone: "50 lyrics", action: "Embed 50 lyrics", metric: "lyrics", goal: 50, src: `${L}/50_verse_vault.webp`,
    description: "Half a hundred stories safe inside you. You've built a vault, not just a list. Your verses have a home now and they're worth protecting. You are prolific, period.",
    popup: "Vault unlocked! 50 lyrics — you're rich in verses." },
  { id: "lyrical_legacy", title: "Lyrical Legacy", collection: "lyrics", tier: "ultimate", milestone: "100 lyrics, then every 100 more", action: "Embed 100 lyrics", metric: "lyrics", goal: 100, every: 100, src: `${L}/100_lyrical_legacy.webp`,
    description: "Legacy. Crown on. You didn't just write 100 lyrics — you built a body of work that will outlive a mood, a day, a year. You are the architect of your own sound legacy. Wear this crown, you earned it.",
    popup: "LEGACY. 100 lyrics — crown on, {artist}. You made history." },
];

const SP = `${P}/split_sheets`;
const SPLITS: BadgeDef[] = [
  { id: "fist_bump_deal", title: "Fist Bump Deal", collection: "splits", tier: "instant", milestone: "Create your first split sheet", action: "Create a split sheet", metric: "splitsCreated", goal: 1, src: `${SP}/fist_pump_sealed_blue.webp`,
    description: "The conversation most artists avoid, you started it. Splits on paper before the song blows up is how friendships survive.",
    popup: "Deal! Your first split sheet is started." },
  { id: "sealed", title: "Sealed", collection: "splits", tier: "standard", milestone: "1 split sheet signed by everyone", action: "Get a split sheet signed", metric: "splitsSigned", goal: 1, src: `${SP}/fist_bump_deal.jpg`,
    description: "Everyone signed. No \"I thought we said…\" later. This song's money has a map.",
    popup: "Sealed! Your first split sheet is signed by everyone." },
  { id: "three_way_collab", title: "Three-Way Collab", collection: "splits", tier: "standard", milestone: "A fully signed split sheet with 3+ collaborators", action: "Sign a 3-way split", metric: "signedSplits3", goal: 1, src: `${SP}/three_way_collab.jpg`,
    description: "Three minds, one song, zero confusion. You made sure everyone in the room gets paid.",
    popup: "Three-way! Every collaborator's share is on paper." },
  { id: "studio_circle", title: "Studio Circle", collection: "splits", tier: "standard", milestone: "A fully signed split sheet with 4+ collaborators", action: "Sign a 4-way split", metric: "signedSplits4", goal: 1, src: `${SP}/studio_circle_clean.png`,
    description: "A full circle of creators and every share accounted for. Big sessions need big organization, and you brought it.",
    popup: "Studio circle! 4+ collaborators, all settled." },
  { id: "piggy_bank_split", title: "Piggy Bank Split", collection: "splits", tier: "standard", milestone: "10 split sheets signed by everyone", action: "Get 10 splits signed", metric: "splitsSigned", goal: 10, src: `${SP}/piggy_bank_split.jpg`,
    description: "Ten songs with the money already divided fairly before the first check arrives. That's how you save the music and the friendships.",
    popup: "Piggy bank! 10 split sheets signed." },
  { id: "hands_in", title: "Hands In", collection: "splits", tier: "standard", milestone: "25 split sheets signed by everyone", action: "Get 25 splits signed", metric: "splitsSigned", goal: 25, src: `${SP}/four_hand_packed_clean.png`,
    description: "Twenty-five times everyone put their hand in and signed. People trust working with you.",
    popup: "Hands in! 25 split sheets signed." },
  { id: "payout_explosion", title: "Payout Explosion", collection: "splits", tier: "mega", milestone: "50 split sheets signed by everyone", action: "Get 50 splits signed", metric: "splitsSigned", goal: 50, src: `${SP}/payout_explosion_cta.jpg`,
    description: "Fifty songs with every payout mapped. When the money comes, it knows exactly where to go.",
    popup: "MEGA! 50 split sheets. Payout explosion!" },
  { id: "written_in_the_stars", title: "Written in the Stars", collection: "splits", tier: "ultimate", milestone: "100 split sheets signed by everyone, then every 100 more", action: "Get 100 splits signed", metric: "splitsSigned", goal: 100, every: 100, src: `${SP}/constellation_collab.jpg`,
    description: "One hundred songs, every share signed and sealed. Your collaborations are written in the stars and on paper.",
    popup: "ULTIMATE! 100 split sheets. Written in the stars." },
  { id: "high_five", title: "High Five", collection: "splits", tier: "standard", milestone: "Every signature you receive on a split sheet or contract", action: "Collect a signature", metric: "signaturesReceived", goal: 1, every: 1, src: `${SP}/high_five.png`,
    description: "Someone put their name next to yours. Getting a music business agreement signed is an accomplishment, every single time.",
    popup: "High five! Another signature came through." },
];

const CT = `${P}/contracts`;
const CONTRACTS: BadgeDef[] = [
  { id: "blueprint", title: "Blueprint", collection: "contracts", tier: "instant", milestone: "Read your first blueprint guide", action: "Read a blueprint guide", metric: "blueprintReads", goal: 1, src: `${CT}/blueprint_contract.webp`,
    description: "Knowledge first. You learned what's in the deal before anyone handed you a pen.",
    popup: "Blueprint unlocked! You know the layout now." },
  { id: "fine_print", title: "Read the Fine Print", collection: "contracts", tier: "standard", milestone: "Draft your first contract", action: "Draft a contract", metric: "contractsDrafted", goal: 1, src: `${CT}/fine_print.webp`,
    description: "You wrote the terms instead of just accepting someone else's. That's a power move.",
    popup: "Fine print read! Your first contract is drafted." },
  { id: "cross_your_ts", title: "Cross Your T's", collection: "contracts", tier: "standard", milestone: "Send your first contract for signature", action: "Send a contract to sign", metric: "contractsSent", goal: 1, src: `${CT}/cross_your_ts.webp`,
    description: "Terms clear, names right, sent out. You handle business the way it's supposed to be handled.",
    popup: "T's crossed! Your contract is out for signature." },
  { id: "blueprints_checked", title: "Blueprints Checked", collection: "contracts", tier: "standard", milestone: "1 contract signed by every party", action: "Get a contract signed", metric: "contractsSigned", goal: 1, src: `${CT}/blueprints_checked.webp`,
    description: "Signed by every party. Your agreement is real, on file and protecting you.",
    popup: "Checked! Your first contract is fully signed." },
  { id: "secure_structure", title: "Secure the Structure", collection: "contracts", tier: "standard", milestone: "3 contracts signed by every party", action: "Get 3 contracts signed", metric: "contractsSigned", goal: 3, src: `${CT}/secure_structure.webp`,
    description: "Three agreements holding your business up. Structure is what lets creativity run free.",
    popup: "Structure secured! 3 contracts signed." },
  { id: "terms_architected", title: "Terms Architected", collection: "contracts", tier: "standard", milestone: "5 contracts signed by every party", action: "Get 5 contracts signed", metric: "contractsSigned", goal: 5, src: `${CT}/terms_architected.png`,
    description: "You're not just signing deals, you're designing them. Five agreements built your way.",
    popup: "Architect! 5 contracts signed." },
  { id: "crossin_your_ts", title: "Crossin' Your T's", collection: "contracts", tier: "standard", milestone: "10 contracts signed by every party", action: "Get 10 contracts signed", metric: "contractsSigned", goal: 10, src: `${CT}/crossin_your_ts_ultra.webp`,
    description: "Ten deals with every detail handled. Nobody can say you didn't read it.",
    popup: "Crossin' them all! 10 contracts signed." },
  { id: "dottin_your_is", title: "Dottin' Your I's", collection: "contracts", tier: "mega", milestone: "25 contracts signed by every party", action: "Get 25 contracts signed", metric: "contractsSigned", goal: 25, src: `${CT}/dottin_your_i_ultra.webp`,
    description: "Twenty-five agreements, every dot and cross in place. That's executive energy.",
    popup: "MEGA! 25 contracts. Every I dotted." },
  { id: "executive_blueprint", title: "Executive Blueprint", collection: "contracts", tier: "mega", milestone: "35 contracts signed by every party", action: "Get 35 contracts signed", metric: "contractsSigned", goal: 35, src: `${CT}/bedazzled_v1.webp`,
    description: "Thirty-five agreements drawn up and signed. You don't wing deals, you design them, and your catalog is built on solid plans.",
    popup: "MEGA! 35 contracts. Executive blueprint." },
  { id: "executive_suite", title: "Executive Suite", collection: "contracts", tier: "mega", milestone: "50 contracts signed by every party", action: "Get 50 contracts signed", metric: "contractsSigned", goal: 50, src: `${CT}/bedazzled_v2.webp`,
    description: "Fifty signed agreements. You run your music like a company because it is one.",
    popup: "MEGA! 50 contracts. Welcome to the executive suite." },
  { id: "executive_legacy", title: "Executive Legacy", collection: "contracts", tier: "ultimate", milestone: "75 contracts signed by every party, then every 75 more", action: "Get 75 contracts signed", metric: "contractsSigned", goal: 75, every: 75, src: `${CT}/bedazzled_v3.webp`,
    description: "Seventy-five signed agreements. Every collaborator, every deal, every term on file. This is how a music business outlasts trends.",
    popup: "ULTIMATE! 75 contracts. Came Through Audio came through for your legacy." },
];

const PR = `${P}/producer`;
const PRODUCER: BadgeDef[] = [
  { id: "cobalt_beat_machine", title: "Cobalt Beat Machine", collection: "producer", tier: "instant", milestone: "1 song with you in Produced by", action: "Produce your first song", metric: "produced", goal: 1, src: `${PR}/cobalt_beat_machine.png`,
    description: "Your first produced record is on file with your name on it. The beat is yours, and now the paperwork says so.",
    popup: "First beat logged! Producer credit secured." },
  { id: "platinum_beat_machine", title: "Platinum Beat Machine", collection: "producer", tier: "standard", milestone: "5 produced songs", action: "Produce 5 songs", metric: "produced", goal: 5, src: `${PR}/platinum_beat_machine.png`,
    description: "Five productions credited. You're building a sound people can trace back to you.",
    popup: "5 beats credited. Platinum moves." },
  { id: "platinum_cobalt_beat_machine", title: "Platinum Cobalt Beat Machine", collection: "producer", tier: "standard", milestone: "10 produced songs", action: "Produce 10 songs", metric: "produced", goal: 10, src: `${PR}/platinum_cobalt_beat_machine.png`,
    description: "Ten records with your production credit. That's a discography.",
    popup: "10 productions! Your sound has a name." },
  { id: "gold_beat_machine", title: "Gold Beat Machine", collection: "producer", tier: "standard", milestone: "25 produced songs", action: "Produce 25 songs", metric: "produced", goal: 25, src: `${PR}/gold_beat_machine.png`,
    description: "Twenty-five beats, every one credited. You're the producer people come back to.",
    popup: "Gold! 25 productions credited." },
  { id: "gold_crusted_beat_machine", title: "Gold Crusted Beat Machine", collection: "producer", tier: "mega", milestone: "50 produced songs", action: "Produce 50 songs", metric: "produced", goal: 50, src: `${PR}/gold_crusted_beat_machine.png`,
    description: "Fifty records. Your pads have been busy and your credits prove it.",
    popup: "MEGA! 50 productions. Crusted in gold." },
  { id: "full_gold_beat_machine", title: "Full Gold Beat Machine", collection: "producer", tier: "ultimate", milestone: "100 produced songs, then every 100 more", action: "Produce 100 songs", metric: "produced", goal: 100, every: 100, src: `${PR}/full_gold_beat_machine.png`,
    description: "One hundred productions with your name on every one. This is a legacy built one beat at a time.",
    popup: "ULTIMATE! 100 productions. Solid gold." },
  { id: "self_produced", title: "Self-Produced", collection: "producer", tier: "standard", milestone: "Every Registration Ready song where your artist name is also in Produced by", action: "Self-produce a ready song", metric: "selfProduced", goal: 1, every: 1,
    src: `${PR}/cobalt_beat_machine.png`, choices: [`${PR}/cobalt_beat_machine.png`, `${PR}/platinum_beat_machine.png`, `${PR}/platinum_cobalt_beat_machine.png`],
    description: "You made the record and the beat, and the paperwork says both. Pick the Beat Machine you want for this one.",
    popup: "Self-produced! Pick your Beat Machine." },
];

/** Instruments with badge art, matched against the performer's Instrument field (most specific first). */
/** `action`: a shorter first-credit line where "Credit a … part" would run past the next-badge card. */
export const INSTRUMENTS: { id: string; label: string; match: RegExp; art: string[]; action?: string }[] = [
  { id: "vocals", label: "Vocal", match: /vocal|voice|sing|choir/i, art: ["vocal_mic.webp"] },
  { id: "steel_pan", label: "Steel Pan", match: /steel ?pan|handpan|hang drum|steel drum/i, art: ["handpan_medallion.png", "star_studded_steel_pan.webp"] },
  { id: "ukulele", label: "Ukulele", match: /ukulele|\buke\b/i, art: ["ukulele_medallion.png", "star_studded_ukulele.webp"] },
  { id: "electric_guitar", label: "Electric Guitar", match: /electric guitar|e-guitar|lead guitar/i, art: ["electric_guitar.png"], action: "Credit an electric guitar" },
  { id: "acoustic_guitar", label: "Guitar", match: /guitar/i, art: ["acoustic_guitar.png"] },
  { id: "piano", label: "Piano", match: /piano|keys|keyboard|organ|synth/i, art: ["keyboard.webp", "grand_piano_medallion.webp", "star_studded_piano.webp"] },
  { id: "drums", label: "Drum", match: /drum|percussion/i, art: ["drum_kit.webp"] },
  { id: "trumpet", label: "Trumpet", match: /trumpet|flugelhorn|cornet/i, art: ["trumpet.webp"] },
  { id: "saxophone", label: "Saxophone", match: /sax/i, art: ["saxophone.png"] },
  { id: "violin", label: "Violin", match: /\bviolin|fiddle/i, art: ["violin.webp"] },
  { id: "cello", label: "Cello", match: /cello/i, art: ["star_studded_cello.png"] },
  { id: "banjo", label: "Banjo", match: /banjo/i, art: ["banjo_medallion.png", "star_studded_banjo.png"] },
  { id: "clarinet", label: "Clarinet", match: /clarinet/i, art: ["clarinet_medallion.png", "star_studded_clarinet.png"] },
  { id: "trombone", label: "Trombone", match: /trombone/i, art: ["trombone_medallion.png", "star_studded_trombone.webp"] },
  { id: "harp", label: "Harp", match: /\bharp\b/i, art: ["star_studded_harp.png"] },
  { id: "xylophone", label: "Xylophone", match: /xylophone|marimba|vibraphone|glockenspiel/i, art: ["xylophone_medallion.png", "star_studded_double_xylophone.webp"] },
];

/**
 * Each instrument's art says its step: cobalt first-credit art comes with the 1st credit and again every 5 credits,
 * medallion art at 10 and star-studded art at 25. Instruments without a piece of art skip that step.
 */
const stepOf = (file: string) => file.includes("medallion") ? 1 : file.startsWith("star_studded") ? 2 : 0;
const LIVE_STEPS = [
  { goal: 1, every: 5 as number | undefined, tier: "instant" as Tier, title: (l: string) => `${l} Credit`, action: (l: string) => `Credit a ${l.toLowerCase()} part`,
    description: (l: string) => `Every ${l.toLowerCase()} part deserves a name. Each ${l.toLowerCase()} credit is how session musicians get paid and get hired again, and every 5 credits earn this badge again.`,
    popup: (l: string) => `${l} credited! The player got their name on the record.` },
  { goal: 10, every: undefined, tier: "standard" as Tier, title: (l: string) => `${l} Medallion`, action: (l: string) => `Credit ${l.toLowerCase()} 10 times`,
    description: (l: string) => `Ten ${l.toLowerCase()} credits. You treat players like partners, and the record shows it.`,
    popup: (l: string) => `Medallion! 10 ${l.toLowerCase()} credits.` },
  { goal: 25, every: undefined, tier: "standard" as Tier, title: (l: string) => `Star-Studded ${l}`, action: (l: string) => `Credit ${l.toLowerCase()} 25 times`,
    description: (l: string) => `Twenty-five ${l.toLowerCase()} credits. Your sessions are star-studded and every star is named.`,
    popup: (l: string) => `Star-studded! 25 ${l.toLowerCase()} credits.` },
];

const LIVE: BadgeDef[] = [
  ...INSTRUMENTS.flatMap((ins) => ins.art.map((file): BadgeDef => {
    const step = LIVE_STEPS[stepOf(file)]!;
    return { id: `live_${ins.id}_${step.goal}`, title: step.title(ins.label), collection: "live", tier: step.tier,
      milestone: step.every ? `1st ${ins.label.toLowerCase()} credit, then every ${step.every} credits` : `${step.goal} ${ins.label.toLowerCase()} credits`, action: (step.goal === 1 && ins.action) || step.action(ins.label),
      metric: `instrument:${ins.id}`, goal: step.goal, ...(step.every ? { every: step.every } : {}),
      src: `${P}/live_musicians/${file}`, description: step.description(ins.label), popup: step.popup(ins.label) };
  })),
  { id: "session_hero", title: "Session Hero", collection: "live", tier: "mega", milestone: "25 performer credits on any instrument", action: "Credit players 25 times", metric: "performerCredits", goal: 25, src: `${P}/live_musicians/session_hero.webp`,
    description: "Twenty-five players credited. Every session you run leaves a paper trail that pays the people who played.",
    popup: "MEGA! 25 performer credits. Session hero." },
  { id: "live_legend", title: "Live Legend", collection: "live", tier: "ultimate", milestone: "100 performer credits on any instrument, then every 100 more", action: "Credit players 100 times", metric: "performerCredits", goal: 100, every: 100, src: `${P}/live_musicians/live_legend.webp`,
    description: "One hundred performer credits. Musicians know that when they play on your records, they get their name and their money.",
    popup: "ULTIMATE! 100 performer credits. Live legend." },
];

const HH = `${P}/hip_hop`;
const HIPHOP: BadgeDef[] = [
  { id: "cobalt_boombox", title: "Cobalt Boombox", collection: "hiphop", tier: "instant", milestone: "1 hip-hop track", action: "Catalog your first hip-hop song", metric: "hiphop", goal: 1, src: `${HH}/cobalt_boombox.png`,
    description: "Your first rap record is on the books. Bars on paper, credits in the file.", popup: "Boombox on! First hip-hop track logged." },
  { id: "studio_headphones", title: "Studio Headphones", collection: "hiphop", tier: "standard", milestone: "5 hip-hop tracks", action: "Catalog 5 hip-hop songs", metric: "hiphop", goal: 5, src: `${HH}/studio_headphones.png`,
    description: "Five tracks deep. You hear the details other people miss, in the mix and in the paperwork.", popup: "Headphones on! 5 tracks." },
  { id: "vintage_mic", title: "Vintage Mic", collection: "hiphop", tier: "standard", milestone: "10 hip-hop tracks", action: "Catalog 10 hip-hop songs", metric: "hiphop", goal: 10, src: `${HH}/vintage_mic.png`,
    description: "Ten records. Classic energy, modern business.", popup: "10 tracks! That's a mixtape." },
  { id: "cobalt_grillz_mic", title: "Cobalt Grillz Mic", collection: "hiphop", tier: "standard", milestone: "15 hip-hop tracks", action: "Catalog 15 hip-hop songs", metric: "hiphop", goal: 15, src: `${HH}/mic_grillz_cobalt_glow.png`,
    description: "Fifteen songs, and your catalog is starting to shine.", popup: "Grillz on! 15 tracks." },
  { id: "platinum_ice_mic", title: "Platinum Ice Mic", collection: "hiphop", tier: "standard", milestone: "25 hip-hop tracks", action: "Catalog 25 hip-hop songs", metric: "hiphop", goal: 25, src: `${HH}/mic_grillz_platinum_ice.png`,
    description: "Twenty-five tracks credited. Iced out and organized.", popup: "Platinum ice! 25 tracks." },
  { id: "gold_filigree_mic", title: "Gold Filigree Mic", collection: "hiphop", tier: "mega", milestone: "40 hip-hop tracks", action: "Catalog 40 hip-hop songs", metric: "hiphop", goal: 40, src: `${HH}/mic_grillz_gold_filigree.png`,
    description: "Forty tracks with every credit in place. That's a catalog with weight.", popup: "MEGA! 40 tracks. Gold grillz." },
  { id: "cta_chain", title: "CTA Chain", collection: "hiphop", tier: "mega", milestone: "50 hip-hop tracks", action: "Catalog 50 hip-hop songs", metric: "hiphop", goal: 50, src: `${HH}/cta_chain_medallion.png`,
    description: "Fifty records. Put the chain on, you earned it with paperwork, not just bars.", popup: "MEGA! 50 tracks. Chain on." },
  { id: "dripping_ice_boombox", title: "Dripping Ice Boombox", collection: "hiphop", tier: "ultimate", milestone: "100 hip-hop tracks, then every 100 more", action: "Catalog 100 hip-hop songs", metric: "hiphop", goal: 100, every: 100, src: `${HH}/dripping_ice_boombox.png`,
    description: "One hundred tracks, every one credited. Legend status.", popup: "ULTIMATE! 100 tracks. Dripping." },
  { id: "iced_dollar", title: "Iced Dollar", collection: "hiphop", tier: "standard", milestone: "Every hip-hop track with a split sheet signed by everyone", action: "Sign splits on a hip-hop song", metric: "hiphopSigned", goal: 1, every: 1, src: `${HH}/iced_dollar.png`,
    description: "You secured the bag before the beat dropped. Split settled, everyone paid right.", popup: "Iced out! Your bag is secured." },
  { id: "diamond_vinyl", title: "Diamond Vinyl", collection: "hiphop", tier: "standard", milestone: "Every hip-hop EP or album with every track Registration Ready", action: "Ready a hip-hop EP or album", metric: "hiphopReleases", goal: 1, every: 1, src: `${HH}/diamond_vinyl.png`,
    description: "A whole project with nothing missing. That's diamond-certified business.", popup: "Diamond! Your whole project is ready to collect." },
];

const SR = `${HH}/spiritual_rap`;
const SPIRITUAL: BadgeDef[] = [
  { id: "cobalt_wings", title: "Cobalt Wings", collection: "spiritual", tier: "instant", milestone: "1 spiritual hip-hop track", action: "Catalog your first spiritual song", metric: "spiritual", goal: 1, src: `${SR}/cobalt_wings_mic.png`,
    description: "Your first faith-filled record is on file. Your message is protected and credited.", popup: "Wings up! Your first spiritual track is logged." },
  { id: "faith_flow", title: "Faith Flow", collection: "spiritual", tier: "standard", milestone: "3 spiritual hip-hop tracks", action: "Catalog 3 spiritual songs", metric: "spiritual", goal: 3, src: `${SR}/faith_flow.png`,
    description: "Three songs flowing from the heart. Keep going.", popup: "Faith flow! 3 tracks." },
  { id: "positive_vibes", title: "Positive Vibes", collection: "spiritual", tier: "standard", milestone: "Every spiritual hip-hop track", action: "Catalog a spiritual song", metric: "spiritual", goal: 1, every: 1, src: `${SR}/positive_vibes.png`,
    description: "Another song spreading light, credited and on file. Every spiritual track you add earns this again.", popup: "Positive vibes! Another track logged." },
  { id: "authentic", title: "Authentic", collection: "spiritual", tier: "standard", milestone: "10 spiritual hip-hop tracks", action: "Catalog 10 spiritual songs", metric: "spiritual", goal: 10, src: `${SR}/authentic.png`,
    description: "Ten songs that sound like you and nobody else.", popup: "Authentic! 10 tracks." },
  { id: "encourager", title: "Encourager", collection: "spiritual", tier: "standard", milestone: "Every 5 spiritual hip-hop tracks", action: "Catalog 5 more spiritual songs", metric: "spiritual", goal: 5, every: 5, src: `${SR}/encourager.png`,
    description: "Five more songs lifting people up. Your music is somebody's answer.", popup: "Encourager! 5 more tracks." },
  { id: "self_love", title: "Self Love", collection: "spiritual", tier: "standard", milestone: "20 spiritual hip-hop tracks", action: "Catalog 20 spiritual songs", metric: "spiritual", goal: 20, src: `${SR}/self_love.png`,
    description: "Twenty songs. You poured into others; this one's for you.", popup: "Self love! 20 tracks." },
  { id: "golden_halo", title: "Golden Halo", collection: "spiritual", tier: "standard", milestone: "25 spiritual hip-hop tracks", action: "Catalog 25 spiritual songs", metric: "spiritual", goal: 25, src: `${SR}/cobalt_wings_mic_gold_halo.png`,
    description: "Twenty-five songs of purpose, every one credited and protected.", popup: "Halo on! 25 tracks." },
  { id: "gold_wings", title: "Gold Wings", collection: "spiritual", tier: "mega", milestone: "40 spiritual hip-hop tracks", action: "Catalog 40 spiritual songs", metric: "spiritual", goal: 40, src: `${SR}/gold_wings_mic.png`,
    description: "Forty songs, gilded and guarded.", popup: "MEGA! 40 tracks. Gold wings." },
  { id: "god_led", title: "God-Led", collection: "spiritual", tier: "ultimate", milestone: "50 spiritual hip-hop tracks, then every 50 more", action: "Catalog 50 spiritual songs", metric: "spiritual", goal: 50, every: 50, src: `${SR}/god_led.png`,
    description: "Fifty songs, led by faith and built with care. A ministry and a catalog.", popup: "ULTIMATE! 50 tracks. God-led." },
];

/** Every badge, including ones waiting on art. */
export const ALL_BADGES: BadgeDef[] = [...CORE, ...LYRICS, ...SPLITS, ...CONTRACTS, ...HEALTH, ...PRODUCER, ...LIVE, ...HIPHOP, ...SPIRITUAL, ...NIGHT];
/** Badges that can be earned and shown today. */
export const BADGES: BadgeDef[] = ALL_BADGES.filter((b) => !b.artPending);
export const badgeById = (id: string) => ALL_BADGES.find((b) => b.id === id);

/** Fills "{artist}" with the user's artist name, or drops it cleanly when there isn't one. */
export const withArtist = (text: string, artist?: string) =>
  text.replace(/, \{artist\}/g, artist?.trim() ? `, ${artist.trim()}` : "").replace(/\{artist\}/g, artist?.trim() || "you");

/** What a user sees about badges. Badges are always earned; these only change what shows. */
export type BadgePrefs = {
  celebrations: "all" | "big" | "off";
  hints: boolean;
  hidden: CollectionId[];
  share: boolean;
};
export const DEFAULT_BADGE_PREFS: BadgePrefs = { celebrations: "all", hints: true, hidden: [], share: true };

/** Avatars are either a badge image (shown whole) or an uploaded photo (shown round). */
export const isBadgeImage = (src?: string) => !!src && src.startsWith("/icons/");

/** Retired badge art, mapped to its replacement so saved avatars keep working without rewriting profile data. */
const RETIRED_BADGES: Record<string, string> = {
  "/icons/playful/bedazzled_mpc.png": "/icons/playful/producer/full_gold_beat_machine.png",
  "/icons/playful/producer/platinum_laptop.png": "/icons/playful/producer/full_gold_beat_machine.png",
};
export const currentBadge = (src?: string) => (src && RETIRED_BADGES[src]) || src;
