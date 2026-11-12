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

  it("finds the catalogued songs through their versions and reports the real gaps", () => {
    expect(r.matched).toHaveLength(23);
    expect(r.notListed.map((n) => n.title)).toEqual(["24/7 Love", "SBOC"]);
    // Recordings on the list that the catalog has never held.
    expect(r.extra.map((w) => `${w.title} [${w.isrc}]`).sort()).toEqual([
      "Beauty King [QZ85M1938225]",
      "Big Swag [QZNMY2291727]",
      "Don'T Even Show It Freestyle [QZNMY2291724]",
      "Luh Baby [QZNMY2291721]",
      "Off With His Head [QZNMY2291726]",
      "Sea Vibes Freestyle [QZNMY2291718]",
    ]);
  });

  it("names the recordings whose titles read differently, and the one code that disagrees", () => {
    expect(r.differences.map((d) => d.issues[0]!.split(" — ")[0]!).sort()).toEqual([
      'The agency calls it "Am Pm (Clean Version)", your catalog has "AM PM"',
      'The agency calls it "Am Pm (Dirty Version)", your catalog has "AM PM"',
      'The agency calls it "Bloodline", your catalog has "Bloodline (Clean Version)"',
      'The agency calls it "Quit Playing With Me (Clean Version)", your catalog has "Quit Playing With Me (Radio edit)"',
    ].concat(["The agency has ISRC QZNMY2291725, your catalog has GXESV2623521"]).sort());
    // Sounds alike under another spelling stay quiet: a feature credit or a capital letter is not a difference.
    expect(r.differences.some((d) => d.title.startsWith("Big Booty"))).toBe(false);
    expect(r.differences.some((d) => d.title.startsWith("Beauty King"))).toBe(false);
  });
});
