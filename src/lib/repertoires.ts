import type { Pillar } from "@/lib/audit";

/**
 * Collection societies by country, for the Royalty Health Check. None of these offer an open lookup API, so each
 * links to its own site: the public search where one exists, otherwise the member login. "Search" copies the key that
 * society searches best by (searchBy) first, so it can be pasted straight in. Society ids are stored in repertoire_checks, so never rename one.
 */
export type Society = {
  id: string;
  name: string;
  url: string;
  /** "public": anyone can search; "member": the writer or label has to log in to check. */
  access: "public" | "member";
  /** Names this society goes by in writers' PRO affiliations (src/lib/metadata.ts PROS). */
  aliases?: string[];
  /** What its search finds a song by most exactly. Default: the title. Writer names are more unique than titles. */
  searchBy?: "isrc" | "writer";
};
export type Country = {
  code: string;
  name: string;
  region: Region;
  societies: Partial<Record<Pillar, Society[]>>;
  note?: string;
};
export const REGIONS = ["North America", "Latin America & Caribbean", "Europe", "Asia-Pacific", "Africa"] as const;
export type Region = (typeof REGIONS)[number];

const s = (id: string, name: string, url: string, access: Society["access"] = "public", aliases?: string[], searchBy?: Society["searchBy"]): Society =>
  ({ id, name, url, access, ...(aliases && { aliases }), ...(searchBy && { searchBy }) });

const ASCAP = s("ascap", "ASCAP", "https://www.ascap.com/repertory", "public", undefined, "writer");
const BMI = s("bmi", "BMI", "https://repertoire.bmi.com/", "public", undefined, "writer");
const SESAC = s("sesac", "SESAC", "https://www.sesac.com/repertory/", "public", undefined, "writer");
const GMR = s("gmr", "GMR", "https://globalmusicrights.com/", "member");
const SOUNDEXCHANGE = s("soundexchange", "SoundExchange", "https://isrc.soundexchange.com/", "public", undefined, "isrc");
const MLC = s("mlc", "The MLC", "https://portal.themlc.com/search", "public", undefined, "writer");
const PRS = s("prs", "PRS for Music", "https://www.prsformusic.com/", "member", ["PRS for Music", "PRS", "MCPS"]);
const GEMA = s("gema", "GEMA", "https://online.gema.de/werke/search.faces?lang=en");
const SACEM = s("sacem", "SACEM", "https://repertoire.sacem.fr/", "public", ["SACEM", "SDRM"]);
const APRA_AU = s("apra-amcos", "APRA AMCOS", "https://www.apraamcos.com.au/", "public", ["APRA AMCOS", "APRA", "AMCOS"]);
const APRA_NZ = { ...APRA_AU, url: "https://www.apraamcos.co.nz/" };
const BUMA = s("buma-stemra", "Buma/Stemra", "https://www.bumastemra.nl/", "member", ["BUMA/STEMRA", "BUMA", "STEMRA"]);

export const INTERNATIONAL = {
  musicbrainz: s("musicbrainz", "MusicBrainz", "https://musicbrainz.org/"),
  deezer: s("deezer", "Streaming (Deezer)", "https://www.deezer.com/"),
  iswc: s("cisac-iswc", "CISAC ISWC Network", "https://iswcnet.cisac.org/"),
};

export const COUNTRIES: Country[] = [
  { code: "US", name: "United States", region: "North America", societies: { performance: [ASCAP, BMI, SESAC, GMR], digital: [SOUNDEXCHANGE], mechanical: [MLC] } },
  { code: "CA", name: "Canada", region: "North America", societies: { performance: [s("socan", "SOCAN", "https://www.socan.com/")], digital: [s("resound", "Re:Sound", "https://www.resound.ca/", "member")], mechanical: [s("cmrra", "CMRRA", "https://www.cmrra.ca/", "member")] } },
  { code: "MX", name: "Mexico", region: "Latin America & Caribbean", societies: { performance: [s("sacm", "SACM", "https://www.sacm.org.mx/", "member")] }, note: "SACM collects both performance and mechanical royalties in Mexico." },
  { code: "BR", name: "Brazil", region: "Latin America & Caribbean", societies: { performance: [s("ecad", "ECAD", "https://www.ecad.org.br/", "member")] }, note: "In Brazil you register through an ECAD member association, such as UBC or ABRAMUS." },
  { code: "AR", name: "Argentina", region: "Latin America & Caribbean", societies: { performance: [s("sadaic", "SADAIC", "https://www.sadaic.org.ar/", "member")] } },
  { code: "EC", name: "Ecuador", region: "Latin America & Caribbean", societies: { performance: [s("sayce", "SAYCE", "https://www.sayce.com.ec/", "member")] } },
  { code: "GB", name: "United Kingdom", region: "Europe", societies: { performance: [PRS], digital: [s("ppl", "PPL", "https://www.ppluk.com/", "member")], mechanical: [PRS] }, note: "PRS for Music handles both performance (PRS) and mechanical (MCPS) royalties." },
  { code: "IE", name: "Ireland", region: "Europe", societies: { performance: [s("imro", "IMRO", "https://www.imro.ie/", "member")] } },
  { code: "DE", name: "Germany", region: "Europe", societies: { performance: [GEMA], digital: [s("gvl", "GVL", "https://www.gvl.de/", "member")], mechanical: [GEMA] }, note: "GEMA collects both performance and mechanical royalties in Germany." },
  { code: "FR", name: "France", region: "Europe", societies: { performance: [SACEM], digital: [s("scpp", "SCPP", "https://www.scpp.fr/", "member")], mechanical: [SACEM] }, note: "SACEM also collects mechanicals for SDRM." },
  { code: "IT", name: "Italy", region: "Europe", societies: { performance: [s("siae", "SIAE", "https://www.siae.it/", "member")] }, note: "SIAE collects both performance and mechanical royalties in Italy." },
  { code: "ES", name: "Spain", region: "Europe", societies: { performance: [s("sgae", "SGAE", "https://www.sgae.es/", "member")] }, note: "SGAE collects both performance and mechanical royalties in Spain." },
  { code: "NL", name: "Netherlands", region: "Europe", societies: { performance: [BUMA], digital: [s("sena", "SENA", "https://www.sena.nl/", "member")], mechanical: [BUMA] } },
  { code: "BE", name: "Belgium", region: "Europe", societies: { performance: [s("sabam", "SABAM", "https://www.sabam.be/", "member")] } },
  { code: "SE", name: "Sweden", region: "Europe", societies: { performance: [s("stim", "STIM", "https://www.stim.se/", "member")] } },
  { code: "NO", name: "Norway", region: "Europe", societies: { performance: [s("tono", "TONO", "https://www.tono.no/", "member")] } },
  { code: "DK", name: "Denmark", region: "Europe", societies: { performance: [s("koda", "KODA", "https://www.koda.dk/", "member")] } },
  { code: "FI", name: "Finland", region: "Europe", societies: { performance: [s("teosto", "TEOSTO", "https://www.teosto.fi/", "member")] } },
  { code: "AU", name: "Australia", region: "Asia-Pacific", societies: { performance: [APRA_AU], digital: [s("ppca", "PPCA", "https://www.ppca.com.au/", "member")], mechanical: [APRA_AU] }, note: "APRA AMCOS handles both performance (APRA) and mechanical (AMCOS) royalties." },
  { code: "NZ", name: "New Zealand", region: "Asia-Pacific", societies: { performance: [APRA_NZ], mechanical: [APRA_NZ] } },
  { code: "JP", name: "Japan", region: "Asia-Pacific", societies: { performance: [s("jasrac", "JASRAC", "https://www2.jasrac.or.jp/eJwid/")] } },
  { code: "KR", name: "South Korea", region: "Asia-Pacific", societies: { performance: [s("komca", "KOMCA", "https://www.komca.or.kr/", "member")] } },
  { code: "IN", name: "India", region: "Asia-Pacific", societies: { performance: [s("iprs", "IPRS", "https://iprs.org/", "member")] } },
  { code: "ZA", name: "South Africa", region: "Africa", societies: { performance: [s("samro", "SAMRO", "https://www.samro.org.za/", "member")] } },
  { code: "NG", name: "Nigeria", region: "Africa", societies: { performance: [s("coson", "COSON", "https://cosonng.com/", "member")] } },
  { code: "KE", name: "Kenya", region: "Africa", societies: { performance: [s("mcsk", "MCSK", "https://mcsk.or.ke/", "member")] } },
];

/** "My country isn't listed": only the international checks apply. */
export const OTHER_COUNTRY: Country = { code: "XX", name: "Other country", region: "Europe", societies: {}, note: "We don't list your local societies yet. Your streaming, MusicBrainz and ISWC checks still run, and you can still track your own PRO." };

/** "in the United States", "in Germany". */
export const inCountry = (c: Country) => c.code === OTHER_COUNTRY.code ? "" : ` in ${["US", "GB", "NL"].includes(c.code) ? "the " : ""}${c.name}`;

export const countryByCode = (code?: string | null) => COUNTRIES.find((c) => c.code === code) ?? (code === OTHER_COUNTRY.code ? OTHER_COUNTRY : undefined);

const allSocieties = () => {
  const map = new Map<string, Society>();
  for (const c of COUNTRIES) for (const list of Object.values(c.societies)) for (const so of list ?? []) map.set(so.id, so);
  return [...map.values()];
};

/** The society a writer's PRO affiliation refers to, wherever in the world it is. */
export function societyForPro(pro?: string): Society | undefined {
  const p = (pro ?? "").trim().toLowerCase();
  if (!p) return undefined;
  return allSocieties().find((so) => [so.name, ...(so.aliases ?? [])].some((n) => n.toLowerCase() === p));
}

/** Which country's societies a catalog most likely belongs to, from its writers' PROs. */
export function guessCountry(pros: string[]): string | undefined {
  const counts = new Map<string, number>();
  for (const pro of pros) {
    const so = societyForPro(pro);
    const c = so && COUNTRIES.find((c) => c.societies.performance?.some((x) => x.id === so.id));
    if (c) counts.set(c.code, (counts.get(c.code) ?? 0) + 1);
  }
  return [...counts].sort((a, b) => b[1] - a[1])[0]?.[0];
}
