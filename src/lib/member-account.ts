import type { StaffAccess } from "./departments";

/**
 * Who may touch a member's account, and what "account" means for each team (founder, 2026-11-05): Support fixes the
 * person (names, contact details), Billing fixes the money (the card on file), super admins do both. Nobody edits a
 * member's plan, role or tier by hand — plan state comes from Stripe, and roles come from Admin → Staff.
 */
export type AccountScope = { editProfile: boolean; editPayment: boolean; label: string };

export function accountScope(access: StaffAccess | null | undefined): AccountScope | null {
  if (!access) return null;
  if (access.role === "super_admin") return { editProfile: true, editPayment: true, label: "Super admin" };
  if (access.departments.includes("support")) return { editProfile: true, editPayment: false, label: "Support" };
  if (access.departments.includes("billing") || access.departments.includes("finance")) {
    return { editProfile: false, editPayment: true, label: "Billing" };
  }
  return null;
}

/** Steps a member follows to change the card on file. The same list goes in the renewal email. */
export const CARD_UPDATE_STEPS = [
  "Sign in and open Profile.",
  "Choose Manage billing. Stripe's secure billing page opens for your account.",
  "Choose the card or payment method there, enter the new card and save.",
  "That card is charged at your next renewal. Invoices stay on that same page.",
] as const;

export type ProfileEdit = { stageName?: string | undefined; legalName?: string | undefined };
export type ProfilePatch = { stage_name?: string | null; legal_name?: string | null };

/** Trims the two names a person may be corrected on; a blank clears the field rather than saving spaces. */
export function profilePatch(input: ProfileEdit): ProfilePatch {
  const patch: ProfilePatch = {};
  if (input.stageName !== undefined) patch.stage_name = input.stageName.trim() || null;
  if (input.legalName !== undefined) patch.legal_name = input.legalName.trim() || null;
  return patch;
}

/** Why this edit can't be saved, or null. Names are all Support may change here; PRO and IPI stay the member's call. */
export function profileEditError(input: ProfileEdit): string | null {
  for (const value of [input.stageName, input.legalName]) {
    if ((value ?? "").trim().length > 120) return "Each name is 120 characters at most.";
  }
  if (input.stageName === undefined && input.legalName === undefined) return "Nothing to change.";
  return null;
}
