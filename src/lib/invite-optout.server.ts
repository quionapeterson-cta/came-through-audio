import { createHmac, timingSafeEqual } from "node:crypto";

/** Signs an email for its "Don't send me invites" link, so nobody can opt out someone else's address. */
export function optOutToken(email: string) {
  const secret = process.env["SESSION_SECRET"];
  if (!secret) throw new Error("Invite opt-out signing is not configured.");
  return createHmac("sha256", secret).update(`invite-stop|${email.trim().toLowerCase()}`).digest("hex").slice(0, 32);
}

export function validOptOutToken(email: string, token: string) {
  const want = Buffer.from(optOutToken(email));
  const got = Buffer.from(token);
  return got.length === want.length && timingSafeEqual(got, want);
}
