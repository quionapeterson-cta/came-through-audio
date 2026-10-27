import { describe, expect, it } from "vitest";
import { catalogMatch, intakeStep, newSongKeys, orderSongsOf } from "./registration";
import { registrationAuthorization } from "./contract-blueprints";

const order = (over: Partial<{ agreement_signed_at: string | null; access_confirmed: Record<string, string>; agencies: string[] }> = {}) =>
  ({ agreement_signed_at: null, access_confirmed: {}, agencies: ["ASCAP", "The MLC"], ...over });

describe("orderSongsOf", () => {
  it("reads picked songs and typed titles back from purchase details, in order", () => {
    const details = { kind: "expert", tracks_2: "c", tracks_1: "a,b", ...newSongKeys([{ title: "New", artist: "Me" }]), new_x: "ignored" };
    expect(orderSongsOf(details)).toEqual({ trackIds: ["a", "b", "c"], newSongs: [{ title: "New", artist: "Me" }] });
  });
  it("skips a broken entry instead of failing the order", () => {
    expect(orderSongsOf({ new_1: "{oops", new_2: JSON.stringify({ t: "Ok", a: "" }) }).newSongs).toEqual([{ title: "Ok", artist: "" }]);
  });
});

describe("intakeStep", () => {
  it("unlocks each step only after the one before it", () => {
    expect(intakeStep(order(), [{ submitted_at: null }], false)).toBe(2);
    expect(intakeStep(order(), [{ submitted_at: null }], true)).toBe(3);
    expect(intakeStep(order(), [{ submitted_at: "x" }], true)).toBe(4);
    expect(intakeStep(order({ agreement_signed_at: "x", access_confirmed: { ASCAP: "x" } }), [{ submitted_at: "x" }], true)).toBe(5);
    expect(intakeStep(order({ agreement_signed_at: "x", access_confirmed: { ASCAP: "x", "The MLC": "x" } }), [{ submitted_at: "x" }], true)).toBe(6);
  });
  it("an unlocked song sends the order back to the readiness check", () => {
    expect(intakeStep(order({ agreement_signed_at: "x" }), [{ submitted_at: "x" }, { submitted_at: null }], false)).toBe(2);
  });
});

describe("registrationAuthorization", () => {
  const base = { effectiveDate: "October 23, 2026", client: "Jordan Lee", songs: [{ title: "Gold Rush", isrc: "USAAA2600001" }], agencies: ["ASCAP", "The MLC"], purchasedOn: "October 22, 2026", amount: "$24.97" };
  it("fills in the client, agencies and Schedule A, under Georgia law", () => {
    const t = registrationAuthorization({ ...base, prelaunch: false });
    expect(t).toContain("and Jordan Lee (\"Client\")");
    expect(t).toContain("(ASCAP, The MLC)");
    expect(t).toContain("1. Gold Rush (ISRC USAAA2600001)");
    expect(t).toContain("the State of Georgia");
    expect(t).not.toContain("{{");
    expect(t).not.toContain("PRE-LAUNCH");
  });
  it("adds the pre-launch clause while the site is pre-launch and renumbers the general terms", () => {
    const t = registrationAuthorization({ ...base, prelaunch: true });
    expect(t).toContain("9. PRE-LAUNCH CONFIDENTIALITY");
    expect(t).toContain("10.1 Entire agreement");
  });
});

describe("catalogMatch", () => {
  const tracks = [{ id: "a", title: "Bloodline" }, { id: "b", title: "Crown  Keeper" }, { id: "c", title: "Twin" }, { id: "d", title: "twin" }];
  it("links a typed title to the one catalog song with that title", () => {
    expect(catalogMatch(" crown keeper ", tracks, [])).toBe("b");
  });
  it("leaves it for the user when no song, two songs, or a song already in the order matches", () => {
    expect(catalogMatch("Missing", tracks, [])).toBeUndefined();
    expect(catalogMatch("Twin", tracks, [])).toBeUndefined();
    expect(catalogMatch("Bloodline", tracks, ["a"])).toBeUndefined();
    expect(catalogMatch(null, tracks, [])).toBeUndefined();
  });
});
