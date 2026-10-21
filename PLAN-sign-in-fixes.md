# PLAN — Sign-in and email link fixes · v1

Status: **awaiting approval (bug fixes, small).**
Source: founder testing notes, 2026-10-21.

---

1. **Change password lands on "Email verified / Enter workspace."** Password-reset emails must send people to `/reset-password` so they can type the new password. Fix the `redirectTo` on the reset request and make `/verified` send a recovery link on to `/reset-password`.
2. **Verifying email after signing up from a split-sheet invite goes to the workspace instead of the split sheet.** The invite address (`/sign/<id>`) must survive signup: save it as the sign-up redirect, and after verifying, `/verified` shows "Continue to your split sheet" instead of "Enter workspace."
   - Founder is retesting with a different email; if it works, this was caused by using an email already signed in.
3. **Homepage top-right Log in just reloads the homepage.** It should open the sign-in form (or go to `/workspace`, which shows sign-in when signed out). Check the pre-launch gate: a signed-out visitor without early access may be bounced back to `/`. If so, the button opens sign-in with the "I have early access" option.

Files: `src/routes/index.tsx` (header button), `src/routes/verified.tsx`, `src/routes/reset-password.tsx`, the sign-up/reset calls in the auth component, `src/routes/sign.$rowId.tsx`.
