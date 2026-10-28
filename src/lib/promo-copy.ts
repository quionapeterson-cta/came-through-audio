import { parentGenre } from "@/lib/metadata";
/** Short, shareable promo captions for the badge celebration. Each spot (embed, catalog, profile) has its own voice. */
export type PromoContext = "embed" | "catalog" | "profile";

export const PROMO_SITE = "camethroughaudio.com";
export const BRAND_TAGS = ["#CameThrough", "#CameThroughAudio"];

/** Three discovery hashtags per genre (keys match GENRES in metadata.ts). */
export const GENRE_TAGS: Record<string, [string, string, string]> = {
  "Hip-Hop/Rap": ["#HipHop", "#RapMusic", "#NewHipHop"],
  "Spiritual Hip-Hop": ["#ChristianHipHop", "#ChristianRap", "#FaithMusic"],
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
export const genreTags = (genre?: string) => (genre && (GENRE_TAGS[genre] ?? GENRE_TAGS[parentGenre(genre)])) || DEFAULT_TAGS;

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
  // More styles (founder, 2026-10-27: as many as possible): release day, pre-save, behind the scenes, milestones,
  // thank-yous, hype and questions for fans.
  (s) => `Release week energy 🗓️ ${cap(s)} is tagged, credited and ready to go 🔥`,
  (s) => `Pre-save mode: ON. ${cap(s)} is almost here and every credit is locked in 🔒🔥`,
  (s) => `If you've been waiting on ${s}, it's close. Real close 👀🔥`,
  (s) => `Wrote it, recorded it, credited it. ${cap(s)} is coming 🎙️🔥`,
  (s) => `${cap(s)} isn't just a song, it's a whole mood. Dropping soon 🌊🔥`,
  (s) => `Came Through Audio came through for ${s} 🙌🏽 Metadata locked, release next 🔥`,
  (s) => `What's the first thing you're doing when ${s} drops? 👇🏽🔥`,
  (s) => `Shout out to everybody who worked on ${s}. Every name is credited 🙏🏽🔥`,
  (s) => `I don't rush my music, I prepare it. ${cap(s)} is ready 🎧🔥`,
  (s) => `The countdown to ${s} has started ⏳🔥`,
  (s) => `New music alert 🚨 ${cap(s)} is tagged and on the way 🔥`,
  (s) => `I put everything into ${s}. Can't wait for you to hear it ❤️‍🔥`,
  (s) => `Quiet before the drop 🤫 ${cap(s)} is ready when you are 🔥`,
  (s) => `${cap(s)}: written with love, released with intention. Soon 🔥`,
  (s) => `This one's for the real ones. ${cap(s)} coming soon 🔥`,
  (s) => `Codes ✔️ Credits ✔️ Cover ✔️ Confidence ✔️ ${cap(s)} 🔥`,
  (s) => `Dropping a hint 💡 ${cap(s)} is almost here 🔥`,
  (s) => `Tag someone who needs to hear ${s} first 👇🏽🔥`,
  (s) => `Can't keep ${s} to myself much longer 😮‍💨🔥`,
  (s) => `Every detail on ${s} handled before it hits the stores. That's how we move 🔥`,
  (s) => `Mark your calendar 📅 ${cap(s)} is pulling up 🔥`,
  (s) => `From the notes app to the master: ${s} is finished 📝🔥`,
  (s) => `I've played ${s} on repeat all week. Your turn soon 🔁🔥`,
  (s) => `Releasing ${s} the professional way: credited, coded and protected 🛡️🔥`,
  (s) => `One more step before ${s} goes live. Almost there 🏁🔥`,
  (s) => `Drop a 🔥 if you're ready for ${s}`,
  (s) => `Built ${s} from the ground up. Now it's almost yours 🔥`,
  (s) => `Headphones on 🎧 ${cap(s)} is the one. Coming soon 🔥`,
  (s) => `New chapter, new sound. ${cap(s)} is on the way 📖🔥`,
  (s) => `The vibes on ${s} are different. You'll see 👀🔥`,
  (s) => `${cap(s)} is mixed, mastered and metadata-ready 💿🔥`,
  (s) => `Thank you for waiting on ${s}. It was worth it 🙏🏽🔥`,
  (s) => `Your next favorite song might be ${s} 😌🔥`,
  (s) => `Taking care of business before ${s} drops. Every credit counts 💼🔥`,
  (s) => `Guess the vibe of ${s} in one emoji 👇🏽🔥`,
  (s) => `Release prep looks like this: tagging ${s} line by line 🖊️🔥`,
  (s) => `${cap(s)} is ready for the world. Are you ready for ${s}? 🌍🔥`,
  (s) => `Some songs you make, some songs make you. ${cap(s)} soon 🔥`,
  (s) => `Locked, loaded and labeled 🏷️ ${cap(s)} is next 🔥`,
  (s) => `It's giving release day soon 💫 ${cap(s)} 🔥`,
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
  (n) => `${n ? (n === 1 ? "Song number one" : `${n} songs`) : "My catalog"} organized and ready to register. Building the right way 🏗️🔥`,
  () => `Came Through Audio came through for my catalog 🙌🏽 Every song in order 🔥`,
  () => `Behind every song is paperwork. Mine's handled 📑🔥`,
  () => `My future self is going to thank me for organizing this catalog 🙏🏽🔥`,
  (n) => `Milestone unlocked: ${n ? (n === 1 ? "first song cataloged" : `${n} songs cataloged`) : "catalog organized"} 🏆🔥`,
  () => `Royalties don't find you, registrations do. Catalog ready 💰🔥`,
  () => `Every credit in the right place, every split agreed. Peace of mind 😌🔥`,
  () => `I don't just make songs, I manage a catalog 📂🔥`,
  () => `Know your splits. Know your codes. Know your catalog. 🔥`,
  () => `Organized catalog, organized money 💸🔥`,
  (n) => `${n && n > 1 ? `${n} songs` : "My songs"} and not one missing a credit ✔️🔥`,
  () => `Taking my catalog as seriously as my music 🎧📂🔥`,
  () => `What do you do after the studio? Organize the catalog. That's the move 🔥`,
  () => `Getting every song registration-ready. Slow work, big payoff 🐢💰🔥`,
  () => `Catalog glow up ✨ Everything credited and in one place 🔥`,
  () => `This is what owning your music looks like 👑🔥`,
  () => `My catalog is my legacy. Treating it like one 🔥`,
  () => `Shout out to every collaborator in my catalog. You're credited 🙏🏽🔥`,
  (n) => `${n ? (n === 1 ? "One song" : `${n} songs`) : "Every song"} down, a whole career to go 🔥`,
  () => `Doing the boring stuff so the music can pay 🧾🔥`,
  () => `Catalog: organized. Splits: settled. Mind: clear 🧠🔥`,
  () => `Making sure every stream finds its way back to the right people 🔁🔥`,
  () => `Independent artists, organize your catalog. Trust me 🔥`,
  () => `Another song added, another step closer to the bag 💼🔥`,
  () => `My catalog has receipts 🧾 Every credit, every code 🔥`,
  () => `I'd rather be organized than wonder where my royalties went 🔍🔥`,
  () => `Every song in my catalog has a home now 🏠🔥`,
  () => `Ask me what's in my catalog. I know every song by heart and by code 🔥`,
  () => `Leveling up my music business one entry at a time 📈🔥`,
  () => `Who else is organizing their catalog this week? 👇🏽🔥`,
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
  () => `Came Through Audio came through for me 🙌🏽 Badge earned 🔥`,
  () => `Small wins count. New badge unlocked 🏅🔥`,
  () => `Proof that the work behind the music matters 👑🔥`,
  () => `Collecting badges and building a career 🏆🔥`,
  () => `Leveled up again. The process is working 📈🔥`,
  () => `Celebrating the wins nobody sees: credits, splits, registrations 🎉🔥`,
  () => `Independent doesn't mean unorganized. Badge unlocked 🔓🔥`,
  () => `Another milestone in the books 📚🔥`,
  () => `Earning my stripes in the music business 🎖️🔥`,
  () => `Doing the work so my music can do the work 💪🏽🔥`,
  () => `Badge drop! The grind is paying off 💎🔥`,
  () => `Stay ready so you don't have to get ready. Badge earned 🔥`,
  () => `Building my music business brick by brick 🧱🔥`,
  () => `Not just an artist, a business. New badge to prove it 💼🔥`,
  () => `Shout out to everyone doing it the right way 🙏🏽🔥`,
  () => `A badge a day keeps the lost royalties away 😅🔥`,
  () => `Making my music career official, one step at a time ✅🔥`,
  () => `Proud of this one. On to the next 🔥`,
  () => `When the paperwork is right, the music hits different 🎶🔥`,
  () => `Unlocked another one. Who's keeping score? 🏅🔥`,
  () => `Crown on, credits handled 👑🔥`,
  () => `My music, my business, my way 🔥`,
  () => `Little by little, it all adds up. New badge 🏆🔥`,
  () => `Celebrating progress over perfection 🎉🔥`,
  () => `The music business rewards the prepared. Badge earned 🔥`,
  () => `Every badge is a step closer to getting paid what I'm owed 💰🔥`,
  () => `Big moves, quiet work. Badge unlocked 🤫🔥`,
  () => `This badge says I take my music seriously 🎧🔥`,
  () => `Your first stop before distribution, and I stopped. Badge earned 🔥`,
  () => `Earned, not given 💯🔥`,
  () => `Another win for independent artists everywhere 🌍🔥`,
  () => `Showing up for my music every day. Badge unlocked 🔥`,
  () => `Checking boxes, earning badges, dropping music ✔️🔥`,
  () => `Getting better at the business of music, one badge at a time 📚🔥`,
  () => `Doing it right pays off. Literally 💸🔥`,
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
