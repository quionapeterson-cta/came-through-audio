/**
 * Admin → Registrations: the workflow's rules, in one place (founder, 2026-11-18).
 *
 * Three things live here rather than in the panel. The per-agency double-check lists, because they are the wording staff
 * are held to and they must match what the shared readiness module already asks for (ASCAP/BMI register the composition,
 * SoundExchange registers the recording). The confirmation sentence, which the server also refuses a status change
 * without. And the grouping, which is the whole point of the tab now: rows are worked per customer, not per order.
 *
 * Nothing here re-implements readiness. `registrationChecks` in `src/lib/readiness.ts` still decides whether a song may
 * be registered at all; these are the last human look before one is marked Registered.
 */
/**
 * The four registries an order can be bought for. Wider than `InviteAgency` on purpose: BMI grants access inside the
 * account rather than by email, so it sends no invitation, but its songs still need the same last human look before they
 * are marked Registered.
 */
export const VERIFICATION_AGENCIES = ["ASCAP", "BMI", "The MLC", "SoundExchange"] as const;
export type VerificationAgency = (typeof VERIFICATION_AGENCIES)[number];

/** The sentence a staff member ticks before one song becomes Registered. Refused by the server, not just the form. */
export const REGISTRATION_CONFIRMATION =
  "I have double-checked all agency submissions for mistakes, fixed any discrepancies, and confirmed there are no blocking issues.";

/** The warning banner in the verification modal, in the founder's own words. */
export const ISSUE_WARNING =
  "If any issues prevent proper registration, do NOT mark as Registered. Set status to 'On Hold' and click 'Report an Issue' until the case is resolved.";

/** What the batch finish confirms, shown above its own confirmation box. */
export const BATCH_CONFIRMATION =
  "Every song for this customer is complete, double-checked at each agency, and free of blocking issues.";

/**
 * The agency-specific double-checks. Each one names a field the agency will reject or mis-file on, so a box that is
 * still unticked is a reason to stop rather than a formality.
 */
export const AGENCY_VERIFICATION: Record<VerificationAgency, { intro: string; checks: string[] }> = {
  SoundExchange: {
    intro:
      "SoundExchange registers the recording, not the composition, so the writer fields are deliberately absent here.",
    checks: [
      "The ISRC on each recording matches the master and is unique (no reused or borrowed code).",
      "The rights owner and artist name are spelled exactly as they appear on the release.",
      "The recording share is allocated to the right owner and totals 100%.",
      "The UPC for the release is entered once per album, not per track.",
      "A featured artist is credited as a featured artist, not added as a second owner.",
    ],
  },
  "The MLC": {
    intro:
      "The MLC registers the composition and matches on title, writer and ISRC, so a wrong IPI files the money to nobody.",
    checks: [
      "The ISRC is present and belongs to this recording.",
      "Every writer has an IPI number and a legal name (no stage names in the writer fields).",
      "The publisher is named with its own IPI, or the work is marked Self-published.",
      "Writer splits total exactly 100%, and publisher shares total exactly 100% when a publisher is listed.",
      "The ISWC is included when the client has one: it helps The MLC match the work.",
    ],
  },
  BMI: {
    intro:
      "BMI registers the composition too, and pays the publisher share to its own writers, so a wrong IPI or an unanswered publisher question blocks the filing.",
    checks: [
      "Legal writer names are used, spelled as they are on the writer's BMI account.",
      "Each writer's PRO and IPI number are correct, and Author/Composer is the role where it applies.",
      "The publisher is entered with its own IPI and share, or the work is marked Self-published (a song with only BMI writers and no publisher needs neither).",
      "Writer splits total exactly 100%, and publisher shares total exactly 100% when a publisher is listed.",
      "The duration and genre are filled in, and \"written for film/TV/stage/ad\" is answered.",
    ],
  },
  ASCAP: {
    intro:
      "ASCAP registers the composition. It does not require an ISRC, so an unreleased work or a song written for another artist still registers.",
    checks: [
      "Legal writer names are used, spelled as they are on the writer's ASCAP account.",
      "Each writer's PRO and IPI number are correct, and Author/Composer is the role where it applies.",
      "The publisher is entered with its share, or the work is marked Self-published.",
      "Writer splits total exactly 100%, and publisher shares total exactly 100% when a publisher is listed.",
      "The samples question is answered, and the work is marked instrumental where there are no lyrics.",
    ],
  },
};

/**
 * The agencies' checks for one order, in one fixed order so the dialogs read the same every time. Every agency an order
 * can be bought for is covered, including BMI: a missing list used to leave its songs with no checklist and no way to
 * press Mark Registered.
 */
export function verificationFor(agencies: string[]): { agency: VerificationAgency; intro: string; checks: string[] }[] {
  return VERIFICATION_AGENCIES.filter((agency) => agencies.includes(agency)).map((agency) => ({
    agency,
    ...AGENCY_VERIFICATION[agency],
  }));
}

/** What a group of orders needs to be grouped: a customer and the per-song status maps the queue already returns. */
export type GroupableOrder = {
  email: string | null;
  customer: string;
  agencies: string[];
  songs: { status: Record<string, string> }[];
  batchRegisteredAt?: string | null;
};

export type UserGroup<T extends GroupableOrder> = {
  /** Stable key for React and for the accordion's memory: the address when we have one. */
  key: string;
  email: string;
  name: string;
  orders: T[];
  /** Songs across every order for this customer. */
  songs: number;
  /** Song × agency pairs already marked Registered, out of `total`. */
  registered: number;
  total: number;
  /** Pairs sitting On Hold, so a card can say so before it is opened. */
  onHold: number;
  /** Every pair registered: the "All Songs Registered" button's own condition. */
  complete: boolean;
  /** Every order has had its batch finish, so the celebration has already been sent. */
  batchDone: boolean;
};

const keyOf = (order: GroupableOrder) =>
  (order.email?.trim().toLowerCase() || `name:${order.customer.trim().toLowerCase()}`) ?? "unknown";

/**
 * One card per customer, orders merged. A customer who bought twice (a single, then an album) is one person with one
 * catalog, so the rows belong together; the original order keeps its own agencies and exports.
 */
export function groupOrdersByUser<T extends GroupableOrder>(orders: T[]): UserGroup<T>[] {
  const groups = new Map<string, UserGroup<T>>();
  for (const order of orders) {
    const key = keyOf(order);
    const group =
      groups.get(key) ??
      {
        key,
        email: order.email ?? "",
        name: order.customer,
        orders: [],
        songs: 0,
        registered: 0,
        total: 0,
        onHold: 0,
        complete: false,
        batchDone: false,
      };
    group.orders.push(order);
    if (!group.email && order.email) group.email = order.email;
    group.songs += order.songs.length;
    for (const song of order.songs) {
      for (const agency of order.agencies) {
        group.total += 1;
        const status = song.status[agency];
        if (status === "registered") group.registered += 1;
        if (status === "on_hold") group.onHold += 1;
      }
    }
    groups.set(key, group);
  }
  return [...groups.values()].map((group) => ({
    ...group,
    complete: group.total > 0 && group.registered === group.total,
    batchDone: group.orders.every((order) => !!order.batchRegisteredAt),
  }));
}

/** `3/5 Registered`, the count the header carries. */
export const progressLabel = (group: Pick<UserGroup<GroupableOrder>, "registered" | "total">) =>
  `${group.registered}/${group.total} Registered`;

/** A customer card is only workable once every order has something to register. */
export const canFinishGroup = (group: Pick<UserGroup<GroupableOrder>, "complete" | "batchDone">) =>
  group.complete && !group.batchDone;
