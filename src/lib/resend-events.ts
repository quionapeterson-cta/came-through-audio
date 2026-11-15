/**
 * Resend delivery events (founder, 2026-11-15).
 *
 * Resend answers a send with "accepted", not "delivered": a bounce arrives minutes later on a webhook. These two pure
 * functions are the whole rule set — what a signed webhook request is, and which status an event means — so the route
 * and the tests share one definition.
 */

/** The status a send row can hold. `accepted` means Resend took it; the rest come from events. */
export const DELIVERY_STATUSES = [
  "accepted",
  "delivered",
  "delayed",
  "bounced",
  "complained",
  "failed",
] as const;
export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];

/** What a person reads beside a send. */
export const DELIVERY_LABELS: Record<DeliveryStatus, string> = {
  accepted: "Sent",
  delivered: "Delivered",
  delayed: "Delayed",
  bounced: "Bounced",
  complained: "Marked spam",
  failed: "Failed",
};

/** Resend's event type → our status; anything else (opened, clicked, sent) changes nothing. */
export function deliveryStatusFor(eventType: string): DeliveryStatus | null {
  switch (eventType) {
    case "email.delivered":
      return "delivered";
    case "email.bounced":
      return "bounced";
    case "email.delivery_delayed":
      return "delayed";
    case "email.complained":
      return "complained";
    case "email.failed":
      return "failed";
    default:
      return null;
  }
}

/** Resend sends a bounce reason worth showing staff: `Permanent`, `Transient` or `General`, plus the server's words. */
export function bounceDetail(event: {
  data?: { bounce?: { type?: string; subType?: string; message?: string } };
}) {
  const bounce = event.data?.bounce;
  if (!bounce) return { type: null as string | null, message: null as string | null };
  const type = bounce.subType || bounce.type || null;
  return { type, message: bounce.message?.trim() || null };
}

const encoder = new TextEncoder();

/** base64 → bytes, for the `whsec_…` secret and the `v1,…` signatures. */
function base64Bytes(value: string) {
  const bin = atob(value);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

/** A constant-time comparison, so a wrong signature can't be found one byte at a time. */
function sameBytes(a: Uint8Array, b: Uint8Array) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i]! ^ b[i]!;
  return diff === 0;
}

/**
 * Checks a Resend webhook the way Svix signs it: HMAC-SHA256 over `id.timestamp.body`, keyed by the base64 part of the
 * `whsec_…` secret. The signature header may carry several `v1,` entries; any one matching is enough. A request older
 * than five minutes is refused, so a captured one can't be replayed later.
 */
export async function verifyResendSignature(input: {
  secret: string;
  id: string | null;
  timestamp: string | null;
  signature: string | null;
  payload: string;
  now?: number;
}): Promise<boolean> {
  const { secret, id, timestamp, signature, payload } = input;
  if (!id || !timestamp || !signature) return false;
  const seconds = Number(timestamp);
  if (!Number.isFinite(seconds)) return false;
  if (Math.abs((input.now ?? Date.now()) / 1000 - seconds) > 300) return false;

  const keyBytes = base64Bytes(secret.replace(/^whsec_/, ""));
  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const expected = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, encoder.encode(`${id}.${timestamp}.${payload}`)),
  );

  return signature
    .split(" ")
    .map((part) => part.trim())
    .filter(Boolean)
    .some((part) => {
      const [version, value] = part.split(",");
      if (version !== "v1" || !value) return false;
      try {
        return sameBytes(base64Bytes(value), expected);
      } catch {
        return false;
      }
    });
}
