import { afterEach, describe, expect, it, vi } from "vitest";
import { emailLayout } from "./email-layout";
import { MAILBOXES, mailFrom, mailKey, mailboxAddress, sendMail } from "./mailer";

const mail = { from: "support" as const, to: ["a@b.com"], subject: "Hi", html: "<p>hi</p>", key: "key-1" };

describe("mailboxes", () => {
  it("names one address per mailbox, all on our own domain", () => {
    const addresses = Object.values(MAILBOXES);
    expect(new Set(addresses).size).toBe(addresses.length);
    for (const address of addresses) expect(address).toMatch(/^[a-z]+@camethroughaudio\.com$/);
  });

  it("builds the from header with our name, or the one that mailbox reads", () => {
    expect(mailFrom("support")).toBe("Came Through Audio <support@camethroughaudio.com>");
    expect(mailFrom("billing", "Came Through Audio Billing")).toBe("Came Through Audio Billing <billing@camethroughaudio.com>");
    expect(mailboxAddress("registrations")).toBe("registrations@camethroughaudio.com");
  });
});

describe("mailKey", () => {
  it("is stable and readable", () => {
    expect(mailKey("Seat invite", "AbC-123")).toBe("seat-invite-abc-123");
    expect(mailKey("seat", "invite")).toBe(mailKey("seat", "invite"));
  });

  it("keeps two different sends apart", () => {
    expect(mailKey("seat-invite", "a")).not.toBe(mailKey("seat-invite", "b"));
  });

  it("stays inside Resend's limit", () => {
    expect(mailKey("x".repeat(500)).length).toBeLessThanOrEqual(200);
  });
});

describe("sendMail", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("refuses a send with no idempotency key", async () => {
    await expect(sendMail({ ...mail, key: "   " })).rejects.toThrow(/idempotency key/i);
  });

  it("refuses a send with no recipient", async () => {
    await expect(sendMail({ ...mail, to: ["  "] })).rejects.toThrow(/recipient/i);
  });

  it("says it is not configured instead of pretending to send", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    vi.stubEnv("CameThroughAudio", "");
    await expect(sendMail({ ...mail, html: emailLayout("<p>hi</p>", { reason: "test" }) })).resolves.toEqual({
      ok: false,
      detail: "no-key",
    });
  });

  it("sends the mailbox address, the key and the reply address to Resend", async () => {
    vi.stubEnv("RESEND_API_KEY", "test_key");
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal("fetch", fetchMock);

    const result = await sendMail({ ...mail, to: ["  a@b.com "], replyTo: "support@camethroughaudio.com" });

    expect(result).toEqual({ ok: true, status: 200 });
    const [url, init] = fetchMock.mock.calls[0] as [string, { headers: Record<string, string>; body: string }];
    expect(url).toBe("https://api.resend.com/emails");
    expect(init.headers["Idempotency-Key"]).toBe("key-1");
    const body = JSON.parse(init.body) as { from: string; to: string[]; reply_to?: string };
    expect(body.from).toBe("Came Through Audio <support@camethroughaudio.com>");
    expect(body.to).toEqual(["a@b.com"]);
    expect(body.reply_to).toBe("support@camethroughaudio.com");
  });

  it("reports a refused send with its status and reason", async () => {
    vi.stubEnv("RESEND_API_KEY", "test_key");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 403, text: async () => "domain not verified" }));
    await expect(sendMail({ ...mail, from: "admin" })).resolves.toEqual({
      ok: false,
      status: 403,
      detail: "domain not verified",
    });
  });
});
