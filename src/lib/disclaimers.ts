/**
 * Every disclaimer on the site, in one place so the wording stays consistent and a lawyer can review it once
 * (founder, 2026-10-25: "place disclaimers everywhere needed so CTA is not held liable"). Each feature shows its short
 * line next to the action; the full terms are in the Terms of Service (src/routes/terms-of-service.tsx).
 * Drafted for review, not legal advice: have a licensed attorney approve before launch.
 */
export const DISCLAIMERS = {
  /** Every page footer. */
  site: "Came Through Audio is not a law firm, accountant, publisher, record label, collection society or distributor, and nothing on this site is legal, financial or tax advice. We are not affiliated with or endorsed by ASCAP, BMI, SESAC, GMR, The MLC, SoundExchange, the Harry Fox Agency or any streaming service; their names belong to their owners.",
  /** Embed Metadata and My Catalog. */
  embed: "You're responsible for the accuracy of the details you embed and for having the rights to the audio, artwork and lyrics you upload. Stores, streaming services and other platforms may remove or change embedded metadata, and embedding doesn't register a song or guarantee royalties.",
  /** Agency exports. */
  exports: "Exports follow each agency's template as we know it. Agencies can change their requirements and decide on their own what they accept and pay. Check every file before you upload it; you're responsible for what you submit.",
  /** Royalty Health Hub, Royalty Health Report, Royalty Utility Suite. */
  health: "Health scores, findings, converters and earnings estimates are based on the details you enter and on public searches that can be incomplete or out of date. They don't guarantee registration, matching or payment and aren't legal, financial or tax advice; each agency decides the final result.",
  /** "Registration Ready" badges and readiness lists. */
  readiness: "\"Registration Ready\" means the required details are filled in. It doesn't confirm they're correct or that you own the rights.",
  /** Split sheets. */
  splits: "A split sheet records what the collaborators agree to. Came Through Audio isn't a party to it, doesn't check who owns what and doesn't give legal advice. Each person is responsible for the splits they sign; settle disagreements between yourselves or with an attorney.",
  /** Contract Generator (on top of CONTRACT_DISCLAIMER). */
  generator: "Drafts are put together automatically from what you type and can contain mistakes or miss terms your deal needs. Came Through Audio isn't a party to your contract and isn't responsible for its terms or how it's used.",
  /** AI Protection Hub, certificates, the verify page. */
  aiProtection: "A certificate is evidence that your files existed in this exact form by a date. It isn't proof of ownership, a copyright registration, legal advice or a guarantee against AI training, imitation, infringement, claims or takedowns, and courts decide how much weight it gets. The attestation is your own statement, so make sure it's true. For the strongest protection, register your work with the U.S. Copyright Office.",
  /** Personal Branding brand kit. */
  branding: "Only upload logos, names, taglines and fonts you own or have permission to use. You're responsible for anything you put on your documents.",
  /** Expert Registration Assistance. */
  expert: "Our team registers using the details you give us, as your authorized representative in your own accounts. Each organization decides whether and when to accept a registration and pay royalties, so we can't guarantee acceptance, timing or any amount.",
  /** Badges, awards and share cards. */
  badges: "Badges celebrate your progress. They have no cash value and don't confirm any registration, ownership or rights.",
} as const;

export type DisclaimerKey = keyof typeof DISCLAIMERS;
