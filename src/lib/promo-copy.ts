/** Short, shareable promo captions for the badge celebration. Each spot (embed, catalog, profile) has its own voice. */
export type PromoContext = "embed" | "catalog" | "profile";

export const PROMO_SITE = "camethroughaudio.com";
export const BRAND_TAGS = ["#CameThrough", "#CameThroughAudio"];

/** Three discovery hashtags per genre (keys match GENRES in metadata.ts). */
export const GENRE_TAGS: Record<string, [string, string, string]> = {
  "Hip-Hop/Rap": ["#HipHop", "#RapMusic", "#NewHipHop"],
  "R&B/Soul": ["#RnB", "#SoulMusic", "#NewRnB"],
  Pop: ["#PopMusic", "#NewPop", "#PopArtist"],
  Rock: ["#RockMusic", "#NewRock", "#RockBand"],
  Gospel: ["#GospelMusic", "#Gospel", "#ChristianMusic"],
  Jazz: ["#JazzMusic", "#Jazz", "#NewJazz"],
  Blues: ["#BluesMusic", "#Blues", "#BluesArtist"],
  Country: ["#CountryMusic", "#NewCountry", "#CountryArtist"],
  Electronic: ["#ElectronicMusic", "#EDM", "#NewEDM"],
  Reggae: ["#Reggae", "#ReggaeMusic", "#Dancehall"],
  Latin: ["#MusicaLatina", "#LatinMusic", "#Reggaeton"],
  Afrobeats: ["#Afrobeats", "#Afrobeat", "#AfroMusic"],
  Classical: ["#ClassicalMusic", "#Composer", "#Orchestra"],
  Soundtrack: ["#FilmScore", "#Soundtrack", "#Composer"],
  Alternative: ["#AlternativeMusic", "#AltMusic", "#IndieMusic"],
};
const DEFAULT_TAGS: [string, string, string] = ["#NewMusic", "#IndependentArtist", "#UpcomingArtist"];
export const genreTags = (genre?: string) => (genre && GENRE_TAGS[genre]) || DEFAULT_TAGS;

/** title: the song title, or undefined when blank or hidden. count: catalog song count, or undefined when hidden. genre: primary genre for hashtags. */
export type PromoInput = { title?: string | undefined; count?: number | undefined; genre?: string | undefined };

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const EMBED: ((song: string) => string)[] = [
  (s) => `I'm embedding ${s} with metadata on Came Through Audio RN! New music dropping soon! 🔥`,
  (s) => `${cap(s)} is officially tagged and locked 🔒 New single loading… stay close 🔥`,
  (s) => `Credits ✔️ Metadata ✔️ Artwork ✔️ ${cap(s)} is almost here 👀🔥`,
  (s) => `Final step before release: embedding the metadata on ${s}. You're not ready 🔥`,
  (s) => `Doing it the right way, every credit on ${s} embedded before distribution. Drop soon 🔥`,
  (s) => `${cap(s)}. Tagged. Protected. Coming soon. 🔥`,
  (s) => `Who's ready for ${s}? 🙋🏽 Metadata's locked, release is close 🔥`,
  (s) => `Studio's done, paperwork's done. ${cap(s)} is pulling up soon 🔥`,
  (s) => `Not a leak, just a tease 👀 ${cap(s)} is tagged and on the way 🔥`,
  (s) => `Every name on ${s} is credited where it belongs. Now we wait 🔥`,
  (s) => `Late night, locking in the metadata on ${s} 🌙 Almost time 🔥`,
  (s) => `${cap(s)} just got its credits, codes and cover locked in. Release mode activated 🔥`,
  (s) => `Turn my notifications on. ${cap(s)} is coming 🔔🔥`,
  (s) => `Behind the scenes: embedding the metadata on ${s} before it drops 🎧🔥`,
  (s) => `The music's ready. The metadata's ready. Are you? ${cap(s)} soon 🔥`,
  (s) => `Getting ${s} distribution-ready, one credit at a time ✍🏽🔥`,
  (s) => `Some things you just can't rush. ${cap(s)} is worth the wait 🔥`,
  (s) => `Tagged it, protected it, now I'm about to drop it. ${cap(s)} coming soon 🔥`,
  (s) => `Big things loading ⏳ ${cap(s)} is metadata-ready 🔥`,
  (s) => `Save the date energy 📅 ${cap(s)} is almost out 🔥`,
];

/** n: number of songs, or undefined when the count is hidden. */
const CATALOG: ((n?: number) => string)[] = [
  (n) => `${n ? (n === 1 ? "My first song." : `${n} songs.`) : "My whole catalog."} Every credit, split and code in one place. Organized the right way 🔥`,
  () => `Building my catalog like a business 📂 Every song credited, every split locked 🔥`,
  () => `Nobody talks about the paperwork. My whole catalog is organized and ready to register 🔥`,
  (n) => `Catalog check ✔️ ${n ? (n === 1 ? "My first song is" : `${n} songs`) : "Every song"} organized, credited and protected. Stay tuned 🔥`,
  (n) => `Owning my music starts with knowing my catalog. ${n ? (n === 1 ? "First song" : `${n} songs`) : "Every song"} locked in 🔥`,
  () => `Credits, splits, codes: all filed. This is what being independent looks like 🔥`,
  (n) => `${n && n > 1 ? `${n} songs deep` : "Catalog growing"} and every single one is organized 📂🔥`,
  () => `My catalog is my business. Organized, protected and ready to collect 💰🔥`,
  () => `Getting my catalog right so every song gets paid right 🔥`,
  (n) => `Building a catalog, not just dropping songs. ${n ? (n === 1 ? "Song one" : `${n} songs`) : "Every song"} in order 🔥`,
  () => `Spring cleaning my catalog 🧹 Every credit where it belongs 🔥`,
  () => `If you don't know your catalog, you don't know your money. Mine's organized 🔥`,
];

const PROFILE: (() => string)[] = [
  () => `Doing music the right way, from the studio to distribution 🔥`,
  () => `Independent and organized. Credits, metadata, protection, all handled 🔥`,
  () => `Earned my badge on Came Through Audio 👑 Next stop: distribution 🔥`,
  () => `Wearing my badge proud 👑 Independent artist doing it the right way 🔥`,
  () => `Every song credited, every split respected. That's how I move 🔥`,
  () => `Making music is half the job. Owning it is the other half 🔥`,
  () => `New badge, same grind 👑 More music on the way 🔥`,
  () => `Organized artist energy. My credits are handled 🔥`,
  () => `From the studio to distribution, I'm covered 🔥`,
  () => `Building something that lasts, one song at a time 👑🔥`,
];

export function promoCount(ctx: PromoContext): number {
  return ctx === "embed" ? EMBED.length : ctx === "catalog" ? CATALOG.length : PROFILE.length;
}

/** The i-th caption for this spot: the line, the site, then five hashtags (two brand, three for the genre). */
export function promoCaption(ctx: PromoContext, i: number, { title, count, genre }: PromoInput): string {
  const n = promoCount(ctx);
  const k = ((i % n) + n) % n;
  const body = ctx === "embed" ? EMBED[k]!(title ? `"${title}"` : "my new single")
    : ctx === "catalog" ? CATALOG[k]!(count)
    : PROFILE[k]!();
  return `${body}\n${PROMO_SITE}\n${[...BRAND_TAGS, ...genreTags(genre)].join(" ")}`;
}

/** X rewards one or two hashtags, so its post swaps any hashtag-only lines for #CameThrough plus the top genre tag. */
export function captionForX(caption: string, genre?: string): string {
  const lines = caption.split("\n").filter((l) => !/^\s*(#\w+\s*)+$/.test(l));
  return [...lines, `${BRAND_TAGS[0]} ${genreTags(genre)[0]}`].join("\n");
}

/** A shuffled order of caption indexes, so Generate goes through every style before repeating. */
export function promoOrder(ctx: PromoContext, random = Math.random): number[] {
  const order = Array.from({ length: promoCount(ctx) }, (_, i) => i);
  for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [order[i], order[j]] = [order[j]!, order[i]!]; }
  return order;
}
