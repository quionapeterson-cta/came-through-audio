import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { bounceDetail, deliveryStatusFor, verifyResendSignature } from "./resend-events";

/** Svix's signature, computed independently of the code under test. */
function signed(secret: string, id: string, timestamp: number, payload: string) {
  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  return "v1," + createHmac("sha256", key).update(`${id}.${timestamp}.${payload}`).digest("base64");
}

const SECRET = `whsec_${Buffer.from("came-through-audio-webhook-key").toString("base64")}`;
const NOW = 1_760_000_000_000;
const STAMP = String(NOW / 1000);

describe("verifyResendSignature", () => {
  it("accepts a correctly signed request", async () => {
    const payload = JSON.stringify({ type: "email.delivered", data: { email_id: "abc" } });
    await expect(
      verifyResendSignature({
        secret: SECRET,
        id: "msg_1",
        timestamp: STAMP,
        signature: signed(SECRET, "msg_1", NOW / 1000, payload),
        payload,
        now: NOW,
      }),
    ).resolves.toBe(true);
  });

  it("accepts when the header carries several signatures", async () => {
    const payload = "{}";
    const header = `v1,bm90LXRoZS1vbmU= ${signed(SECRET, "msg_2", NOW / 1000, payload)}`;
    await expect(
      verifyResendSignature({
        secret: SECRET,
        id: "msg_2",
        timestamp: STAMP,
        signature: header,
        payload,
        now: NOW,
      }),
    ).resolves.toBe(true);
  });

  it("refuses a changed payload, a wrong key, and an old request", async () => {
    const payload = '{"type":"email.bounced"}';
    const good = signed(SECRET, "msg_3", NOW / 1000, payload);
    const other = `whsec_${Buffer.from("another-key").toString("base64")}`;
    await expect(
      verifyResendSignature({
        secret: SECRET,
        id: "msg_3",
        timestamp: STAMP,
        signature: good,
        payload: payload + " ",
        now: NOW,
      }),
    ).resolves.toBe(false);
    await expect(
      verifyResendSignature({
        secret: other,
        id: "msg_3",
        timestamp: STAMP,
        signature: good,
        payload,
        now: NOW,
      }),
    ).resolves.toBe(false);
    await expect(
      verifyResendSignature({
        secret: SECRET,
        id: "msg_3",
        timestamp: STAMP,
        signature: good,
        payload,
        now: NOW + 10 * 60_000,
      }),
    ).resolves.toBe(false);
  });

  it("refuses a request with no signature headers", async () => {
    await expect(
      verifyResendSignature({
        secret: SECRET,
        id: null,
        timestamp: null,
        signature: null,
        payload: "{}",
        now: NOW,
      }),
    ).resolves.toBe(false);
  });
});

describe("deliveryStatusFor", () => {
  it("maps the events that change what staff see", () => {
    expect(deliveryStatusFor("email.delivered")).toBe("delivered");
    expect(deliveryStatusFor("email.bounced")).toBe("bounced");
    expect(deliveryStatusFor("email.delivery_delayed")).toBe("delayed");
    expect(deliveryStatusFor("email.complained")).toBe("complained");
    expect(deliveryStatusFor("email.failed")).toBe("failed");
  });

  it("ignores events that say nothing about delivery", () => {
    expect(deliveryStatusFor("email.sent")).toBeNull();
    expect(deliveryStatusFor("email.opened")).toBeNull();
    expect(deliveryStatusFor("email.clicked")).toBeNull();
  });
});

describe("bounceDetail", () => {
  it("keeps the reason the recipient's server gave", () => {
    expect(
      bounceDetail({
        data: { bounce: { type: "Permanent", subType: "General", message: "Recipient not found" } },
      }),
    ).toEqual({ type: "General", message: "Recipient not found" });
  });

  it("is empty when there is no bounce", () => {
    expect(bounceDetail({ data: {} })).toEqual({ type: null, message: null });
  });
});
