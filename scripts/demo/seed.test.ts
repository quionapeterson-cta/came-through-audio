/**
 * Seeds the demo account (demo@camethroughaudio.com) with sample data for the demo video and homepage photos.
 * Run: DEMO_PASSWORD=… npx vitest run scripts/demo/seed.test.ts --environment node
 * Everything here is fictional demo data. Safe to re-run: it replaces the demo account's songs.
 */
import { it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { emptyContributor, emptyMetadata, type Metadata } from "@/lib/metadata";
import { toCatalogRow } from "@/lib/catalog";

const sb = createClient(process.env["VITE_SUPABASE_URL"]!, process.env["VITE_SUPABASE_PUBLISHABLE_KEY"]!, { auth: { persistSession: false } });
const writer = (legalName: string, role: string, pro: string, ipi: string, percentage: string) => ({ ...emptyContributor(), name: legalName, legalName, role, pro, ipi, percentage });

const base = (o: Partial<Metadata>): Metadata => ({
  ...emptyMetadata(), artist: "Demo Artist", label: "Came Through Records", language: "English", primaryGenre: "R&B/Soul",
  copyright: "© 2026 Demo Artist", phonographic: "℗ 2026 Came Through Records", recordedIn: "United States", recordedYear: "2026",
  writers: [writer("Jordan Avery", "Author/Composer", "BMI", "00731245689", "100")], composers: [emptyContributor()],
  producers: [{ ...emptyContributor(), name: "Demo Artist" }], publishers: [emptyContributor()], selfPublished: true,
  samples: "No", writtenFor: "No", explicit: false, ...o,
});

const EP = "Night Drive";
const songs: Metadata[] = [
  base({ title: "Headlights", album: EP, releaseType: "EP", trackNumber: "1", trackTotal: "4", duration: "3:12", releaseDate: "2026-11-14", isrc: "US-CTA-26-00011", upc: "012345678911", lyrics: "Headlights on the open road\nEvery mile a story told" }),
  base({ title: "Slow Motion", album: EP, releaseType: "EP", trackNumber: "2", trackTotal: "4", duration: "3:40", releaseDate: "2026-11-14", isrc: "US-CTA-26-00012", upc: "012345678911",
    writers: [writer("Jordan Avery", "Author", "BMI", "00731245689", "50"), writer("Riley Brooks", "Composer", "ASCAP", "00612398745", "50")],
    lyrics: "Everything moves in slow motion\nWhen you look at me like that" }),
  base({ title: "City Lights", album: EP, releaseType: "EP", trackNumber: "3", trackTotal: "4", duration: "2:58", releaseDate: "2026-11-14", isrc: "US-CTA-26-00013", upc: "012345678911" }),
  base({ title: "Last Exit", album: EP, releaseType: "EP", trackNumber: "4", trackTotal: "4", duration: "4:05", releaseDate: "2026-11-14", isrc: "", upc: "012345678911",
    writers: [writer("Jordan Avery", "Author/Composer", "BMI", "00731245689", "60"), writer("", "Composer", "", "", "40")] }),
  base({ title: "Golden Hour", releaseType: "Single", duration: "3:21", releaseDate: "2026-09-05", isrc: "US-CTA-26-00021", upc: "012345678928", lyrics: "Golden hour, I see it clear\nEverything I need is here" }),
  base({ title: "Came Up", releaseType: "Single", duration: "2:47", releaseDate: "2026-07-18", isrc: "US-CTA-26-00031", upc: "012345678935", primaryGenre: "Hip-Hop/Rap" }),
];

it("seeds the demo account", async () => {
  const { data: auth, error } = await sb.auth.signInWithPassword({ email: "demo@camethroughaudio.com", password: process.env["DEMO_PASSWORD"]! });
  if (error || !auth.user) throw error ?? new Error("Sign-in failed");
  const uid = auth.user.id;
  const onboarding = { done: true, welcomed: true, avatar: "/icons/playful/crowns/king_crown.png", stageName: "Demo Artist", legalName: "Jordan Avery", healthCountry: "US" };
  const profile = { artist: "Demo Artist", label: "Came Through Records", language: "English", primaryGenre: "R&B/Soul", copyright: "© 2026 Demo Artist", phonographic: "℗ 2026 Came Through Records",
    recordedIn: "United States", writers: [writer("Jordan Avery", "Author/Composer", "BMI", "00731245689", "100")], producers: [{ ...emptyContributor(), name: "Demo Artist" }], selfPublished: true };
  const p = await sb.from("profiles").update({ onboarding, artist_defaults: profile } as never).eq("id", uid);
  if (p.error) throw p.error;
  await sb.from("catalogs").delete().eq("user_id", uid);
  for (const m of songs) {
    const r = await sb.from("catalogs").insert(toCatalogRow(m, uid) as never);
    if (r.error) throw r.error;
  }
  console.log(`seeded ${songs.length} songs for ${uid}`);
}, 60000);
