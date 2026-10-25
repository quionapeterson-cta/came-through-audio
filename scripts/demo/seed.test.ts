/**
 * Seeds the demo account (demo@camethroughaudio.com) with sample data for the demo video and homepage photos.
 * Run: DEMO_PASSWORD=… npx vitest run scripts/demo/seed.test.ts --environment node
 * Karma Came's own songs (BAM, Therapy Deluxe Edition, two singles), from the MP3s in this folder; ISRCs and UPCs are stand-ins. Safe to re-run: it replaces the demo account's songs.
 */
import { it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { emptyContributor, emptyMetadata, type Contributor, type Metadata } from "@/lib/metadata";
import { toCatalogRow } from "@/lib/catalog";

const sb = createClient(process.env["VITE_SUPABASE_URL"]!, process.env["VITE_SUPABASE_PUBLISHABLE_KEY"]!, { auth: { persistSession: false } });
const writer = (legalName: string, role: string, pro: string, ipi: string, percentage: string) => ({ ...emptyContributor(), name: legalName, legalName, role, pro, ipi, percentage });

const QUI = "Qui-Ona Peterson";
const solo = [writer(QUI, "Author/Composer", "", "", "100")];
// Calvin's row is left blank on purpose: the demo video types his name in on camera and cuts away before it is complete.
const withCalvin = [writer(QUI, "Author", "", "", ""), writer("", "Composer", "", "", "")];

const base = (o: Partial<Metadata>): Metadata => ({
  ...emptyMetadata(), artist: "Karma Came", language: "English", primaryGenre: "Hip-Hop/Rap", recordedIn: "United States",
  writers: solo, composers: [emptyContributor()], producers: [{ ...emptyContributor(), name: "Karma Came" }], publishers: [emptyContributor()], selfPublished: true,
  samples: "No", writtenFor: "No", ...o,
});

// BAM (2016). ISRCs and UPCs are stand-ins, never the real codes.
const BAM: [string, string[], Contributor[]][] = [
  ["Bloodline", [], withCalvin], ["Big Booty Bouncing", ["OG PI"], solo], ["Bossed Out", [], withCalvin], ["Be There in a Minute", [], solo],
  ["Beauty King", ["Digga"], solo], ["Boys After Me", [], solo], ["Wild N Free", [], solo], ["Roll Out", ["Uncle Rickey"], withCalvin],
  ["Such a Fool", [], solo], ["Good Girls", [], solo], ["All Your Life", [], solo],
];
const y2026 = { label: "Came Through Audio", secondaryGenre: "R&B/Soul", copyright: `© 2026 ${QUI}`, recordedYear: "2026", explicit: true };
const therapy = (n: number, title: string, o: Partial<Metadata> = {}) =>
  base({ ...y2026, title, album: "Therapy Deluxe Edition", releaseType: "EP", trackNumber: String(n), trackTotal: "4", duration: "3:08", isrc: `US-CTA-26-0010${n}`, upc: "012345678928", ...o });
const songs: Metadata[] = [
  ...BAM.map(([title, featured, writers], i) => base({ title, featured: featured.length ? featured : [""], writers, album: "BAM", releaseType: "Album",
    trackNumber: String(i + 1), trackTotal: "11", copyright: `© 2016 ${QUI}`, recordedYear: "2016", isrc: `US-CTA-16-${String(i + 1).padStart(5, "0")}`, upc: "012345678911" })),
  therapy(1, "Therapy"), therapy(2, "Therapy (Clean)", { explicit: false }), therapy(3, "Therapy (Instrumental)", { instrumental: true, explicit: false }), therapy(4, "Therapy (Acapella)"),
  base({ ...y2026, title: "Bloodline", album: "Bloodline", releaseType: "Single", duration: "3:20", isrc: "US-CTA-26-00111", upc: "012345678935" }),
  base({ ...y2026, title: "Quit Playing With Me", album: "Quit Playing With Me", releaseType: "Single", duration: "4:30", isrc: "US-CTA-26-00121", upc: "012345678942" }),
];

it("seeds the demo account", async () => {
  const { data: auth, error } = await sb.auth.signInWithPassword({ email: "demo@camethroughaudio.com", password: process.env["DEMO_PASSWORD"]! });
  if (error || !auth.user) throw error ?? new Error("Sign-in failed");
  const uid = auth.user.id;
  const onboarding = { done: true, welcomed: true, avatar: "/icons/playful/crowns/king_crown.png", stageName: "Karma Came", legalName: QUI, healthCountry: "US" };
  const profile = { artist: "Karma Came", label: "Came Through Audio", language: "English", primaryGenre: "Hip-Hop/Rap", copyright: `© 2026 ${QUI}`,
    recordedIn: "United States", writers: solo, producers: [{ ...emptyContributor(), name: "Karma Came" }], selfPublished: true };
  const p = await sb.from("profiles").update({ onboarding, artist_defaults: profile } as never).eq("id", uid);
  if (p.error) throw p.error;
  await sb.from("catalogs").delete().eq("user_id", uid);
  for (const m of songs) {
    const r = await sb.from("catalogs").insert(toCatalogRow(m, uid) as never);
    if (r.error) throw r.error;
  }
  console.log(`seeded ${songs.length} songs for ${uid}`);
}, 60000);
