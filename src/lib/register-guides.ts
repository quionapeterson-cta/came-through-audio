import type { Pillar } from "@/lib/audit";
import type { Country, Society } from "@/lib/repertoires";

/**
 * Plain-language "how to register" steps for one society, shown when a song isn't registered there yet.
 * Kept general on purpose: every society's portal differs, so the steps say what to do, not which buttons to press.
 */
export type Guide = { pays: string; who: string; steps: string[] };

export function registerGuide(society: Society, pillar: Pillar, country: Country): Guide {
  const n = society.name;
  if (pillar === "performance") return {
    pays: `${n} pays songwriters when the song plays on radio, TV, in shops and venues, live and on streaming.`,
    who: "Each songwriter, through their own PRO. A writer belongs to only one PRO at a time.",
    steps: [
      `Log in to ${n}. Not a member yet? Join as a songwriter first.`,
      "Register the song as a new work, with the exact title and every writer, their shares and IPI numbers.",
      "Make sure the shares match your split sheet, then submit. New works can take a few weeks to show up in search.",
    ],
  };
  if (pillar === "mechanical") return {
    pays: `${n} pays songwriters and publishers each time the song is streamed or downloaded.`,
    who: "The song's publisher. Self-published songwriters can register their own songs.",
    steps: [
      `Sign up with ${n} as a publisher, or as a self-published songwriter.`,
      "Register the song with every writer, their shares and the ISWC if you have one.",
      "Link the song to its recordings by ISRC, so streams can be matched and paid.",
    ],
  };
  return {
    pays: country.code === "US"
      ? `${n} pays the artist and the master owner when the recording plays on digital and satellite radio, like Pandora and SiriusXM.`
      : `${n} pays performers and the master owner when the recording plays on radio and in public.`,
    who: "The featured artist, and whoever owns the master recording. If you own your masters, that's you twice.",
    steps: [
      `Create a ${n} account as the performer, and as the rights owner if you own your master.`,
      "Add the recording with its ISRC exactly as it appears on streaming.",
      "Add your payment and tax details, so royalties can be paid out.",
    ],
  };
}

/** Steps for bringing a registration in line after the song's details changed in the catalog. */
export function updateGuide(society: Society, pillar: Pillar): string[] {
  const what = pillar === "digital" ? "the recording's title, artist and ISRC" : "the title, every writer, their shares and IPI numbers, and the publisher";
  return [
    `Log in to ${society.name} and open the ${pillar === "digital" ? "recording" : "song"} you registered.`,
    `Update ${what} so they match your catalog exactly.`,
    "Save your changes, then tick this step. Updates can take a few weeks to show up in search.",
  ];
}
