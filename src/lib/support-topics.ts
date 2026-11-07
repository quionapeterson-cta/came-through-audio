/**
 * What a support ticket is about, in two steps: which part of the app ("Where is it?"), then the closest thing that is
 * going wrong ("What's happening?"). The areas are the workspace tabs, in the order the tabs appear, plus the account
 * side and a catch-all. The flat list is what the ticket stores in `category`, as "Area · Issue", so staff see both in
 * one column without a schema change (founder, 2026-11-05: Royalty Help is gone; the tab names say more).
 */
export const TICKET_TOPICS = [
  {
    area: "Embed Metadata",
    issues: ["The finished file won't play, save or download", "Cover art, lyrics or credits are missing from the file", "The wrong writer, artist or date got embedded", "I don't know which fields to fill in"],
  },
  {
    area: "My Catalog",
    issues: ["A song won't save or upload", "Downloading a master, cover art or lyrics", "Searching, filtering or editing my songs", "A song is missing or duplicated in my catalog"],
  },
  {
    area: "Royalty Health Hub",
    issues: ["A song is flagged missing that I know is registered", "The check or report won't run", "Uploading an agency report", "Reading my score and next steps"],
  },
  {
    area: "AI Protection Hub",
    issues: ["Registering a song or a collection", "A certificate won't download", "Changing a registration I already made"],
  },
  {
    area: "Split Sheets",
    issues: ["Sending a split sheet to a co-writer", "A co-writer can't open or sign it", "Splits or publisher shares don't add up", "Downloading the signed sheet"],
  },
  {
    area: "Contracts & Blueprints",
    issues: ["Finding the right contract or blueprint", "A contract won't generate or download", "Signature requests and signing a contract"],
  },
  {
    area: "PDF Fill & Sign",
    issues: ["My PDF won't open in the tool", "Text or my signature landed in the wrong place", "The downloaded PDF looks unclear"],
  },
  {
    area: "Account & billing",
    issues: ["Upgrading, downgrading or cancelling", "A charge, invoice or refund", "Signing in, email or password", "Seats and artist seats", "Personal branding kit"],
  },
  {
    area: "Something else",
    issues: ["A technical problem with the site", "A question before I sign up", "Press, partnership or licensing", "Feedback or a feature request"],
  },
] as const;

export type TicketArea = (typeof TICKET_TOPICS)[number]["area"];
/** Billing questions go to the billing inbox; the check reads this prefix. */
export const BILLING_AREA: TicketArea = "Account & billing";
/** Every area + issue pair, as it is stored in `category`. */
export const categoryFor = (area: string, issue: string) => `${area} · ${issue}`;
export const TICKET_CATEGORIES = TICKET_TOPICS.flatMap((t) => t.issues.map((i) => categoryFor(t.area, i))) as [string, ...string[]];
