import { describe, expect, it } from "vitest";
import { ACCEPT_STEPS, inviteBlocker, INVITE_STEPS, looksLikeEmail, STAFF_EMAIL_RULE } from "./staff-invites";

describe("inviting staff", () => {
  it("refuses a member account's email and says what to do instead", () => {
    const why = inviteBlocker({ email: "artist@example.com", memberAccount: true, onTeam: false });
    expect(why).toMatch(/separate email/i);
    expect(why).toMatch(/member account/i);
  });

  it("refuses an address already on the team", () => {
    expect(inviteBlocker({ email: "lead@camethroughaudio.com", memberAccount: false, onTeam: true })).toMatch(/already on the team/i);
  });

  it("lets a plain new work address through", () => {
    expect(inviteBlocker({ email: "new@camethroughaudio.com", memberAccount: false, onTeam: false })).toBeNull();
  });

  it("states the rule and both step lists, so the page and the email cannot drift", () => {
    expect(STAFF_EMAIL_RULE).toMatch(/separate work address/i);
    expect(INVITE_STEPS.length).toBeGreaterThanOrEqual(4);
    expect(ACCEPT_STEPS.join(" ")).toMatch(/choose a password/i);
    expect(ACCEPT_STEPS.join(" ")).toMatch(/admin/i);
  });

  it("catches a malformed address before the server does", () => {
    expect(looksLikeEmail("nope")).toBe(false);
    expect(looksLikeEmail("a@b.co")).toBe(true);
  });
});
