/**
 * Where each agency actually signs a member in (founder, 2026-11-14).
 *
 * Two different links, deliberately kept apart:
 *  - the **public repertoire search** (`PUBLIC_REPERTOIRE` in discrepancy-treatments.ts) is where anyone can look a code
 *    or a work up without an account;
 *  - the **portal** here is the member's own account, which is where a registration is actually made.
 * A card that asks someone to register was sending them to the agency's marketing homepage; these are the sign-in pages,
 * checked on 2026-11-14 (SoundExchange Direct, ASCAP Member Access and The MLC Portal answer 200, and BMI lands on its
 * Online Services login). BMI's Auth0 link carries a single-use `state=` token, so the durable address is stored here.
 */
export type AgencyPortal = {
  /** What the member sees on the link: the agency's own name for its account area. */
  name: string;
  /** The sign-in page itself. */
  signIn: string;
};

export const AGENCY_PORTALS: Record<string, AgencyPortal> = {
  soundexchange: {
    name: "SoundExchange Direct",
    signIn: "https://sxdirect.soundexchange.com/login/",
  },
  ascap: { name: "ASCAP Member Access", signIn: "https://www.ascap.com/member-access#login" },
  bmi: { name: "BMI Online Services", signIn: "https://ols.bmi.com/" },
  mlc: { name: "The MLC Portal", signIn: "https://portal.themlc.com/login" },
};

/**
 * The portal for a society, with a fallback to the society's own site for one we have no sign-in page for — so a card is
 * never left without a way in, and never given a link we have not checked.
 */
export function portalFor(society: string, fallbackUrl = ""): AgencyPortal {
  return AGENCY_PORTALS[society] ?? { name: "the agency account", signIn: fallbackUrl };
}
