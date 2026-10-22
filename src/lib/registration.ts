import { REGISTRATION_AGENCY_LABEL, registrationAgency, registrationChecks, type MissingItem, type RegistrationAgency } from "@/lib/readiness";
import { creditName, type Metadata } from "@/lib/metadata";

/** Public registries only (SESAC is invitation-only and not offered), as stored on a purchase. */
export const ASSISTANCE_AGENCIES = ["ASCAP", "BMI", "SoundExchange", "The MLC"] as const;

/** Songs typed at checkout that aren't in the catalog yet (PLAN-registration-intake §1). */
export const MAX_NEW_SONGS = 20;
export type NewSong = { title: string; artist: string };

/** Who users add as their representative/user at each agency (founder, 2026-10-22). */
export const REPRESENTATIVE = { email: "registration@camethroughaudio.com", firstName: "Came", lastName: "Through Audio" } as const;

export type SongStatus = "pending" | "in_progress" | "registered";
export const SONG_STATUS_LABEL: Record<SongStatus, string> = { pending: "Pending", in_progress: "In progress", registered: "Registered" };

export type RegistrationOrder = {
  purchase_id: string;
  user_id: string;
  agencies: string[];
  agreement_body: string | null;
  agreement_hash: string | null;
  agreement_name: string | null;
  agreement_signed_at: string | null;
  access_confirmed: Record<string, string>;
  created_at: string;
};
export type RegistrationSong = {
  id: string;
  purchase_id: string;
  position: number;
  track_id: string | null;
  pending_title: string | null;
  pending_artist: string | null;
  snapshot: Metadata | null;
  submitted_at: string | null;
  status: Record<string, SongStatus>;
};

/** new_1, new_2…: one song typed at checkout per Stripe metadata key, read back by newSongsOf. */
export function newSongKeys(songs: NewSong[]): Record<string, string> {
  return Object.fromEntries(songs.map((s, i) => [`new_${i + 1}`, JSON.stringify({ t: s.title, a: s.artist })]));
}

const numbered = (details: Record<string, string>, prefix: string) =>
  Object.keys(details).filter((k) => new RegExp(`^${prefix}_\\d+$`).test(k)).sort((a, b) => Number(a.slice(prefix.length + 1)) - Number(b.slice(prefix.length + 1)));

/** Catalog song IDs and typed titles paid for in one Expert Assistance purchase, in checkout order. */
export function orderSongsOf(details: Record<string, string>): { trackIds: string[]; newSongs: NewSong[] } {
  const trackIds = [...new Set(numbered(details, "tracks").flatMap((k) => details[k]!.split(",").filter(Boolean)))];
  const newSongs = numbered(details, "new").flatMap((k) => {
    try {
      const v = JSON.parse(details[k]!) as { t?: string; a?: string };
      return v.t ? [{ title: v.t, artist: v.a ?? "" }] : [];
    } catch { return []; }
  });
  return { trackIds, newSongs };
}

export const orderAgencies = (agencies: string[]) => agencies.map(registrationAgency).filter((a): a is RegistrationAgency => !!a);

/** Every agency's missing items for one song, merged so an item two agencies share shows once, naming both. */
export function missingFor(m: Metadata, agencies: RegistrationAgency[]): (MissingItem & { agencies: string[] })[] {
  const out = new Map<string, MissingItem & { agencies: string[] }>();
  for (const c of registrationChecks(m, agencies)) for (const i of c.missing) {
    const key = `${i.field}|${i.message}`;
    const seen = out.get(key);
    if (seen) seen.agencies.push(REGISTRATION_AGENCY_LABEL[c.agency]);
    else out.set(key, { ...i, agencies: [REGISTRATION_AGENCY_LABEL[c.agency]] });
  }
  return [...out.values()];
}

/** Where an order stands: the first step that isn't done is the one the user works on (§3). */
export function intakeStep(o: Pick<RegistrationOrder, "agreement_signed_at" | "access_confirmed" | "agencies">, songs: Pick<RegistrationSong, "submitted_at">[], allReady: boolean): 2 | 3 | 4 | 5 | 6 {
  if (!songs.length || songs.some((s) => !s.submitted_at)) return allReady ? 3 : 2;
  if (!o.agreement_signed_at) return 4;
  if (o.agencies.some((a) => !o.access_confirmed[a])) return 5;
  return 6;
}

/** Plain-language steps for adding Came Through Audio at each agency. Checked against each portal's help pages, 2026-10-22. */
export const ACCESS_STEPS: Record<string, { where: string; steps: string[]; permission: string; help: string }> = {
  ASCAP: {
    where: "ASCAP Member Access",
    steps: ["Log in to Member Access and open Profile → Designated Users.", "Click Add and enter the details below.", "Check the permission to register and edit works. Leave banking unchecked."],
    permission: "Register works (no bank or payment access)",
    help: "https://www.ascap.com/help/my-ascap-membership",
  },
  BMI: {
    where: "BMI Online Services",
    steps: ["Log in to BMI Online Services and choose Third Party Permissions from the main menu.", "Add a new user with the details below.", "Give it title registration access, then click Save on Application Permissions (it isn't finished until you save)."],
    permission: "Title registration (no payment access)",
    help: "https://www.bmi.com/faq/entry/how-do-i-grant-someone-access-to-my-bmi-account",
  },
  "The MLC": {
    where: "The MLC Portal",
    steps: ["Log in to the MLC Portal and open the Member Hub → Member Settings → User Permissions.", "Click Add User and enter the details below.", "Choose the Copyright User permission group (registers works, no banking)."],
    permission: "Copyright User",
    help: "https://help.themlc.com/en/support/what-are-the-different-types-of-permissions",
  },
  SoundExchange: {
    where: "SoundExchange Direct",
    steps: ["Log in to SX Direct and open Settings → Registrant Details.", "Click Guest List next to your name, then Add Guest, and enter the details below.", "Choose the View with repertoire permission so we can submit your recordings. Guests can never change payments."],
    permission: "View with repertoire",
    help: "https://www.soundexchange.com/2020/11/24/primary-guest-access-in-soundexchange-direct-everything-you-need-to-know/",
  },
};

/** Writers as they'll be registered: legal name (role, share). */
export const writerLine = (m: Metadata) =>
  m.writers.filter(creditName).map((w) => `${creditName(w)} (${w.role || "—"}${w.percentage ? `, ${w.percentage}%` : ""})`).join(", ");
