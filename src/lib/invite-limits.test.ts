import { describe, it, expect } from "vitest";
import { cleanInviteText, inviteBlockReason, trustedOrigin } from "@/lib/invite-limits";

const ok = { senderToday: 0, rowSends: [], recipientToday: 0, blocked: false };
const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();

describe("cleanInviteText", () => {
  it("removes web addresses and emails", () => {
    expect(cleanInviteText("Claim your prize at https://evil.example/x now")).toBe("Claim your prize at now");
    expect(cleanInviteText("Visit www.win.biz or prizes.com/claim")).toBe("Visit or");
    expect(cleanInviteText("Write to scam@bad.io")).toBe("Write to");
  });
  it("keeps ordinary titles and names", () => {
    expect(cleanInviteText("Big Booty Bouncing (feat. OG PI)")).toBe("Big Booty Bouncing (feat. OG PI)");
    expect(cleanInviteText("J. Cole")).toBe("J. Cole");
  });
  it("caps length at 80 characters", () => {
    expect(cleanInviteText("a".repeat(200))).toHaveLength(80);
  });
});

describe("inviteBlockReason", () => {
  it("allows a first send", () => expect(inviteBlockReason(ok)).toBeNull());
  it("refuses blocked recipients", () => expect(inviteBlockReason({ ...ok, blocked: true })).toMatch(/turned off/));
  it("caps the sender at 25 a day", () => expect(inviteBlockReason({ ...ok, senderToday: 25 })).toMatch(/limit of 25/));
  it("waits 24 hours between resends of one row", () => {
    expect(inviteBlockReason({ ...ok, rowSends: [hoursAgo(5)] })).toMatch(/Resend available tomorrow/);
    expect(inviteBlockReason({ ...ok, rowSends: [hoursAgo(25)] })).toBeNull();
  });
  it("stops after 3 sends of one row", () => expect(inviteBlockReason({ ...ok, rowSends: [hoursAgo(90), hoursAgo(60), hoursAgo(30)] })).toMatch(/3 times/));
  it("caps a recipient at 3 a day from everyone", () => expect(inviteBlockReason({ ...ok, recipientToday: 3 })).toMatch(/several invites/));
});

describe("trustedOrigin", () => {
  const site = "https://pixel-perfect-studio-382.lovable.app";
  it("keeps our own addresses", () => {
    expect(trustedOrigin("https://camethroughaudio.com/workspace", site)).toBe("https://camethroughaudio.com");
    // Editor previews need a Lovable login, so recipients get the published site instead.
    expect(trustedOrigin("https://id-preview--abc.lovable.app", site)).toBe(site);
    expect(trustedOrigin("https://abc.lovableproject.com", site)).toBe(site);
    expect(trustedOrigin(`${site}/workspace`, site)).toBe(site);
  });
  it("replaces anyone else's", () => {
    expect(trustedOrigin("https://evil-lovable.app", site)).toBe(site);
    expect(trustedOrigin("https://camethroughaudio.com.evil.io", site)).toBe(site);
    expect(trustedOrigin("not a url", site)).toBe(site);
  });
});
