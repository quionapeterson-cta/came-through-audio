import { describe, expect, it } from "vitest";
import { activeKitKeys, autoBindKit, brandAccess, brandingUntil, hexRgb, kitAllowance, kitFromRow, kitReady, kitYearKey, usableKits } from "./brand-kit";
import { checkoutInput, planCheckout } from "./stripe-mapping";

const buy = (created_at: string, refunded = false) => ({ kind: "branding", created_at, details: refunded ? { refunded_at: created_at } : {} });

describe("Personal Branding", () => {
  it("lasts a year per paid subscription year (each kit is its own yearly subscription)", () => {
    const now = new Date("2026-11-01T00:00:00Z");
    expect(brandingUntil([], now)).toBeNull();
    expect(brandingUntil([buy("2026-10-01T00:00:00Z")], now)?.toISOString()).toBe("2027-10-01T00:00:00.000Z");
    // Two kits are two subscriptions, each with its own year: access runs until the later one ends.
    expect(brandingUntil([buy("2026-10-01T00:00:00Z"), buy("2026-10-20T00:00:00Z")], now)?.toISOString()).toBe("2027-10-20T00:00:00.000Z");
    expect(brandingUntil([buy("2025-01-01T00:00:00Z")], now)).toBeNull();
    expect(brandingUntil([buy("2026-10-01T00:00:00Z", true)], now)).toBeNull();
    expect(brandingUntil([{ kind: "vault", created_at: "2026-10-01T00:00:00Z", details: {} }], now)).toBeNull();
  });

  it("counts each paid year to Stripe's period end, not a fixed 365 days", () => {
    const now = new Date("2026-11-01T00:00:00Z");
    const stated = { kind: "branding", created_at: "2026-10-01T00:00:00Z", details: { period_end: "2027-03-01T00:00:00Z" } };
    // The paid-through date Stripe gave is what counts, even when it is longer or shorter than a year.
    expect(brandingUntil([stated], now)?.toISOString()).toBe("2027-03-01T00:00:00.000Z");
    const short = { kind: "branding", created_at: "2026-10-01T00:00:00Z", details: { period_end: "2026-10-20T00:00:00Z" } };
    expect(brandingUntil([short], now)).toBeNull();
    expect(kitAllowance("plus", [short], now)).toBe(0);
    expect(kitAllowance("plus", [stated], now)).toBe(1);
    // A row with no period end still falls back to the year, so older purchases keep working.
    expect(brandingUntil([buy("2026-10-01T00:00:00Z")], now)?.toISOString()).toBe("2027-10-01T00:00:00.000Z");
  });

  it("Catalog Management includes it; the add-on turns it on for any plan", () => {
    const until = new Date("2027-01-01");
    expect(brandAccess("management", null)).toEqual({ contracts: true, splits: true, lyrics: true, catalog: true });
    expect(brandAccess("free", until)).toEqual({ contracts: true, splits: true, lyrics: true, catalog: true });
    expect(brandAccess("collaborate", until)).toEqual({ contracts: true, splits: true, lyrics: true, catalog: true });
    expect(brandAccess("plus", null)).toEqual({ contracts: false, splits: false, lyrics: false, catalog: false });
  });

  it("cleans kit rows and keeps every valid color", () => {
    const k = kitFromRow({ name: " Karma ", colors: ["#004aad", "nope", "#4D8CFF", "#FFFFFF", "#0B0B0B", "#123456"], font: "Comic Sans", show_footer: false });
    expect(k).toMatchObject({ name: "Karma", colors: ["#004AAD", "#4D8CFF", "#FFFFFF", "#0B0B0B", "#123456"], font: "Arial", showFooter: false, logoPath: null });
    expect(kitReady(k)).toBe(true);
    expect(kitReady(kitFromRow({ name: "" }))).toBe(false);
    expect(hexRgb("#004AAD")).toEqual([0, 74, 173]);
  });

  it("checks out as a yearly branding_yearly subscription that returns to Profile", () => {
    expect(planCheckout(checkoutInput.parse({ kind: "branding" }), "u1")).toMatchObject({
      mode: "subscription", items: [{ lookupKey: "branding_yearly", quantity: 1 }], metadata: { userId: "u1", kind: "branding" }, returnTab: "profile", managed: true,
    });
  });
});

describe("several Branding Kits", () => {
  const now = new Date("2026-11-01T00:00:00Z");
  it("allows one kit with Catalog Management plus one per active purchase", () => {
    expect(kitAllowance("plus", [], now)).toBe(0);
    expect(kitAllowance("management", [], now)).toBe(1);
    expect(kitAllowance("plus", [buy("2026-10-01T00:00:00Z"), buy("2026-10-20T00:00:00Z")], now)).toBe(2);
    expect(kitAllowance("management", [buy("2026-10-01T00:00:00Z"), buy("2025-01-01T00:00:00Z"), buy("2026-10-02T00:00:00Z", true)], now)).toBe(2);
  });
  it("names the purchase key of every running kit year", () => {
    const keys = activeKitKeys([
      { kind: "branding", created_at: "2026-10-01T00:00:00Z", details: { subscription: "sub_a", period_end: "2027-10-01T00:00:00Z" } },
      { kind: "branding", created_at: "2025-10-01T00:00:00Z", details: { subscription: "sub_old", period_end: "2026-10-01T00:00:00Z" } },
      { kind: "branding", created_at: "2026-10-02T00:00:00Z", details: { subscription: "sub_refunded", refunded_at: "2026-11-01T00:00:00Z" } },
      { kind: "vault", created_at: "2026-10-03T00:00:00Z", details: { subscription: "sub_vault" } },
    ], now);
    expect([...keys]).toEqual(["sub:sub_a"]);
  });

  it("unlocks exactly the kit its subscription paid for", () => {
    const kits = [{ id: "k1", paidKey: "sub:a" }, { id: "k2", paidKey: "sub:b" }, { id: "k3", paidKey: null }];
    expect(usableKits(kits, 1, false, new Set(["sub:b"])).map((k) => k.id)).toEqual(["k2"]);
    expect(usableKits(kits, 2, false, new Set(["sub:a", "sub:b"])).map((k) => k.id)).toEqual(["k1", "k2"]);
    // The year that lapsed is not in the set, so its kit is not usable even though it is the oldest.
    expect(usableKits(kits, 1, false, new Set(["sub:b"])).map((k) => k.id)).not.toContain("k1");
  });

  it("keeps the included kit as the default and adds the linked paid ones", () => {
    const kits = [{ id: "k1" }, { id: "k2", paidKey: "sub:b" }, { id: "k3" }];
    expect(usableKits(kits, 1, true, new Set()).map((k) => k.id)).toEqual(["k1"]);
    expect(usableKits(kits, 2, true, new Set(["sub:b"])).map((k) => k.id)).toEqual(["k1", "k2"]);
    expect(usableKits(kits, 9, true, new Set(["sub:b"])).map((k) => k.id)).toEqual(["k1", "k2", "k3"]);
  });

  it("gives a year with no kit yet to the newest unlinked kit first", () => {
    const kits = [{ id: "k1", paidKey: "sub:old" }, { id: "k2" }];
    expect(usableKits(kits, 1, false, new Set(["sub:new"])).map((k) => k.id)).toEqual(["k2"]);
    // A spare slot (an allowance the member has but a year that names no kit) can only fall to the lapsed kit.
    expect(usableKits(kits, 2, false, new Set(["sub:new"])).map((k) => k.id)).toEqual(["k2", "k1"]);
    expect(usableKits([], 1, false, new Set(["sub:new"]))).toEqual([]);
    expect(usableKits([{ id: "k1" }], 0, false, new Set())).toEqual([]);
  });

  it("lights up a lapsed-linked kit when a running year has no kit to name", () => {
    // The locked screen's Add Personal Branding buys without naming a kit: their one kit must print, not stay locked.
    expect(usableKits([{ id: "k1", paidKey: "sub:old" }], 1, false, new Set(["sub:new"])).map((k) => k.id)).toEqual(["k1"]);
    // A brand-new unlinked kit still wins the free slot when there is one.
    expect(usableKits([{ id: "k1", paidKey: "sub:old" }, { id: "k2" }], 1, false, new Set(["sub:new"])).map((k) => k.id)).toEqual(["k2"]);
    // Once the year is linked to the kit it was bought for, the exact link decides, not the fallback.
    const linked = [{ id: "k1", paidKey: "sub:old" }, { id: "k2", paidKey: "sub:new" }];
    expect(usableKits(linked, 1, false, new Set(["sub:new"])).map((k) => k.id)).toEqual(["k2"]);
    // Two lapsed kits and one running year: the newest comes back, and only one of them.
    expect(usableKits([{ id: "k1", paidKey: "sub:a" }, { id: "k2", paidKey: "sub:b" }], 1, false, new Set(["sub:new"])).map((k) => k.id)).toEqual(["k2"]);
    // With the included kit it is still the default, and the year fills the paid slot.
    expect(usableKits([{ id: "k1", paidKey: "sub:old" }], 2, true, new Set(["sub:new"])).map((k) => k.id)).toEqual(["k1"]);
  });

  it("keys a year bought before the subscription was stored by its own purchase row", () => {
    const bought = new Date(Date.now() - 5 * 86400000).toISOString();
    // The sandbox branding rows of 2026-11-07 carry only kind and userId, but they still count as a paid year.
    const legacy = { id: "p1", kind: "branding", created_at: bought, details: { kind: "branding" } };
    expect(kitYearKey(legacy)).toBe("row:p1");
    expect([...activeKitKeys([legacy])]).toEqual(["row:p1"]);
    // A row with no id and no subscription can name nothing, rather than inventing a key.
    expect(kitYearKey({ kind: "branding", created_at: bought, details: {} })).toBeNull();
    // A real subscription still wins, so its exact link never changes shape.
    expect(kitYearKey({ id: "p2", kind: "branding", created_at: bought, details: { subscription: "sub_123" } })).toBe("sub:sub_123");
    // A legacy year can unlock the kit linked to it, just like a subscription year.
    const paid = activeKitKeys([legacy]);
    expect(usableKits([{ id: "k1", paidKey: "row:p1" }], 1, false, paid).map((k) => k.id)).toEqual(["k1"]);
    // A refunded legacy year is not running and names no kit.
    expect([...activeKitKeys([{ ...legacy, details: { refunded_at: new Date().toISOString() } }])]).toEqual([]);
  });

  it("binds a member's only kit to their running paid year", () => {
    const paid = new Set(["sub:new"]);
    // Bought before the kit existed, or before the link did: it can only belong to the one kit they have.
    expect(autoBindKit([{ id: "k1", paidKey: null }], paid)).toEqual({ kitId: "k1", key: "sub:new" });
    // Their own year lapsed and they renewed: the link moves to the running year.
    expect(autoBindKit([{ id: "k1", paidKey: "sub:old" }], paid)).toEqual({ kitId: "k1", key: "sub:new" });
    // Already tied to a running year: nothing to write.
    expect(autoBindKit([{ id: "k1", paidKey: "sub:new" }], paid)).toBeNull();
    // Once linked, the kit is usable with no fallback involved.
    expect(usableKits([{ id: "k1", paidKey: "sub:new" }], 1, false, paid).map((k) => k.id)).toEqual(["k1"]);
    // More than one kit is a choice, not a guess, and a year that isn't running binds nothing.
    expect(autoBindKit([{ id: "k1" }, { id: "k2" }], paid)).toBeNull();
    expect(autoBindKit([{ id: "k1" }], new Set())).toBeNull();
    expect(autoBindKit([{ id: null }], paid)).toBeNull();
  });

  it("reads a kit's style and section title color, with safe defaults", () => {
    expect(kitFromRow({ id: "k1", name: "Biz", style: "banner", header_color: "#7a1f1f" })).toMatchObject({ id: "k1", style: "banner", headerColor: "#7A1F1F" });
    expect(kitFromRow({ name: "Biz", style: "weird", header_color: "red" })).toMatchObject({ style: "classic", headerColor: null });
  });
});

describe("kit options", async () => {
  const { kitOptions, DEFAULT_KIT_OPTIONS } = await import("./brand-kit");
  it("reads saved options and falls back to the defaults", () => {
    expect(kitOptions(undefined)).toEqual(DEFAULT_KIT_OPTIONS);
    expect(kitOptions({ watermark: true, cover: true, signature: "box", accent: "#7a1f1f", corners: "square" })).toEqual({ watermark: true, cover: true, signature: "box", accent: "#7A1F1F", titleColor: null, corners: "square", logoAlign: "left", logoSnap: "middle", logoNudge: 0 });
    // The document title's own colour (founder, 2026-11-07): blank until picked, and cleaned like the accent.
    expect(kitOptions({ titleColor: "#7a1f1f" }).titleColor).toBe("#7A1F1F");
    expect(kitOptions({ titleColor: "red" }).titleColor).toBeNull();
    expect(kitOptions({ signature: "fancy", accent: "red", corners: "wavy" })).toEqual(DEFAULT_KIT_OPTIONS);
  });
});

describe("where the logo sits in the header", async () => {
  const { kitOptions, logoTop, logoNudgeValue, HEADING, LOGO_NUDGE_MAX } = await import("./brand-kit");

  it("keeps the settled middle and puts the top and bottom edges on the name", () => {
    // Middle is the 19.4 mm line every kit has printed at since the header existed: untouched kits never move.
    expect(logoTop({ snap: "middle", nudge: 0, height: 10, hasTagline: true })).toBeCloseTo(14.4, 5);
    expect(logoTop({ snap: "top", nudge: 0, height: 10, hasTagline: true })).toBeCloseTo(HEADING.withTagline.top, 5);
    expect(logoTop({ snap: "bottom", nudge: 0, height: 10, hasTagline: true })).toBeCloseTo(HEADING.withTagline.bottom - 10, 5);
    // No tagline is a shorter heading, so its bottom sits higher.
    expect(logoTop({ snap: "bottom", nudge: 0, height: 10, hasTagline: false })).toBeCloseTo(HEADING.nameOnly.bottom - 10, 5);
  });

  it("moves by the fine amount, and never climbs into the title or off the page", () => {
    expect(logoTop({ snap: "middle", nudge: 2.5, height: 10, hasTagline: true })).toBeCloseTo(16.9, 5);
    // An impossible movement is read as ±12 mm, and the picture still never leaves the header.
    expect(logoTop({ snap: "middle", nudge: -100, height: 10, hasTagline: true })).toBe(6);
    expect(logoTop({ snap: "middle", nudge: 100, height: 10, hasTagline: true })).toBeCloseTo(26.4, 5);
    expect(logoTop({ snap: "middle", nudge: 12, height: 16, hasTagline: true })).toBe(22);
  });

  it("reads the fine amount as millimetres: one decimal, inside ±12, unreadable is none", () => {
    expect(logoNudgeValue("2.44")).toBe(2.4);
    expect(logoNudgeValue(-99)).toBe(-LOGO_NUDGE_MAX);
    expect(logoNudgeValue(undefined)).toBe(0);
    expect(logoNudgeValue("nope")).toBe(0);
  });

  it("cleans a saved side, line and movement, defaulting to how every kit already prints", () => {
    expect(kitOptions({ logoAlign: "right", logoSnap: "top", logoNudge: 3.2 })).toMatchObject({ logoAlign: "right", logoSnap: "top", logoNudge: 3.2 });
    expect(kitOptions({ logoAlign: "sideways", logoSnap: "diagonal", logoNudge: "nope" })).toMatchObject({ logoAlign: "left", logoSnap: "middle", logoNudge: 0 });
    expect(kitOptions({ logoSnap: "bottom" }).logoSnap).toBe("bottom");
    // A kit saved before these controls existed keeps printing exactly as it did.
    expect(kitFromRow({ name: "Biz" })?.options).toMatchObject({ logoAlign: "left", logoSnap: "middle", logoNudge: 0 });
  });
});

describe("saved colour sets", async () => {
  const { kitColorSets, withColorSet, withoutColorSet, MAX_COLOR_SETS } = await import("./brand-kit");

  it("keeps only named sets with readable colours", () => {
    expect(kitColorSets(undefined)).toEqual([]);
    expect(kitColorSets([{ name: " Wine ", colors: ["#7a1f1f", "nope"] }, { name: "", colors: ["#000000"] }, { name: "wine", colors: ["#FFFFFF"] }]))
      .toEqual([{ name: "Wine", colors: ["#7A1F1F"] }]);
    expect(kitFromRow({ name: "Biz", color_sets: [{ name: "Ink", colors: ["#0B0B0B"] }] })?.colorSets).toEqual([{ name: "Ink", colors: ["#0B0B0B"] }]);
    expect(kitFromRow({ name: "Biz" })?.colorSets).toEqual([]);
  });

  it("saves a set under its name, replaces the same name, and deletes by name", () => {
    const one = withColorSet([], { name: "Ink", colors: ["#0b0b0b"] });
    expect(one).toEqual([{ name: "Ink", colors: ["#0B0B0B"] }]);
    expect(withColorSet(one, { name: "ink", colors: ["#004aad"] })).toEqual([{ name: "ink", colors: ["#004AAD"] }]);
    expect(withColorSet(one, { name: "", colors: ["#004AAD"] })).toEqual(one);
    expect(withColorSet(one, { name: "Wine", colors: ["nope"] })).toEqual(one);
    expect(withoutColorSet([...one, { name: "Wine", colors: ["#7A1F1F"] }], "Ink")).toEqual([{ name: "Wine", colors: ["#7A1F1F"] }]);
  });

  it("never grows past the cap", () => {
    let sets: { name: string; colors: string[] }[] = [];
    for (let i = 0; i < MAX_COLOR_SETS + 5; i++) sets = withColorSet(sets, { name: `Set ${i}`, colors: ["#0B0B0B"] });
    expect(sets).toHaveLength(MAX_COLOR_SETS);
    expect(sets[sets.length - 1]!.name).toBe(`Set ${MAX_COLOR_SETS + 4}`);
  });
});

describe("undo and redo in the kit editor", async () => {
  const { emptyHistory, recordHistory, redoHistory, undoHistory, emptyKit } = await import("./brand-kit");
  const before = { ...emptyKit("Karma"), tagline: "one" };
  const after = { ...emptyKit("Karma"), tagline: "two" };

  it("steps back and forward through the kit's own edits", () => {
    const history = recordHistory(emptyHistory(), before);
    const back = undoHistory(history, after)!;
    expect(back.kit.tagline).toBe("one");
    const forward = redoHistory(back.history, back.kit)!;
    expect(forward.kit.tagline).toBe("two");
    expect(redoHistory(forward.history, forward.kit)).toBeNull();
    expect(undoHistory(emptyHistory(), after)).toBeNull();
  });

  it("drops the redo trail as soon as a new edit is made", () => {
    const back = undoHistory(recordHistory(emptyHistory(), before), after)!;
    expect(recordHistory(back.history, back.kit).future).toEqual([]);
  });
});
