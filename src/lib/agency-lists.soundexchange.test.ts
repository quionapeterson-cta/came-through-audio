import { describe, expect, it } from "vitest";
import { compareList, parseDelimited, readWorks } from "@/lib/agency-lists";
import { emptyMetadata } from "@/lib/metadata";

const csv = `Artist,Track Title,ISRC,SXID,Effective %,Hold,Registrant,Payee ID#,Association Type
Karma Came,Off With His Head,QZNMY2291717,SX217QF8DO,100.0,No,Came Through Audio LLC,1000117426,Rights Owner
Karma Came,Excuses,QZNMY2291722,SX217QF8DR,100.0,No,Came Through Audio LLC,1000117426,Rights Owner
Karma Came,Beauty King Ft Digga,GX8KD2635482,SX217QGYZE,100.0,No,Came Through Audio LLC,1000117426,Rights Owner
Karma Came,Bossed Out (Feat. Rich Homie Milli),GBSMU3483169,SX217QGYZL,100.0,No,Came Through Audio LLC,1000117426,Rights Owner
Karma Came,Bloodline,GBSMU2963386,SX217QGYZM,100.0,No,Came Through Audio LLC,1000117426,Rights Owner
Karma Came,Quit Playing With Me (Official Acapella),QT6HW2687938,SX217QGYZV,100.0,No,Came Through Audio LLC,1000117426,Rights Owner
Karma Came,Quit Playing With Me (Official Instrumental),QT6HW2687936,SX217QGYZW,100.0,No,Came Through Audio LLC,1000117426,Rights Owner
Karma Came,Am Pm (Clean Version),QT6HX2656773,SX217QGZ03,100.0,No,Came Through Audio LLC,1000117426,Rights Owner
Karma Came,Am Pm (Dirty Version),QT6HX2656774,SX217QGZ04,100.0,No,Came Through Audio LLC,1000117426,Rights Owner
Karma Came,Big Swag,QZNMY2291727,SX217QI29R,100.0,No,Came Through Audio LLC,1000117426,Rights Owner
Karma Came,Sea Vibes Freestyle,QZNMY2291718,SX217QI29S,100.0,No,Came Through Audio LLC,1000117426,Rights Owner
Karma Came,Off With His Head,QZNMY2291726,SX217QI29V,100.0,No,Came Through Audio LLC,1000117426,Rights Owner
Karma Came,Do You Mind That,QZNMY2291725,SX217QI29W,100.0,No,Came Through Audio LLC,1000117426,Rights Owner
Digga ♦ Karma Came,Beauty King,QZ85M1938225,SX210ZBXQI,100.0,Yes,Came Through Audio LLC,1000117426,Rights Owner
Karma Came,Hood Shit,QZNMY2291719,SX217QF8DP,100.0,No,Came Through Audio LLC,1000117426,Rights Owner
Karma Came,Big Swag,QZNMY2291720,SX217QF8DQ,100.0,No,Came Through Audio LLC,1000117426,Rights Owner
Karma Came,Party,QZNMY2291723,SX217QF8DS,100.0,No,Came Through Audio LLC,1000117426,Rights Owner
Karma Came,Wild N Free,GX8KD2603157,SX217QGYZF,100.0,No,Came Through Audio LLC,1000117426,Rights Owner
Karma Came,Big Booty Bouncing (Feat. Og Pi),GX8KD2640648,SX217QGYZG,100.0,No,Came Through Audio LLC,1000117426,Rights Owner
Karma Came,Be There In A Minute,GBSMU3950662,SX217QGYZH,100.0,No,Came Through Audio LLC,1000117426,Rights Owner
Karma Came,Boys After Me,GBSMU2956927,SX217QGYZI,100.0,No,Came Through Audio LLC,1000117426,Rights Owner
Karma Came,Good Girls,GX8KD2637080,SX217QGYZJ,100.0,No,Came Through Audio LLC,1000117426,Rights Owner
Karma Came,Such A Fool,GX8KD2663516,SX217QGYZK,100.0,No,Came Through Audio LLC,1000117426,Rights Owner
Karma Came,Roll Out (Feat. Uncle Rickey),GBSMU3574011,SX217QGYZN,100.0,No,Came Through Audio LLC,1000117426,Rights Owner
Karma Came,All Your Life,GX8KD2671898,SX217QGYZO,100.0,No,Came Through Audio LLC,1000117426,Rights Owner
Karma Came,Therapy,QT6HM2622200,SX217QGYZQ,100.0,No,Came Through Audio LLC,1000117426,Rights Owner
Karma Came,Quit Playing With Me (Clean Version),QT6HW2687935,SX217QGYZU,100.0,No,Came Through Audio LLC,1000117426,Rights Owner
Karma Came,Quit Playing With Me (Dirty Version),QT6HW2687937,SX217QGYZX,100.0,No,Came Through Audio LLC,1000117426,Rights Owner
Karma Came,Luh Baby,QZNMY2291721,SX217QI29T,100.0,No,Came Through Audio LLC,1000117426,Rights Owner
Karma Came,Don'T Even Show It Freestyle,QZNMY2291724,SX217QI29U,100.0,No,Came Through Audio LLC,1000117426,Rights Owner
`;

// The founder's catalog as it stands (title, ISRC, version), from the database.
const catalog: [string, string, string][] = [
  ["24/7 Love", "GBSMU3060595", ""], ["All Your Life", "GX8KD2671898", ""], ["AM PM", "QT6HX2656774", ""],
  ["AM PM", "QT6HX2656773", ""], ["Be There in a Minute", "GBSMU3950662", ""], ["Beauty King Feat. Digga", "GX8KD2635482", ""],
  ["Big Booty Bouncing feat. OG PI", "GX8KD2640648", ""], ["Big Booty Bouncing feat. OG PI", "GX8KD2640648", ""],
  ["Big Swag", "QZNMY2291720", ""], ["Bloodline", "GBSMU2963386", ""], ["BloodLine", "GBSMU2963386", ""],
  ["Bloodline (Clean Version)", "GBSMU2963386", ""], ["Bossed Out", "GBSMU3483169", ""],
  ["Bossed Out Feat. Rich Homie Milli", "GBSMU3483169", ""], ["Boys After Me", "GBSMU2956927", ""],
  ["Do you Mind That?", "GXESV2623521", ""], ["Excuses", "QZNMY2291722", ""], ["Good Girls", "GX8KD2637080", ""],
  ["Hood Shit", "QZNMY2291719", ""], ["Off with his Head", "QZNMY2291717", ""], ["Party", "QZNMY2291723", ""],
  ["Quit Playing With Me", "QT6HW2687935", "Radio edit"], ["Quit Playing With Me - Dirty Version", "QT6HW2687937", ""],
  ["Quit Playing With Me - Official Acapella", "QT6HW2687938", ""], ["Quit Playing With Me - Official Instrumental", "QT6HW2687936", ""],
  ["Roll Out", "GBSMU3574011", ""], ["SBOC", "QTAEW2650909", ""], ["Such A Fool", "GX8KD2663516", ""],
  ["Therapy", "QT6HM2622200", ""], ["Wild N Free", "GX8KD2603157", ""],
];

const track = (id: string, [title, isrc, version]: [string, string, string]) => ({
  id, title, artist: "Karma Came", updatedAt: "",
  metadata: { ...emptyMetadata(), title, version, artist: "Karma Came", isrc, writers: [] as never[], composers: [], publishers: [] },
});

/**
 * The founder's own SoundExchange export (2026-10-31), read exactly as they uploaded it with their real catalog beside it
 * (founder, 2026-11-12). A recordings list is one row per recording, which is where two songs sharing a title lost one of
 * their codes, and where a version in brackets has to still find the catalog's song.
 */
describe("the founder's real SoundExchange export", () => {
  const works = readWorks(parseDelimited(csv));
  const r = compareList(works, catalog.map((c, i) => track(`t${i}`, c)), true, "SoundExchange");

  it("keeps two recordings apart when they share a title", () => {
    expect(works).toHaveLength(30);
    expect(works.filter((w) => w.title === "Big Swag").map((w) => w.isrc).sort()).toEqual(["QZNMY2291720", "QZNMY2291727"]);
    expect(works.filter((w) => w.title === "Off With His Head").map((w) => w.isrc).sort()).toEqual(["QZNMY2291717", "QZNMY2291726"]);
    expect(works.filter((w) => w.title.startsWith("Beauty King")).map((w) => w.isrc).sort()).toEqual(["GX8KD2635482", "QZ85M1938225"]);
  });

  it("accounts for every catalogued song, and leaves only the real gaps over", () => {
    // Every song is matched, a difference, or missing from the list — never dropped on the way through. A song can be
    // both matched on its own code and a difference for a second code on the list.
    const covered = new Set([...r.matched, ...r.differences, ...r.notListed, ...r.clashes].map((m) => m.trackId));
    expect(covered.size).toBe(catalog.length);
    expect(r.notListed.map((n) => n.title)).toEqual(["24/7 Love", "SBOC"]);
    // A second code under one title belongs to its song, never to "recordings nobody catalogued" (founder, 2026-11-14).
    expect(r.extra.map((w) => `${w.title} [${w.isrc}]`).sort()).toEqual([
      "Don'T Even Show It Freestyle [QZNMY2291724]",
      "Luh Baby [QZNMY2291721]",
      "Sea Vibes Freestyle [QZNMY2291718]",
    ]);
    // Both AM PM versions are catalogued with the codes the list holds: nothing to report, and no name invented.
    expect(r.differences.filter((d) => d.title.toUpperCase() === "AM PM")).toHaveLength(0);
  });

  it("reads each version as a version, never as part of the name", () => {
    // The list's own title, its title without the version, and the version it names — read, not guessed.
    expect(works.find((w) => w.isrc === "QT6HW2687935")).toMatchObject({
      title: "Quit Playing With Me (Clean Version)", coreTitle: "Quit Playing With Me", version: "Clean Version", artist: "Karma Came",
    });
    // "Bloodline" on SoundExchange is Bloodline: no version is invented on it.
    expect(works.find((w) => w.title === "Bloodline")).toMatchObject({ isrc: "GBSMU2963386" });
    expect(works.find((w) => w.title === "Bloodline")!.version).toBeUndefined();

    const issues = r.differences.map((d) => d.issues[0]!.split(" — ")[0]!).sort();
    // The one real version disagreement, in the list's own words.
    expect(issues).toContain('The agency has version "Clean Version", your catalog has "Radio edit"');
    // Never the fabricated "Bloodline (Clean Version)" on a recording the list calls Bloodline.
    expect(issues.some((i) => /your catalog has "Bloodline \(Clean Version\)"/.test(i))).toBe(false);
    // A clean version that is not out yet waits for release instead of reading as a mismatch.
    expect(issues).toContain('Your catalog\'s "Clean Version" is not released yet, and the agency lists this recording without a version');
    // The three titles the list holds under two codes are each reported as one song with two recordings.
    for (const title of ["Beauty King", "Big Swag", "Off With His Head"]) {
      expect(issues.some((i) => i.startsWith(`The agency holds a second ISRC for "${title}"`))).toBe(true);
    }
    // A capital letter is never a difference.
    expect(r.differences.some((d) => d.title.startsWith("Big Booty"))).toBe(false);
  });
});
