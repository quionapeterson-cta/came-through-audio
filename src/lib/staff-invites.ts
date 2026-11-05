/**
 * Staff invitations (founder, 2026-11-05): one email, one identity. A person who already has a member account does not
 * get staff access on that account — an artist's login and a work login stay separate, so nobody ends up deciding their
 * own ticket, refund or split sheet from the dashboard. These are the steps HR and super admins follow, and the same
 * steps the invite email repeats to the person joining.
 */

export const STAFF_EMAIL_RULE =
  "Staff sign in with their own email. If they already have a member account, invite a separate work address — never add staff access to the account they use as an artist.";

export const INVITE_STEPS = [
  "Ask for the email they will use for work. If they already have a member account, it has to be a different address.",
  "Open Admin → Staff and choose Invite Employee.",
  "Pick the role, then the departments they work in. Employees and leads need at least one; HR Admin and Project Manager don't.",
  "Send the invite. The branded email goes from admin@camethroughaudio.com and takes them to our own page to choose a password.",
  "Confirm they appear as Invited, then Active after they sign in. A lead walks their department with them before they answer a customer alone.",
] as const;

export const ACCEPT_STEPS = [
  "Open the link in the invite email.",
  "Choose a password on the page it opens. It is not a sign-up form: your account already exists.",
  "Sign in at /login with this email and the password you just set.",
  "Open Admin → My Queue. Your lead will show you your department's queue and this handbook.",
] as const;

export type InviteTarget = { email: string; memberAccount: boolean; onTeam: boolean };

/** Why this invite can't be sent, or null. Checked on the server, never only in the form. */
export function inviteBlocker(target: InviteTarget): string | null {
  if (target.onTeam) return "That email is already on the team. Edit their access in the list instead.";
  if (target.memberAccount) {
    return "That email already has a member account. Staff need a separate email: ask for their work address, then invite that one. Their member account is left alone.";
  }
  return null;
}

/** True when the address is missing an @ or a dot, so the invite button can say why before the server does. */
export function looksLikeEmail(email: string): boolean {
  return /^\S+@\S+\.\S+$/.test(email.trim());
}
