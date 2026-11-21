import { describe, expect, it } from "vitest";
import { canRenewEarly, currentPause, dueRenewalReminder, dueReminder, earlyRenewalTarget, extendedRenewal, inGrace, isPaused, keptOnFree, offers, pauseEndingOnCancel, pauseSpan, shiftedEmptyAfter, type Pause, type PlanSub } from "@/lib/retention";
import { planCheckout, checkoutInput } from "@/lib/stripe-mapping";
import { crc32, uniqueName, zipBytes } from "@/lib/zip";

const now = new Date("2026-10-22T12:00:00Z");
const sub = (extra: Partial<PlanSub> = {}): PlanSub => ({ stripe_subscription_id: "sub_1", status: "active", current_period_start: "2025-11-10T00:00:00Z", current_period_end: "2026-11-10T00:00:00Z", cancel_at_period_end: false, ...extra });
const used = (kind: Pause["kind"], created: string, extra: Partial<Pause> = {}): Pause => ({ id: kind, kind, months: kind === "pause" ? 1 : null, starts_at: created, ends_at: created, ended_at: null, created_at: created, ...extra });

describe("need more time and pause", () => {
  it("are offered on a running plan (the cancel screen), not on one already cancelling", () => {
    expect(offers(sub({ current_period_end: "2027-06-10T00:00:00Z" }), null, [], now)).toMatchObject({ failing: false, canExtend: true, canPause: true });
    expect(offers(sub({ cancel_at_period_end: true }), null, [], now).canExtend).toBe(false);
  });
  it("open after a failed renewal, never once the plan has ended", () => {
    expect(offers(sub({ status: "past_due", current_period_end: "2027-10-01T00:00:00Z" }), null, [], now)).toMatchObject({ failing: true, canExtend: true });
    // A lapsed plan is kept on Free automatically, so there is no countdown left to buy time in.
    const lapse = { plan_ended_at: "2026-10-10T00:00:00Z", empty_after: "2026-11-09T00:00:00Z", emptied_at: null };
    expect(offers(null, lapse, [], now).canPause).toBe(false);
    expect(offers(null, { ...lapse, emptied_at: "2026-11-09T00:00:00Z" }, [], now).canPause).toBe(false);
  });
  it("cancelling a plan while paused ends the live pause, so the Vault fee can be stopped with it", () => {
    const live = used("pause", "2026-10-01T00:00:00Z", { starts_at: "2026-10-01T00:00:00Z", ends_at: null });
    expect(pauseEndingOnCancel([live], now)?.id).toBe("pause");
    // Already ended, or not started yet: nothing to end with the plan.
    expect(pauseEndingOnCancel([{ ...live, ended_at: "2026-10-02T00:00:00Z" }], now)).toBeNull();
    // A pause scheduled for a later renewal is still a live Vault subscription: cancelling the plan must stop it before
    // it ever starts, or it would begin billing against no plan.
    expect(pauseEndingOnCancel([{ ...live, starts_at: "2027-01-01T00:00:00Z" }], now)?.id).toBe("pause");
  });

  it("are each once every 12 months", () => {
    const o = offers(sub(), null, [used("extend", "2026-03-01T00:00:00Z")], now);
    expect(o).toMatchObject({ canExtend: false, canPause: true });
    expect(o.extendAgain?.toISOString().slice(0, 10)).toBe("2027-03-01");
    expect(offers(sub(), null, [used("extend", "2025-09-01T00:00:00Z")], now).canExtend).toBe(true);
  });
  it("a pause chosen before renewal starts on the renewal date; after a failed renewal it starts now", () => {
    // A pause has no end date (founder, 2026-11-21): it runs until the member resumes.
    expect(pauseSpan(sub(), now)).toEqual({ starts: new Date("2026-11-10T00:00:00Z") });
    expect(pauseSpan(sub({ status: "past_due" }), now).starts).toEqual(now);
    expect(isPaused([used("pause", "2026-10-01T00:00:00Z", { starts_at: "2026-11-10T00:00:00Z", ends_at: "2026-12-10T00:00:00Z" })], now)).toBe(false);
    expect(isPaused([used("pause", "2026-10-01T00:00:00Z", { starts_at: "2026-10-01T00:00:00Z", ends_at: "2026-12-10T00:00:00Z" })], now)).toBe(true);
  });
  it("an open-ended pause runs until the member resumes, however long that takes", () => {
    const live = used("pause", "2026-10-01T00:00:00Z", { starts_at: "2026-10-01T00:00:00Z", ends_at: null });
    expect(isPaused([live], now)).toBe(true);
    expect(currentPause([live], now)?.id).toBe("pause");
    // Years later it is still the live pause: nothing closes it but resuming.
    expect(isPaused([live], new Date("2031-06-01T00:00:00Z"))).toBe(true);
    // Not started yet, and ended, both read as not paused.
    expect(isPaused([{ ...live, starts_at: "2027-01-01T00:00:00Z" }], now)).toBe(false);
    expect(isPaused([{ ...live, ended_at: "2026-10-02T00:00:00Z" }], now)).toBe(false);
  });
  it("need more time moves the renewal 30 days", () => {
    expect(extendedRenewal(sub(), now).toISOString().slice(0, 10)).toBe("2026-12-10");
    expect(extendedRenewal(sub({ status: "past_due", current_period_start: "2026-10-15T00:00:00Z" }), now).toISOString().slice(0, 10)).toBe("2026-11-21");
  });
  it("a paused grace period keeps the days it had left", () => {
    const lapse = { plan_ended_at: "", empty_after: "2026-11-01T12:00:00Z", emptied_at: null };
    expect(shiftedEmptyAfter(lapse, new Date("2027-01-01T12:00:00Z"), now).toISOString().slice(0, 10)).toBe("2027-01-11");
  });
});

describe("emptying reminders", () => {
  const lapse = (empty: string, reminders: string[] = []) => ({ plan_ended_at: "", empty_after: empty, emptied_at: null, reminders });
  it("sends day 0, then 7 days left, then the last day, once each", () => {
    expect(dueReminder(lapse("2026-11-21T12:00:00Z"), now)?.send).toBe("start");
    expect(dueReminder(lapse("2026-11-21T12:00:00Z", ["start"]), now)).toBeNull();
    expect(dueReminder(lapse("2026-10-28T12:00:00Z", ["start"]), now)?.send).toBe("7");
    // A late start skips straight to the most urgent one and counts the earlier ones as sent.
    expect(dueReminder(lapse("2026-10-23T12:00:00Z"), now)).toEqual({ send: "1", covers: ["start", "7", "1"] });
  });
});

describe("a plan that ends is kept on Free", () => {
  it("keeps the catalog read-only with no countdown, whether or not the member pressed anything", () => {
    const lapse = { plan_ended_at: "2026-10-01T00:00:00Z", empty_after: "2026-11-01T12:00:00Z", emptied_at: null, kept_free_at: "2026-10-25T00:00:00Z" };
    expect(keptOnFree(lapse)).toBe(true);
    expect(inGrace(lapse, now)).toBe(false);
    // Automatic now: a lapse nobody answered is still kept, with no emptying window to act in.
    expect(keptOnFree({ ...lapse, kept_free_at: null })).toBe(true);
    expect(inGrace({ ...lapse, kept_free_at: null }, now)).toBe(false);
    // A catalog already emptied under the old rule is not kept after the fact.
    expect(keptOnFree({ ...lapse, emptied_at: "2026-11-01T12:00:00Z" })).toBe(false);
  });
});

describe("renewal reminders", () => {
  const renews = new Date("2027-01-20T12:00:00Z"); // 90 days after `now`
  it("go out 90, 60, 30, 7 and 1 day ahead, once each per renewal date", () => {
    expect(dueRenewalReminder(renews, [], null, now)).toBe(90);
    expect(dueRenewalReminder(renews, ["90"], renews.toISOString(), now)).toBeNull();
    expect(dueRenewalReminder(new Date("2026-11-30T12:00:00Z"), ["90"], "2026-11-30T12:00:00.000Z", now)).toBe(60);
    expect(dueRenewalReminder(new Date("2026-10-27T12:00:00Z"), [], null, now)).toBe(7);
    expect(dueRenewalReminder(new Date("2027-06-01T12:00:00Z"), [], null, now)).toBeNull();
  });
  it("start over when the renewal date moves", () => {
    expect(dueRenewalReminder(renews, ["90"], "2026-11-30T12:00:00Z", now)).toBe(90);
  });
});

describe("renew now", () => {
  it("is only for a plan running normally, one year ahead at a time", () => {
    expect(canRenewEarly(sub(), [], now)).toBe(true);
    expect(canRenewEarly(sub({ cancel_at_period_end: true }), [], now)).toBe(false);
    expect(canRenewEarly(sub({ status: "past_due" }), [], now)).toBe(false);
    expect(canRenewEarly(sub(), [used("pause", "2026-10-01T00:00:00Z", { starts_at: "2026-11-10T00:00:00Z", ends_at: "2026-12-10T00:00:00Z" })], now)).toBe(false);
    // Already renewed early: the next charge is more than a year away.
    expect(canRenewEarly(sub({ status: "trialing", current_period_end: "2027-11-10T00:00:00Z" }), [], now)).toBe(false);
  });
  it("keeps every day left: the plan runs a year past the renewal it paid for", () => {
    expect(earlyRenewalTarget("2026-11-10T00:00:00Z").toISOString().slice(0, 10)).toBe("2027-11-10");
  });
  it("is priced from the subscription, never through planCheckout", () => {
    expect(() => planCheckout(checkoutInput.parse({ kind: "renew" }), "u1")).toThrow();
  });
});

describe("vault checkout", () => {
  it("opens the pause's own monthly subscription, with no length to choose", () => {
    const plan = planCheckout(checkoutInput.parse({ kind: "vault" }), "u1");
    // A pause lasts as long as the member needs (founder, 2026-11-21): one monthly line, no months and no end date.
    expect(plan).toMatchObject({ mode: "subscription", items: [{ lookupKey: "vault_month", quantity: 1 }], metadata: { userId: "u1", kind: "vault" }, managed: true });
    expect(plan.metadata["months"]).toBeUndefined();
    expect(plan.metadata["pauseEnds"]).toBeUndefined();
  });
});

describe("zip", () => {
  it("stores files a standard reader can open", () => {
    expect(crc32(new TextEncoder().encode("123456789"))).toBe(0xcbf43926);
    const bytes = zipBytes([{ name: "Song.mp3", data: new Uint8Array([1, 2, 3]) }]);
    const view = new DataView(bytes.buffer);
    expect(view.getUint32(0, true)).toBe(0x04034b50);
    expect(view.getUint32(bytes.length - 22, true)).toBe(0x06054b50);
    expect(view.getUint16(bytes.length - 12, true)).toBe(1);
  });
  it("never repeats a file name", () => {
    const taken = new Set<string>();
    expect([uniqueName("Song.mp3", taken), uniqueName("song.mp3", taken), uniqueName("Song.mp3", taken)]).toEqual(["Song.mp3", "song (2).mp3", "Song (3).mp3"]);
  });
});
