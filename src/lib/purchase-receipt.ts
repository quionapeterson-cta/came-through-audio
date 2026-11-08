/**
 * The purchase confirmation (founder, 2026-11-08): every checkout writes one email, keyed to its Stripe session, and its
 * button opens the page the purchase actually unlocked. `purchaseLanding` is the single source of truth for that page,
 * read by the checkout's own return URL and by the email, so the two can never drift apart.
 *
 * Wording rules unchanged: no number, limit, date or promise the founder hasn't approved. The only figure the email
 * carries is the amount Stripe charged on that session, and the plan names come from TIER_LABEL.
 */
import { PRICE_TIER, TIER_LABEL, type Tier } from "./plans";

export type PurchaseKind = "plan" | "seat" | "vault" | "branding" | "contract" | "ai" | "expert" | "renew";

const KINDS: readonly PurchaseKind[] = ["plan", "seat", "vault", "branding", "contract", "ai", "expert", "renew"];

/** A Stripe metadata `kind` as a purchase we know how to confirm, or null. */
export function purchaseKind(raw: string | null | undefined): PurchaseKind | null {
  return KINDS.includes(raw as PurchaseKind) ? (raw as PurchaseKind) : null;
}

/**
 * Where a purchase sends the member back to, `checkout=success` included. These are the paths the checkout already
 * returned to before the email existed; keeping them here means the confirmation button lands where the buyer does.
 */
export function purchaseLanding(kind: PurchaseKind): string {
  switch (kind) {
    case "ai":
      return "/workspace?tab=protect&checkout=success";
    case "expert":
      return "/workspace?tab=health&checkout=success";
    case "contract":
      return "/workspace?tab=learn&checkout=success";
    case "branding":
      return "/profile?checkout=success#brand-kit";
    case "renew":
      return "/profile?checkout=success";
    // A plan, its seats and a pause all live in the workspace, which opens the seat invite on the way back.
    case "plan":
    case "seat":
    case "vault":
      return "/workspace?checkout=success";
  }
}

/** The plan a plan checkout bought, from the lookup keys the session carries. Seats and add-ons are not plans. */
export function purchasedPlan(priceIds: string[]): Tier | null {
  for (const id of priceIds) {
    const tier = PRICE_TIER[id];
    if (tier) return tier;
  }
  return null;
}

/** An amount Stripe charged, in its own currency, or null when the session didn't report one. */
export function money(amount: number | null | undefined, currency: string | null | undefined): string | null {
  if (typeof amount !== "number" || !currency) return null;
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() }).format(amount / 100);
  } catch {
    return null;
  }
}

export type ReceiptCopy = { subject: string; eyebrow: string; heading: string; paragraphs: string[]; cta: string };

/** What one purchase's email says. `paid` is the real charge on that session, and is left out when Stripe didn't say. */
/** A date in the same long form every account email uses, or null when it isn't a date. */
function renewalDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

export function receiptCopy(i: {
  kind: PurchaseKind;
  plan?: Tier | null;
  paid?: string | null;
  managed?: boolean;
  /**
   * The date the plan next renews, when this purchase moved it (Renew now). It is the renewal date, never the end of a
   * Stripe trial: the confirmation says "renews", because that is what the member is being told (founder, 2026-11-08).
   */
  renewsOn?: string | null;
}): ReceiptCopy {
  const paid = i.paid ?? null;
  const money_line = paid ? `We charged ${paid}.` : "Your payment went through.";
  const base = { eyebrow: "Purchase confirmed" };

  let copy: ReceiptCopy;
  switch (i.kind) {
    case "plan": {
      const name = i.plan ? TIER_LABEL[i.plan] : "your plan";
      copy = {
        ...base,
        subject: i.plan ? `Your ${name} plan is active` : "Your plan is active",
        heading: `${name} is on your account`,
        paragraphs: [
          money_line,
          "Every feature that comes with the plan is unlocked now, in the workspace.",
          "You can download invoices and change the card on file from Profile → Manage billing whenever you need to.",
        ],
        cta: "Open your workspace",
      };
      break;
    }
    case "seat":
      copy = {
        ...base,
        subject: "Your artist seats are ready",
        heading: "Your artist seats are ready to fill",
        paragraphs: [
          money_line,
          "Each artist on a seat needs their own account: the invite form opens in the workspace, and they can sign up from the link it sends them.",
          "A seat keeps the catalog that comes with it while it is paid for, and your own plan never changes.",
        ],
        cta: "Invite your artists",
      };
      break;
    case "vault":
      copy = {
        ...base,
        subject: "Your pause is in place",
        heading: "Your pause is in place",
        paragraphs: [
          money_line,
          "A pause stops the plan charge and then renews by itself afterwards. It is not a cancellation.",
          "Resume any time from Profile, which ends the pause rather than the plan.",
        ],
        cta: "Open your workspace",
      };
      break;
    case "branding":
      copy = {
        ...base,
        subject: "Your branding kit is unlocked",
        heading: "Your branding kit is unlocked",
        paragraphs: [
          money_line,
          "It is on your account for the year, on any plan, and it prints on the contracts, split sheets, lyric downloads and catalog downloads you hand out.",
          "Set up the logo, colours and name in Profile → Brand kit.",
        ],
        cta: "Set up your kit",
      };
      break;
    case "contract":
      copy = {
        ...base,
        subject: "Your contract is ready",
        heading: "Your contract is ready",
        paragraphs: [
          money_line,
          "It is in My Contracts, where you can read it, adjust it and download it.",
          "If anything in it reads wrong, reply to this email and we will sort it out.",
        ],
        cta: "Open My Contracts",
      };
      break;
    case "ai":
      copy = {
        ...base,
        subject: "Your AI Protection package is active",
        heading: "Your AI Protection package is active",
        paragraphs: [
          money_line,
          "The songs you picked are covered by the package, and the certificates are issued from the AI Protection Hub in your workspace.",
        ],
        cta: "Open AI Protection",
      };
      break;
    case "expert":
      copy = {
        ...base,
        subject: "We're getting your registrations started",
        heading: "Your registration assistance is under way",
        paragraphs: [
          money_line,
          "Our team is checking every song you sent against what each agency asks for before anything is filed.",
          "Expert Help in the Royalty Health Hub shows what is still outstanding, and we email you if we need a detail from you.",
        ],
        cta: "Open Expert Help",
      };
      break;
    case "renew": {
      const renews = renewalDate(i.renewsOn);
      copy = {
        ...base,
        subject: renews ? `Your plan now renews on ${renews}` : "Your renewal is in",
        heading: "You're renewed for another year",
        paragraphs: [
          money_line,
          ...(renews ? [`Your plan now renews on ${renews}, with nothing charged before then.`] : []),
          "Every day you had left is kept, and the next charge sits a year past the renewal this paid for.",
          "Your catalog, masters and badges carry on as they are.",
        ],
        cta: "Open Profile",
      };
      break;
    }
  }

  if (i.managed) {
    copy.paragraphs.push("If you paid through Link, Stripe's checkout service, its own receipt reaches you as well; this note is what confirms what unlocked on your account.");
  }
  return copy;
}
