import type { Pillar } from "@/lib/audit";
import type { Society } from "@/lib/repertoires";

/**
 * "Not showing up yet? Relax, this is common." Reasons a registered song can be missing from a society's public
 * search. Keep every line factual and sourced from the society's own material; never promise timelines we can't
 * back up. Sources: ASCAP ACE (updated weekly), BMI/ASCAP Songview (reconciled works), The MLC (unmatched and
 * unclaimed royalties, held at least 3 years; Matching and Claiming Tools), SoundExchange ISRC search (repertoire
 * comes from rights owners and distributors).
 */
export type Reason = { title: string; text: string };
export type Reasons = { reasons: Reason[]; calm: string };

const spelling: Reason = { title: "Spelled a little differently.", text: "Search a shorter version of the title, leave out \"(feat. …)\", or search by your name or the ISRC/ISWC instead." };

export function notShowingReasons(society: Society, pillar: Pillar): Reasons {
  if (society.id === "mlc") return {
    reasons: [
      { title: "Not matched to a recording yet.", text: "The MLC pays when a stream of a recording is matched to your registered song. Add the recording's ISRC to the song, or use The MLC's Matching Tool to link it." },
      { title: "Shares not fully claimed.", text: "If the claimed shares add up to less than 100%, The MLC holds the unclaimed part. Each writer's publisher (or the self-published writer) claims their share with the Claiming Tool." },
      { title: "Still processing.", text: "New registrations take time to appear in The MLC's public search." },
      spelling,
    ],
    calm: "Your money isn't lost while you sort this out. The MLC holds unmatched and unclaimed mechanical royalties for at least 3 years, and you can still claim them.",
  };
  if (society.id === "soundexchange") return {
    reasons: [
      { title: "Your distributor hasn't sent it yet.", text: "SoundExchange only lists recordings that rights owners, labels and distributors have submitted. Ask your distributor, or register the ISRC yourself in SoundExchange Direct." },
      { title: "Released recently.", text: "The ISRC database updates as new releases are submitted, so very new songs may not be in it yet." },
      { title: "Search by ISRC.", text: "The most reliable search is the 12-character ISRC with no dashes." },
    ],
    calm: "It's normal for a new recording to take a while to appear. Register once and it keeps working for every future play.",
  };
  if (pillar === "performance") return {
    reasons: [
      { title: "Still processing.", text: `New works take time to show up in ${society.name}'s public search${society.id === "ascap" ? ". ASCAP's public database (ACE) updates weekly" : ""}. Check your member account's work list, where new registrations appear first.` },
      ...(society.id === "bmi" || society.id === "ascap" ? [{ title: "Not reconciled yet.", text: "BMI and ASCAP's shared Songview search lists a song once both societies' records for it agree. When co-writers belong to different PROs, that can take longer." }] : []),
      { title: "A co-writer registered it differently.", text: "If a co-writer registered the song first with a different title or splits, ask them to compare details so the records match." },
      spelling,
    ],
    calm: "This is common and fixable. Registering is what counts; once the record matches, performance royalties follow the song.",
  };
  return {
    reasons: [{ title: "Still processing.", text: `New registrations take time to appear in ${society.name}'s search.` }, spelling],
    calm: "This is common. Give it some time, then check again.",
  };
}
