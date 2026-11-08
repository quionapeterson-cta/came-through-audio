import { describe, expect, it } from "vitest";
import { BILLING_EMAIL, SUPPORT_EMAIL, escapeHtml } from "./email-layout";
import {
  AFTER_SEND,
  TICKET_STATUSES,
  afterSendStatus,
  canSendReply,
  draftGaps,
  inboxFor,
  isClosed,
  memberUnread,
  memberVisible,
  replyParagraphs,
  replySubject,
  ticketCode,
  ticketLink,
} from "./support-replies";

const ticket = { id: "8f2d5c19-aaaa-bbbb-cccc-123456789abc", subject: "Charged twice" };

describe("ticket statuses", () => {
  it("adds waiting on the member without losing the three that shipped", () => {
    expect(TICKET_STATUSES).toEqual(["open", "in_progress", "waiting", "resolved"]);
  });

  it("maps each after-send choice to the status it leaves behind", () => {
    expect(AFTER_SEND.map((a) => a.id)).toEqual(["stay", "waiting", "resolved"]);
    expect(afterSendStatus("stay")).toBe("in_progress");
    expect(afterSendStatus("waiting")).toBe("waiting");
    expect(afterSendStatus("resolved")).toBe("resolved");
  });

  it("treats resolved as closed, and nothing else", () => {
    expect(isClosed({ status: "resolved" })).toBe(true);
    expect(isClosed({ status: "waiting" })).toBe(false);
    expect(isClosed({ status: "open" })).toBe(false);
  });
});

describe("the reply email", () => {
  it("carries a short ticket code so a mailbox threads the conversation", () => {
    expect(ticketCode(ticket.id)).toBe("8F2D5C");
    expect(replySubject(ticket)).toBe("Re: [Ticket #8F2D5C] Charged twice");
  });

  it("sends billing tickets from billing@ and everything else from support@", () => {
    expect(inboxFor("Account & billing · A charge, invoice or refund")).toBe(BILLING_EMAIL);
    expect(inboxFor("My Catalog · A song won't save or upload")).toBe(SUPPORT_EMAIL);
  });

  it("links straight back to the member's message box", () => {
    expect(ticketLink("https://example.test/", ticket.id)).toBe(
      `https://example.test/workspace?tab=support&ticket=${ticket.id}#reply`,
    );
  });

  it("keeps paragraphs and escapes what the member would read", () => {
    const html = replyParagraphs("Hi Tasha,\nThanks <b>again</b>.\n\nCame Through Audio", escapeHtml);
    expect(html.match(/<p /g)?.length).toBe(2);
    expect(html).toContain("&lt;b&gt;");
    expect(html).toContain("Hi Tasha,<br/>");
  });
});

describe("sending a reply", () => {
  it("refuses an empty reply", () => {
    expect(canSendReply("   ", false).ok).toBe(false);
  });

  it("refuses a member-facing reply that still has placeholders in it", () => {
    const check = canSendReply("Hi {{first_name}}, your refund of {{amount}} is approved.", false);
    expect(check.ok).toBe(false);
    if (!check.ok) expect(check.error).toContain("{{amount}}");
  });

  it("lets an internal note keep its placeholders, because only staff read it", () => {
    expect(canSendReply("INTERNAL: check {{detail}} before replying.", true).ok).toBe(true);
  });

  it("refuses a body past the ceiling", () => {
    expect(canSendReply("a".repeat(8001), true).ok).toBe(false);
    expect(canSendReply("a".repeat(8000), true).ok).toBe(true);
  });

  it("finds every distinct placeholder once", () => {
    expect(draftGaps("{{amount}} / {{ date }} / {{amount}}")).toEqual(["amount", "date"]);
  });
});

describe("what the member may see", () => {
  const rows = [
    { id: "1", internal: false },
    { id: "2", internal: true },
  ];

  it("never hands the member an internal note", () => {
    expect(memberVisible(rows).map((r) => r.id)).toEqual(["1"]);
  });

  it("marks a thread unread until the member opens it after our reply", () => {
    expect(memberUnread({ member_read_at: null }, "2026-11-08T10:00:00Z")).toBe(true);
    expect(memberUnread({ member_read_at: "2026-11-08T11:00:00Z" }, "2026-11-08T10:00:00Z")).toBe(false);
    expect(memberUnread({ member_read_at: "2026-11-08T09:00:00Z" }, "2026-11-08T10:00:00Z")).toBe(true);
    expect(memberUnread({ member_read_at: null }, null)).toBe(false);
  });
});
