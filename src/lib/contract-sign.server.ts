import { createHash, createHmac, randomInt, timingSafeEqual } from "node:crypto";

/**
 * The private part of a company agreement's signing link. An HMAC of the party id, so it is never stored, can't be
 * guessed, and the same link works for the email, a resend and Copy link.
 */
export function signLinkToken(partyId: string) {
  const secret = process.env["SESSION_SECRET"];
  if (!secret) throw new Error("Contract signing links are not configured.");
  return createHmac("sha256", secret).update(`contract-sign|${partyId}`).digest("hex").slice(0, 40);
}

export function validSignLinkToken(partyId: string, token: string) {
  const want = Buffer.from(signLinkToken(partyId));
  const got = Buffer.from(token);
  return got.length === want.length && timingSafeEqual(got, want);
}

export const signLink = (origin: string, partyId: string) => `${origin}/contract/${partyId}?t=${signLinkToken(partyId)}`;

export const newSignCode = () => String(randomInt(0, 1_000_000)).padStart(6, "0");

export const hashSignCode = (partyId: string, code: string) =>
  createHash("sha256").update(`${process.env["SESSION_SECRET"] ?? "cta"}|${partyId}|${code}`).digest("hex");

/** "j•••@example.com", so the page can say where the code went without showing the whole address. */
export const maskEmail = (email: string) => email.replace(/^(.)[^@]*/, "$1•••");
