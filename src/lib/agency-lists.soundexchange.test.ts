import { describe, expect, it } from "vitest";
import { compareList, parseDelimited, readWorks } from "@/lib/agency-lists";
import { emptyMetadata } from "@/lib/metadata";

const csv = `Artist,Track Title,ISRC,SXID,Effective %,Hold,Registrant,Payee ID#,Association Type
Karma Came,Off With His Head,QZNMY2291717,SX17QF8DO,100.0,No,Came Through Audio LLC,1000117426,Rights Owner
Karma Came,Excuses,QZNMY2291722,SX17QF8DR,100.0,No,Came Through Audio LLC,1000117426,Rights Owner
Karma Came,Beauty King Ft Digga,GX8KD2635482,SX17QGYZE,100.0,No,Came Through Audio LLC,1000117426,Rights Owner
Karma Came,Bossed Out (Feat. Rich Homie Milli),GBSMU3483169,SX17QGYZL,100.0,No,Came Through Audio LLC,1000117426,Rights Owner
Karma Came,Bloodline,GBSMU2963386,SX17QGYZM,100.0,No,Came Through Audio LLC,1000117426,Rights Owner
Karma Came,Quit Playing With Me (Official Acapella),QT6HW2687938,SX17QGYZW,100.0,No,Came Through Audio LLC,1000117426,Rights Owner
Karma Came,Quit Playing With Me (Official Instrumental),QT6HW2687936,SX17QGYZW,100.0,No,Came Through Audio LLC,1000117426,Rights Owner
Karma Came,Am Pm (Clean Version),QT6HX2656773,SX17QGZ03,100.0,No,Came Through Audio LLC,1000117426,Rights Owner
Karma Came,Am Pm (Dirty Version),QT6HX2656774,SX17QGZ04,100.0,No,Came Through Audio LLC,1000117426,Rights Owner
Karma Came,Big Swag,QZNMY2291727,SX17QIX9R,100.0,No,Came Through Audio LLC,1000117426,Rights Owner
Karma Came,Sea Vibes Freestyle,QZNMY2291718,SX17QIX9S,100.0,No,Came Through Audio LLC,1000117426,Rights Owner
Karma Came,Off With His Head,QZNMY2291726,SX17QIX9V,100.0,No,Came Through Audio LLC,1000117426,Rights Owner
Karma Came,Do You Mind That,QZNMY2291725,SX17QIX9W,100.0,No,Came Through Audio LLC,1000117426,Rights Owner
Digga + Karma Came,Beauty King,Q2SM1933825,SX210ZBXQJ,100.0,Yes,Came Through Audio LLC,1000117426,Rights Owner
Karma Came,Hood Shit,QZNMY2291719,SX17QF8DP,100.0,No,Came Through Audio LLC,1000117426,Rights Owner
Karma Came,Big Swag,QZNMY2291720,SX17QF8DQ,100.0,No,Came Through Audio LLC,1000117426,Rights Owner
Karma Came,Party,QZNMY2291723,SX17QF8DS,100.0,No,Came Through Audio LLC,1000117426,Rights Owner
Karma Came,Wild N Free,GX8KD2603157,SX17QGYZF,100.0,No,Came Through Audio LLC,1000117426,Rights Owner
Karma Came,Big Booty Bouncing (Feat. Og Pi),GX8KD2640648,SX17QGYZG,100.0,No,Came Through Audio LLC,1000117426,Rights Owner
Karma Came,Be There In A Minute,GBSMU3950662,SX17QGYZH,100.0,No,Came Through Audio LLC,1000117426,Rights Owner
Karma Came,Boys After Me,GBSMU2956927,SX17QGYZI,100.0,No,Came Through Audio LLC,1000117426,Rights Owner
Karma Came,Good Girls,GX8KD2637080,SX17QGYZJ,100.0,No,Came Through Audio LLC,1000117426,Rights Owner
Karma Came,Such A Fool,GX8KD2663516,SX17QGYZK,100.0,No,Came Through Audio LLC,1000117426,Rights Owner
Karma Came,Roll Out (Feat. Uncle Rickey),GBSMU3574011,SX17QGYZN,100.0,No,Came Through Audio LLC,1000117426,Rights Owner
Karma Came,All Your Life,GX8KD2671898,SX17QGYZO,100.0,No,Came Through Audio LLC,1000117426,Rights Owner
Karma Came,Therapy,QT6HM2622200,SX17QGYZU,100.0,No,Came Through Audio LLC,1000117426,Rights Owner
Karma Came,Quit Playing With Me (Clean Version),QT6HW2687935,SX17QGYZU,100.0,No,Came Through Audio LLC,1000117426,Rights Owner
Karma Came,Quit Playing With Me (Dirty Version),QT6HW2687937,SX17QGYZV,100.0,No,Came Through Audio LLC,1000117426,Rights Owner
`;

// The founder's catalog as it stands (title, ISRC), from the database.
const catalog: [string, string][] = [
  ["24/7 Love", "GBSMU3060595"], ["All Your Life", "GX8KD2671898"], ["AM PM", "QT6HX2656774"], ["AM PM", "QT6HX2656773"],
  ["Be There in a Minute", "GBSMU3950662"], ["Beauty King Feat. Digga", "GX8KD2635482"],
  ["Big Booty Bouncing feat. OG PI", "GX8KD2640648"], ["Big Booty Bouncing feat. OG PI", "GX8KD2640648"],
  ["Big Swag", "QZNMY2291720"], ["Bloodline", "GBSMU2963386"], ["BloodLine", "GBSMU2963386"],
  ["Bloodline (Clean Version)", "GBSMU2963386"], ["Bossed Out", "GBSMU3483169"],
  ["Bossed Out Feat. Rich Homie Milli", "GBSMU3483169"], ["Boys After Me", "GBSMU2956927"],
  ["Do you Mind That?", "GXESV2623521"], ["Excuses", "QZNMY2291722"], ["Good Girls", "GX8KD2637080"],
  ["Hood Shit", "QZNMY2291719"], ["Off with his Head", "QZNMY2291717"], ["Party", "QZNMY2291723"],
  ["Quit Playing With Me", "QT6HW2687935"], ["Quit Playing With Me - Dirty Version", "QT6HW2687937"],
  ["Quit Playing With Me - Official Acapella", "QT6HW2687938"], ["Quit Playing With Me - Official Instrumental", "QT6HW2687936"],
  ["Roll Out", "GBSMU3574011"], ["SBOC", "QTAEW2650909"], ["Such A Fool", "GX8KD2663516"],
  ["Therapy", "QT6HM2622200"], ["Wild N Free", "GX8KD2603157"],
];

const track = (id: string, [title, isrc]: [string, string]) => ({
  id, title, artist: "Karma Came", updatedAt: "",
  metadata: { ...emptyMetadata(), title, artist: "Karma Came", isrc, writers: [] as never[], composers: [], publishers: [] },
});

/**
 * The founder's own SoundExchange export (2026-10-31), read exactly as they uploaded it with its real catalog beside it
 * (founder, 2026-11-12). A recordings list is one row per recording, which is where two songs sharing a title lost one of
 * their codes, and where a version in brackets has to still find the catalog's song.
 */
describe("the founder's real SoundExchange export", () => {
  const works = readWorks(parseDelimited(csv));
  const r = compareList(works, catalog.map((c, i) => track(`t${i}`, c)), true, "SoundExchange");

  it("keeps two recordings apart when they share a title", () => {
    expect(works).toHaveLength(28);
    expect(works.filter((w) => w.title === "Big Swag").map((w) => w.isrc).sort()).toEqual(["QZNMY2291720", "QZNMY2291727"]);
    expect(works.filter((w) => w.title === "Off With His Head").map((w) => w.isrc).sort()).toEqual(["QZNMY2291717", "QZNMY2291726"]);
    expect(works.filter((w) => w.title.startsWith("Beauty King")).map((w) => w.isrc).sort()).toEqual(["GX8KD2635482", "Q2SM1933825"]);
  });

  it("finds the catalogued songs through their versions and leaves only the real gaps", () => {
    expect(r.matched).toHaveLength(27);
    // One genuine mismatch: SoundExchange has a different ISRC for "Do you Mind That?".
    expect(r.differences.map((d) => d.issues[0])).toEqual(["The agency has ISRC QZNMY2291725, your catalog has GXESV2623521"]);
    expect(r.notListed.map((n) => n.title)).toEqual(["24/7 Love", "SBOC"]);
    expect(r.extra.map((w) => `${w.title} [${w.isrc}]`)).toEqual([
      "Big Swag [QZNMY2291727]",
      "Sea Vibes Freestyle [QZNMY2291718]",
      "Off With His Head [QZNMY2291726]",
      "Beauty King [Q2SM1933825]",
    ]);
  });
});
